import { expect } from 'chai';
import request from 'supertest';
import {
    bootFlowTestServer,
    teardownFlowTestServer,
    FlowTestContext,
} from './utils/setup';
import {
    installConsumerRoleMocks,
    installProviderRoleMocks,
    installInboundEndpointMocks,
    seedPendingDataExchange,
    FlowMocksHandle,
} from './utils/mocks';
import { URLS } from './utils/fixtures';
import { DataExchange } from '../../utils/types/dataExchange';
import { DataExchangeStatusEnum } from '../../utils/enums/dataExchangeStatusEnum';

describe('Ecosystem flow (no service chain)', () => {
    /* ====================================================================
     * As consumer: POST /consumer/exchange initiates the flow
     * ==================================================================== */
    describe('As consumer: POST /consumer/exchange initiates the flow', () => {
        let ctx: FlowTestContext;
        let mocks: FlowMocksHandle;

        before(async () => {
            ctx = await bootFlowTestServer({
                endpoint: URLS.consumerEndpoint,
            });
        });

        after(async () => {
            await teardownFlowTestServer(ctx);
        });

        beforeEach(() => {
            mocks = installConsumerRoleMocks(ctx.server);
        });

        afterEach(async () => {
            mocks.restore();
            await DataExchange.deleteMany({});
        });

        it('reaches IMPORT_SUCCESS on happy path', async () => {
            const [response] = await Promise.all([
                request(ctx.server.app)
                    .post('/consumer/exchange')
                    .set('Content-Type', 'application/json')
                    .send({
                        contract: URLS.contract,
                        resourceId: URLS.resourceId,
                        purposeId: URLS.purposeId,
                    }),
                mocks.simulatedRemote,
            ]);

            expect(response.status).to.equal(200);
            expect(response.body.content.success).to.equal(true);
            expect(response.body.content.dataExchange.status).to.equal(
                DataExchangeStatusEnum.IMPORT_SUCCESS
            );
            expect(mocks.calls.createDataExchangeAtProvider).to.equal(1);
            expect(mocks.calls.providerExport).to.equal(1);
            expect(mocks.calls.consumerImportRepresentation).to.equal(1);
        });

        it('times out when the remote provider never pushes data back', async () => {
            mocks.restore();
            mocks = installConsumerRoleMocks(ctx.server, { silent: true });
            process.env.EXCHANGE_TIMEOUT = '1';

            const response = await request(ctx.server.app)
                .post('/consumer/exchange')
                .set('Content-Type', 'application/json')
                .send({
                    contract: URLS.contract,
                    resourceId: URLS.resourceId,
                    purposeId: URLS.purposeId,
                });

            process.env.EXCHANGE_TIMEOUT = '5';

            expect(response.status).to.equal(200);
            expect(response.body.content.success).to.equal(false);
            expect(response.body.content.dataExchange.status).to.equal(
                DataExchangeStatusEnum.EXCHANGE_TIMEOUT
            );
        }).timeout(8000);

        it('rejects an exchange when the resourceId is not in the contract', async () => {
            const response = await request(ctx.server.app)
                .post('/consumer/exchange')
                .set('Content-Type', 'application/json')
                .send({
                    contract: URLS.contract,
                    resourceId:
                        'http://host.docker.internal:4040/v1/catalog/serviceofferings/deadbeefdeadbeefdeadbeef',
                    purposeId: URLS.purposeId,
                });

            expect(response.status).to.equal(500);
            expect(response.body.content.success).to.equal(false);
            expect(mocks.calls.providerExport).to.equal(0);
        });

        it('rejects an exchange when the purposeId is not in the contract', async () => {
            const response = await request(ctx.server.app)
                .post('/consumer/exchange')
                .set('Content-Type', 'application/json')
                .send({
                    contract: URLS.contract,
                    resourceId: URLS.resourceId,
                    purposeId:
                        'http://host.docker.internal:4040/v1/catalog/serviceofferings/deadbeefdeadbeefdeadbeef',
                });

            expect(response.status).to.equal(500);
            expect(response.body.content.success).to.equal(false);
            expect(mocks.calls.providerExport).to.equal(0);
        });
    });

    /* ====================================================================
     * As provider: POST /consumer/exchange runs ProviderExportService in-process
     * ==================================================================== */
    describe('As provider: POST /consumer/exchange runs in-process export', () => {
        let ctx: FlowTestContext;
        let mocks: FlowMocksHandle;

        before(async () => {
            ctx = await bootFlowTestServer({
                endpoint: URLS.providerEndpoint,
            });
        });

        after(async () => {
            await teardownFlowTestServer(ctx);
        });

        beforeEach(() => {
            mocks = installProviderRoleMocks(ctx.server);
        });

        afterEach(async () => {
            mocks.restore();
            await DataExchange.deleteMany({});
        });

        it('fetches data from its representation and pushes it to the remote consumer', async () => {
            const [response] = await Promise.all([
                request(ctx.server.app)
                    .post('/consumer/exchange')
                    .set('Content-Type', 'application/json')
                    .send({
                        contract: URLS.contract,
                        resourceId: URLS.resourceId,
                        purposeId: URLS.purposeId,
                    }),
                mocks.simulatedRemote,
            ]);

            expect(response.status).to.equal(200);
            expect(response.body.content.success).to.equal(true);
            expect(response.body.content.dataExchange.status).to.equal(
                DataExchangeStatusEnum.IMPORT_SUCCESS
            );
            // Provider creates the DataExchange at the remote consumer.
            expect(mocks.calls.createDataExchangeAtConsumer).to.equal(1);
            // Provider read its own representation URL.
            expect(mocks.calls.providerRepresentationGet).to.equal(1);
            // Provider pushed data to the remote consumer's /consumer/import.
            expect(mocks.calls.consumerImportRemote).to.equal(1);
        });
    });

    /* ====================================================================
     * Inbound: POST /consumer/import (we are consumer, provider pushes data)
     * ==================================================================== */
    describe('Inbound: POST /consumer/import', () => {
        let ctx: FlowTestContext;
        let mocks: FlowMocksHandle;

        before(async () => {
            ctx = await bootFlowTestServer({
                endpoint: URLS.consumerEndpoint,
            });
        });

        after(async () => {
            await teardownFlowTestServer(ctx);
        });

        beforeEach(() => {
            mocks = installInboundEndpointMocks();
        });

        afterEach(async () => {
            mocks.restore();
            await DataExchange.deleteMany({});
        });

        it('persists data into the consumer representation and flips status to IMPORT_SUCCESS', async () => {
            const de = await seedPendingDataExchange();
            const data = { id: 'user-1', firstName: 'Jane' };

            const response = await request(ctx.server.app)
                .post('/consumer/import')
                .set('Content-Type', 'application/json')
                .set('x-provider-data-exchange', de.exchangeIdentifier)
                .send({ exchangeIdentifier: de.exchangeIdentifier, data });

            expect(response.status).to.equal(200);
            expect(response.body.content.success).to.equal(true);

            const updated = await DataExchange.findOne({
                exchangeIdentifier: de.exchangeIdentifier,
            });
            expect(updated.status).to.equal(
                DataExchangeStatusEnum.IMPORT_SUCCESS
            );
            expect(mocks.calls.consumerImportRepresentation).to.equal(1);
        });

        it('records CONSUMER_IMPORT_ERROR when the representation endpoint fails', async () => {
            mocks.restore();
            mocks = installInboundEndpointMocks({
                failConsumerRepresentation: true,
            });

            const de = await seedPendingDataExchange();

            const response = await request(ctx.server.app)
                .post('/consumer/import')
                .set('Content-Type', 'application/json')
                .set('x-provider-data-exchange', de.exchangeIdentifier)
                .send({
                    exchangeIdentifier: de.exchangeIdentifier,
                    data: { id: 'user-1' },
                });

            expect(response.status).to.equal(500);
            const updated = await DataExchange.findOne({
                exchangeIdentifier: de.exchangeIdentifier,
            });
            expect(updated.status).to.equal(
                DataExchangeStatusEnum.CONSUMER_IMPORT_ERROR
            );
        });
    });

    /* ====================================================================
     * Inbound: POST /provider/export (we are provider, consumer kicked us)
     * ==================================================================== */
    describe('Inbound: POST /provider/export', () => {
        let ctx: FlowTestContext;
        let mocks: FlowMocksHandle;

        before(async () => {
            ctx = await bootFlowTestServer({
                endpoint: URLS.providerEndpoint,
            });
        });

        after(async () => {
            await teardownFlowTestServer(ctx);
        });

        beforeEach(() => {
            mocks = installInboundEndpointMocks();
        });

        afterEach(async () => {
            mocks.restore();
            await DataExchange.deleteMany({});
        });

        it('fetches the representation and pushes it to the remote consumer', async () => {
            const de = await seedPendingDataExchange();

            const response = await request(ctx.server.app)
                .post('/provider/export')
                .set('Content-Type', 'application/json')
                .send({
                    exchangeIdentifier: de.exchangeIdentifier,
                    consumerEndpoint: URLS.consumerEndpoint,
                    contract: URLS.contract,
                });

            expect(response.status).to.equal(200);
            expect(response.body.content.success).to.equal(true);
            expect(mocks.calls.providerRepresentationGet).to.equal(1);
            expect(mocks.calls.consumerImportRemote).to.equal(1);
        });

        it('records PROVIDER_EXPORT_ERROR when the representation source fails', async () => {
            mocks.restore();
            mocks = installInboundEndpointMocks({
                failProviderRepresentation: true,
            });

            const de = await seedPendingDataExchange();

            await request(ctx.server.app)
                .post('/provider/export')
                .set('Content-Type', 'application/json')
                .send({
                    exchangeIdentifier: de.exchangeIdentifier,
                    consumerEndpoint: URLS.consumerEndpoint,
                    contract: URLS.contract,
                });

            const updated = await DataExchange.findOne({
                exchangeIdentifier: de.exchangeIdentifier,
            });
            expect(updated.status).to.equal(
                DataExchangeStatusEnum.PROVIDER_EXPORT_ERROR
            );
            expect(mocks.calls.consumerImportRemote).to.equal(0);
        });
    });

    /* ====================================================================
     * Inbound: POST /dataexchanges (another PDC creates the exchange on us)
     * ==================================================================== */
    describe('Inbound: POST /dataexchanges', () => {
        let ctx: FlowTestContext;
        let mocks: FlowMocksHandle;

        before(async () => {
            ctx = await bootFlowTestServer({
                endpoint: URLS.consumerEndpoint,
            });
        });

        after(async () => {
            await teardownFlowTestServer(ctx);
        });

        beforeEach(() => {
            mocks = installInboundEndpointMocks();
        });

        afterEach(async () => {
            mocks.restore();
            await DataExchange.deleteMany({});
        });

        it('persists a DataExchange created by a remote PDC', async () => {
            const payload = {
                exchangeIdentifier: 'remote-created-dex-1',
                exchangeKey: 'remote-key-1',
                providerEndpoint: URLS.providerEndpoint,
                consumerEndpoint: URLS.consumerEndpoint,
                contract: URLS.contract,
                purposeId: URLS.purposeId,
                resources: [
                    {
                        serviceOffering: URLS.resourceId,
                        resource: URLS.dataResource,
                    },
                ],
                purposes: [
                    {
                        serviceOffering: URLS.purposeId,
                        resource: URLS.softwareResource,
                    },
                ],
                status: DataExchangeStatusEnum.PENDING,
                createdAt: new Date().toISOString(),
            };

            const response = await request(ctx.server.app)
                .post('/dataexchanges')
                .set('Content-Type', 'application/json')
                .send(payload);

            expect(response.status).to.equal(200);
            expect(response.body.content.exchangeIdentifier).to.equal(
                payload.exchangeIdentifier
            );

            const persisted = await DataExchange.findOne({
                exchangeIdentifier: payload.exchangeIdentifier,
            });
            expect(persisted).to.exist;
            expect(persisted.providerEndpoint).to.equal(URLS.providerEndpoint);
            expect(persisted.contract).to.equal(URLS.contract);
        });
    });

    /* ====================================================================
     * Inbound: PUT /private/dataexchanges/exchangeidentifier/:id
     * (status sync from the other PDC)
     * ==================================================================== */
    describe('Inbound: PUT /private/dataexchanges/exchangeidentifier/:id', () => {
        let ctx: FlowTestContext;
        let mocks: FlowMocksHandle;

        before(async () => {
            ctx = await bootFlowTestServer({
                endpoint: URLS.consumerEndpoint,
            });
        });

        after(async () => {
            await teardownFlowTestServer(ctx);
        });

        beforeEach(() => {
            mocks = installInboundEndpointMocks();
        });

        afterEach(async () => {
            mocks.restore();
            await DataExchange.deleteMany({});
        });

        it('updates the DataExchange when a valid exchange key is supplied', async () => {
            const de = await seedPendingDataExchange();

            const response = await request(ctx.server.app)
                .put(
                    `/private/dataexchanges/exchangeidentifier/${de.exchangeIdentifier}`
                )
                .set('Content-Type', 'application/json')
                .set('ptx-data-exchange-key', de.exchangeKey)
                .send({ status: DataExchangeStatusEnum.IMPORT_SUCCESS });

            expect(response.status).to.equal(200);

            const updated = await DataExchange.findOne({
                exchangeIdentifier: de.exchangeIdentifier,
            });
            expect(updated.status).to.equal(
                DataExchangeStatusEnum.IMPORT_SUCCESS
            );
        });

        it('rejects with 401 when the exchange key header is missing', async () => {
            const de = await seedPendingDataExchange();

            const response = await request(ctx.server.app)
                .put(
                    `/private/dataexchanges/exchangeidentifier/${de.exchangeIdentifier}`
                )
                .set('Content-Type', 'application/json')
                .send({ status: DataExchangeStatusEnum.IMPORT_SUCCESS });

            expect(response.status).to.equal(401);
        });

        it('rejects with 401 when the exchange key does not match', async () => {
            const de = await seedPendingDataExchange();

            const response = await request(ctx.server.app)
                .put(
                    `/private/dataexchanges/exchangeidentifier/${de.exchangeIdentifier}`
                )
                .set('Content-Type', 'application/json')
                .set('ptx-data-exchange-key', 'not-the-right-key')
                .send({ status: DataExchangeStatusEnum.IMPORT_SUCCESS });

            expect(response.status).to.equal(401);
        });
    });
});
