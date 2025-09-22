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
import { Catalog } from '../../utils/types/catalog';
import { ObjectId } from 'mongodb';
import {
    setUpDspCatalogErrorNockMocks,
    setUpDspCatalogNockMocks,
} from '../utils/mock';

dotenv.config({ path: '.env.test' });

describe('Catalog API tests', () => {
    let serverInstance: AppServer;
    process.env.NODE_ENV = 'test';
    let mongoServer: MongoMemoryServer;
    let resourceId: any;
    let resourceErrorId: any;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        const cat = await Catalog.create({
            resourceId: '660432088020cd0ef5427e1b',
            enabled: true,
            endpoint:
                'http://catalog.test/v1/catalog/serviceofferings/660432088020cd0ef5427e1b',
            type: 'serviceofferings',
        });

        const caterror = await Catalog.create({
            resourceId: '660432088020cd0ef5427e2c',
            enabled: true,
            endpoint:
                'http://catalog.test/v1/catalog/serviceofferings/660432088020cd0ef5427e2c',
            type: 'serviceofferings',
        });

        resourceId = cat._id.toString();
        resourceErrorId = caterror._id.toString();

        setupEnvironment('test');
        serverInstance = await startTestServer(config.port);
    });

    after(async () => {
        serverInstance.server.close();
        Logger.info({ message: 'Server closed' });
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('DSP Catalog Router Tests', () => {
        describe('Contract Negotiation Request Tests', () => {
            it('Should handle catalog request and respond with 200', async () => {
                const [response] = await handle(
                    request(serverInstance.app).post('/catalog/request').send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:CatalogRequestMessage',
                    })
                );

                expect(response.status).to.equal(200);
                expect(response.body).has.property('@type', 'dcat:Catalog');
                expect(response.body).has.property('dcat:dataset');
                expect(response.body['dcat:dataset'].length).equal(2);
                expect(response.body['dcat:dataset'][0]).equal(resourceId);
            });

            it('Should return 400 for invalid catalog request format', async () => {
                const response = await request(serverInstance.app)
                    .post('/catalog/request')
                    .send({
                        // Missing required fields
                        '@context':
                            'https://w3id.org/dspace/2024/1/context.json',
                        '@type': 'dspace:CatalogInvalidMessage',
                    });
                expect(response.status).to.equal(400);
            });

            describe('Dataset Retrieval Tests', () => {
                it('Should retrieve a dataset and respond with 200', async () => {
                    setUpDspCatalogNockMocks();
                    const response = await request(serverInstance.app)
                        .get(`/catalog/datasets/${resourceId}`)
                        .send();

                    expect(response.status).to.equal(200);
                    expect(response.body).to.have.property(
                        '@id',
                        '660432088020cd0ef5427e1b'
                    );
                    expect(response.body).to.have.property(
                        '@type',
                        'ServiceOffering'
                    );
                    expect(response.body).to.have.property(
                        'dcterms:title',
                        'test no user interacton'
                    );
                    expect(response.body).to.have.property(
                        'dcterms:description',
                        'des'
                    );
                    expect(response.body).to.have.property(
                        'dcterms:identifier',
                        '660432088020cd0ef5427e1b'
                    );
                    expect(response.body['odrl:hasPolicy'].length).equal(1);
                    expect(response.body).to.have.property(
                        'dcterms:issued',
                        '2024-03-27T14:49:44.506Z'
                    );
                    expect(response.body).to.have.property(
                        'dcterms:modified',
                        '2024-03-27T14:50:02.746Z'
                    );
                    expect(response.body).to.have.property(
                        'dcat:version',
                        '1.1.0'
                    );
                    expect(response.body).to.have.property('dcat:keyword', '');
                    expect(response.body['dcterms:hasPart'].length).equal(1);
                    expect(response.body['dcterms:hasPart'][0]).equal(
                        'http://catalog.test/v1/catalog/dataresources/65e71e4174f9e9026bd5dc41'
                    );
                    expect(response.body['dcat:distribution'].length).equal(2);
                    expect(
                        response.body['dcat:distribution'][0]
                    ).to.have.property(
                        'dcat:accessURL',
                        'http://catalog.test:3331/api/users/{userId}'
                    );
                    expect(
                        response.body['dcat:distribution'][0]
                    ).to.have.property('dcat:mediaType', '');
                    expect(
                        response.body['dcat:distribution'][0]
                    ).to.have.property('dcat:accessService');
                    expect(
                        response.body['dcat:distribution'][1]
                    ).to.have.property(
                        'dcat:accessURL',
                        'http://catalog.test:3331/api/users/{userId}'
                    );
                    expect(
                        response.body['dcat:distribution'][1]
                    ).to.have.property('dcat:mediaType', '');
                    expect(
                        response.body['dcat:distribution'][1]
                    ).to.have.property('dcat:accessService');
                    expect(
                        response.body['dcat:qualifiedRelation'].length
                    ).equal(1);
                    expect(
                        response.body['dcat:qualifiedRelation'][0]
                    ).to.have.property('dcat:hadRole', 'DataResource');
                    expect(
                        response.body['dcat:qualifiedRelation'][0]
                    ).to.have.property(
                        'dcterms:relation',
                        'http://catalog.test/v1/catalog/dataresources/65e71e4174f9e9026bd5dc41'
                    );
                    expect(
                        response.body['dcat:qualifiedRelation'][0]
                    ).to.have.property('dcterms:description', 'desc');
                    expect(response.body).to.have.property('dcterms:creator');
                    expect(response.body['dcterms:creator']).to.have.property(
                        'account',
                        '6564abb5d853e8e05b132057'
                    );
                    expect(response.body).to.have.property(
                        'dcterms:spatial',
                        'World'
                    );
                });

                it('Should return 404 for non-existent Dataset', async () => {
                    const response = await request(serverInstance.app)
                        .get(`/catalog/datasets/${new ObjectId()}`)
                        .send();
                    expect(response.status).to.equal(404);
                });

                it('Should return 500 for dependency error', async () => {
                    setUpDspCatalogErrorNockMocks();
                    const response = await request(serverInstance.app)
                        .get(`/catalog/datasets/${resourceErrorId}`)
                        .send();
                    expect(response.status).to.equal(500);
                });
            });
        });
    });
});
