import { DataExchange, IDataExchange } from '../../../utils/types/dataExchange';
import { handle } from '../../../libs/loaders/handler';
import { getContract } from '../../../libs/third-party/contract';
import { selfDescriptionProcessor } from '../../../utils/selfDescriptionProcessor';
import {
    pepLeftOperandsVerification,
    pepVerification,
} from '../../../utils/pepVerification';
import { getCatalogData } from '../../../libs/third-party/catalog';
import { consumerError } from '../../../utils/consumerError';
import { Regexes } from '../../../utils/regexes';
import { getRepresentation } from '../../../libs/loaders/representationFetcher';
import { DataExchangeStatusEnum } from '../../../utils/enums/dataExchangeStatusEnum';
import { consumerImport } from '../../../libs/third-party/consumer';
import { processLeftOperands } from '../../../utils/leftOperandProcessor';
import { Logger } from '../../../libs/loggers';
import { triggerInfrastructureFlowService } from './infrastructure.public.service';
import { checksum } from '../../../functions/checksum.function';
import { getEndpoint } from '../../../libs/loaders/configuration';
import { getCredentialByIdService } from '../../private/v1/credential.private.service';
import postgres from 'postgres';
import { exec } from 'node:child_process';

interface IProviderExportServiceOptions {
    infrastructureConfigurationId?: string;
}

/**
 * Provider Export Service
 * @param consumerDataExchange
 * @param options
 * @constructor
 */
