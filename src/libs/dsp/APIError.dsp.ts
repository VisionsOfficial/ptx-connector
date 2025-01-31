import { Request, Response } from 'express';

export class APIError extends Error {
    isAPIError = true;
    req: Request;
    res: Response;
    code: number;

    constructor(options: APIErrorOptions) {
        super(options.message);
        this.req = options.req;
        this.res = options.res;
        this.code = options.code || 500;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
        };
    }
}

export type APIErrorOptions = {
    req: Request;
    res: Response;
    code?: number;
    message?: string;
};
