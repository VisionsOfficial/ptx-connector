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

describe('DSP Contract Negotiation API tests', () => {
    let serverInstance: AppServer;
    process.env.NODE_ENV = 'test';
    let mongoServer: MongoMemoryServer;
    let providerPid: any;
    let consumerPid = 'urn:uuid:32541fe6-c580-409e-85a8-8a9a32fbe833';

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

    describe('Contract Negotiation Router Tests', () => {
        describe('Contract Negotiation Request Tests', () => {
            it('Should handle contract negotiation request and respond with 201', async () => {
                const response = await request(serverInstance.app)
                    .post('/negotiations/request')
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractRequestMessage',
                        'dspace:consumerPid': consumerPid,
                        'dspace:offer': {
                            '@type': 'odrl:Offer',
                            '@id': '...',
                        },
                        'dspace:callbackAddress': 'https://callback.com',
                    });

                expect(response.status).to.equal(201);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
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

            it('Should return 400 for invalid contract negotiation request format', async () => {
                const response = await request(serverInstance.app)
                    .post('/negotiations/request')
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Contract Negotiation Retrieval Tests', () => {
            it('Should retrieve a contract negotiation and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .get(`/negotiations/${providerPid}`)
                    .send();
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
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

            it('Should return 404 for non-existent contract negotiation', async () => {
                const response = await request(serverInstance.app)
                    .get('/negotiations/provider-non-existent')
                    .send();
                expect(response.status).to.equal(404);
            });
        });

        describe('Contract Negotiation Offer Request Tests', () => {
            it('Should handle contract negotiation offer request and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/request`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractRequestMessage',
                        'dspace:consumerPid': consumerPid,
                        'dspace:offer': {
                            '@type': 'odrl:Offer',
                            '@id': '...',
                        },
                        'dspace:callbackAddress': 'https://callback.com',
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
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
                    'dspace:OFFERED'
                );
            });

            it('Should return 404 for Contract negotiation not found', async () => {
                const response = await request(serverInstance.app)
                    .post('/negotiations/provider-123456/request')
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractOfferMessage',
                    });
                expect(response.status).to.equal(404);
                expect(response.body).to.have.property(
                    'message',
                    'Contract negotiation not found'
                );
            });

            it('Should return 400 for invalid contract negotiation offer request format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/request`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractOfferMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Contract Negotiation Event Tests', () => {
            it('Should handle contract negotiation event and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/events`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationEventMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:eventType': 'dspace:ACCEPTED',
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
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
                    'dspace:ACCEPTED'
                );
            });

            it('Should return 400 for invalid contract negotiation event format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/events`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationEventMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Contract Agreement Verification Tests', () => {
            it('Should verify contract agreement and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/agreement/verification`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractAgreementVerificationMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
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
                    'dspace:VERIFIED'
                );
            });

            it('Should return 400 for invalid contract agreement verification format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/agreement/verification`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractAgreementVerificationMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Contract Negotiation Termination Tests', () => {
            it('Should terminate a contract negotiation and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/termination`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationTerminationMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:code': 'TERMINATION_CODE',
                        'dspace:reason': ['REASON_1'],
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
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
                    'dspace:TERMINATED'
                );
            });

            it('Should return 400 for invalid contract negotiation termination format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/negotiations/${providerPid}/termination`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationTerminationMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Negotiation Offers Tests', () => {
            it('Should handle contract negotiation offer and respond with 201', async () => {
                const response = await request(serverInstance.app)
                    .post('/negotiations/offers')
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractOfferMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:offer': {
                            '@type': 'odrl:Offer',
                            '@id': '...',
                        },
                        'dspace:callbackAddress': 'https://callback.com',
                    });
                expect(response.status).to.equal(201);

                consumerPid = response.body['dspace:consumerPid'];

                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
                );
                expect(response.body).to.have.property(
                    'dspace:providerPid',
                    providerPid
                );
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:OFFERED'
                );
            });

            it('Should return 400 for invalid contract negotiation offer format', async () => {
                const response = await request(serverInstance.app)
                    .post('/negotiations/offers')
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractOfferMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Consumer-Side Negotiation Tests', () => {
            it('Should handle contract negotiation offer from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/offers`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractOfferMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:offer': {},
                        'dspace:callbackAddress': 'https://callback.com',
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
                );
                expect(response.body).to.have.property(
                    'dspace:providerPid',
                    providerPid
                );
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:OFFERED'
                );
            });

            it('Should return 400 for invalid contract negotiation offer from consumer format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/offers`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractRequestMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Contract Agreement Verification Tests', () => {
            it('Should handle contract agreement verification from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/agreement`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractAgreementMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:agreement': {
                            '@type': 'agreement',
                        },
                        'dspace:callbackAddress': 'https://callback.com',
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
                );
                expect(response.body).to.have.property(
                    'dspace:providerPid',
                    providerPid
                );
                //TODO: actually Terminated
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:AGREED'
                );
            });

            it('Should return 400 for invalid contract agreement verification from consumer format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/agreement`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractAgreementVerificationMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Contract Negotiation Event Tests', () => {
            it('Should handle contract negotiation event from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/events`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationEventMessage',
                        'dspace:providerPid': providerPid,
                        'dspace:consumerPid': consumerPid,
                        'dspace:eventType': 'dspace:FINALIZED',
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
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
                    'dspace:FINALIZED'
                );
            });

            it('Should return 400 for invalid contract negotiation event from consumer format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/events`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationEventMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });

        describe('Contract Negotiation Termination Tests', () => {
            it('Should handle contract negotiation termination from consumer and respond with 200', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/termination`)
                    .send({
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationTerminationMessage',
                        'dspace:consumerPid': providerPid,
                        'dspace:providerPid': providerPid,
                        'dspace:code': 'TERMINATION_CODE',
                        'dspace:reason': ['REASON_1'],
                    });
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property(
                    '@context',
                    'https://w3id.org/dspace/2024/1/context.json'
                );
                expect(response.body).to.have.property(
                    '@type',
                    'dspace:ContractNegotiation'
                );
                expect(response.body).to.have.property(
                    'dspace:providerPid',
                    providerPid
                );
                //TODO: actually Terminated
                expect(response.body).to.have.property(
                    'dspace:state',
                    'dspace:TERMINATED'
                );
            });

            it('Should return 400 for invalid contract negotiation termination from consumer format', async () => {
                const response = await request(serverInstance.app)
                    .post(`/callback/negotiations/${consumerPid}/termination`)
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:ContractNegotiationTerminationMessage',
                    });
                expect(response.status).to.equal(400);
            });
        });
    });
});