export const ProviderExportService = async (
    consumerDataExchange: string,
    options?: IProviderExportServiceOptions
) => {
    //Get the data exchange
    const dataExchange = await DataExchange.findOne({
        consumerDataExchange: consumerDataExchange,
    });

    try {
        // Get the contract
        const [contractResp] = await handle(getContract(dataExchange.contract));

        const useServiceChain =
            dataExchange?.serviceChain &&
            dataExchange?.serviceChain.services.length > 0;

        const serviceOffering = selfDescriptionProcessor(
            dataExchange.resources[0].serviceOffering,
            dataExchange,
            dataExchange.contract,
            contractResp
        );

        //PEP
        const {
            success: pep,
            contractID,
            resourceID,
        } = await pepVerification({
            targetResource: serviceOffering,
            referenceURL: dataExchange.contract,
        });

        if (pep) {
            for (const resource of dataExchange.resources) {
                const resourceSD = resource.resource;

                // B to B exchange
                if (
                    dataExchange._id &&
                    dataExchange.consumerEndpoint &&
                    resourceSD
                ) {
                    //Call the catalog endpoint
                    const [endpointData] = await handle(
                        getCatalogData(resourceSD)
                    );

                    if (!endpointData?.representation) {
                        await consumerError(
                            dataExchange.consumerEndpoint,
                            dataExchange._id.toString(),
                            'No representation found'
                        );
                    }

                    let data;
                    let contentLength = 0;
                    if (
                        !endpointData?.representation?.url.match(
                            Regexes.urlParams
                        )
                    ) {
                        switch (endpointData?.representation?.type) {
                            case 'REST': {
                                const [getProviderData, responseHeaders] =
                                    await handle(
                                        getRepresentation({
                                            resource: resourceSD,
                                            method: endpointData?.representation
                                                ?.method,
                                            endpoint:
                                                endpointData?.representation
                                                    ?.url,
                                            credential:
                                                endpointData?.representation
                                                    ?.credential,
                                            representationQueryParams:
                                                endpointData?.representation
                                                    ?.queryParams,
                                            proxy: endpointData?.representation
                                                ?.proxy,
                                            dataExchange,
                                            mimeType:
                                                endpointData?.representation
                                                    ?.mimeType,
                                        })
                                    );

                                data = getProviderData;

                                if (!useServiceChain) {
                                    contentLength =
                                        responseHeaders['content-length'];

                                    if (!responseHeaders['content-file-name']) {
                                        const parsedUrl = new URL(
                                            endpointData?.representation?.url
                                        );
                                        const [, bucketFromUrl, ...keyParts] =
                                            parsedUrl.pathname.split('/');
                                        responseHeaders['content-file-name'] =
                                            keyParts.join('/');
                                    }

                                    if (
                                        !endpointData?.representation?.mimeType
                                    ) {
                                        Logger.info({
                                            message: `No mimetype defined for ${resourceSD} in catalog, defaulting to application/json`,
                                            location: 'ProviderExportService',
                                        });
                                    }

                                    //TODO: commented out mimetype validation for now
                                    // if (
                                    //     endpointData?.representation
                                    //         ?.mimeType &&
                                    //     !responseHeaders[
                                    //         'content-type'
                                    //     ]?.includes(
                                    //         endpointData?.representation
                                    //             ?.mimeType
                                    //     )
                                    // ) {
                                    //     throw new Error(
                                    //         `Mimetype validation failed for ${resourceSD}, expected: ${endpointData?.representation?.mimeType}, got: ${responseHeaders['content-type']} from representation url`
                                    //     );
                                    // }

                                    if (
                                        !endpointData?.representation?.mimeType?.includes(
                                            'application/json'
                                        )
                                    ) {
                                        await dataExchange.updateProviderData({
                                            mimeType:
                                                endpointData?.representation
                                                    ?.mimeType,
                                            checksum: checksum(data),
                                            size: responseHeaders[
                                                'content-length'
                                            ],
                                            fileName:
                                                responseHeaders[
                                                    'content-file-name'
                                                ],
                                        });
                                    }
                                }

                                break;
                            }
                            case 'POSTGRESQL': {
                                let cred;

                                const sqlConfig =
                                    endpointData?.representation?.sql;

                                if (!sqlConfig.query) {
                                    const message = `No SQL query defined for ${resourceSD} in catalog`;
                                    Logger.error({
                                        message,
                                        location: 'ProviderExportService',
                                    });
                                    throw new Error(message);
                                }

                                if (!sqlConfig?.url) {
                                    const message = `No URL defined for ${resourceSD} in catalog`;
                                    Logger.error({
                                        message,
                                        location: 'ProviderExportService',
                                    });
                                    throw new Error(message);
                                }

                                if (sqlConfig?.credential) {
                                    cred = await getCredentialByIdService(
                                        sqlConfig?.credential
                                    );
                                }

                                try {
                                    const sql = postgres(sqlConfig?.url, {
                                        host: sqlConfig?.host,
                                        port: sqlConfig?.port,
                                        database: sqlConfig?.database,
                                        username: cred?.key,
                                        password: cred?.value,
                                    });

                                    data = await sql.unsafe(sqlConfig?.query);
                                    contentLength = data.length;

                                    await sql.end();
                                } catch (e) {
                                    Logger.error({
                                        message: `Error executing SQL for ${resourceSD}: ${e.message}`,
                                        location: 'ProviderExportService',
                                    });

                                    throw e;
                                }

                                break;
                            }
                            case 'FTP': {
                                try {
                                    // FTP implementation placeholder
                                    Logger.info({
                                        message: `FTP representation type selected for ${resourceSD}, but not implemented.`,
                                        location: 'ProviderExportService',
                                    });

                                    const ftpConfig =
                                        endpointData?.representation?.ftp;

                                    if (!ftpConfig.command) {
                                        new Error(
                                            'Aucune commande définie dans ftpConfig.'
                                        );
                                        return;
                                    }
                                    for (const purpose of dataExchange.purposes) {
                                        const [catalogSoftwareResource] =
                                            await handle(
                                                getCatalogData(purpose.resource)
                                            );

                                        if (
                                            catalogSoftwareResource
                                                .representation.type !== 'FTP'
                                        ) {
                                            Logger.warn({
                                                message: `Skipping FTP command execution for purpose ${purpose.resource} with representation type ${catalogSoftwareResource.representation.type}`,
                                                location:
                                                    'ProviderExportService',
                                            });
                                            continue;
                                        }

                                        const serviceRepresentation =
                                            catalogSoftwareResource
                                                ?.representation.ftp;

                                        let command = ftpConfig.command;

                                        const matches =
                                            command.match(/{\w+(\.\w+)?}/g);
                                        if (matches) {
                                            matches.forEach((match: string) => {
                                                const key = match.replace(
                                                    /[{}]/g,
                                                    ''
                                                );
                                                let value;
                                                if (
                                                    key.startsWith('service.')
                                                ) {
                                                    const subKey =
                                                        key.split('.')[1];
                                                    value =
                                                        serviceRepresentation[
                                                            subKey
                                                        ];
                                                } else {
                                                    value = ftpConfig[key];
                                                }
                                                if (value !== undefined) {
                                                    command = command.replace(
                                                        match,
                                                        value
                                                    );
                                                }
                                            });
                                        }

                                        await dataExchange?.updateStatus(
                                            DataExchangeStatusEnum.TRANSFER_STARTED
                                        );

                                        await new Promise<void>(
                                            (resolve, reject) => {
                                                exec(
                                                    command,
                                                    async (
                                                        error,
                                                        stdout,
                                                        stderr
                                                    ) => {
                                                        if (error) {
                                                            Logger.error({
                                                                message: `Error executing FTP command for ${resourceSD}: ${error.message}`,
                                                                location:
                                                                    'ProviderExportService',
                                                            });
                                                            reject(error);
                                                            return;
                                                        }

                                                        if (stderr) {
                                                            Logger.error({
                                                                message: `FTP command stderr for ${resourceSD}: ${stderr}`,
                                                                location:
                                                                    'ProviderExportService',
                                                            });
                                                        }

                                                        if (stdout) {
                                                            Logger.info({
                                                                message: `FTP command stdout for ${resourceSD}: ${stdout}`,
                                                                location:
                                                                    'ProviderExportService',
                                                            });

                                                            data = stdout;
                                                            await dataExchange?.updateStatus(
                                                                DataExchangeStatusEnum.TRANSFER_COMPLETED,
                                                                data
                                                            );
                                                        }
                                                        resolve();
                                                    }
                                                );
                                            }
                                        );
                                    }

                                    break;
                                } catch (e) {
                                    Logger.error({
                                        message: `Error retrieving FTP data for ${resourceSD}: ${e.message}`,
                                        location: 'ProviderExportService',
                                    });

                                    throw e;
                                }
                                break;
                            }
                            // case 'KAFKA': {
                            //     try {
                            //         // Kafka implementation placeholder
                            //         Logger.info( {
                            //             message: `KAFKA representation type selected for ${resourceSD}, but not implemented.`,
                            //             location: 'ProviderExportService',
                            //         });
                            //
                            //         const kafkaConfig =
                            //             endpointData?.representation?.kafka;
                            //
                            //         if (!kafkaConfig.brokers) {
                            //             let message = `No kafka brokers defined for ${resourceSD} in catalog`
                            //             Logger.error({
                            //                 message: message,
                            //                 location: 'ProviderExportService',
                            //             });
                            //            throw new Error(message)
                            //         }
                            //
                            //         if (!kafkaConfig?.topic) {
                            //             let message = `No kafka topic defined for ${resourceSD} in catalog`
                            //             Logger.error({
                            //                 message: message,
                            //                 location: 'ProviderExportService',
                            //             });
                            //             throw new Error(message)
                            //         }
                            //
                            //         data = kafkaConfig;
                            //
                            //         await kafkaPublisher(dataExchange);
                            //
                            //     } catch (e) {
                            //         Logger.error({
                            //             message: `Error retrieving KAFKA data for ${resourceSD}: ${e.message}`,
                            //             location: 'ProviderExportService',
                            //         });
                            //
                            //         throw e;
                            //     }
                            //     break;
                            // }
                            // case 'WEBSOCKET': {
                            //     try {
                            //         // WEBSOCKET implementation placeholder
                            //         Logger.info( {
                            //             message: `WEBSOCKET representation type selected for ${resourceSD}, but not implemented.`,
                            //             location: 'ProviderExportService',
                            //         });
                            //
                            //         const websocketConfig =
                            //             endpointData?.representation?.websocket;
                            //
                            //         if (!websocketConfig.url) {
                            //             let message = `No websocket url defined for ${resourceSD} in catalog`
                            //             Logger.error({
                            //                 message: message,
                            //                 location: 'ProviderExportService',
                            //             });
                            //            throw new Error(message)
                            //         }
                            //
                            //         data = websocketConfig;
                            //         await websocketPublisher(dataExchange);
                            //
                            //     } catch (e) {
                            //         Logger.error({
                            //             message: `Error retrieving WEBSOCKET data for ${resourceSD}: ${e.message}`,
                            //             location: 'ProviderExportService',
                            //         });
                            //
                            //         throw e;
                            //     }
                            //     break;
                            // }
                            // case 'AMQP': {
                            //     try {
                            //         // AMPQP implementation placeholder
                            //         Logger.info( {
                            //             message: `AMPQP representation type selected for ${resourceSD}, but not implemented.`,
                            //             location: 'ProviderExportService',
                            //         });
                            //
                            //         const amqpConfig =
                            //             endpointData?.representation?.ampqp;
                            //
                            //         if (!amqpConfig.url) {
                            //             let message = `No ampqp url defined for ${resourceSD} in catalog`
                            //             Logger.error({
                            //                 message: message,
                            //                 location: 'ProviderExportService',
                            //             });
                            //            throw new Error(message)
                            //         }
                            //
                            //         data = amqpConfig;
                            //         await amqpPublisher(dataExchange);
                            //
                            //     } catch (e) {
                            //         Logger.error({
                            //             message: `Error retrieving AMPQP data for ${resourceSD}: ${e.message}`,
                            //             location: 'ProviderExportService',
                            //         });
                            //
                            //         return e;
                            //     }
                            //     break;
                            // }
                            default: {
                                new Error('Representation type not supported');
                            }
                        }
                    }

                    if (
                        dataExchange?.serviceChain &&
                        dataExchange?.serviceChain.services.length > 0
                    ) {
                        if (
                            endpointData?.representation?.mimeType &&
                            !endpointData?.representation?.mimeType?.includes(
                                'application/json'
                            ) &&
                            !endpointData?.representation?.mimeType?.includes(
                                'text/plain'
                            )
                        ) {
                            throw new Error(
                                `Mimetype validation failed for service chain, only 'application/json' or 'text/plain' supported, got: ${endpointData?.representation?.mimeType} for ${resourceSD}`
                            );
                        }

                        //Trigger the infrastructure flow
                        await triggerInfrastructureFlowService(
                            dataExchange.serviceChain,
                            dataExchange,
                            data
                        );
                    } else {
                        //Trigger the generic flow
                        await triggerGenericFlow({
                            dataExchange,
                            data,
                            serviceOffering,
                            contractID,
                            resourceID,
                            endpointData,
                        });
                    }
                    Logger.info({
                        message: `Successfully retrieve data from ${resourceSD} with size of ${contentLength}Bytes`,
                        location: 'ProviderExportService',
                    });
                }
            }

            return true;
        } else {
            return new Error('PEP verification failed');
        }
    } catch (e) {
        Logger.error({
            message: e.message,
            location: e.stack,
        });

        await dataExchange?.updateStatus(
            DataExchangeStatusEnum.PROVIDER_EXPORT_ERROR,
            e.message,
            await getEndpoint()
        );
    }
};

/**
 * Trigger the generic flow to send data to consumer endpoint
 * @param props
 */
const triggerGenericFlow = async (props: {
    dataExchange: IDataExchange;
    data: any;
    serviceOffering: string;
    contractID: string;
    resourceID: string;
    endpointData?: any;
}) => {
    try {
        //Send the data to generic endpoint
        const [consumerImportRes] = await handle(
            consumerImport(
                props.dataExchange.consumerEndpoint,
                props.dataExchange._id.toString(),
                props.data,
                props.endpointData?.apiResponseRepresentation,
                props.dataExchange.providerData.mimetype
            )
        );

        if (consumerImportRes) {
            const names = await pepLeftOperandsVerification({
                targetResource: props.serviceOffering,
            });
            await processLeftOperands(
                names,
                props.contractID,
                props.resourceID
            );
        }
    } catch (e) {
        Logger.error({
            message: e.message,
            location: e.stack,
        });
    }
};
