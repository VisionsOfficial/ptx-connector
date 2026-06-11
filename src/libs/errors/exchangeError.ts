/**
 * Custom error class for handling errors in the exchange process.
 */
export class ExchangeError extends Error {
    location: string;
    stack: string;
    host: string;
    isExchangeError: boolean;
    statusCode: number;

    constructor(message = '', location: string = null, statusCode = 500, stack: string = null, host: string = null) {
        super(message);
        this.isExchangeError = true;
        this.location = location;
        this.statusCode = statusCode;
        this.stack = stack;
        this.host = host;
    }
}
