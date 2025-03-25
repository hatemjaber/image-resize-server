import fs from 'fs';
import { Readable } from 'stream';
import { HttpsProxyAgent } from 'https-proxy-agent';
import mime from 'mime-types';
import axios from 'axios';
import { SUPPORTED_IMAGE_TYPES } from './constants.js';
import {
    S3Client,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3ClientConfig,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3';

/**
 * Wrapper class for AWS S3 operations with additional functionality for image handling.
 * Provides methods for uploading, downloading, and managing objects in S3-compatible storage.
 */
export class S3Wrapper {
    /** Maximum file size limit (1GB) to prevent uploading extremely large files */
    private readonly maxSizeLimit: number;
    private readonly s3Client: S3Client;

    /**
     * Creates a new S3Wrapper instance with the specified configuration.
     * @param config - S3 client configuration including credentials and endpoint
     * @param maxSizeLimit - Optional maximum file size limit in bytes (defaults to 1GB)
     */
    constructor (config: S3ClientConfig, maxSizeLimit: number = 1 * 1024 * 1024 * 1024) {
        this.s3Client = new S3Client(config);
        this.maxSizeLimit = maxSizeLimit;
    }

    /**
     * Core method to upload data to S3. All other upload methods ultimately call this.
     * @param bucket - The S3 bucket name
     * @param key - The object key (path) in the bucket
     * @param body - The actual data to upload (supports multiple formats for flexibility)
     * @param contentType - The MIME type of the content for proper serving
     */
    async putObject(bucket: string, key: string, body: Buffer | Readable | string, contentType: string): Promise<void> {
        const params = {
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType  // Important for browsers to properly handle the content
        };
        const command = new PutObjectCommand(params);
        await this.s3Client.send(command);
    }

    /**
     * Upload a file from the local filesystem to S3.
     * Uses streams for memory-efficient uploads of large files.
     * @param bucket - The S3 bucket name
     * @param key - The object key (path) in the bucket
     * @param filePath - The local file path to upload
     * @param contentType - The MIME type of the file (optional, will be inferred from file extension if not provided)
     */
    async uploadFromFile(bucket: string, key: string, filePath: string, contentType?: string): Promise<void> {
        const stream = fs.createReadStream(filePath);
        // Allow override of mime type, but fallback to automatic detection based on file extension if not provided
        const mimeType = contentType || mime.lookup(filePath) || "application/octet-stream";
        await this.putObject(bucket, key, stream, mimeType);
    }

    /**
     * Upload base64-encoded data to S3.
     * Useful for handling data from HTML5 Canvas or other base64 sources.
     */
    async uploadFromBase64(bucket: string, key: string, base64Data: string, contentType: string): Promise<void> {
        const buffer = Buffer.from(base64Data, "base64");
        await this.putObject(bucket, key, buffer, contentType);
    }

    /**
     * Upload from a data URL (e.g., from canvas.toDataURL()).
     * Automatically extracts the MIME type from the data URL format.
     * @param bucket - The S3 bucket name
     * @param key - The object key (path) in the bucket
     * @param dataUrl - The data URL to upload
     */
    async uploadFromDataUrl(bucket: string, key: string, dataUrl: string): Promise<void> {
        const parts = dataUrl.split(",");
        const base64Data = parts[1];
        const mimeType = parts[0].split(";")[0].split(":")[1];
        await this.uploadFromBase64(bucket, key, base64Data, mimeType);
    }

    /**
     * Upload content from a remote URL to S3.
     * Supports proxy for environments that require it (e.g., corporate networks).
     * Includes size limit checks and proper content type handling.
     * @param bucket - The S3 bucket name
     * @param key - The object key (path) in the bucket
     * @param url - The URL to upload
     * @param isImage - Whether to validate as an image (optional)
     * @param proxy - The proxy URL to use (optional)
     */
    async uploadFromUrl(bucket: string, key: string, url: string, isImage: boolean = false, proxy?: string): Promise<void> {
        const agent = proxy ? new HttpsProxyAgent(proxy) : null;

        const response = await axios({
            method: "get",
            url: url,
            responseType: "arraybuffer",
            httpsAgent: agent
        });

        if (response.status !== 200) {
            throw new Error(`Failed to fetch URL: ${ url }`);
        }

        const contentType = response.headers["content-type"] || "application/octet-stream";
        const contentLength = response.headers["content-length"];

        // Validate that it's a supported image type if isImage is true
        if (isImage && !SUPPORTED_IMAGE_TYPES.includes(contentType as any)) {
            throw new Error(`Unsupported image format. Supported formats: ${ SUPPORTED_IMAGE_TYPES.join(", ") }`);
        }

        if (contentLength && parseInt(contentLength, 10) > this.maxSizeLimit) {
            throw new Error("Content size exceeds the limit.");
        }

        const buffer = Buffer.from(response.data, "binary");
        await this.putObject(bucket, key, buffer, contentType);
    }

    /**
     * List objects in a bucket with an optional prefix filter.
     * Useful for implementing directory-like browsing or cleanup operations.
     * @param bucket - The S3 bucket name
     * @param prefix - The prefix to filter the objects (optional)
     * @returns Array of object keys in the bucket
     */
    async listObjects(bucket: string, prefix?: string): Promise<string[]> {
        const params = {
            Bucket: bucket,
            Prefix: prefix
        };
        const command = new ListObjectsV2Command(params);
        const data = await this.s3Client.send(command);
        return data.Contents?.map((item) => item.Key).filter((key): key is string => key !== undefined) || [];
    }

    /**
     * Get an object's data as a readable stream.
     * Memory efficient for large files as it streams the data.
     * @param bucket - The S3 bucket name
     * @param key - The object key (path) in the bucket
     */
    async getObject(bucket: string, key: string): Promise<Readable | null> {
        const params = {
            Bucket: bucket,
            Key: key
        };
        const command = new GetObjectCommand(params);
        const data = await this.s3Client.send(command);
        return data.Body as Readable;
    };

    /**
     * Get both the object data and its metadata (including content type).
     * Useful when serving files where content type is important (e.g., images).
     * Makes two requests: one for metadata and one for content, but provides complete information.
     * @param bucket - The S3 bucket name
     * @param key - The object key (path) in the bucket
     */
    async getObjectWithMetadata(bucket: string, key: string): Promise<{ data: Readable | null; contentType: string | null; }> {
        // Get the object data
        const objectData = await this.getObject(bucket, key);

        // Get the metadata separately to ensure we have content type
        const headObjectParams = {
            Bucket: bucket,
            Key: key
        };
        const headObjectCommand = new HeadObjectCommand(headObjectParams);
        const metadata = await this.s3Client.send(headObjectCommand);

        return {
            data: objectData as Readable | null,
            contentType: metadata.ContentType || null
        };
    };

    /**
     * Delete a single object from the bucket.
     * @param bucket - The S3 bucket name
     * @param key - The object key (path) in the bucket
     */
    async removeObject(bucket: string, key: string): Promise<void> {
        const params = {
            Bucket: bucket,
            Key: key.startsWith('/') ? key.substring(1) : key
        };
        const command = new DeleteObjectCommand(params);
        await this.s3Client.send(command);
    };

    /**
     * Delete multiple objects in a single request.
     * More efficient than deleting objects one by one.
     * Note: When using MinIO, if the batch delete fails due to MD5 checksum requirements,
     * the method falls back to deleting objects individually.
     * @param bucket - The S3 bucket name
     * @param keys - The array of object keys (paths) in the bucket
     */
    async removeObjects(bucket: string, keys: string[]): Promise<void> {
        const objects = keys.map((key) => ({
            Key: key.startsWith('/') ? key.substring(1) : key
        }));
        try {
            const params = {
                Bucket: bucket,
                Delete: {
                    Objects: objects,
                    Quiet: true  // Don't return the list of deleted objects
                }
            };
            const command = new DeleteObjectsCommand(params);
            await this.s3Client.send(command);
        } catch (error) {
            // MinIO requires MD5 checksums in request headers, even if not present in putObject
            // If batch delete fails, fall back to individual deletes
            await Promise.all(
                objects.map(({ Key }) => this.removeObject(bucket, Key))
            );
        }
    }
}
