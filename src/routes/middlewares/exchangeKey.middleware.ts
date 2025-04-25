import { NextFunction, Request, Response } from 'express';
import { DataExchange } from '../../utils/types/dataExchange';

/**
 * Checks the validation pipeline of express-validator
 */
export const exchangeKey = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.header('ptx-data-exchange-key')) {
        return res.status(401).json({ message: 'Missing exchange key' });
    }

    const dataExchange = await DataExchange.findOne({
        exchangeKey: req.header('ptx-data-exchange-key'),
    });
    if (!dataExchange) return res.status(401).json('Wrong exchange Key given');
    else next();
};
