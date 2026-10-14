import { Router } from 'express';
import {
    error,
    success,
    getDataExchanges,
    updateDataExchange,
    getDataExchangeById,
    createDataExchange,
    updateDataExchangeDataProcessing, transferCompleted, transferFailed,
} from '../../../controllers/public/v1/dataExchange.public.controller';
const r: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Data-Exchange
 *   description: Data Exchange webhooks and routes
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Dataexchange:
 *       type: object
 *       properties:
 *         contract:
 *           type: string
 *           description: the self-description of the contract on which the exchange is based.
 *         providerEndpoint:
 *           type: string
 *           description: provider data space connector endpoint.
 *         purposeId:
 *           type: string
 *           description: purpose of the exchange, the service offering who consume the data.
 *         resourceId:
 *           type: string
 *           description: resource of the exchange, the service offering where the data come from.
 *         status:
 *           type: string
 *           description: status of the exchange.
 *         createdAt:
 *           type: string
 *           description: timestamp.
 *         updatedAt:
 *           type: string
 *           description: timestamp.
 */

r.post('/', createDataExchange);

/**
 * @swagger
 * /dataexchanges/:
 *   get:
 *     summary: Get all data exchange
 *     tags: [Data-Exchange]
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 */
r.get('/', getDataExchanges);

/**
 * @swagger
 * /dataexchanges/{id}:
 *   get:
 *     summary: Get data exchange by id
 *     tags: [Data-Exchange]
 *     produces:
 *       - application/json
 *     parameters:
 *        - name: id
 *          description: data exchange id.
 *          in: path
 *          required: true
 *          type: string
 *     responses:
 *       '200':
 *         description: Successful response
 */
r.get('/:id', getDataExchangeById);

r.put('/:id', updateDataExchange);

r.put('/:id/servicechains/:index', updateDataExchangeDataProcessing);

r.put('/:id/error', error);

r.put('/:id/success', success);

/**
 * @swagger
 * /dataexchanges/{id}/transfer/completed:
 *   put:
 *     summary: Change data exchange status to TRANSFER_COMPLETED
 *     tags: [Data-Exchange]
 *     produces:
 *       - application/json
 *     parameters:
 *        - name: id
 *          description: data exchange id.
 *          in: path
 *          required: true
 *          type: string
 *     responses:
 *       '200':
 *         description: Successful response
 *       '400':
 *         description: Error response
 */
r.put('/:id/transfer/completed', transferCompleted);

/**
 * @swagger
 * /dataexchanges/{id}/transfer/failed:
 *   put:
 *     summary: Change data exchange status to TRANSFER_FAILED
 *     tags: [Data-Exchange]
 *     produces:
 *       - application/json
 *     parameters:
 *        - name: id
 *          description: data exchange id.
 *          in: path
 *          required: true
 *          type: string
 *     responses:
 *       '200':
 *         description: Successful response
 *       '400':
 *         description: Error response
 */
r.put('/:id/transfer/failed', transferFailed);

export default r;
