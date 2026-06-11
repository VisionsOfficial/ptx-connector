import { AxiosResponse } from 'axios';
import {ExchangeError} from "../errors/exchangeError";

/**
 * Handles the promise returned by an API call, extracting data and headers on success, and throwing an ExchangeError on failure.
 * @param promise
 */
export const handle = (promise: any) => {
    return promise
        .then((data: AxiosResponse) => {
            return [data?.data ?? data, data?.headers];
        })
        .catch((error: any) => {
            throw new ExchangeError(
                error?.message,
                "Handler",
                error?.response?.statusCode ?? error?.response?.status,
                error?.response?.data,
                error?.response?.config?.url
            );
        });
};
