import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import request from 'supertest';
import { AppServer } from '../../../server';
import { DataExchange } from '../../../utils/types/dataExchange';
import { DataExchangeStatusEnum } from '../../../utils/enums/dataExchangeStatusEnum';
import {
    URLS,
    contractFixture,
    resourceServiceOfferingFixture,
    purposeServiceOfferingFixture,
    providerParticipantFixture,
    consumerParticipantFixture,
    dataResourceFixture,
    softwareResourceFixture,
    providerExportedData,
} from './fixtures';

export interface FlowMocksHandle {
    mock: MockAdapter;
    calls: {
        createDataExchangeAtProvider: number;
        createDataExchangeAtConsumer: number;
        providerExport: number;
        providerRepresentationGet: number;
        consumerImportRepresentation: number;
        consumerImportRemote: number;
        syncWithParticipant: number;
    };
    /**
     * Resolves once any background callback initiated by a mock (e.g. the
     * simulated remote provider pushing data back to /consumer/import, or the
     * simulated remote consumer updating our DataExchange to IMPORT_SUCCESS)
     * has finished. Tests should await this before asserting so the in-flight
     * updateStatus / syncWithParticipant chain has fully drained.
     */
    simulatedRemote: Promise<void>;
    restore: () => void;
}

interface BaseOptions {
    silent?: boolean;
    failProviderRepresentation?: boolean;
    failConsumerRepresentation?: boolean;
    payload?: any;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Install the GET mocks that every ecosystem flow test needs:
 * contract, both service offerings, both participants, the data + software
 * resources. These are read-only and identical for every scenario.
 */
const installCatalogReadMocks = (mock: MockAdapter) => {
    mock.onGet(URLS.contract).reply(200, contractFixture);
    mock.onGet(URLS.resourceId).reply(200, resourceServiceOfferingFixture);
    mock.onGet(URLS.purposeId).reply(200, purposeServiceOfferingFixture);
    mock.onGet(URLS.providerParticipant).reply(
        200,
        providerParticipantFixture
    );
    mock.onGet(URLS.consumerParticipant).reply(
        200,
        consumerParticipantFixture
    );
    mock.onGet(URLS.dataResource).reply(200, dataResourceFixture);
    mock.onGet(URLS.softwareResource).reply(200, softwareResourceFixture);
};

/**
 * Status-sync PUTs flow back to whichever PDC we don't own. Match on path to
 * cover both directions in a single rule.
 */
const installSyncWithParticipantMock = (
    mock: MockAdapter,
    onCall: () => void
) => {
    mock.onPut(/\/private\/dataexchanges\/exchangeidentifier\//).reply(() => {
        onCall();
        return [200, { success: true }];
    });
};

/**
 * Mocks for a flow where our connector plays the consumer role:
 * - it creates the DataExchange at the (mocked) remote provider
 * - it calls /provider/export on the remote provider
 * - the mock simulates the remote provider pushing data back to our own
 *   /consumer/import endpoint via supertest, exercising the real import code
 */
export const installConsumerRoleMocks = (
    server: AppServer,
    options: BaseOptions = {}
): FlowMocksHandle => {
    const mock = new MockAdapter(axios, { onNoMatch: 'throwException' });

    const calls = {
        createDataExchangeAtProvider: 0,
        createDataExchangeAtConsumer: 0,
        providerExport: 0,
        providerRepresentationGet: 0,
        consumerImportRepresentation: 0,
        consumerImportRemote: 0,
        syncWithParticipant: 0,
    };

    let resolveRemote: () => void;
    const simulatedRemote = new Promise<void>((resolve) => {
        resolveRemote = resolve;
    });
    if (options.silent) {
        resolveRemote!();
    }

    installCatalogReadMocks(mock);

    mock.onPost(`${URLS.providerEndpoint}dataexchanges`).reply(() => {
        calls.createDataExchangeAtProvider++;
        return [200, { content: { _id: 'remote-provider-dex-id' } }];
    });

    mock.onPost(`${URLS.providerEndpoint}provider/export`).reply((req) => {
        calls.providerExport++;
        const body = JSON.parse(req.data);
        const exchangeIdentifier = body.exchangeIdentifier;

        if (!options.silent) {
            setImmediate(() => {
                request(server.app)
                    .post('/consumer/import')
                    .set('Content-Type', 'application/json')
                    .set('x-provider-data-exchange', exchangeIdentifier)
                    .send({
                        exchangeIdentifier,
                        data: options.payload ?? providerExportedData,
                    })
                    .end(() => resolveRemote!());
            });
        }

        return [200, { success: true }];
    });

    mock.onPost(URLS.consumerRepresentation).reply(() => {
        calls.consumerImportRepresentation++;
        if (options.failConsumerRepresentation) {
            return [500, { error: 'representation unavailable' }];
        }
        return [200, { success: true }];
    });

    installSyncWithParticipantMock(mock, () => {
        calls.syncWithParticipant++;
    });

    return {
        mock,
        calls,
        simulatedRemote,
        restore: () => mock.restore(),
    };
};

/**
 * Mocks for a flow where our connector plays the provider role:
 * - it creates the DataExchange at the (mocked) remote consumer
 * - it runs ProviderExportService in-process, which fetches data from its
 *   own representation URL and pushes it to the remote consumer's
 *   /consumer/import
 * - the mock simulates the remote consumer importing the data by flipping our
 *   local DataExchange to IMPORT_SUCCESS, so the consumerExchange polling
 *   loop resolves
 */
