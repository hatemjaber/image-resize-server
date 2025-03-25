import { Readable } from "stream";
import sharp from "sharp";
import { env } from "./env.js";
import { S3Wrapper } from "./s3-wrapper.js";
import { handlers } from "./exceptions.js";

type HealthCheckResponse = {
    status: "healthy" | "error";
    message: string;
    checks?: { s3: string; imageProcessing: string; };
    error?: string;
};

/**
 * S3 client instance configured with environment variables.
 * Uses the specified endpoint, region, and credentials from environment variables.
 */
export const s3 = new S3Wrapper({
    endpoint: env.BUCKET_ENDPOINT,
    region: env.BUCKET_REGION,
    credentials: {
        accessKeyId: env.BUCKET_ACCESS_KEY_ID,
        secretAccessKey: env.BUCKET_ACCESS_KEY,
    },
    forcePathStyle: true,
});

/**
 * Creates a health check image using Sharp.
 * The image is a simple 100x100 gradient with text.
 */
async function createHealthCheckImage(): Promise<Buffer> {
    try {
        const width = 400;
        const height = 400;

        return await sharp({
            create: {
                width,
                height,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        })
            .composite([{
                input: Buffer.from(`<svg width="${ width }" height="${ height }">
            <rect width="100%" height="100%" fill="url(#gradient)"/>
            <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#00ff00"/>
                    <stop offset="100%" style="stop-color:#0000ff"/>
                </linearGradient>
            </defs>
            <text x="50%" y="50%" font-family="Arial" font-size="16"
                fill="white" text-anchor="middle" dominant-baseline="middle">
                Health Check ${ new Date().toISOString() }
            </text>
        </svg>`),
                top: 0,
                left: 0
            }])
            .png()
            .toBuffer();
    } catch (error) {
        throw error;
    }
}

/**
 * Ensures the health check image exists in the bucket.
 * Creates it if it doesn't exist.
 */
export async function ensureHealthCheckImage(s3: S3Wrapper): Promise<void> {
    try {
        // Check if health check image exists
        const { data } = await s3.getObjectWithMetadata(env.BUCKET_NAME, env.HEALTH_CHECK_IMAGE_KEY);
        if (data) {
            console.log("Health check image exists");
            return;
        }
    } catch (error) {
        console.log("Health check image not found, creating...");
        const imageBuffer = await createHealthCheckImage();
        await s3.putObject(env.BUCKET_NAME, env.HEALTH_CHECK_IMAGE_KEY, imageBuffer, "image/png");
        console.log("Health check image created successfully");
    }
}

/**
 * Performs a health check by verifying S3 connectivity and image processing capabilities.
 * @returns Object containing health check status and details
 */
export async function performHealthCheck(s3: S3Wrapper): Promise<HealthCheckResponse> {
    try {
        // Try to retrieve the health check image
        const { data, contentType } = await s3.getObjectWithMetadata(env.BUCKET_NAME, env.HEALTH_CHECK_IMAGE_KEY);
        if (!data) {
            return {
                status: "error",
                message: "Health check image not found"
            };
        }

        // Try to process the image to verify Sharp is working
        const buffer = await streamToBuffer(data);
        await sharp(buffer)
            .resize(50, 50)  // Test resize operation
            .toBuffer();

        return {
            status: "healthy",
            message: "Image service is fully operational",
            checks: {
                s3: "connected",
                imageProcessing: "operational"
            }
        };
    } catch (error) {
        return {
            status: "error",
            message: "Health check failed",
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Converts a readable stream to a Buffer.
 * This is useful for processing file uploads or S3 object streams.
 * 
 * @param stream - The readable stream to convert
 * @returns Promise resolving to a Buffer containing the stream data
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Clean up all resized variants of an image.
 * This should be called before replacing an existing image.
 */
export async function cleanupResizedVariants(s3: S3Wrapper, key: string): Promise<void> {
    try {
        // List all objects with the key prefix to find resized variants
        const allObjects = await s3.listObjects(env.BUCKET_NAME, key + "_");

        if (allObjects.length > 0) {
            console.log(`Found ${ allObjects.length } resized variants to clean up for ${ key }`);
            console.log("allObjects");
            console.log(allObjects);
            await s3.removeObjects(env.BUCKET_NAME, allObjects);
            console.log(`Cleaned up resized variants for ${ key }`);
        }
    } catch (error) {
        throw new handlers.CleanupResizedVariantsFailed();
    }
}

export function validateSegments(key: string, excludeString: string): void {
    const segments = key.split("/").filter(it => it);
    if (segments.length == 1 && segments[0] == excludeString) {
        throw new handlers.InvalidKey();
    }
}

export function validateSizeParameter(_size: string): void {
    let width = 0;
    let height = 0;

    const size = _size.toLowerCase();

    if (size && size.includes("x")) {
        // look for x or X
        const [w, h] = size.split("x");
        width = parseInt(w);
        if (w.length != width.toString().length) {
            throw new handlers.InvalidSizeParameter({ reason: `1: Width ${ w } is not a valid number` });
        }
        height = parseInt(h);
        if (h.length != height.toString().length) {
            throw new handlers.InvalidSizeParameter({ reason: `2: Height ${ h } is not a valid number` });
        }
    } else {
        width = parseInt(size);
        if (size.length != width.toString().length) {
            throw new handlers.InvalidSizeParameter({ reason: `3: Width ${ size } is not a valid number` });
        }
    }
}