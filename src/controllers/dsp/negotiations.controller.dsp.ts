import { Request, Response, NextFunction } from 'express';
import ContractNegotiationServiceDsp from '../../services/dsp/contract.negotiation.service.dsp';
import { Error404 } from '../../libs/dsp/Error404.dsp';
import { ContractNegotiation } from '../../libs/dsp/ContractNegotiation.dsp';
import { NegotiationState } from '../../utils/types/dsp/message-types.interface.dsp';

/**
 * Retrieves a contract negotiation using the providerPid
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.binding.https#id-2.1-the-negotiations-endpoint-provider-side
 */
export const getContractNegotiation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;
        let cn;
        if (providerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromProviderPid(
                    {
                        providerPid,
                    }
                );
        } else if (consumerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPid(
                    {
                        consumerPid,
                    }
                );
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        if (!cn) {
            throw new Error404({ req, res });
        }

        res.status(200).json(new ContractNegotiation(cn).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a contract negotiation request
 * from a consumer following the IDS negotiation protocol.
 *
 * @note
 * In this mvp, we are not handling the case where this processing
 * could make the contract negotiation state transition to "TERMINATED".
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.binding.https#id-2.2-the-negotiations-request-endpoint-provider-side
 */
export const handleContractNegotiationRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const message = req.body;

        let cn = null;

        if (message['dspace:providerPid']) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromProviderPid(
                    {
                        providerPid: message['dspace:providerPid'],
                    }
                );
            if (!cn) throw new Error404({ req, res });
        } else {
            cn = await ContractNegotiationServiceDsp.createContractNegotiation({
                consumerPid: message['dspace:consumerPid'],
                state: NegotiationState.REQUESTED,
            });
        }

        res.status(201).json(
            await ContractNegotiationServiceDsp.getContractNegotiationMessageFromDocumentId(
                cn.id
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a contract negotiation offer
 * from a provider following the IDS negotiation protocol.
 *
 * @note
 * In this mvp, we are not handling the case where this processing
 * could make the contract negotiation state transition to "TERMINATED".
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/contract-negotiation/contract.negotiation.binding.https#id-3.2-the-negotiations-offers-endpoint-consumer-side
 */
export const handleContractNegotiationOffer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const message = req.body;

        let cn = null;

        cn = await ContractNegotiationServiceDsp.createContractNegotiation({
            providerPid: message['dspace:providerPid'],
            state: NegotiationState.OFFERED,
        });

        res.status(201).json(
            await ContractNegotiationServiceDsp.getContractNegotiationMessageFromDocumentId(
                cn.id
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Handles a consumer making an Offer by POSTing a Contract Request Message
 *
 * The specification does not define a specific response body for this
 * operation and states that clients are not required to process it, but
 * will return a 200 response if successfully processed.
 *
 * @note
 * For the context of this MVP, the processing of the offer is to
 * change the state of the CN to be REQUESTED.
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.binding.https#id-2.3-the-negotiations-providerpid-request-endpoint-provider-side
 */
export const handleContractNegotiationOfferRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;
        const message = req.body;
        let cn;
        if (providerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        providerPid,
                        consumerPid: message['dspace:consumerPid'],
                    }
                );
        } else if (consumerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        consumerPid,
                        providerPid: message['dspace:providerPid'],
                    }
                );
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        cn.state = NegotiationState.OFFERED.toString();
        await cn.save();

        res.status(200).json(new ContractNegotiation(cn).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a ContractNegotiationEventMessage sent
 * by a consumer to accept the Provider's Offer.
 *
 * @note
 * For the simplicity of this MVP, we suppose that the provider
 * simply transitions the state to ACCEPTED.
 *
 * @see https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.binding.https#id-2.4-the-negotiations-providerpid-events-endpoint-provider-side
 */
export const handleContractNegotiationEvent = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;
        const message = req.body;
        let cn;
        if (providerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        providerPid,
                        consumerPid: message['dspace:consumerPid'],
                    }
                );
            cn.state = NegotiationState.ACCEPTED.toString();
        } else if (consumerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        consumerPid,
                        providerPid: message['dspace:providerPid'],
                    }
                );
            cn.state = NegotiationState.FINALIZED.toString();
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        await cn.save();

        res.status(200).json(new ContractNegotiation(cn).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a Contract Agreement Message sent
 * by a provider create an Agreement.
 *
 * @note
 * For the simplicity of this MVP, we suppose that the provider
 * simply transitions the state to ACCEPTED.
 *
 * @see https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.binding.https#id-2.4-the-negotiations-providerpid-events-endpoint-provider-side
 */
export const handleContractAgreementMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const consumerPid = req.params.consumerPid;
        const message = req.body;
        const cn =
            await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                {
                    consumerPid,
                    providerPid: message['dspace:providerPid'],
                }
            );

        // TODO: Implement the verification of who initiated the Offer
        // Which would respond with a 400 response with a contract negotiation error body

        cn.state = NegotiationState.AGREED.toString();
        await cn.save();

        res.status(200).json(new ContractNegotiation(cn).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a ContractAgreementVerificationMessage sent
 * by a consumer to verify the acceptance of an Agreement.
 *
 * Resulting states can be VERIFIED or TERMINATED.
 *
 * @see https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.protocol#id-2.4-contract-agreement-verification-message
 */
export const handleContractAgreementVerification = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const cn =
            await ContractNegotiationServiceDsp.getContractNegotiationFromProviderPid(
                {
                    providerPid,
                }
            );

        cn.state = NegotiationState.VERIFIED.toString();
        await cn.save();

        res.status(200).json(new ContractNegotiation(cn).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the termination of a contract negotiation sent by the consumer.
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.binding.https#id-2.6-the-negotiations-providerpid-termination-endpoint-provider-side
 */
export const handleContractNegotiationTermination = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;

        const message = req.body;

        let cn;
        if (providerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        providerPid,
                        consumerPid: message['dspace:consumerPid'],
                    }
                );
        } else if (consumerPid) {
            cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        consumerPid,
                        providerPid: message['dspace:providerPid'],
                    }
                );
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        cn.state = NegotiationState.TERMINATED.toString();
        await cn.save();

        res.status(200).json(new ContractNegotiation(cn).toJSON());
    } catch (error) {
        next(error);
    }
};
