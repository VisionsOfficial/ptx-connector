import axios from 'axios';
import { urlChecker } from '../../utils/urlChecker';
import { checkConnectorProxy } from './proxy';
import { getProxy } from '../loaders/configuration';

export const consumerImport = async (
    endpoint: string,
    dataExchangeId: string,
    data: any,
    apiResponseRepresentation?: any,
    mimeType?: string,
    chunkIndex?: number,
    totalChunks?: number
) => {
    const chunkHeaders: Record<string, string> =
        chunkIndex !== undefined && totalChunks !== undefined
            ? {
                  'x-chunk-index': String(chunkIndex),
                  'x-chunk-total': String(totalChunks),
              }
            : {};

    if (!mimeType || mimeType === 'application/json') {
        return axios.post(
            urlChecker(endpoint, 'consumer/import'),
            {
                providerDataExchange: dataExchangeId,
                data,
                apiResponseRepresentation,
            },
            {
                headers: {
                    'x-provider-data-exchange': dataExchangeId,
                    'x-api-response-representation': apiResponseRepresentation,
                    'Content-Type': 'application/json',
                    ...chunkHeaders,
                },
                ...(await checkConnectorProxy({
                    dataExchangeId,
                    endpoint: endpoint,
                    configProxy: getProxy(),
                })),
            }
        );
    } else {
        return axios.post(urlChecker(endpoint, 'consumer/import'), data, {
            headers: {
                'x-provider-data-exchange': dataExchangeId,
                'x-api-response-representation': apiResponseRepresentation,
                'content-Type': mimeType,
                ...chunkHeaders,
            },
            maxBodyLength: Infinity,
            ...(await checkConnectorProxy({
                dataExchangeId,
                endpoint: endpoint,
                configProxy: getProxy(),
            })),
        });
    }
};
