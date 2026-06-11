import axios from 'axios';
import { urlChecker } from '../../utils/urlChecker';

export const consumerImport = async (
    endpoint: string,
    data: any,
    apiResponseRepresentation?: any,
    mimeType?: string,
    exchangeIdentifier?: string
) => {
    if (!mimeType || mimeType === 'application/json') {
        return axios.post(
            urlChecker(endpoint, 'consumer/import'),
            {
                exchangeIdentifier,
                data,
                apiResponseRepresentation,
            },
            {
                headers: {
                    'x-provider-data-exchange': exchangeIdentifier,
                    'x-api-response-representation': apiResponseRepresentation,
                    'Content-Type': 'application/json',
                },
            }
        );
    } else {
        return axios.post(urlChecker(endpoint, 'consumer/import'), data, {
            headers: {
                'x-provider-data-exchange': exchangeIdentifier,
                'x-api-response-representation': apiResponseRepresentation,
                'content-Type': mimeType,
            },
            maxBodyLength: Infinity,
        });
    }
};
