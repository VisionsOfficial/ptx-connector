import { Router } from 'express';
import { updateDataExchangeByExchangeIdentifier } from '../../../controllers/public/v1/dataExchange.public.controller';
import { exchangeKey } from '../../middlewares/exchangeKey.middleware';

const r: Router = Router();

r.put(
    '/exchangeidentifier/:exchangeIdentifier',
    exchangeKey,
    updateDataExchangeByExchangeIdentifier
);

export default r;
