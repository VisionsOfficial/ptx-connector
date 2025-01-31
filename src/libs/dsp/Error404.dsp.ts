import { APIError, APIErrorOptions } from './APIError.dsp';

export class Error404 extends APIError {
    code = 404;

    constructor(options: APIErrorOptions) {
        super({ ...options, message: options.message || 'Not Found' });
    }
}
