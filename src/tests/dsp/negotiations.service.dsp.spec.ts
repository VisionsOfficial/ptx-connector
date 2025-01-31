import { expect } from 'chai';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ContractNegotiationServiceDsp from '../../services/dsp/contract.negotiation.service.dsp';
import mongoose from 'mongoose';
import { NegotiationState } from '../../utils/types/dsp/message-types.interface.dsp';
import { ContractNegotiationModel } from '../../utils/types/dsp/ContractNegotiation.model';
import { ObjectId } from 'mongodb';

describe('DSP Contract Negotiation Service tests', () => {
    let mongoServer: MongoMemoryServer;
    const consumerPid = 'consumer-123456';
    let providerPid;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    after(async () => {
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('Contract Negotiation Service - Creation and Retrieval', () => {
        it('Should create a contract negotiation', async () => {
            const cn =
                await ContractNegotiationServiceDsp.createContractNegotiation({
                    consumerPid,
                    state: NegotiationState.REQUESTED,
                });

            expect(cn).to.have.property('id');
            expect(cn).to.have.property('providerPid');
            expect(cn.providerPid).to.match(/^urn:uuid:/);
            expect(cn.consumerPid).to.equal(consumerPid);
            expect(cn.state).to.equal('dspace:REQUESTED');
            providerPid = cn.providerPid;
        });

        it('Should retrieve a contract negotiation by providerPid', async () => {
            // Create a contract negotiation first
            const created =
                await ContractNegotiationServiceDsp.createContractNegotiation({
                    consumerPid,
                    state: NegotiationState.REQUESTED,
                });

            const cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromProviderPid(
                    {
                        providerPid: created.providerPid,
                    }
                );

            expect(cn).to.have.property('id');
            expect(cn.providerPid).to.equal(created.providerPid);
            expect(cn.consumerPid).to.equal(consumerPid);
        });

        it('Should return null when retrieving non-existent providerPid', async () => {
            const cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromProviderPid(
                    {
                        providerPid: 'non-existent',
                    }
                );

            expect(cn).to.be.null;
        });

        it('Should retrieve a contract negotiation by consumerPid', async () => {
            // Create a contract negotiation first
            await ContractNegotiationServiceDsp.createContractNegotiation({
                consumerPid,
                state: NegotiationState.REQUESTED,
            });

            const cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPid(
                    {
                        consumerPid,
                    }
                );

            expect(cn).to.have.property('id');
            expect(cn.consumerPid).to.equal(consumerPid);
        });

        it('Should return null when retrieving non-existent consumerPid', async () => {
            const cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPid(
                    {
                        consumerPid: 'non-existent',
                    }
                );

            expect(cn).to.be.null;
        });

        it('Should retrieve a contract negotiation by consumerPid and ProviderPid', async () => {
            // Create a contract negotiation first
            const response =
                await ContractNegotiationServiceDsp.createContractNegotiation({
                    consumerPid,
                    state: NegotiationState.REQUESTED,
                });

            const cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        consumerPid,
                        providerPid: response.providerPid,
                    }
                );

            expect(cn).to.have.property('id');
            expect(cn.consumerPid).to.equal(consumerPid);
        });

        it('Should return null when retrieving non-existent consumerPid', async () => {
            const cn =
                await ContractNegotiationServiceDsp.getContractNegotiationFromConsumerPidAnProviderPid(
                    {
                        consumerPid: 'non-existent',
                        providerPid: 'non-existent',
                    }
                );

            expect(cn).to.be.null;
        });
    });

    describe('Contract Negotiation Service - Property Mapping', () => {
        it('Should correctly map IDS properties to DB properties', () => {
            expect(
                ContractNegotiationServiceDsp.getMappedIDSToDBProperty(
                    'dspace:providerPid'
                )
            ).to.equal('providerPid');

            expect(
                ContractNegotiationServiceDsp.getMappedIDSToDBProperty(
                    'dspace:consumerPid'
                )
            ).to.equal('consumerPid');

            expect(
                ContractNegotiationServiceDsp.getMappedIDSToDBProperty(
                    'dspace:negotiationState'
                )
            ).to.equal('state');
        });

        it('Should throw error for invalid property mapping', () => {
            expect(() => {
                // @ts-expect-error Testing invalid input
                ContractNegotiationServiceDsp.getMappedIDSToDBProperty(
                    'dspace:invalid-property'
                );
            }).to.throw('Property not found');
        });
    });

    describe('Contract Negotiation Service - Message Handling', () => {
        it('Should retrieve contract negotiation message from documentId', async () => {
            // Create a contract negotiation with documentId
            const cn = new ContractNegotiationModel({
                providerPid: 'urn:uuid:test',
                consumerPid,
                state: NegotiationState.REQUESTED,
            });
            await cn.save();

            const message =
                await ContractNegotiationServiceDsp.getContractNegotiationMessageFromDocumentId(
                    cn._id.toString()
                );

            expect(message).to.have.property(
                '@type',
                'dspace:ContractNegotiation'
            );
            expect(message).to.have.property(
                'dspace:providerPid',
                'urn:uuid:test'
            );
            expect(message).to.have.property('dspace:consumerPid', consumerPid);
            expect(message).to.have.property(
                'dspace:state',
                NegotiationState.REQUESTED
            );
            expect(message).to.have.property('@context');
        });

        it('Should return undefined when retrieving message with non-existent documentId', async () => {
            const message =
                await ContractNegotiationServiceDsp.getContractNegotiationMessageFromDocumentId(
                    new ObjectId().toString()
                );

            expect(message).to.have.property('dspace:providerPid', undefined);
            expect(message).to.have.property('dspace:consumerPid', undefined);
            expect(message).to.have.property('dspace:state', undefined);
        });
    });
});
