import { Router } from 'express';
import {
    getTransferProcess,
    handleTransferProcessCompleted,
    handleTransferProcessRequest,
    handleTransferProcessStarted,
    handleTransferProcessSuspension,
    handleTransferProcessTermination,
} from '../../controllers/dsp/transfers.controller.dsp';
import {
    verifyConsumerTpPid,
    verifyProviderTpPid,
} from '../middlewares/dsp/dsp.middleware.dsp';
import { body } from 'express-validator';
import { validate } from '../middlewares/validator.middleware';
const r: Router = Router();

const transferRequestMessageValidation = [
    body('@context')
        .exists()
        .isString()
        .equals('https://w3id.org/dspace/2024/1/context.json'),
    body('@type').exists().isString().equals('dspace:TransferRequestMessage'),
    body('dspace:agreementId').exists().isString(),
    body('dspace:consumerPid').exists().isString(),
    body('dct:format').exists().isString(),
    body('dspace:dataAddress').optional(),
    body('dspace:callbackAddress').exists().isString(),
];

const transferStartMessageValidation = [
    body('@context')
        .exists()
        .isString()
        .equals('https://w3id.org/dspace/2024/1/context.json'),
    body('@type').exists().isString().equals('dspace:TransferStartMessage'),
    body('dspace:providerPid').exists().isString(),
    body('dspace:consumerPid').exists().isString(),
    body('dspace:dataAddress').optional(),
];

const transferCompletionMessageValidation = [
    body('@context')
        .exists()
        .isString()
        .equals('https://w3id.org/dspace/2024/1/context.json'),
    body('@type')
        .exists()
        .isString()
        .equals('dspace:TransferCompletionMessage'),
    body('dspace:providerPid').exists().isString(),
    body('dspace:consumerPid').exists().isString(),
];

const transferTerminationMessageValidation = [
    body('@context')
        .exists()
        .isString()
        .equals('https://w3id.org/dspace/2024/1/context.json'),
    body('@type')
        .exists()
        .isString()
        .equals('dspace:TransferTerminationMessage'),
    body('dspace:providerPid').exists().isString(),
    body('dspace:consumerPid').exists().isString(),
    body('dspace:code').optional().isString(),
    body('dspace:reason').optional().isArray(),
];

const transferSuspensionMessageValidation = [
    body('@context')
        .exists()
        .isString()
        .equals('https://w3id.org/dspace/2024/1/context.json'),
    body('@type')
        .exists()
        .isString()
        .equals('dspace:TransferSuspensionMessage'),
    body('dspace:providerPid').exists().isString(),
    body('dspace:consumerPid').exists().isString(),
    body('dspace:code').optional().isString(),
    body('dspace:reason').optional().isArray(),
];

/**
 * @swagger
 * tags:
 *   name: DSP Transfer Process
 *   description: IDSA Transfer Process Protocol
 */

//#region Provider Path Bindings

/**
 * @swagger
 * /transfers/{providerPid}:
 *   get:
 *     summary: Retrieves a transfer process by provider PID.
 *     description: This endpoint retrieves a transfer process using the provider's PID.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: providerPid
 *         description: The PID of the provider.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 "@context":
 *                   description: The context of the message.
 *                   type: string
 *                 "@type":
 *                   description: The type of the message.
 *                   type: string
 *                 "dspace:providerPid":
 *                   description: The PID of the provider.
 *                   type: string
 *                 "dspace:consumerPid":
 *                   description: The PID of the consumer.
 *                   type: string
 *                 "dspace:state":
 *                   description: The state of the transfer process.
 *                   type: string
 *       '404':
 *         description: Transfer process not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 */
r.get(
    '/transfers/:providerPid',
    verifyProviderTpPid,
    validate,
    getTransferProcess
);

/**
 * @swagger
 * /transfers/request:
 *   post:
 *     summary: Handles the reception of a transfer process request from a consumer.
 *     description: This endpoint processes the reception of a transfer process request from a consumer.
 *     tags: [DSP Transfer Process]
 *     requestBody:
 *       description: The transfer request body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               '@context':
 *                 description: The context of the message.
 *                 type: string
 *               '@type':
 *                 description: The type of the message.
 *                 type: string
 *               'dspace:consumerPid':
 *                 description: The PID of the consumer.
 *                 type: string
 *               'dspace:agreementId':
 *                 description: The ID of the agreement.
 *                 type: string
 *               'dct:format':
 *                 description: The format of the data.
 *                 type: string
 *               'dspace:dataAddress':
 *                 description: The data address.
 *                 type: object
 *                 properties:
 *                   '@type':
 *                     description: The type of the data address.
 *                     type: string
 *                   'dspace:endpointType':
 *                     description: The type of the endpoint.
 *                     type: string
 *                   'dspace:endpoint':
 *                     description: The endpoint.
 *                     type: string
 *                   'dspace:endpointProperties':
 *                     description: The endpoint properties.
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         '@type':
 *                           description: The type of the endpoint property.
 *                           type: string
 *                         'dspace:name':
 *                           description: The name of the endpoint property.
 *                           type: string
 *                         'dspace:value':
 *                           description: The value of the endpoint property.
 *                           type: string
 *               'dspace:callbackAddress':
 *                 description: The callback address.
 *                 type: string
 *     responses:
 *       '201':
 *         description: Transfer process successfully created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 '@context':
 *                   description: The context of the message.
 *                   type: string
 *                 '@type':
 *                   description: The type of the message.
 *                   type: string
 *                 'dspace:providerPid':
 *                   description: The PID of the provider.
 *                   type: string
 *                 'dspace:consumerPid':
 *                   description: The PID of the consumer.
 *                   type: string
 *                 'dspace:state':
 *                   description: The state of the transfer process.
 *                   type: string
 */
