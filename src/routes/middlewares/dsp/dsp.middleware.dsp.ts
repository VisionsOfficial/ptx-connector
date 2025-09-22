import { Request, Response, NextFunction } from 'express';
import ContractNegotiationServiceDsp from '../../../services/dsp/contract.negotiation.service.dsp';
import transferProcessServiceDsp from '../../../services/dsp/transfer.process.service.dsp';

/**
 * Validates the base information of an IDS
 * ContractNegotiationMessage.
 *
 * @note This is a basic verification in the context of the
 * mvp. But could be expanded upon to verify that the
 * context value is matching the standard and the id
 * resolves to something in a IDS Catalog.
 */
const validateBaseMessageInfo = (message: any) => {
    if (!message) return false;
    const keys = ['@context', '@id'];
    for (const key of keys) {
        if (!message[key]) return false;
    }

    return true;
};

/**
 * Validates the ContractNegotiationRequestMessage coming
 * from a consumer.
 */
export const validateContractNegotiationRequestFormat = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const payload = req.body;

    let errors = 0;

    if (!validateBaseMessageInfo(payload)) errors++;

    if (!payload.offer) errors++;

    /**
     * Check the presence and validity of the offer as defined by the IDS specification.
     *
     * @note In the context of this mvp, we are not
     * looking up the "@id" in any catalog and suppose
     * that the offer is valid if it is present.
     */
    if (payload.offer && !payload.offer['@id']) errors++;

    // Request is coming from consumer so consumer should have set the cn id
    if (!payload['dspace:consumerPid']) errors++;

    // Check if consumer callback address is present
    if (!payload.callbackAddress) errors++;

    if (errors > 0)
        return res.status(400).json({
            message: 'invalid contract negotiation request format',
            payload: payload,
        });

    next();
};

/**
 * Validates the ContractAgreementVerificationMessage coming from the consumer
 * to verify the acceptance of an Agreement.
 */
export const validateContractAgreementVerificationFormat = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const payload = req.body;

    let errors = 0;

    if (!validateBaseMessageInfo(payload)) errors++;
    if (payload['@id'] !== 'dspace:ContractAgreementVerificationMessage')
        errors++;
    if (!payload['dspace:providerPid']) errors++;
    if (!payload['dspace:consumerPid']) errors++;

    if (!payload.agreement) errors++;

    if (errors > 0)
        return res.status(400).json({
            message: 'invalid contract agreement verification format',
            payload: payload,
        });

    next();
};

/**
 * Validates the ContractNegotiationEventMessage coming from the consumer
 * to accept the current Provider's Offer.
 */
export const validateContractNegotiationEventFormat = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const payload = req.body;

    let errors = 0;

    if (!validateBaseMessageInfo(payload)) errors++;
    if (payload['@id'] !== 'dspace:ContractNegotiationEventMessage') errors++;
    if (!payload['dspace:providerPid']) errors++;
    if (!payload['dspace:consumerPid']) errors++;
    if (!payload['dspace:eventType']) errors++;

    if (errors > 0)
        return res.status(400).json({
            message: 'invalid contract negotiation event format',
            payload: payload,
        });

    next();
};

/**
 * Verifies that a contract negotiation with the given providerPid exists
 */
export const verifyProviderPid = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { providerPid } = req.params;
    if (!providerPid) {
        return res.status(400).json({
            message: 'providerPid is missing',
        });
    }

    const cn =
        await ContractNegotiationServiceDsp.getContractNegotiationFromProviderPid(
            {
                providerPid,
            }
        );

    if (!cn) {
        return res
            .status(404)
            .json({ message: 'Contract negotiation not found' });
    }

    next();
};

/**
 * Verifies that a transfer process with the given providerPid exists
 */
export const verifyProviderTpPid = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { providerPid } = req.params;
    if (!providerPid) {
        return res.status(400).json({
            message: 'providerPid is missing',
        });
    }

    const cn =
        await transferProcessServiceDsp.getTransferProcessFromProviderPid({
            providerPid,
        });

    if (!cn) {
        return res
            .status(404)
            .json({ message: 'Contract negotiation not found' });
    }

    next();
};

/**
 * Verifies that a contract negotiation with the given consumerPid exists
 */
export const verifyConsumerPid = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { consumerPid } = req.params;
    if (!consumerPid) {
        return res.status(400).json({
            message: 'consumerPid is missing',
        });
    }

    const cn =
        await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPid(
            {
                consumerPid,
            }
        );

    if (!cn) {
        return res
            .status(404)
            .json({ message: 'Contract negotiation not found' });
    }

    next();
};

/**
 * Verifies that a transfer process with the given consumerPid exists
 */
export const verifyConsumerTpPid = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { consumerPid } = req.params;
    if (!consumerPid) {
        return res.status(400).json({
            message: 'consumerPid is missing',
        });
    }

    const cn =
        await transferProcessServiceDsp.getTransferProcessFromConsumerPid({
            consumerPid,
        });

    if (!cn) {
        return res
            .status(404)
            .json({ message: 'Contract negotiation not found' });
    }

    next();
};
