import { expect } from 'chai';
import { MongoMemoryServer } from 'mongodb-memory-server';
import TransferProcessServiceDsp from '../../services/dsp/transfer.process.service.dsp';
import mongoose from 'mongoose';
import { TransferState } from '../../utils/types/dsp/message-types.interface.dsp';
import { TransferProcessModel } from '../../utils/types/dsp/TransferProcess.model';
import { ObjectId } from 'mongodb';

describe('DSP Transfer Process Service tests', () => {
    let mongoServer: MongoMemoryServer;
    const consumerPid = 'consumer-123456';
    let providerPid: string;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    after(async () => {
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('Transfer Process Service - Creation and Retrieval', () => {
        it('Should create a transfer process', async () => {
            const tp = await TransferProcessServiceDsp.createTransferProcess({
                consumerPid,
                state: TransferState.REQUESTED,
            });

            expect(tp).to.have.property('id');
            expect(tp).to.have.property('providerPid');
            expect(tp.providerPid).to.match(/^urn:uuid:/);
            expect(tp.consumerPid).to.equal(consumerPid);
            expect(tp.state).to.equal('dspace:REQUESTED');
            providerPid = tp.providerPid;
        });

        it('Should retrieve a transfer process by providerPid', async () => {
            // Create a transfer process first
            const created =
                await TransferProcessServiceDsp.createTransferProcess({
                    consumerPid,
                    state: TransferState.REQUESTED,
                });

            const tp =
                await TransferProcessServiceDsp.getTransferProcessFromProviderPid(
                    {
                        providerPid: created.providerPid,
                    }
                );

            expect(tp).to.have.property('id');
            expect(tp.providerPid).to.equal(created.providerPid);
            expect(tp.consumerPid).to.equal(consumerPid);
        });

        it('Should return null when retrieving non-existent providerPid', async () => {
            const tp =
                await TransferProcessServiceDsp.getTransferProcessFromProviderPid(
                    {
                        providerPid: 'non-existent',
                    }
                );

            expect(tp).to.be.null;
        });

        it('Should retrieve a transfer process by consumerPid', async () => {
            // Create a transfer process first
            await TransferProcessServiceDsp.createTransferProcess({
                consumerPid,
                state: TransferState.REQUESTED,
            });

            const tp =
                await TransferProcessServiceDsp.getTransferProcessFromConsumerPid(
                    {
                        consumerPid,
                    }
                );

            expect(tp).to.have.property('id');
            expect(tp.consumerPid).to.equal(consumerPid);
        });

        it('Should return null when retrieving non-existent consumerPid', async () => {
            const tp =
                await TransferProcessServiceDsp.getTransferProcessFromConsumerPid(
                    {
                        consumerPid: 'non-existent',
                    }
                );

            expect(tp).to.be.null;
        });
    });

    describe('Transfer Process Service - Property Mapping', () => {
        it('Should correctly map IDS properties to DB properties', () => {
            expect(
                TransferProcessServiceDsp.getMappedIDSToDBProperty(
                    'dspace:providerPid'
                )
            ).to.equal('providerPid');

            expect(
                TransferProcessServiceDsp.getMappedIDSToDBProperty(
                    'dspace:consumerPid'
                )
            ).to.equal('consumerPid');

            expect(
                TransferProcessServiceDsp.getMappedIDSToDBProperty(
                    'dspace:negotiationState'
                )
            ).to.equal('state');
        });

        it('Should throw error for invalid property mapping', () => {
            expect(() => {
                TransferProcessServiceDsp.getMappedIDSToDBProperty(
                    'dspace:invalid-property' as any
                );
            }).to.throw('Property not found');
        });
    });

    describe('Transfer Process Service - Message Handling', () => {
        it('Should retrieve transfer process message from documentId', async () => {
            // Create a transfer process with documentId
            const tp = new TransferProcessModel({
                providerPid: 'urn:uuid:test',
                consumerPid,
                state: TransferState.REQUESTED,
            });
            await tp.save();

            const message =
                await TransferProcessServiceDsp.getTransferProcessMessageFromDocumentId(
                    tp._id.toString()
                );

            expect(message).to.have.property('@type', 'dspace:TransferProcess');
            expect(message).to.have.property(
                'dspace:providerPid',
                'urn:uuid:test'
            );
            expect(message).to.have.property('dspace:consumerPid', consumerPid);
            expect(message).to.have.property(
                'dspace:state',
                TransferState.REQUESTED
            );
            expect(message).to.have.property('@context');
        });

        it('Should handle non-existent documentId gracefully', async () => {
            const message =
                await TransferProcessServiceDsp.getTransferProcessMessageFromDocumentId(
                    new ObjectId().toString()
                );

            expect(message).to.have.property('@type', 'dspace:TransferProcess');
            expect(message).to.have.property('dspace:providerPid', undefined);
            expect(message).to.have.property('dspace:consumerPid', undefined);
            expect(message).to.have.property('dspace:state', undefined);
        });
    });
});
