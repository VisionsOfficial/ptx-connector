import { APIError, APIErrorOptions } from './APIError.dsp';

export class Error400 extends APIError {
    code = 400;
    reason: any[] = [];

    constructor(options: APIErrorOptions & { reason?: any[] }) {
        super({ ...options, message: options.message || 'Bad Request' });
        this.reason = options.reason || [];
    }

    toJSON() {
        const base = super.toJSON();
        return {
            ...base,
            reason: this.reason,
        };
    }
}
