import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config, setupEnvironment } from '../../../config/environment';
import { startServer, AppServer } from '../../../server';
import { URLS } from './fixtures';

export interface FlowTestContext {
    server: AppServer;
    mongoServer: MongoMemoryServer;
    restoreReadFileSync: () => void;
}

/**
 * Boot a standalone connector instance for a flow test.
 *
 * - in-memory Mongo (no host dependency)
 * - inject a fake config.json so the connector resolves its catalog/contract
 *   URIs and dataspace endpoint to known test values
 * - short EXCHANGE_TIMEOUT so a stuck flow fails fast
 *
 * Returns the started server + handles needed to tear everything down cleanly.
 */
export const bootFlowTestServer = async (overrides?: {
    endpoint?: string;
}): Promise<FlowTestContext> => {
    process.env.NODE_ENV = 'test';
    process.env.EXCHANGE_TIMEOUT = process.env.EXCHANGE_TIMEOUT ?? '5';

    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const fakeConfig = {
        endpoint: overrides?.endpoint ?? URLS.consumerEndpoint,
        serviceKey: 'test-service-key',
        secretKey: 'test-secret-key',
        catalogUri: URLS.catalogBase,
        contractUri: 'http://host.docker.internal:8888/',
        consentUri: 'http://host.docker.internal:9999/',
    };

    const fs = require('fs');
    const originalReadFileSync = fs.readFileSync;
    // Match config.json AND config.<env>.json (e.g. config.test.json) so the
    // real config.test.json in src/ does not leak through and override our
    // fake endpoint.
    const configFileRegex = /[\\/]config(\.[a-z0-9]+)?\.json$/i;
    fs.readFileSync = (path: string, ...rest: any[]) => {
        if (typeof path === 'string' && configFileRegex.test(path)) {
            return JSON.stringify(fakeConfig);
        }
        return originalReadFileSync(path, ...rest);
    };

    setupEnvironment('test');
    const server = await startServer(config.port);

    return {
        server,
        mongoServer,
        restoreReadFileSync: () => {
            fs.readFileSync = originalReadFileSync;
        },
    };
};

export const teardownFlowTestServer = async (ctx?: FlowTestContext) => {
    if (!ctx) return;
    ctx.restoreReadFileSync();
    ctx.server.server.close();
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
    await ctx.mongoServer.stop();
};
