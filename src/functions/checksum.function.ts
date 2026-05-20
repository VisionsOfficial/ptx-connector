import { createHash } from 'node:crypto';
import { Readable } from 'stream';
import * as fs from 'fs';

const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB

export const checksum = (data: any): string => {
    if (data instanceof Readable) {
        throw new Error('Unable to calculate hash for flowing readable stream');
    }

    let dataToHash: Buffer;

    if (Buffer.isBuffer(data)) {
        dataToHash = data;
    } else if (typeof data === 'string') {
        dataToHash = Buffer.from(data, 'utf-8');
    } else if (typeof data === 'object') {
        dataToHash = Buffer.from(JSON.stringify(data), 'utf-8');
    } else {
        dataToHash = Buffer.from(data.toString(), 'utf-8');
    }

    const hash = createHash('sha256');
    for (let offset = 0; offset < dataToHash.length; offset += CHUNK_SIZE) {
        hash.update(dataToHash.slice(offset, offset + CHUNK_SIZE));
    }
    return hash.digest('hex');
};

/**
 * Compute SHA-256 checksum from a file path without loading the entire file into RAM.
 * Reads the file in 64 MB chunks.
 */
export const checksumFromFilePath = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = fs.createReadStream(filePath, {
            highWaterMark: CHUNK_SIZE,
        });
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

/**
 * Compute SHA-256 checksum from a Readable stream.
 * The stream is consumed — do NOT reuse it after calling this function.
 */
export const checksumFromStream = (stream: Readable): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};
