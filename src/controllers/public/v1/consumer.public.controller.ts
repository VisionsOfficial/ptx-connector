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
import { getEndpoint, getProxy } from '../../../libs/loaders/configuration';
import { ExchangeError } from '../../../libs/errors/exchangeError';
import axios from 'axios';
import { verifyPayloadDefault } from '../../../utils/validation/payloadValidation';
import { ObjectId } from 'mongodb';
import { checkConnectorProxy } from '../../../libs/third-party/proxy';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Track temp file paths per dataExchange: Map<exchangeId, { filePath, receivedChunks, totalChunks, contentType }>
const chunkFileStore = new Map<
    string,
    {
        filePath: string;
        receivedChunks: Set<number>;
        totalChunks: number;
        contentType: string;
    }
>();

// In-memory chunk store: Map<dataExchangeId, Map<chunkIndex, Buffer>>
const chunkStore = new Map<string, Map<number, Buffer>>();

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
                    axios.get(
                        service.participant,
                        await checkConnectorProxy({
                            configProxy: getProxy(),
                        })
                    )
                );

                // Find the participant endpoint
                const participantEndpoint =
                    participantResponse.dataspaceEndpoint;

                // Sync the data exchange with the infrastructure
                if (
                    participantEndpoint !== (await getEndpoint()) &&
                    participantEndpoint !== dataExchange?.consumerEndpoint &&
                    participantEndpoint !== dataExchange?.providerEndpoint
                )
                    await dataExchange.syncWithInfrastructure(
                        participantEndpoint
                    );

                if (service.pre && service.pre.length > 0) {
                    for (const prechain of service.pre) {
                        for (const element of prechain) {
                            const [participantResponse] = await handle(
                                axios.get(
                                    element.participant,
                                    await checkConnectorProxy({
                                        configProxy: getProxy(),
                                    })
                                )
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
                                    participantEndpoint
                                );
                            }
                        }
                    }
                }
            }
        }

        //default protocol and use provider export service
        if (dataExchange.consumerEndpoint) {
            const updatedDataExchange = await DataExchange.findById(
                dataExchange._id
            );

            await ProviderExportService(
                updatedDataExchange.consumerDataExchange
            );
        }
        //default protocol and request provider
        else {
            if (providerEndpoint === (await getEndpoint())) {
                Logger.error({
                    message: "Can't make request to itself.",
                    location: 'consumerExchange',
                });
                throw new ExchangeError(
                    "Can't make request to itself.",
                    'triggerEcosystemFlow',
                    500
                );
            }
            // Fire and forget - don't wait for provider response
            // The status polling loop below will handle completion
            providerExport(providerEndpoint, dataExchange._id.toString()).catch(
                (err) => {
                    Logger.error({
                        message: `Provider export failed: ${err.message}`,
                        location: 'consumerExchange - providerExport',
                    });
                }
            );
        }

        const startTime = Date.now();
        const timeout =
            (process.env.EXCHANGE_TIMEOUT
                ? parseInt(process.env.EXCHANGE_TIMEOUT)
                : 30) * 1000;
        let message: string;
        let success = false;
        // return code 200 everything is ok
        while (
            dataExchange.status === 'PENDING' ||
            dataExchange.status === 'TRANSFER_STARTED'
        ) {
            if (Date.now() - startTime > timeout) {
                message = `${
                    process.env.EXCHANGE_TIMEOUT
                        ? parseInt(process.env.EXCHANGE_TIMEOUT)
                        : 30
                } sec Timeout reached.`;
                break;
            }
            dataExchange = await DataExchange.findById(dataExchange._id);
            if (dataExchange.status === 'IMPORT_SUCCESS') {
                success = true;
            }
            await new Promise((resolve) => setTimeout(resolve, 500)); // Add 500ms delay between checks
        }

        //Publisher
        // amqpPublisher(dataExchange);
        // kafkaPublisher(dataExchange);
        // websocketPublisher(dataExchange);

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
        let { providerDataExchange, data, apiResponseRepresentation } =
            req.body;

        if (!providerDataExchange) {
            providerDataExchange = req.headers['x-provider-data-exchange'];
        }

        if (!data) {
            data = req.body;
        }

        if (!apiResponseRepresentation) {
            apiResponseRepresentation =
                req.headers['x-api-response-representation'];
        }

        // --- Chunk reassembly (disk-based, no RAM accumulation) ---
        const chunkIndexHeader = req.headers['x-chunk-index'];
        const chunkTotalHeader = req.headers['x-chunk-total'];

        if (chunkIndexHeader !== undefined && chunkTotalHeader !== undefined) {
            const chunkIndex = parseInt(chunkIndexHeader as string, 10);
            const totalChunks = parseInt(chunkTotalHeader as string, 10);
            const exchangeId = providerDataExchange as string;
            const contentType = (req.headers['content-type'] as string) ?? 'application/octet-stream';

            // Convert incoming data to Buffer
            const chunkBuffer: Buffer = Buffer.isBuffer(data)
                ? data
                : Buffer.isBuffer(req.body)
                ? req.body
                : Buffer.from(
                      typeof data === 'string' ? data : JSON.stringify(data),
                      'utf-8'
                  );

            // Init temp file for this exchange
            if (!chunkFileStore.has(exchangeId)) {
                const filePath = path.join(os.tmpdir(), `ptc-chunk-${exchangeId}`);
                // Pre-allocate empty file
                fs.writeFileSync(filePath, '');
                chunkFileStore.set(exchangeId, {
                    filePath,
                    receivedChunks: new Set(),
                    totalChunks,
                    contentType,
                });
            }

            const store = chunkFileStore.get(exchangeId);

            // Write chunk at its correct byte offset
            const offset = chunkIndex * (50 * 1024 * 1024); // 50 MB chunks
            const fd = fs.openSync(store.filePath, 'r+');
            // Ensure file is large enough
            const currentSize = fs.fstatSync(fd).size;
            if (currentSize < offset) {
                // Extend with zeros up to offset
                fs.ftruncateSync(fd, offset);
            }
            const buf = Buffer.alloc(chunkBuffer.length);
            chunkBuffer.copy(buf);
            fs.writeSync(fd, buf, 0, buf.length, offset);
            fs.closeSync(fd);

            store.receivedChunks.add(chunkIndex);

            Logger.info({
                message: `Received chunk ${chunkIndex + 1}/${totalChunks} for dataExchange ${exchangeId} (${chunkBuffer.length} bytes) → written to disk at offset ${offset}`,
                location: 'consumerImport',
            });

            // Not all chunks received yet
            if (store.receivedChunks.size < totalChunks) {
                return restfulResponse(res, 200, {
                    success: true,
                    message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
                });
            }

            // All chunks received — validate then stream to service
            const { filePath } = store;
            const totalSize = fs.statSync(filePath).size;
            chunkFileStore.delete(exchangeId);

            Logger.info({
                message: `All ${totalChunks} chunks written to disk for dataExchange ${exchangeId} (total: ${totalSize} bytes) — streaming to service`,
                location: 'consumerImport',
            });

            // Validate checksum/mimetype/size from the file on disk (no stream consumed)
            if (!contentType.includes('application/json')) {
                await verifyPayloadDefault(
                    {
                        dataExchange: providerDataExchange,
                        data: null,
                        filePath,
                    },
                    {
                        ...req.headers,
                        'content-length': String(totalSize),
                    }
                );
            }

            // Create the stream AFTER validation so it's not consumed twice
            const fileStream = fs.createReadStream(filePath);

            // Cleanup temp file after stream ends
            fileStream.on('close', () => {
                fs.unlink(filePath, (err) => {
                    if (err) Logger.error({ message: `Failed to delete temp file ${filePath}: ${err.message}`, location: 'consumerImport' });
                });
            });

            await consumerImportService({
                providerDataExchange,
                data: fileStream,
                apiResponseRepresentation,
                contentLength: totalSize,
                mimeType: contentType,
            });

            return restfulResponse(res, 200, { success: true });
        }
        // --- End chunk reassembly ---

        if (!req.headers['content-type'].includes('application/json')) {
            await verifyPayloadDefault(
                { dataExchange: providerDataExchange, data },
                req.headers
            );
        }

        await consumerImportService({
            providerDataExchange,
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
            $or: [
                { _id: new ObjectId(req.body.providerDataExchange) },
                { _id: req.body.providerDataExchange },
                { providerDataExchange: req.body.providerDataExchange },
            ],
        });

        await dataExchange?.updateStatus(
            DataExchangeStatusEnum.CONSUMER_IMPORT_ERROR,
            e.message,
            await getEndpoint()
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
