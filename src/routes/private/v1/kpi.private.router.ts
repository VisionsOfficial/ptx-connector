import { Router } from 'express';
import {
    getKpiByOffer,
    getKpiOverview,
    getKpiServiceChain,
    getKpiSimple,
    getKpiVolume,
} from '../../../controllers/private/v1/kpi.private.controller';
import { auth } from '../../middlewares/auth.middleware';

const r: Router = Router();

r.use(auth);

/**
 * @swagger
 * tags:
 *   name: KPIs
 *   description: Exchange KPI metrics
 */

/**
 * @swagger
 * /private/kpis/exchanges/overview:
 *   get:
 *     summary: Global exchange KPI overview
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 */
r.get('/exchanges/overview', getKpiOverview);

/**
 * @swagger
 * /private/kpis/exchanges/by-offer:
 *   get:
 *     summary: Exchange count and success rate grouped by service offering
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *     parameters:
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [resource, purpose]
 *           default: resource
 *         description: Whether to group by provider resource offering or consumer purpose offering
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 */
r.get('/exchanges/by-offer', getKpiByOffer);

/**
 * @swagger
 * /private/kpis/exchanges/service-chain:
 *   get:
 *     summary: Service-chain exchange count and success rate
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 */
r.get('/exchanges/service-chain', getKpiServiceChain);

/**
 * @swagger
 * /private/kpis/exchanges/simple:
 *   get:
 *     summary: Simple (bilateral) exchange count and success rate
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 */
r.get('/exchanges/simple', getKpiSimple);

/**
 * @swagger
 * /private/kpis/exchanges/volume:
 *   get:
 *     summary: Exchange volume over time and total bytes transferred
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *     parameters:
 *       - name: from
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - name: to
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 */
r.get('/exchanges/volume', getKpiVolume);

export default r;
