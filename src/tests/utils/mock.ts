import nock from 'nock';

export const setUpDspCatalogNockMocks = () => {
    // Mocking ecosystem contract
    nock('http://catalog.test')
        .get('/v1/catalog/serviceofferings/660432088020cd0ef5427e1b')
        .reply(200, {
            '@context': 'http://catalog.test/v1/serviceoffering',
            '@type': 'ServiceOffering',
            _id: '660432088020cd0ef5427e1b',
            name: 'test no user interacton',
            providedBy: '6564abb5d853e8e05b132057',
            aggregationOf: [
                'http://catalog.test/v1/catalog/dataresources/65e71e4174f9e9026bd5dc41',
            ],
            dependsOn: [],
            policy: [
                {
                    '@context': {
                        xsd: 'http://www.w3.org/2001/XMLSchema#',
                        description: {
                            '@id': 'https://schema.org/description',
                            '@container': '@language',
                        },
                    },
                    '@id': 'http://catalog.test/static/references/rules/rule-access-4.json',
                    title: {
                        '@type': 'xsd/string',
                        '@value': 'Count',
                    },
                    uid: 'rule-access-4',
                    name: 'Count',
                    description: [
                        {
                            '@value': 'MUST not use data for more than n times',
                            '@language': 'en',
                        },
                    ],
                    policy: {
                        permission: [
                            {
                                action: 'use',
                                target: '@{target}',
                                constraint: [
                                    {
                                        leftOperand: 'count',
                                        operator: 'lt',
                                        rightOperand: '@{value}',
                                    },
                                ],
                            },
                        ],
                    },
                    requestedFields: ['target', 'value'],
                },
            ],
            termsAndConditions: '',
            dataProtectionRegime: [],
            dataAccountExport: [],
            location: 'World',
            description: 'des',
            keywords: [],
            dataResources: [
                'http://catalog.test/v1/catalog/dataresources/65e71e4174f9e9026bd5dc41',
            ],
            softwareResources: [],
            archived: false,
            visible: true,
            pricing: '180',
            pricingModel: [
                'http://catalog.test/static/references/pricing-model/dataBased.json',
            ],
            businessModel: [
                'http://catalog.test/static/references/business-model/subscription.json',
            ],
            maximumConsumption: '',
            maximumPerformance: '',
            pricingDescription: 'dfezd',
            noUserInteraction: false,
            compliantServiceOfferingVC: '',
            serviceOfferingVC: '',
            schema_version: '1.1.0',
            createdAt: '2024-03-27T14:49:44.506Z',
            updatedAt: '2024-03-27T14:50:02.746Z',
            __v: 0,
        });
    // Mocking ecosystem contract
    nock('http://catalog.test')
        .get('/v1/catalog/dataresources/65e71e4174f9e9026bd5dc41')
        .reply(200, {
            '@context': 'http://catalog.test/v1/dataresource',
            '@type': 'DataResource',
            _id: '65e71e4174f9e9026bd5dc41',
            aggregationOf: [],
            name: 'PROVIDER PAYLOAD TEST',
            description: 'desc',
            copyrightOwnedBy: [
                'http://catalog.test/v1/catalog/participants/6564abb5d853e8e05b132057',
            ],
            license: [],
            policy: [
                {
                    '@context': {
                        xsd: 'http://www.w3.org/2001/XMLSchema#',
                        description: {
                            '@id': 'https://schema.org/description',
                            '@container': '@language',
                        },
                    },
                    '@id': 'http://catalog.test/static/references/rules/rule-access-1.json',
                    title: {
                        '@type': 'xsd/string',
                        '@value': 'No Restriction',
                    },
                    uid: 'rule-access-1',
                    name: 'No Restriction',
                    description: [
                        {
                            '@value': 'CAN use data without any restrictions',
                            '@language': 'en',
                        },
                    ],
                    policy: {
                        permission: [
                            {
                                action: 'use',
                                target: '@{target}',
                                constraint: [],
                            },
                        ],
                    },
                    requestedFields: ['target'],
                },
            ],
            producedBy: '6564abb5d853e8e05b132057',
            exposedThrough: [],
            obsoleteDateTime: '',
            expirationDateTime: '',
            containsPII: false,
            anonymized_extract: '',
            archived: false,
            attributes: [],
            category: '648353e51d2c11adaae558c1',
            isPayloadForAPI: true,
            country_or_region: 'World',
            entries: -1,
            subCategories: [],
            schema_version: '1',
            createdAt: '2024-03-05T13:29:37.061Z',
            updatedAt: '2024-03-27T14:08:19.986Z',
            __v: 0,
            representation: {
                _id: '65e71e4174f9e9026bd5dc48',
                resourceID: '65e71e4174f9e9026bd5dc41',
                fileType: '',
                type: 'REST',
                url: 'http://catalog.test:3331/api/users/{userId}',
                sqlQuery: '',
                className: '',
                method: 'none',
                credential: '',
                createdAt: '2024-03-05T13:29:37.122Z',
                updatedAt: '2024-06-25T07:48:59.077Z',
                __v: 0,
            },
            apiResponseRepresentation: {
                _id: '65e71e4174f9e9026bd5dc4d',
                resourceID: '65e71e4174f9e9026bd5dc41',
                fileType: '',
                type: 'REST',
                url: 'http://catalog.test:3331/api/users/{userId}',
                sqlQuery: '',
                className: '',
                method: 'none',
                credential: '',
                createdAt: '2024-03-05T13:29:37.141Z',
                updatedAt: '2024-06-25T07:48:59.073Z',
                __v: 0,
            },
        });
};
export const setUpDspCatalogErrorNockMocks = () => {
    // Mocking ecosystem contract
    nock('http://catalog.test')
        .get('/v1/catalog/serviceofferings/660432088020cd0ef5427e2c')
        .reply(200, {
            error: 'internal-server-error',
            statusCode: 500,
            message: 'Unknown Error',
        });
};