export const installProviderRoleMocks = (
    server: AppServer,
    options: BaseOptions = {}
): FlowMocksHandle => {
    const mock = new MockAdapter(axios, { onNoMatch: 'throwException' });

    const calls = {
        createDataExchangeAtProvider: 0,
        createDataExchangeAtConsumer: 0,
        providerExport: 0,
        providerRepresentationGet: 0,
        consumerImportRepresentation: 0,
        consumerImportRemote: 0,
        syncWithParticipant: 0,
    };

    let resolveRemote: () => void;
    const simulatedRemote = new Promise<void>((resolve) => {
        resolveRemote = resolve;
    });
    if (options.silent) {
        resolveRemote!();
    }

    installCatalogReadMocks(mock);

    mock.onPost(`${URLS.consumerEndpoint}dataexchanges`).reply(() => {
        calls.createDataExchangeAtConsumer++;
        return [200, { content: { _id: 'remote-consumer-dex-id' } }];
    });

    mock.onGet(URLS.providerRepresentation).reply((config) => {
        calls.providerRepresentationGet++;
        if (options.failProviderRepresentation) {
            return [500, { error: 'representation unavailable' }];
        }
        const data = options.payload ?? providerExportedData;
        return [
            200,
            data,
            {
                'content-type': 'application/json',
                'content-length': JSON.stringify(data).length.toString(),
            },
        ];
    });

    // The remote consumer receiving data. Simulate the side-effect: the
    // consumer would update its DataExchange to IMPORT_SUCCESS and sync it
    // back to us. We collapse that into a direct Mongo update against our
    // local DataExchange, which is what the polling loop watches.
    mock.onPost(`${URLS.consumerEndpoint}consumer/import`).reply((req) => {
        calls.consumerImportRemote++;
        const exchangeIdentifier =
            req.headers?.['x-provider-data-exchange'] ??
            (req.data ? JSON.parse(req.data).exchangeIdentifier : undefined);

        if (!options.silent && exchangeIdentifier) {
            setImmediate(() => {
                DataExchange.findOneAndUpdate(
                    { exchangeIdentifier },
                    { status: DataExchangeStatusEnum.IMPORT_SUCCESS }
                ).then(() => resolveRemote!(), () => resolveRemote!());
            });
        } else {
            resolveRemote!();
        }

        return [200, { success: true }];
    });

    installSyncWithParticipantMock(mock, () => {
        calls.syncWithParticipant++;
    });

    return {
        mock,
        calls,
        simulatedRemote,
        restore: () => mock.restore(),
    };
};

/**
 * Minimal mock set for direct inbound endpoint tests (POST /consumer/import,
 * POST /provider/export, etc.) where the calling PDC is simulated by
 * supertest itself. We only need the catalog reads and benign success
 * responses on any outbound HTTP traffic.
 */
export const installInboundEndpointMocks = (
    options: BaseOptions = {}
): FlowMocksHandle => {
    const mock = new MockAdapter(axios, { onNoMatch: 'throwException' });

    const calls = {
        createDataExchangeAtProvider: 0,
        createDataExchangeAtConsumer: 0,
        providerExport: 0,
        providerRepresentationGet: 0,
        consumerImportRepresentation: 0,
        consumerImportRemote: 0,
        syncWithParticipant: 0,
    };

    installCatalogReadMocks(mock);

    mock.onGet(URLS.providerRepresentation).reply(() => {
        calls.providerRepresentationGet++;
        if (options.failProviderRepresentation) {
            return [500, { error: 'representation unavailable' }];
        }
        const data = options.payload ?? providerExportedData;
        return [
            200,
            data,
            {
                'content-type': 'application/json',
                'content-length': JSON.stringify(data).length.toString(),
            },
        ];
    });

    mock.onPost(URLS.consumerRepresentation).reply(() => {
        calls.consumerImportRepresentation++;
        if (options.failConsumerRepresentation) {
            return [500, { error: 'representation unavailable' }];
        }
        return [200, { success: true }];
    });

    mock.onPost(`${URLS.consumerEndpoint}consumer/import`).reply(() => {
        calls.consumerImportRemote++;
        return [200, { success: true }];
    });

    installSyncWithParticipantMock(mock, () => {
        calls.syncWithParticipant++;
    });

    return {
        mock,
        calls,
        simulatedRemote: Promise.resolve(),
        restore: () => mock.restore(),
    };
};

/**
 * Backwards-compatible alias for the consumer role mocks. Older specs can
 * keep importing `installEcosystemFlowMocks`.
 */
export const installEcosystemFlowMocks = installConsumerRoleMocks;

/**
 * Persist a DataExchange that mirrors what triggerEcosystemFlow would have
 * created, for tests that hit the inbound endpoints directly (no
 * /consumer/exchange call upstream).
 */
export const seedPendingDataExchange = async (overrides?: Partial<{
    consumerEndpoint: string;
    providerEndpoint: string;
}>) => {
    const exchangeIdentifier = `flow-test-${Date.now()}-${Math.floor(
        Math.random() * 1e6
    )}`;
    const exchangeKey = `key-${Date.now()}`;

    const de = await DataExchange.create({
        exchangeIdentifier,
        exchangeKey,
        providerEndpoint:
            overrides?.providerEndpoint ?? URLS.providerEndpoint,
        consumerEndpoint:
            overrides?.consumerEndpoint ?? URLS.consumerEndpoint,
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
        purposeId: URLS.purposeId,
        contract: URLS.contract,
        status: DataExchangeStatusEnum.PENDING,
        createdAt: new Date(),
    });

    return de;
};
