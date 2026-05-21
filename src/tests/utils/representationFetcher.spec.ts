import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Readable } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const credentialServiceModule = require('../../services/private/v1/credential.private.service');

import {
    getRepresentation,
    postRepresentation,
    putRepresentation,
    postOrPutRepresentation,
} from '../../libs/loaders/representationFetcher';
import { IDataExchange } from '../../utils/types/dataExchange';
import { ObjectId } from 'mongodb';

const makeDataExchange = (overrides: Partial<IDataExchange> = {}): IDataExchange =>
    ({
        _id: new ObjectId(),
        contract: 'http://catalog/contracts/abc123',
        providerEndpoint: 'http://provider:3000',
        consumerEndpoint: 'http://consumer:3001',
        status: 'PENDING',
        resources: [] as any,
        purposes: [] as any,
        providerData: {
            mimetype: 'application/json',
        },
        ...overrides,
    } as unknown as IDataExchange);

describe('representationFetcher', () => {
    let axiosMock: MockAdapter;
    let s3SendStub: sinon.SinonStub;
    let uploadDoneStub: sinon.SinonStub;

    beforeEach(() => {
        axiosMock = new MockAdapter(axios);

        // Stub S3Client.prototype.send so no real AWS call is made
        s3SendStub = sinon.stub(S3Client.prototype, 'send');

        // Stub Upload.prototype.done so no real multipart upload is made
        uploadDoneStub = sinon.stub(Upload.prototype, 'done');

        sinon.stub(credentialServiceModule, 'getCredentialByIdService').resolves(null);
        sinon.stub(credentialServiceModule, 'getCredential').resolves({
            credentialResponse: [],
            isS3: false,
        });
    });

    afterEach(() => {
        axiosMock.restore();
        sinon.restore();
    });

    describe('getRepresentation()', () => {
        describe('method: none', () => {
            it('should perform a GET without authentication and return the response', async () => {
                const endpoint = 'http://provider/data';
                axiosMock.onGet(endpoint).reply(200, { hello: 'world' });

                const result = await getRepresentation({
                    method: 'none',
                    endpoint,
                    credential: null,
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
                expect(result.data).to.deep.equal({ hello: 'world' });
            });

            it('should inject x-ptx headers into the request', async () => {
                const endpoint = 'http://provider/data';
                const dataExchange = makeDataExchange();

                axiosMock.onGet(endpoint).reply((config) => {
                    expect(config.headers).to.have.property('x-ptx-dataExchangeId');
                    expect(config.headers).to.have.property('x-ptx-contractId');
                    return [200, {}];
                });

                await getRepresentation({
                    method: 'none',
                    endpoint,
                    credential: null,
                    dataExchange,
                } as any);
            });

            it('should replace {userId} in the URL with the consent identifier', async () => {
                const endpoint = 'http://provider/data/{userId}';
                const decryptedConsent = {
                    providerUserIdentifier: { identifier: 'user-42' },
                };

                axiosMock.onGet('http://provider/data/user-42').reply(200, { ok: true });

                const result = await getRepresentation({
                    method: 'none',
                    endpoint,
                    credential: null,
                    decryptedConsent,
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
            });

            it('should use responseType arraybuffer for non-JSON mimeTypes', async () => {
                const endpoint = 'http://provider/file.csv';
                axiosMock.onGet(endpoint).reply((config) => {
                    expect(config.responseType).to.equal('arraybuffer');
                    return [200, Buffer.from('a,b,c')];
                });

                await getRepresentation({
                    method: 'none',
                    endpoint,
                    credential: null,
                    mimeType: 'text/csv',
                    dataExchange: makeDataExchange(),
                } as any);
            });

            it('should return a complete Buffer for a large binary file (arraybuffer)', async () => {
                const endpoint = 'http://provider/file.bin';

                // 2 MB of deterministic binary content
                const TOTAL_SIZE = 2 * 1024 * 1024;
                const fullBuffer = Buffer.alloc(TOTAL_SIZE);
                for (let i = 0; i < TOTAL_SIZE; i++) fullBuffer[i] = i % 256;

                axiosMock.onGet(endpoint).reply(200, fullBuffer, {
                    'content-type': 'application/octet-stream',
                    'content-length': TOTAL_SIZE.toString(),
                });

                const result = await getRepresentation({
                    method: 'none',
                    endpoint,
                    credential: null,
                    mimeType: 'application/octet-stream',
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
                // axios-mock-adapter returns the buffer as-is for arraybuffer responseType
                const receivedBuffer = Buffer.isBuffer(result.data)
                    ? result.data
                    : Buffer.from(result.data as ArrayBuffer);
                expect(receivedBuffer.length).to.equal(
                    TOTAL_SIZE,
                    `Expected ${TOTAL_SIZE} bytes but got ${receivedBuffer.length}`
                );
                expect(receivedBuffer.equals(fullBuffer)).to.be.true;
            });
        });

        describe('method: apiKey', () => {
            it('should inject the API key into the request headers', async () => {
                const endpoint = 'http://provider/secure';

                (credentialServiceModule.getCredential as sinon.SinonStub).resolves({
                    credentialResponse: [{ key: 'X-API-Key', value: 'secret-key', type: 'apiKey' }],
                    isS3: false,
                });

                axiosMock.onGet(endpoint).reply((config) => {
                    expect(config.headers['X-API-Key']).to.equal('secret-key');
                    return [200, { secure: true }];
                });

                const result = await getRepresentation({
                    method: 'apiKey',
                    endpoint,
                    credential: 'cred-1',
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
            });

            it('should return a complete Buffer for a large binary file with apiKey (arraybuffer)', async () => {
                const endpoint = 'http://provider/secure-file.bin';

                (credentialServiceModule.getCredential as sinon.SinonStub).resolves({
                    credentialResponse: [{ key: 'X-API-Key', value: 'secret', type: 'apiKey' }],
                    isS3: false,
                });

                const TOTAL_SIZE = 2 * 1024 * 1024;
                const fullBuffer = Buffer.alloc(TOTAL_SIZE);
                for (let i = 0; i < TOTAL_SIZE; i++) fullBuffer[i] = i % 256;

                axiosMock.onGet(endpoint).reply(200, fullBuffer, {
                    'content-type': 'application/octet-stream',
                });

                const result = await getRepresentation({
                    method: 'apiKey',
                    endpoint,
                    credential: 'cred-1',
                    mimeType: 'application/octet-stream',
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
                const receivedBuffer = Buffer.isBuffer(result.data)
                    ? result.data
                    : Buffer.from(result.data as ArrayBuffer);
                expect(receivedBuffer.length).to.equal(TOTAL_SIZE);
                expect(receivedBuffer.equals(fullBuffer)).to.be.true;
            });
        });

        describe('method: s3', () => {
            it('should call S3Client.send and return a normalised response object', async () => {
                const endpoint = 'http://minio:9000/my-bucket/path/to/file.json';

                (credentialServiceModule.getCredential as sinon.SinonStub).resolves({
                    credentialResponse: [
                        {
                            type: 's3',
                            content: { accessKeyId: 'AKID', secretAccessKey: 'SECRET', region: 'us-east-1' },
                        },
                    ],
                    isS3: true,
                });

                const readable = Readable.from(Buffer.from(JSON.stringify({ key: 'value' })));
                s3SendStub.resolves({
                    Body: readable,
                    ContentType: 'application/json',
                    ContentLength: 15,
                });

                const result = await getRepresentation({
                    method: 'apiKey',
                    endpoint,
                    credential: 'cred-s3',
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
                expect(result.headers['content-type']).to.equal('application/json');
                expect(result.headers['content-file-name']).to.equal('path/to/file.json');
                expect(s3SendStub.calledOnce).to.be.true;
            });

            it('should correctly concatenate multiple stream chunks into a single Buffer', async () => {
                const endpoint = 'http://minio:9000/bucket/file.bin';

                (credentialServiceModule.getCredential as sinon.SinonStub).resolves({
                    credentialResponse: [
                        {
                            type: 's3',
                            content: { accessKeyId: 'AKID', secretAccessKey: 'SECRET', region: 'us-east-1' },
                        },
                    ],
                    isS3: true,
                });

                // ── Simulate a large file (5 MB) split into 64 KB chunks ─────────────
                const CHUNK_SIZE = 64 * 1024;          // 64 KB — typical TCP/S3 chunk
                const TOTAL_SIZE = 5 * 1024 * 1024;   // 5 MB

                // Deterministic pseudo-random content so we can verify integrity
                const fullBuffer = Buffer.alloc(TOTAL_SIZE);
                for (let i = 0; i < TOTAL_SIZE; i++) {
                    fullBuffer[i] = i % 256;
                }

                const chunks: Buffer[] = [];
                for (let offset = 0; offset < TOTAL_SIZE; offset += CHUNK_SIZE) {
                    chunks.push(fullBuffer.subarray(offset, Math.min(offset + CHUNK_SIZE, TOTAL_SIZE)));
                }

                // Build a Readable that drains all chunks asynchronously
                const largeFileStream = new Readable({ read() {} });
                setTimeout(() => {
                    for (const chunk of chunks) {
                        largeFileStream.push(chunk);
                    }
                    largeFileStream.push(null); // EOF
                }, 0);

                s3SendStub.resolves({
                    Body: largeFileStream,
                    ContentType: 'application/octet-stream',
                    ContentLength: TOTAL_SIZE,
                });

                const result = await getRepresentation({
                    method: 'apiKey',
                    endpoint,
                    credential: 'cred-s3',
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
                expect(Buffer.isBuffer(result.data)).to.be.true;
                expect(result.data.length).to.equal(
                    TOTAL_SIZE,
                    `Expected ${TOTAL_SIZE} bytes but got ${result.data.length} — chunk concatenation is broken`
                );
                expect(result.headers['content-length']).to.equal(TOTAL_SIZE.toString());
                expect(result.data.equals(fullBuffer)).to.be.true;
                expect(s3SendStub.calledOnce).to.be.true;
            });

            it('should throw an error if S3 credentials are missing', async () => {
                (credentialServiceModule.getCredential as sinon.SinonStub).resolves({
                    credentialResponse: [],
                    isS3: true,
                });

                try {
                    await getRepresentation({
                        method: 'apiKey',
                        endpoint: 'http://minio:9000/bucket/key',
                        credential: 'cred-s3',
                        dataExchange: makeDataExchange(),
                    } as any);
                    expect.fail('Should have thrown an error');
                } catch (err: any) {
                    expect(err.message).to.equal('S3 credentials not found');
                }
            });
        });
    });

    describe('postRepresentation()', () => {
        describe('method: none', () => {
            it('should perform a POST without authentication', async () => {
                const endpoint = 'http://consumer/ingest';
                axiosMock.onPost(endpoint).reply(201, { created: true });

                const result = await postRepresentation({
                    method: 'none',
                    endpoint,
                    data: { foo: 'bar' },
                    credential: null,
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(201);
            });

            it('should forward the request body correctly', async () => {
                const endpoint = 'http://consumer/ingest';
                const payload = { name: 'test', value: 42 };

                axiosMock.onPost(endpoint).reply((config) => {
                    const body = JSON.parse(config.data);
                    expect(body).to.deep.equal(payload);
                    return [200, {}];
                });

                await postRepresentation({
                    method: 'none',
                    endpoint,
                    data: payload,
                    credential: null,
                    dataExchange: makeDataExchange(),
                } as any);
            });
        });

        describe('method: apiKey', () => {
            it('should inject the API key into the POST request headers', async () => {
                const endpoint = 'http://consumer/secure';

                (credentialServiceModule.getCredentialByIdService as sinon.SinonStub).resolves({
                    key: 'Authorization',
                    value: 'Bearer token123',
                    type: 'apiKey',
                });
                (credentialServiceModule.getCredential as sinon.SinonStub).resolves({
                    credentialResponse: [],
                    isS3: false,
                });

                axiosMock.onPost(endpoint).reply((config) => {
                    expect(config.headers['Authorization']).to.equal('Bearer token123');
                    return [200, {}];
                });

                const result = await postRepresentation({
                    method: 'apiKey',
                    endpoint,
                    data: {},
                    credential: 'cred-1',
                    dataExchange: makeDataExchange(),
                } as any);

                expect(result.status).to.equal(200);
            });
        });

        describe('method: s3', () => {
            const s3Creds = () => ({
                credentialResponse: [
                    {
                        type: 's3',
                        content: { accessKeyId: 'AKID', secretAccessKey: 'SECRET', region: 'eu-west-1' },
                    },
                ],
                isS3: true,
            });

            it('should upload via multipart S3 Upload and return a normalised response object', async () => {
                const endpoint = 'http://minio:9000/my-bucket/uploads';
                (credentialServiceModule.getCredential as sinon.SinonStub).resolves(s3Creds());
                uploadDoneStub.resolves({ ETag: '"etag-123"', VersionId: 'v1' });

                const dataExchange = makeDataExchange({
                    providerData: { mimetype: 'application/json', fileName: 'test.json' } as any,
                } as any);

                const result = await postRepresentation({
                    method: 'apiKey',
                    endpoint,
                    data: { record: 1 },
                    credential: 'cred-s3',
                    dataExchange,
                } as any);

                expect(result.status).to.equal(200);
                expect(result.data.bucket).to.equal('my-bucket');
                expect(result.data.etag).to.equal('"etag-123"');
                expect(uploadDoneStub.calledOnce).to.be.true;
            });

            it('should auto-generate a fileName when absent for an S3 upload', async () => {
                const endpoint = 'http://minio:9000/bucket/prefix';
                (credentialServiceModule.getCredential as sinon.SinonStub).resolves(s3Creds());
                uploadDoneStub.resolves({ ETag: '"e"' });

                const dataExchange = makeDataExchange({
                    providerData: { mimetype: 'application/json' } as any,
                } as any);

                const result = await postRepresentation({
                    method: 'apiKey',
                    endpoint,
                    data: {},
                    credential: 'cred-s3',
                    dataExchange,
                    mimeType: 'application/json',
                } as any);

                expect(result.data.key).to.match(/^prefix\/.+\.json$/);
            });

            it('should throw an error if S3 credential content is incomplete', async () => {
                (credentialServiceModule.getCredential as sinon.SinonStub).resolves({
                    credentialResponse: [{ type: 's3', content: {} }],
                    isS3: true,
                });

                try {
                    await postRepresentation({
                        method: 'apiKey',
                        endpoint: 'http://minio:9000/bucket/key',
                        data: {},
                        credential: 'cred-s3',
                        dataExchange: makeDataExchange(),
                    } as any);
                    expect.fail('Should have thrown an error');
                } catch (err: any) {
                    expect(err.message).to.equal('Missing S3 credential content');
                }
            });

            it('should upload a Readable stream directly to S3 without buffering', async () => {
                const endpoint = 'http://minio:9000/my-bucket/uploads';
                (credentialServiceModule.getCredential as sinon.SinonStub).resolves(s3Creds());
                uploadDoneStub.resolves({ ETag: '"etag-stream"' });

                const inputStream = Readable.from(Buffer.from('stream content'));
                const dataExchange = makeDataExchange({
                    providerData: { mimetype: 'application/json', fileName: 'stream.json' } as any,
                } as any);

                const result = await postRepresentation({
                    method: 'apiKey',
                    endpoint,
                    data: inputStream,
                    credential: 'cred-s3',
                    dataExchange,
                } as any);

                expect(result.status).to.equal(200);
                expect(result.data.etag).to.equal('"etag-stream"');
                expect(uploadDoneStub.calledOnce).to.be.true;
            });

            it('should wrap a Buffer into a Readable stream before uploading to S3', async () => {
                const endpoint = 'http://minio:9000/my-bucket/uploads';
                (credentialServiceModule.getCredential as sinon.SinonStub).resolves(s3Creds());
                uploadDoneStub.resolves({ ETag: '"etag-buffer"' });

                const dataExchange = makeDataExchange({
                    providerData: { mimetype: 'application/octet-stream', fileName: 'file.bin' } as any,
                } as any);

                const result = await postRepresentation({
                    method: 'apiKey',
                    endpoint,
                    data: Buffer.from('binary content'),
                    credential: 'cred-s3',
                    dataExchange,
                    mimeType: 'application/octet-stream',
                } as any);

                expect(result.status).to.equal(200);
                expect(result.data.etag).to.equal('"etag-buffer"');
                expect(uploadDoneStub.calledOnce).to.be.true;
            });
        });
    });

    describe('putRepresentation()', () => {
        it('should perform a PUT without authentication', async () => {
            const endpoint = 'http://consumer/resource/1';
            axiosMock.onPut(endpoint).reply(200, { updated: true });

            const result = await putRepresentation({
                method: 'none',
                endpoint,
                data: { name: 'updated' },
                credential: null,
                dataExchange: makeDataExchange(),
            } as any);

            expect(result.status).to.equal(200);
            expect(result.data).to.deep.equal({ updated: true });
        });

        it('should inject the API key into the PUT request headers', async () => {
            const endpoint = 'http://consumer/resource/2';

            (credentialServiceModule.getCredentialByIdService as sinon.SinonStub).resolves({
                key: 'X-API-Key',
                value: 'my-api-key',
                type: 'apiKey',
            });

            axiosMock.onPut(endpoint).reply((config) => {
                expect(config.headers['X-API-Key']).to.equal('my-api-key');
                return [200, {}];
            });

            const result = await putRepresentation({
                method: 'apiKey',
                endpoint,
                data: {},
                credential: 'cred-1',
                dataExchange: makeDataExchange(),
            } as any);

            expect(result.status).to.equal(200);
        });
    });

    describe('postOrPutRepresentation()', () => {
        it('should use PUT when the URL contains {userId}', async () => {
            const representationUrl = 'http://consumer/resource/{userId}';
            axiosMock.onPut('http://consumer/resource/user-99').reply(200, { put: true });

            const result = await postOrPutRepresentation({
                method: 'none',
                representationUrl,
                verb: 'PUT',
                data: { value: 1 },
                credential: null,
                user: 'user-99',
                dataExchange: makeDataExchange(),
            } as any);

            // handle() unwraps axios response: result === response.data
            expect(result).to.deep.equal({ put: true });
        });

        it('should use POST when the URL has no parameter and verb=POST', async () => {
            const representationUrl = 'http://consumer/ingest';
            axiosMock.onPost(representationUrl).reply(201, { created: true });

            const result = await postOrPutRepresentation({
                method: 'none',
                representationUrl,
                verb: 'POST',
                data: { value: 2 },
                credential: null,
                user: 'user-1',
                dataExchange: makeDataExchange(),
            } as any);

            expect(result).to.deep.equal({ created: true });
        });

        it('should use PUT when verb=PUT and the URL has no parameter', async () => {
            const representationUrl = 'http://consumer/resource/fixed';
            axiosMock.onPut(representationUrl).reply(200, { updated: true });

            const result = await postOrPutRepresentation({
                method: 'none',
                representationUrl,
                verb: 'PUT',
                data: { value: 3 },
                credential: null,
                user: 'user-1',
                dataExchange: makeDataExchange(),
            } as any);

            expect(result).to.deep.equal({ updated: true });
        });

        it('should default to POST when verb is unknown', async () => {
            const representationUrl = 'http://consumer/ingest';
            axiosMock.onPost(representationUrl).reply(200, { default: true });

            const result = await postOrPutRepresentation({
                method: 'none',
                representationUrl,
                verb: 'UNKNOWN',
                data: {},
                credential: null,
                user: 'user-1',
                dataExchange: makeDataExchange(),
            } as any);

            expect(result).to.deep.equal({ default: true });
        });
    });

    describe('Injected headers', () => {
        it('should inject service-chain headers when chainId is provided', async () => {
            const endpoint = 'http://consumer/ingest';
            axiosMock.onPost(endpoint).reply((config) => {
                expect(config.headers['x-ptx-service-chain-id']).to.equal('chain-xyz');
                expect(config.headers['x-ptx-service-chain-next-target']).to.equal('next-node');
                return [200, {}];
            });

            await postRepresentation({
                method: 'none',
                endpoint,
                data: {},
                credential: null,
                chainId: 'chain-xyz',
                nextTargetId: 'next-node',
                dataExchange: makeDataExchange(),
            } as any);
        });

        it('should inject x-ptx-consent-id from the decrypted consent', async () => {
            const endpoint = 'http://consumer/ingest';
            const decryptedConsent = { _id: 'consent-42', dataConsumer: { selfDescriptionURL: 'http://consumer' } };

            axiosMock.onPost(endpoint).reply((config) => {
                expect(config.headers['x-ptx-consent-id']).to.equal('consent-42');
                return [200, {}];
            });

            await postRepresentation({
                method: 'none',
                endpoint,
                data: {},
                credential: null,
                decryptedConsent,
                dataExchange: makeDataExchange(),
            } as any);
        });
    });
});

