import { Request, Response, NextFunction } from 'express';
import TransferProcessService from '../../services/dsp/transfer.process.service.dsp';
import { Error404 } from '../../libs/dsp/Error404.dsp';
import { TransferProcess } from '../../libs/dsp/TransferProcess.dsp';
import { TransferState } from '../../utils/types/dsp/message-types.interface.dsp';

/**
 * Retrieves a transfer process using the providerPid
 * A TP can be accessed by a Consumer or Provider
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/transfer-process/transfer.process.binding.https#id-2.1-the-transfers-endpoint-provider-side
 */
export const getTransferProcess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const tp =
            await TransferProcessService.getTransferProcessFromProviderPid({
                providerPid,
            });

        if (!tp) {
            throw new Error404({ req, res });
        }

        res.status(200).json(new TransferProcess(tp).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a transfer process request
 * from a consumer.
 *
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/transfer-process/transfer.process.binding.https#id-2.2-the-transfers-request-endpoint-provider-side
 */
export const handleTransferProcessRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const message = req.body;

        let tp = null;

        if (message['dspace:providerPid']) {
            tp = await TransferProcessService.getTransferProcessFromProviderPid(
                {
                    providerPid: message['dspace:providerPid'],
                }
            );
            if (!tp) throw new Error404({ req, res });
        } else {
            tp = await TransferProcessService.createTransferProcess({
                consumerPid: message['dspace:consumerPid'],
                state: TransferState.REQUESTED,
            });
        }

        res.status(201).json(
            await TransferProcessService.getTransferProcessMessageFromDocumentId(
                tp.id
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Handles a consumer or provider attempting to start a TP after it has been suspended by POSTing a Transfer Start Message
 *
 * The specification does not define a specific response body for this
 * operation and states that clients are not required to process it, but
 * will return a 200 response if successfully processed.
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/transfer-process/transfer.process.binding.https#id-2.3-the-transfers-providerpid-start-endpoint-provider-side
 */
export const handleTransferProcessStarted = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;
        let tp;
        if (providerPid) {
            tp = await TransferProcessService.getTransferProcessFromProviderPid(
                {
                    providerPid,
                }
            );
        } else if (consumerPid) {
            tp = await TransferProcessService.getTransferProcessFromConsumerPid(
                {
                    consumerPid,
                }
            );
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        if (tp.state !== TransferState.SUSPENDED.toString()) {
            tp.state = TransferState.STARTED.toString();
            await tp.save();
        }

        res.status(200).json(new TransferProcess(tp).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a Transfer Completion Message sent
 * by a consumer or provider to complete a TP.
 *
 * @note
 * For the simplicity of this MVP, we suppose that the provider
 * simply transitions the state to COMPLETED.
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/transfer-process/transfer.process.binding.https#id-2.4-the-transfers-providerpid-completion-endpoint-provider-side
 */
export const handleTransferProcessCompleted = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;
        let tp;
        if (providerPid) {
            tp = await TransferProcessService.getTransferProcessFromProviderPid(
                {
                    providerPid,
                }
            );
        } else if (consumerPid) {
            tp = await TransferProcessService.getTransferProcessFromConsumerPid(
                {
                    consumerPid,
                }
            );
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        // TODO: Implement the verification of who initiated the Offer
        // Which would respond with a 400 response with a transfer process error body

        tp.state = TransferState.COMPLETED.toString();
        await tp.save();

        res.status(200).json(new TransferProcess(tp).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a Transfer Suspension Message sent
 * by a consumer or provider to suspend a TP.
 *
 * Resulting states can be VERIFIED or TERMINATED.
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/transfer-process/transfer.process.binding.https#id-2.6-the-transfers-providerpid-suspension-endpoint-provider-side
 */
export const handleTransferProcessSuspension = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;
        let tp;
        if (providerPid) {
            tp = await TransferProcessService.getTransferProcessFromProviderPid(
                {
                    providerPid,
                }
            );
        } else if (consumerPid) {
            tp = await TransferProcessService.getTransferProcessFromConsumerPid(
                {
                    consumerPid,
                }
            );
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        tp.state = TransferState.SUSPENDED.toString();
        await tp.save();

        res.status(200).json(new TransferProcess(tp).toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the reception of a Transfer Termination Message sent
 * by a consumer or provider to terminate a TP.
 *
 * @see
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/transfer-process/transfer.process.binding.https#id-3.4-the-transfers-consumerpid-termination-endpoint-consumer-side
 * https://docs.internationaldataspaces.org/ids-knowledgebase/dataspace-protocol/transfer-process/transfer.process.binding.https#id-2.5-the-transfers-providerpid-termination-endpoint-provider-side
 */
export const handleTransferProcessTermination = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providerPid = req.params.providerPid;
        const consumerPid = req.params.consumerPid;
        let tp;
        if (providerPid) {
            tp = await TransferProcessService.getTransferProcessFromProviderPid(
                {
                    providerPid,
                }
            );
        } else if (consumerPid) {
            tp = await TransferProcessService.getTransferProcessFromConsumerPid(
                {
                    consumerPid,
                }
            );
        } else {
            throw new Error(
                'Either providerPid or consumerPid must be provided.'
            );
        }

        tp.state = TransferState.TERMINATED.toString();
        await tp.save();

        res.status(200).json(new TransferProcess(tp).toJSON());
    } catch (error) {
        next(error);
    }
};
