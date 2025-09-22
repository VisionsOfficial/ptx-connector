import { Router } from 'express';
import { body } from 'express-validator';
import {
    getDataset,
    handleCatalogRequest,
} from '../../controllers/dsp/catalog.controller.dsp';
import { validate } from '../middlewares/validator.middleware';
const r: Router = Router();

const CatalogRequestMessageValidation = [
    body('@context')
        .exists()
        .isString()
        .equals('https://w3id.org/dspace/2024/1/context.json'),
    body('@type').exists().isString().equals('dspace:CatalogRequestMessage'),
    body('dspace:filter').optional().isArray(),
];

/**
 * @swagger
 * tags:
 *   name: DSP Catalog
 *   description: IDSA Catalog Protocol
 */

//#region catalog Path Bindings

/**
 * @swagger
 * /catalog/request:
 *   post:
 *     summary: Handle catalog request
 *     tags: [DSP Catalog]
 *     requestBody:
 *       description: Catalog request message body
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message
 *                 type: string
 *                 example: "https://w3id.org/dspace/2024/1/context.json"
 *               "@type":
 *                 description: The type of the message
 *                 type: string
 *                 example: "dspace:CatalogRequestMessage"
 *               dspace:filter:
 *                 description: The filter for the catalog request
 *                 type: object
 *     responses:
 *       '200':
 *         description: Catalog request successfully handled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 catalog:
 *                   description: The catalog response
 *                   type: object
 */
r.post(
    '/catalog/request',
    CatalogRequestMessageValidation,
    validate,
    handleCatalogRequest
);

/**
 * @swagger
 * /catalog/datasets/{id}:
 *   get:
 *     summary: Get dataset by ID
 *     tags: [DSP Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: The ID of the dataset
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Dataset found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dataset:
 *                   description: The dataset
 *                   type: object
 *       '404':
 *         description: Dataset not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message
 *                   type: string
 *       '500':
 *         description: Dependency error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message
 *                   type: string
 */
r.get('/catalog/datasets/:id', getDataset);

export default r;
