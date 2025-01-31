import { expect } from 'chai';
import request from 'supertest';
import { config, setupEnvironment } from '../../config/environment';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Logger } from '../../libs/loggers';
import { startTestServer } from '../utils/testServer';
import { AppServer } from '../../server';

dotenv.config({ path: '.env.test' });

describe('DSP Transfer Process API tests', () => {
    let serverInstance: AppServer;
    process.env.NODE_ENV = 'test';
    let mongoServer: MongoMemoryServer;
    let providerPid: any;
    const consumerPid = 'urn:uuid:32541fe6-c580-409e-85a8-8a9a32fbe833';

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        setupEnvironment('test');
        serverInstance = await startTestServer(config.port);
    });

    after(async () => {
        serverInstance.server.close();
        Logger.info({ message: 'Server closed' });
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('Transfer Process Router Tests', () => {
        describe('Transfer Process Request Tests', () => {
            it('Should handle transfer process request and respond with 201', async () => {
                const response = await request(serverInstance.app)
                    .post('/transfers/request')
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                        'dspace:consumerPid': consumerPid,
                        'dspace:agreementId': 'agreement-123',
                        'dct:format': 'application/json',
                        'dspace:callbackAddress': 'https://callback.com',
                    });

                expect(response.status).to.equal(201);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:TransferProcess'
                );
                expect(response.body).to.have.property(
                    'dspace:consumerPid',
                    consumerPid
                );
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:REQUESTED'
                );

                providerPid = response.body['dspace:providerPid'];
            });

            it('Should return 400 for invalid transfer process request format', async () => {
                const response = await request(serverInstance.app)
                    .post('/transfers/request')
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Transfer Process Retrieval Tests', () => {
            it('Should retrieve a transfer process and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .get(`/transfers/${providerPid}`)
                    .send();

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:TransferProcess'
                );
                expect(response.body).to.have.property(
                    'dspace:providerPid',
                    providerPid
                );
                expect(response.body).to.have.property(
                    'dspace:consumerPid',
                    consumerPid
                );
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:REQUESTED'
                );
            });

            it('Should return 404 for non-existent transfer process', async () => {
                const response = await request(serverInstance.app)
                    .get('/transfers/non-existent-pid')
                    .send();
                expect(response.status).to.equal(404);
            });
        });

        describe('Transfer Process Start Tests', () => {
            it('Should handle transfer process start and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/start`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferStartMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:dataAddress': {
                            '@type': 'DataAddress',
                            'dspace:endpointType': 'HTTP',
                            'dspace:endpoint': 'https://example.com/data',
                        },
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:STARTED'
                );
            });

            it('Should return 400 for invalid transfer process start format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/start`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Transfer Process Completion Tests', () => {
            it('Should handle transfer process completion and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/completion`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferCompletionMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:COMPLETED'
                );
            });

            it('Should return 400 for invalid transfer process completion format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/completion`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Transfer Process Suspension Tests', () => {
            it('Should handle transfer process suspension and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/suspension`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferSuspensionMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:code': 'SUSPENSION_CODE',
                        'dspace:reason': ['REASON_1'],
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:SUSPENDED'
                );
            });

            it('Should return 400 for invalid transfer process suspension format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/suspension`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Transfer Process Termination Tests', () => {
            it('Should handle transfer process termination and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/termination`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferTerminationMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:code': 'TERMINATION_CODE',
                        'dspace:reason': ['REASON_1'],
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:TERMINATED'
                );
            });

            it('Should return 400 for invalid transfer process termination format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/transfers/${providerPid}/termination`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Consumer Transfer Process Start Tests', () => {
            it('Should handle transfer process start from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/start`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferStartMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:dataAddress': {
                            '@type': 'DataAddress',
                            'dspace:endpointType': 'HTTP',
                            'dspace:endpoint': 'https://example.com/data',
                        },
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:STARTED'
                );
            });

            it('Should return 400 for invalid transfer process start format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/start`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Consumer Transfer Process Completion Tests', () => {
            it('Should handle transfer process completion from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/completion`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferCompletionMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:COMPLETED'
                );
            });

            it('Should return 400 for invalid transfer process completion format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/completion`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Consumer Transfer Process Suspension Tests', () => {
            it('Should handle transfer process suspension from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/suspension`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferSuspensionMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:code': 'SUSPENSION_CODE',
                        'dspace:reason': ['REASON_1'],
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:SUSPENDED'
                );
            });

            it('Should return 400 for invalid transfer process suspension format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/suspension`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Consumer Transfer Process Termination Tests', () => {
            it('Should handle transfer process termination from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/termination`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferTerminationMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:code': 'TERMINATION_CODE',
                        'dspace:reason': ['REASON_1'],
                    });

                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:TERMINATED'
                );
            });

            it('Should return 400 for invalid transfer process termination format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/transfers/${consumerPid}/termination`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:TransferRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });
    });
});
