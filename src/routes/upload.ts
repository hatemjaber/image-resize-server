import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { imageToBuffer, extractImageMetadata } from "../utils/image-operations.js";
import { s3, cleanupResizedVariants } from "../utils/helpers.js";
import { env } from "../utils/env.js";
import { handlers } from "../utils/exceptions.js";
import crypto from "crypto";

/**
 * Upload one or more images to the storage service.
 * This endpoint handles both single and multiple file uploads.
 * 
 * Request:
 * - Method: POST
 * - Path: /image/{prefix}/*
 * - Content-Type: multipart/form-data
 * - Body: Form data with either:
 *   - field name 'file' for a single file
 *   - field name 'files' for multiple files
 * 
 * Response:
 * - 200: Success with uploaded file(s) information
 * - 400: Invalid request or file validation error
 * - 500: Server error during upload
 */
export async function uploadImages(c: Context) {
    try {
        // Get the prefix from the path parameter
        const prefix = c.req.path.replace("/image/", "").split("/")[0];

        // Validate prefix
        if (!prefix) {
            throw new handlers.PrefixRequired(c);
        }

        // Validate prefix format (alphanumeric, hyphens, and underscores only)
        if (!/^[a-zA-Z0-9-_]+$/.test(prefix)) {
            throw new handlers.InvalidPrefixFormat(c);
        }

        const formData = await c.req.formData();

        // Try to get files from either 'files' or 'file' field
        let files = formData.getAll('files');
        if (files.length === 0) {
            const singleFile = formData.get('file');
            if (singleFile) {
                files = [singleFile];
            }
        }

        if (!files || files.length === 0) {
            throw new handlers.NoFileProvided(c);
        }

        const uploadResults = await Promise.all(
            files.map(async (file) => {
                if (!(file instanceof File)) {
                    throw new handlers.InvalidImageProvided();
                }

                // Validate file type
                if (!file.type.startsWith('image/')) {
                    throw new handlers.UnsupportedImageFormat();
                }

                // Convert file to buffer and validate
                const buffer = await imageToBuffer(file);

                // Generate a unique key using UUID v4 with the prefix
                const timestamp = Date.now();
                const uuid = crypto.randomUUID();
                const key = `${ prefix }/${ timestamp }-${ uuid }`;

                // Clean up any existing resized variants if the key already exists
                await cleanupResizedVariants(s3, key);

                // Upload the file
                await s3.putObject(env.BUCKET_NAME, key, buffer, file.type);

                // Extract metadata from the image
                const metadata = await extractImageMetadata(buffer);

                return {
                    key,
                    originalName: file.name,
                    contentType: file.type,
                    size: file.size,
                    metadata
                };
            })
        );

        // Return response in a consistent format
        return c.json({
            success: true,
            message: `Successfully uploaded ${ uploadResults.length } file(s)`,
            files: uploadResults
        });

    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        throw new handlers.Unknown();
    }
} 