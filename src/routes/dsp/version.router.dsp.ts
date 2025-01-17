import { Request, Response } from 'express';
import { Router } from 'express';
import { body } from 'express-validator';
import { getEndpoint } from '../../libs/loaders/configuration';
const r: Router = Router();

/**
 * @swagger
 * tags:
 *   name: DSP Procotol specification
 *   description: IDSA Catalog Protocol
 */

/**
 * @swagger
 * /.well-known/dspace-version:
 *   get:
 *     summary: Get dataset dspace-version
 *     tags: [DSP Procotol specification]
 *     responses:
 *       '200':
 *         description: Dataset found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 '@context':
 *                   description: The context of the dataset
 *                   type: string
 *                 protocolVersions:
 *                   description: The protocol versions available
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       version:
 *                         description: The version of the protocol
 *                         type: string
 *                       path:
 *                         description: The path to the protocol version
 *                         type: string
 */
r.get('/.well-known/dspace-version', async (req: Request, res: Response) => {
    return res.status(200).json({
        '@context': 'https://w3id.org/dspace/2024/1/context.json',
        protocolVersions: [
            {
                version: '2024-1',
                path: await getEndpoint(),
            },
        ],
    });
});

export default r;
