import { APIError, APIErrorOptions } from './APIError.dsp';

export class RouteNotFoundError extends APIError {
    isRouteNotFoundError = true;

    constructor(options: APIErrorOptions) {
        super({
            code: 404,
            message: 'Route not found',
            ...options,
        });
    }
}