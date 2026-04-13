import { Router } from 'express';
import {
    getKpiByOffer,
    getKpiOverview,
    getKpiServiceChain,
    getKpiSimple,
    getKpiVolume,
} from '../../../controllers/private/v1/kpi.private.controller';
import { kpiAuth } from '../../middlewares/auth.middleware';

const r: Router = Router();

r.use(kpiAuth);

/**
 * @swagger
 * tags:
 *   name: KPIs
 *   description: Exchange KPI metrics
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     KpiOverview:
 *       type: object
 *       description: Global overview of all data exchanges
 *       properties:
 *         totalExchanges:
 *           type: integer
 *           description: Total number of DataExchange documents
 *           example: 1274
 *         completedExchanges:
 *           type: integer
 *           description: Exchanges that have left the PENDING state
 *           example: 1200
 *         successfulExchanges:
 *           type: integer
 *           description: Exchanges with status EXPORT_SUCCESS or IMPORT_SUCCESS
 *           example: 1100
 *         globalSuccessRate:
 *           type: number
 *           format: float
 *           description: successfulExchanges / totalExchanges, rounded to 3 decimal places
 *           example: 0.863
 *         totalBytesTransferred:
 *           type: integer
 *           description: Sum of providerData.size across all qualifying exchanges (partial coverage)
 *           example: 204800
 *         simpleExchanges:
 *           type: integer
 *           description: Exchanges without a service chain
 *           example: 900
 *         serviceChainExchanges:
 *           type: integer
 *           description: Exchange steps that are part of a service chain
 *           example: 374
 *     KpiByOffer:
 *       type: object
 *       description: Exchange statistics for a single service offering
 *       properties:
 *         serviceOffering:
 *           type: string
 *           description: URI of the service offering
 *           example: "https://catalog.example.com/v1/catalog/serviceofferings/abc123"
 *         totalExchanges:
 *           type: integer
 *           example: 300
 *         successfulExchanges:
 *           type: integer
 *           example: 270
 *         successRate:
 *           type: number
 *           format: float
 *           example: 0.9
 *     KpiServiceChain:
 *       type: object
 *       description: Statistics for service-chain exchange steps
 *       properties:
 *         totalServiceChainExchanges:
 *           type: integer
 *           description: Total individual exchange steps part of any service chain
 *           example: 374
 *         successfulServiceChainExchanges:
 *           type: integer
 *           example: 320
 *         successRate:
 *           type: number
 *           format: float
 *           example: 0.856
 *     KpiSimple:
 *       type: object
 *       description: Statistics for simple (bilateral) exchanges
 *       properties:
 *         totalSimpleExchanges:
 *           type: integer
 *           example: 900
 *         successfulSimpleExchanges:
 *           type: integer
 *           example: 780
 *         successRate:
 *           type: number
 *           format: float
 *           example: 0.867
 *     KpiVolumeDay:
 *       type: object
 *       description: Exchange count for a single day
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *           description: Date in YYYY-MM-DD format
 *           example: "2026-04-09"
 *         count:
 *           type: integer
 *           example: 42
 *     KpiVolume:
 *       type: object
 *       description: Volume metrics and daily time-series
 *       properties:
 *         totalBytesTransferred:
 *           type: integer
 *           description: Sum of providerData.size (partial coverage, REST non-chain only)
 *           example: 204800
 *         byteCoverageNote:
 *           type: string
 *           description: Human-readable note explaining byte coverage limitations
 *           example: "Only REST non-service-chain exchanges report a size. This total is partial."
 *         exchangesByDay:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/KpiVolumeDay'
 */

/**
 * @swagger
 * /private/kpis/exchanges/overview:
 *   get:
 *     summary: Global exchange KPI overview
 *     description: Returns aggregate counts, success rate, byte volume, and exchange type breakdown across all DataExchange documents.
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *       - kpiApiKey: []
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KpiOverview'
 *       '401':
 *         description: Unauthorized – missing or invalid JWT / API key
 */
r.get('/exchanges/overview', getKpiOverview);

/**
 * @swagger
 * /private/kpis/exchanges/by-offer:
 *   get:
 *     summary: Exchange count and success rate grouped by service offering
 *     description: >
 *       Returns one entry per distinct service offering URI, sorted by total exchange count descending.
 *       Use the `type` query parameter to switch between grouping by the provider's resource offering
 *       or the consumer's purpose offering.
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *       - kpiApiKey: []
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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KpiByOffer'
 *       '401':
 *         description: Unauthorized – missing or invalid JWT / API key
 */
r.get('/exchanges/by-offer', getKpiByOffer);

/**
 * @swagger
 * /private/kpis/exchanges/service-chain:
 *   get:
 *     summary: Service-chain exchange count and success rate
 *     description: >
 *       Returns statistics for exchange steps that were part of a service chain
 *       (i.e. whose serviceChain.services array is non-empty).
 *       Each individual step within a chain is counted separately, not the chain as a whole.
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *       - kpiApiKey: []
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KpiServiceChain'
 *       '401':
 *         description: Unauthorized – missing or invalid JWT / API key
 */
r.get('/exchanges/service-chain', getKpiServiceChain);

/**
 * @swagger
 * /private/kpis/exchanges/simple:
 *   get:
 *     summary: Simple (bilateral) exchange count and success rate
 *     description: >
 *       Returns statistics for exchanges that are NOT part of a service chain
 *       (i.e. whose serviceChain.services array is absent or empty).
 *       These represent direct point-to-point bilateral data transfers.
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *       - kpiApiKey: []
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KpiSimple'
 *       '401':
 *         description: Unauthorized – missing or invalid JWT / API key
 */
r.get('/exchanges/simple', getKpiSimple);

/**
 * @swagger
 * /private/kpis/exchanges/volume:
 *   get:
 *     summary: Exchange volume over time and total bytes transferred
 *     description: >
 *       Returns total bytes transferred (partial coverage – only REST non-chain exchanges
 *       report a providerData.size) and a daily time-series of exchange counts.
 *       An optional date range narrows the query window; omitting both parameters returns
 *       all historical data.
 *     tags: [KPIs]
 *     security:
 *       - jwt: []
 *       - kpiApiKey: []
 *     parameters:
 *       - name: from
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of the date range (ISO 8601, inclusive)
 *         example: "2026-01-01T00:00:00Z"
 *       - name: to
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of the date range (ISO 8601, inclusive)
 *         example: "2026-04-09T23:59:59Z"
 *     produces:
 *       - application/json
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KpiVolume'
 *       '401':
 *         description: Unauthorized – missing or invalid JWT / API key
 */
r.get('/exchanges/volume', getKpiVolume);

export default r;
