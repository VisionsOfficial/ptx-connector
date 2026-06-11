import { Request, Response, NextFunction } from 'express';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { DataExchange, IDataExchange } from '../../../utils/types/dataExchange';
import { handle } from '../../../libs/loaders/handler';
import { providerExport } from '../../../libs/third-party/provider';
import { Logger } from '../../../libs/loggers';
import { DataExchangeStatusEnum } from '../../../utils/enums/dataExchangeStatusEnum';
import {
    consumerImportService,
    triggerBilateralFlow,
    triggerEcosystemFlow,
} from '../../../services/public/v1/consumer.public.service';
import { ProviderExportService } from '../../../services/public/v1/provider.public.service';
import { getEndpoint } from '../../../libs/loaders/configuration';
import { ExchangeError } from '../../../libs/errors/exchangeError';
import axios from 'axios';
import { verifyPayloadDefault } from '../../../utils/validation/payloadValidation';
import { ObjectId } from 'mongodb';

/**
 * trigger the data exchange between provider and consumer in a bilateral or ecosystem contract
 * @param req
 * @param res
 * @param next
 */
export const consumerExchange = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        //req.body
        const {
            resources,
            contract,
            resourceId,
            purposeId,
            providerParams,
            consumerParams,
            purposes,
            serviceChainId,
            serviceChainParams,
        } = req.body;

        //Create a data Exchange
        let dataExchange: IDataExchange;
        let providerEndpoint: string;

        // ecosystem contract
        if (contract.includes('contracts')) {
            const {
                dataExchange: ecosystemDataExchange,
                providerEndpoint: endpoint,
            } = await triggerEcosystemFlow({
                purposeId,
                resourceId,
                contract,
                resources,
                purposes,
                providerParams,
                consumerParams,
                serviceChainId,
                serviceChainParams,
            });

            dataExchange = ecosystemDataExchange;
            if (endpoint) providerEndpoint = endpoint;
        } else {
            const {
                dataExchange: bilateralDataExchange,
                providerEndpoint: endpoint,
            } = await triggerBilateralFlow({
                contract,
                resources,
                purposes,
                providerParams,
                consumerParams,
                serviceChainId,
                serviceChainParams,
            });

            dataExchange = bilateralDataExchange;
            if (endpoint) providerEndpoint = endpoint;
        }

        if (!dataExchange) {
            throw new ExchangeError(
                'Error when trying to initiate te exchange.',
                'triggerEcosystemFlow',
                500
            );
        }

        if (serviceChainId && dataExchange.serviceChain.services.length > 0) {
            for (const service of dataExchange.serviceChain.services) {
                // Get the infrastructure service information
                const [participantResponse] = await handle(
                    axios.get(service.participant)
                );

                // Find the participant endpoint
                const participantEndpoint =
                    participantResponse.dataspaceEndpoint;

                // Sync the data exchange with the infrastructure
                if (
                    participantEndpoint !== (await getEndpoint())
                )
                    await dataExchange.syncWithInfrastructure(
                        participantEndpoint,
                        service.service
                    );

                if (service.pre && service.pre.length > 0) {
                    for (const prechain of service.pre) {
                        for (const element of prechain) {
                            const [participantResponse] = await handle(
                                axios.get(element.participant)
                            );

                            // Find the participant endpoint
                            const participantEndpoint =
                                participantResponse.dataspaceEndpoint;

                            if (
                                participantEndpoint !==
                                    dataExchange.consumerEndpoint &&
                                participantEndpoint !== (await getEndpoint())
                            ) {
                                // Sync the data exchange with the infrastructure
                                await dataExchange.syncWithInfrastructure(
                                    participantEndpoint,
                                    element.service
                                );
                            }
                        }
                    }
                }
            }
        } else {
            // Create the data exchange at the provider
            await dataExchange.createDataExchangeToOtherParticipant();
        }

        //Trigger provider.ts endpoint exchange
        if (dataExchange.providerEndpoint === (await getEndpoint())) {
            const updatedDataExchange = await DataExchange.findOne({
                exchangeIdentifier: dataExchange.exchangeIdentifier
            });

            await ProviderExportService(
                updatedDataExchange.exchangeIdentifier
            );
        } else {
            await handle(
                providerExport(providerEndpoint, dataExchange.exchangeIdentifier)
            );
        }
        const startTime = Date.now();
        const parsedExchangeTimeout = Number(process.env.EXCHANGE_TIMEOUT);
        const timeoutSeconds =
            Number.isFinite(parsedExchangeTimeout) && parsedExchangeTimeout > 0
                ? parsedExchangeTimeout
                : 30;
        const timeout = timeoutSeconds * 1000;
        let message: string;
        let success = false;
        // return code 200 everything is ok
        while (dataExchange.status === 'PENDING') {
            if (Date.now() - startTime > timeout) {
                message = `${
                    parseInt(process.env.EXCHANGE_TIMEOUT) || 30
                } sec Timeout reached.`;

                await dataExchange.updateStatus(
                    DataExchangeStatusEnum.EXCHANGE_TIMEOUT,
                    new Error(message),
                    'consumerExchangeController',
                );
                break;
            }
            dataExchange = await DataExchange.findById(dataExchange._id);
            if (dataExchange.status === 'IMPORT_SUCCESS') {
                success = true;
            }
        }

        return restfulResponse(res, 200, { success, dataExchange, message });
    } catch (e) {
        Logger.error({
            message: e.message,
            location: e.stack,
        });

        return restfulResponse(res, 500, {
            success: false,
            message: e.message,
        });
    }
};

/**
 * import the data from the provider into the consumer software representation
 * @param req
 * @param res
 * @param next
 */
export const consumerImport = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        let { data, apiResponseRepresentation, exchangeIdentifier } =
            req.body;

        if (!exchangeIdentifier) {
            exchangeIdentifier = req.headers['x-provider-data-exchange'];
        }

        if (!data) {
            data = req.body;
        }

        if (!apiResponseRepresentation) {
            apiResponseRepresentation =
                req.headers['x-api-response-representation'];
        }

        if (!req.headers['content-type'].includes('application/json')) {
            await verifyPayloadDefault(
                { exchangeIdentifier, data },
                req.headers
            );
        }

        await consumerImportService({
            exchangeIdentifier,
            data,
            apiResponseRepresentation,
        });

        return restfulResponse(res, 200, { success: true });
    } catch (e) {
        Logger.error({
            message: e.message,
            location: e.stack,
        });

        const dataExchange = await DataExchange.findOne({
            exchangeIdentifier: req.body.exchangeIdentifier
        });

        await dataExchange?.updateStatus(
            DataExchangeStatusEnum.CONSUMER_IMPORT_ERROR,
            e,
            'consumerImportController',
        );

        return restfulResponse(res, 500, { success: false });
    }
};

export const authAPIKeycheck = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    return restfulResponse(res, 200, {
        success: true,
        message: 'API key authentication successful',
    });
};
