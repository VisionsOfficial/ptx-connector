/**
 * Shared fixtures for flow tests.
 *
 * Mirrors the real catalog/contract/participant payloads from a local
 * Provider/Consumer setup, so the connector's behaviour can be exercised
 * end-to-end without any network or other connectors running.
 */

export const URLS = {
    catalogBase: 'http://host.docker.internal:4040/v1/catalog',
    contract:
        'http://host.docker.internal:8888/contracts/6a0efda83d981b2bab2dadd5',

    resourceId:
        'http://host.docker.internal:4040/v1/catalog/serviceofferings/66d187f4ee71f9f096bae8ca',
    purposeId:
        'http://host.docker.internal:4040/v1/catalog/serviceofferings/66d18b79ee71f9f096baecb0',

    providerParticipant:
        'http://host.docker.internal:4040/v1/catalog/participants/66d18724ee71f9f096bae810',
    consumerParticipant:
        'http://host.docker.internal:4040/v1/catalog/participants/66d18a1dee71f9f096baec08',

    dataResource:
        'http://host.docker.internal:4040/v1/catalog/dataresources/66d1889cee71f9f096bae98b',
    softwareResource:
        'http://host.docker.internal:4040/v1/catalog/softwareresources/66d18bf6ee71f9f096baed58',

    providerEndpoint: 'http://host.docker.internal:3333/',
    consumerEndpoint: 'http://host.docker.internal:3334/',

    providerRepresentation: 'http://host.docker.internal:3321/users',
    consumerRepresentation: 'http://localhost:3332/consume/store',
};

export const contractFixture = {
    _id: '6a0efda83d981b2bab2dadd5',
    ecosystem:
        'http://host.docker.internal:4040/v1/catalog/ecosystems/6a0efda889aadebefa1c8d3c',
    orchestrator: URLS.providerParticipant,
    rolesAndObligations: [] as any[],
    status: 'signed',
    useDVCT: false,
    serviceOfferings: [
        {
            participant: URLS.providerParticipant,
            serviceOffering: URLS.resourceId,
            policies: [
                {
                    description: 'CAN use data without any restrictions',
                    permission: [
                        {
                            action: 'use',
                            target: URLS.resourceId,
                            duty: [],
                            constraint: [],
                        },
                    ],
                    prohibition: [],
                },
            ],
            _id: '6a0efdc03d981b2bab2dade9',
        },
        {
            participant: URLS.consumerParticipant,
            serviceOffering: URLS.purposeId,
            policies: [
                {
                    description: 'CAN use data without any restrictions',
                    permission: [
                        {
                            action: 'use',
                            target: URLS.purposeId,
                            duty: [],
                            constraint: [],
                        },
                    ],
                    prohibition: [],
                },
            ],
            _id: '6a0efdd83d981b2bab2dadf5',
        },
    ],
    serviceChains: [
        {
            catalogId: '6a2805a3b1f55f757e783e9e',
            serviceChainId: '6a2805a3b1f55f757e783e9e',
            services: [
                {
                    participant: URLS.providerParticipant,
                    service: URLS.resourceId,
                    params: '',
                    pre: [],
                },
                {
                    participant:
                        'http://host.docker.internal:4040/v1/catalog/participants/66d18a1dee71f9f096baec07',
                    service:
                        'http://host.docker.internal:4040/v1/catalog/infrastructureservices/67f669b57b3045a9bb30e240',
                    params: '',
                    pre: [],
                },
                {
                    participant: URLS.consumerParticipant,
                    service: URLS.purposeId,
                    params: '',
                    pre: [],
                },
            ],
        },
    ],
    purpose: [] as any[],
    members: [],
    revokedMembers: [],
};

export const resourceServiceOfferingFixture = {
    '@context': 'http://host.docker.internal:4040/v1/serviceoffering',
    '@type': 'ServiceOffering',
    _id: '66d187f4ee71f9f096bae8ca',
    name: 'Prov.',
    providedBy: '66d18724ee71f9f096bae810',
    aggregationOf: [URLS.dataResource],
    dependsOn: [] as string[],
    dataResources: [URLS.dataResource],
    softwareResources: [] as string[],
    policy: [{ uid: 'rule-access-1', name: 'No Restriction' }],
    archived: false,
    visible: true,
    status: 'published',
};

export const purposeServiceOfferingFixture = {
    '@context': 'http://host.docker.internal:4040/v1/serviceoffering',
    '@type': 'ServiceOffering',
    _id: '66d18b79ee71f9f096baecb0',
    name: 'Cons.',
    providedBy: '66d18a1dee71f9f096baec08',
    aggregationOf: [URLS.softwareResource],
    dependsOn: [] as string[],
    dataResources: [] as string[],
    softwareResources: [URLS.softwareResource],
    policy: [{ uid: 'rule-access-1', name: 'No Restriction' }],
    archived: false,
    visible: true,
    status: 'published',
};

export const providerParticipantFixture = {
    '@context': 'http://host.docker.internal:4040/v1/participant',
    '@type': 'Participant',
    _id: '66d18724ee71f9f096bae810',
    legalName: 'Test-DataProvider',
    dataspaceEndpoint: URLS.providerEndpoint,
};

export const consumerParticipantFixture = {
    '@context': 'http://host.docker.internal:4040/v1/participant',
    '@type': 'Participant',
    _id: '66d18a1dee71f9f096baec08',
    legalName: 'Participant One',
    dataspaceEndpoint: URLS.consumerEndpoint,
};

export const dataResourceFixture = {
    '@context': 'http://host.docker.internal:4040/v1/dataresource',
    '@type': 'DataResource',
    _id: '66d1889cee71f9f096bae98b',
    name: 'Provider',
    producedBy: '66d18724ee71f9f096bae810',
    containsPII: false,
    isPayloadForAPI: false,
    representation: {
        _id: '66d1889cee71f9f096bae996',
        resourceID: '66d1889cee71f9f096bae98b',
        type: 'REST',
        url: URLS.providerRepresentation,
        method: 'none',
        credential: '',
        queryParams: ['page', 'limit', 'skip'],
        mimeType: 'application/json',
        sql: { url: null, query: null, credential: null },
        proxy: { host: null, port: null, protocol: null, credential: null },
    },
};

export const softwareResourceFixture = {
    '@context': 'http://host.docker.internal:4040/v1/softwareresource',
    '@type': 'SoftwareResource',
    _id: '66d18bf6ee71f9f096baed58',
    providedBy: '66d18a1dee71f9f096baec08',
    name: 'consumer',
    usePII: false,
    isAPI: true,
    representation: {
        _id: '66d18bf6ee71f9f096baed63',
        resourceID: '66d18bf6ee71f9f096baed58',
        url: URLS.consumerRepresentation,
        method: 'none',
        credential: '',
        type: 'REST',
        queryParams: ['data', 'test', 'classification_request_id'],
        mimeType: 'application/json',
        proxy: { host: null, port: null, protocol: null, credential: null },
        sql: { url: null, query: null, credential: null },
    },
};

/**
 * Sample payload the simulated remote provider will push to /consumer/import
 * after our connector calls providerExport.
 */
export const providerExportedData = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
};