r.post(
    '/transfers/request',
    transferRequestMessageValidation,
    validate,
    handleTransferProcessRequest
);

/**
 * @swagger
 * /transfers/{providerPid}/start:
 *   post:
 *     summary: Handles the reception of a Transfer Start Message sent by a consumer to start a TP.
 *     description: This endpoint processes the start of a transfer process initiated by the consumer.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: providerPid
 *         description: The PID of the provider.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: The transfer start message body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               '@context':
 *                 description: The context of the message.
 *                 type: string
 *               '@type':
 *                 description: The type of the message.
 *                 type: string
 *               'dspace:providerPid':
 *                 description: The PID of the provider.
 *                 type: string
 *               'dspace:consumerPid':
 *                 description: The PID of the consumer.
 *                 type: string
 *               'dspace:dataAddress':
 *                 description: The data address.
 *                 type: object
 *                 properties:
 *                   '@type':
 *                     description: The type of the data address.
 *                     type: string
 *                   'dspace:endpointType':
 *                     description: The endpoint type of the data address.
 *                     type: string
 *                   'dspace:endpoint':
 *                     description: The endpoint of the data address.
 *                     type: string
 *                   'dspace:endpointProperties':
 *                     description: The endpoint properties of the data address.
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         '@type':
 *                           description: The type of the endpoint property.
 *                           type: string
 *                         'dspace:name':
 *                           description: The name of the endpoint property.
 *                           type: string
 *                         'dspace:value':
 *                           description: The value of the endpoint property.
 *                           type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully started.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer start message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/transfers/:providerPid/start',
    transferStartMessageValidation,
    verifyProviderTpPid,
    validate,
    handleTransferProcessStarted
);

/**
 * @swagger
 * /transfers/{providerPid}/completion:
 *   post:
 *     summary: Handles the completion of a transfer process by the provider.
 *     description: This endpoint is used by the provider to complete a transfer process.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: providerPid
 *         description: The PID of the provider.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message.
 *                 type: string
 *               "@type":
 *                 description: The type of the message.
 *                 type: string
 *               "dspace:providerPid":
 *                 description: The PID of the provider.
 *                 type: string
 *               "dspace:consumerPid":
 *                 description: The PID of the consumer.
 *                 type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully completed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer completion message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/transfers/:providerPid/completion',
    transferCompletionMessageValidation,
    verifyProviderTpPid,
    validate,
    handleTransferProcessCompleted
);

/**
 * @swagger
 * /transfers/{providerPid}/termination:
 *   post:
 *     summary: Handles the reception of a Transfer Termination Message sent by a consumer to terminate a TP.
 *     description: This endpoint processes the termination of a transfer process initiated by the consumer.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: providerPid
 *         description: The PID of the provider.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: The transfer termination message body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message.
 *                 type: string
 *               "@type":
 *                 description: The type of the message.
 *                 type: string
 *               "dspace:providerPid":
 *                 description: The PID of the provider.
 *                 type: string
 *               "dspace:consumerPid":
 *                 description: The PID of the consumer.
 *                 type: string
 *               "dspace:code":
 *                 description: The code for the termination.
 *                 type: string
 *               "dspace:reason":
 *                 description: The reasons for the termination.
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully terminated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer termination message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/transfers/:providerPid/termination',
    transferTerminationMessageValidation,
    verifyProviderTpPid,
    validate,
    handleTransferProcessTermination
);

/**
 * @swagger
 * /transfers/{providerPid}/suspension:
 *   post:
 *     summary: Handles the suspension of a transfer process by the provider.
 *     description: This endpoint is used by the provider to suspend a transfer process.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: providerPid
 *         description: The PID of the provider.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: The transfer suspension message body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message.
 *                 type: string
 *               "@type":
 *                 description: The type of the message.
 *                 type: string
 *               "dspace:providerPid":
 *                 description: The PID of the provider.
 *                 type: string
 *               "dspace:consumerPid":
 *                 description: The PID of the consumer.
 *                 type: string
 *               "dspace:code":
 *                 description: The code for the suspension.
 *                 type: string
 *               "dspace:reason":
 *                 description: The reasons for the suspension.
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully suspended.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer suspension message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/transfers/:providerPid/suspension',
    transferSuspensionMessageValidation,
    verifyProviderTpPid,
    validate,
    handleTransferProcessSuspension
);
//#endregion

//#region Consumer Path Bindings
/**
 * @swagger
 * /callback/transfers/{consumerPid}/start:
 *   post:
 *     summary: Handles the start of a transfer process by the provider.
 *     description: This endpoint is used by the provider to start a transfer process.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: consumerPid
 *         description: The PID of the consumer.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message.
 *                 type: string
 *               "@type":
 *                 description: The type of the message.
 *                 type: string
 *               "dspace:providerPid":
 *                 description: The PID of the provider.
 *                 type: string
 *               "dspace:consumerPid":
 *                 description: The PID of the consumer.
 *                 type: string
 *               "dspace:dataAddress":
 *                 description: The data address of the transfer process.
 *                 type: object
 *                 properties:
 *                   "@type":
 *                     description: The type of the data address.
 *                     type: string
 *                   "dspace:endpointType":
 *                     description: The type of the endpoint.
 *                     type: string
 *                   "dspace:endpoint":
 *                     description: The endpoint of the data address.
 *                     type: string
 *                   "dspace:endpointProperties":
 *                     description: The endpoint properties of the data address.
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         '@type':
 *                           description: The type of the endpoint property.
 *                           type: string
 *                         'dspace:name':
 *                           description: The name of the endpoint property.
 *                           type: string
 *                         'dspace:value':
 *                           description: The value of the endpoint property.
 *                           type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully started.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer start message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/callback/transfers/:consumerPid/start',
    transferStartMessageValidation,
    verifyConsumerTpPid,
    validate,
    handleTransferProcessStarted
);

/**
 * @swagger
 * /callback/transfers/{consumerPid}/completion:
 *   post:
 *     summary: Handles the completion of a transfer process by the provider.
 *     description: This endpoint is used by the provider to complete a transfer process.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: consumerPid
 *         description: The PID of the consumer.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: The transfer completion message body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message.
 *                 type: string
 *               "@type":
 *                 description: The type of the message.
 *                 type: string
 *               "dspace:providerPid":
 *                 description: The PID of the provider.
 *                 type: string
 *               "dspace:consumerPid":
 *                 description: The PID of the consumer.
 *                 type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully completed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer completion message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/callback/transfers/:consumerPid/completion',
    transferCompletionMessageValidation,
    verifyConsumerTpPid,
    validate,
    handleTransferProcessCompleted
);

/**
 * @swagger
 * /callback/transfers/{consumerPid}/termination:
 *   post:
 *     summary: Handles the termination of a transfer process by the provider.
 *     description: This endpoint is used by the provider to terminate a transfer process.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: consumerPid
 *         description: The PID of the consumer.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: The transfer termination message body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message.
 *                 type: string
 *               "@type":
 *                 description: The type of the message.
 *                 type: string
 *               "dspace:providerPid":
 *                 description: The PID of the provider.
 *                 type: string
 *               "dspace:consumerPid":
 *                 description: The PID of the consumer.
 *                 type: string
 *               "dspace:code":
 *                 description: The code for the termination.
 *                 type: string
 *               "dspace:reason":
 *                 description: The reasons for the termination.
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully terminated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer termination message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/callback/transfers/:consumerPid/termination',
    transferTerminationMessageValidation,
    verifyConsumerTpPid,
    validate,
    handleTransferProcessTermination
);

/**
 * @swagger
 * /callback/transfers/{consumerPid}/suspension:
 *   post:
 *     summary: Handles the suspension of a transfer process by the provider.
 *     description: This endpoint is used by the provider to suspend a transfer process.
 *     tags: [DSP Transfer Process]
 *     parameters:
 *       - in: path
 *         name: consumerPid
 *         description: The PID of the consumer.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: The transfer suspension message body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               "@context":
 *                 description: The context of the message.
 *                 type: string
 *               "@type":
 *                 description: The type of the message.
 *                 type: string
 *               "dspace:providerPid":
 *                 description: The PID of the provider.
 *                 type: string
 *               "dspace:consumerPid":
 *                 description: The PID of the consumer.
 *                 type: string
 *               "dspace:code":
 *                 description: The code for the suspension.
 *                 type: string
 *               "dspace:reason":
 *                 description: The reasons for the suspension.
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: Transfer process successfully suspended.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Success message.
 *                   type: string
 *       '400':
 *         description: Invalid transfer suspension message format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   description: Error message.
 *                   type: string
 *                 payload:
 *                   description: The invalid payload.
 *                   type: object
 */
r.post(
    '/callback/transfers/:consumerPid/suspension',
    transferSuspensionMessageValidation,
    verifyConsumerTpPid,
    validate,
    handleTransferProcessSuspension
);
//#endregion

export default r;
