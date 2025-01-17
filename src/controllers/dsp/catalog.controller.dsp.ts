import { Request, Response, NextFunction } from 'express';
import {
    getCatalogService,
    getServiceOfferingByIdService,
} from '../../services/private/v1/catalog.private.service';
import { mapCatalog, mapServiceOffering } from '../../libs/dcat';
import axios from 'axios';

/**
 * Request the catalog
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/catalog/catalog.binding.https#id-2.1-the-catalog-request-endpoint-provider-side
 */
export const handleCatalogRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const catalog = await getCatalogService();

        const dcatCatalog = await mapCatalog(catalog);

        res.status(200).json(dcatCatalog);
    } catch (error) {
        next(error);
    }
};

/**
 * Get a dataset
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/catalog/catalog.binding.https#id-2.2-the-catalog-datasets-id-endpoint-provider-side
 */
export const getDataset = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const dataset = await getServiceOfferingByIdService(req.params.id);

        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found' });
        }

        const response = await axios.get(dataset.endpoint);

        if (
            response.status !== 200 ||
            response.data.statusCode === 500 ||
            !response.data
        ) {
            return res.status(500).json({ message: 'Dependency error' });
        }

        res.status(200).json(await mapServiceOffering(response.data));
    } catch (error) {
        next(error);
    }
};
