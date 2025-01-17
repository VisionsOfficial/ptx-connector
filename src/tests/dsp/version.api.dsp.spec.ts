import { expect } from 'chai';
import request from 'supertest';
import { config, setupEnvironment } from '../../config/environment';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Logger } from '../../libs/loggers';
import { startTestServer } from '../utils/testServer';
import { AppServer } from '../../server';
import { handle } from '../../libs/loaders/handler';
import { getEndpoint } from '../../libs/loaders/configuration';

dotenv.config({ path: '.env.test' });

describe('Catalog API tests', () => {
    let serverInstance: AppServer;
    process.env.NODE_ENV = 'test';
    let mongoServer: MongoMemoryServer;

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

    describe('DSP Version Router Tests', () => {
        it('Should handle version request and respond with 200', async () => {
            const [response] = await handle(
                request(serverInstance.app).get('/.well-known/dspace-version')
            );

            expect(response.status).to.equal(200);
            expect(response.body).has.property(
                '@context',
                'https://w3id.org/dspace/2024/1/context.json'
            );
            expect(response.body).has.property('protocolVersions');
            expect(response.body['protocolVersions'][0]).has.property(
                'version',
                '2024-1'
            );
            expect(response.body['protocolVersions'][0]).has.property(
                'path',
                await getEndpoint()
            );
        });
    });
});
