import sharp, { ResizeOptions } from "sharp";
import { s3, streamToBuffer } from "./helpers.js";
import { env } from "./env.js";
import { handlers } from "./exceptions.js";
import ExifReader from 'exifreader';

/**
 * Validates and parses the size parameter string into width and height.
 * Size format should be "WIDTHxHEIGHT" (e.g., "800x600").
 * @param size - The size string in format "WIDTHxHEIGHT"
 * @returns Object containing validated width and height
 * @throws {InvalidSizeParameter} If size format is invalid or dimensions exceed limits
 */
function validateSize(size: string): { width: number; height: number; } {
    const [width, height] = size.toLowerCase().split("x").map(Number);

    if (isNaN(width) || isNaN(height)) {
        throw new handlers.InvalidSizeParameter({ reason: 'Invalid size format. Expected format: WIDTHxHEIGHT' });
    }

    if (width <= 0 || height <= 0) {
        throw new handlers.InvalidSizeParameter({ reason: 'Dimensions must be positive numbers' });
    }

    // Maximum size limit to prevent processing extremely large images
    if (width > 5000 || height > 5000) {
        throw new handlers.InvalidSizeParameter({ reason: 'Dimensions exceed maximum allowed size of 5000x5000' });
    }

    return { width, height };
}

/**
 * Converts a File object to a Buffer and validates it as an image.
 * @param image - The File object to convert
 * @returns Promise resolving to a Buffer containing the image data
 * @throws {InvalidImageProvided} If the file is empty or not a valid image
 */
export async function imageToBuffer(image: File): Promise<Buffer> {
    try {
        const arrayBuffer = await image.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new handlers.InvalidImageProvided();
        }
        const buffer = Buffer.from(arrayBuffer);
        await sharp(buffer).metadata();
        return buffer;
    } catch (error) {
        throw new handlers.InvalidImageProvided();
    }
}

/**
 * Retrieves an image from S3 storage.
 * @param key - The S3 key of the image
 * @returns Promise resolving to the image buffer and content type
 * @throws {ImageNotFound} If the image doesn't exist in S3
 */
export async function getImage(key: string): Promise<{ buffer: Buffer; contentType: string; }> {
    try {
        const { data, contentType } = await s3.getObjectWithMetadata(env.BUCKET_NAME, key);
        if (!data) {
            throw new handlers.ImageNotFound();
        }
        const buffer = await streamToBuffer(data);
        return { buffer, contentType: contentType || "image/jpeg" };
    } catch (error) {
        throw new handlers.ImageNotFound();
    }
}

/**
 * Gets an existing resized image or creates a new one if it doesn't exist.
 * This function is optimized for image resizing with the following defaults:
 * - Maintains aspect ratio (fit: 'inside')
 * - Prevents upscaling (withoutEnlargement: true)
 * - Uses high-quality downscaling (kernel: 'lanczos3')
 * 
 * @param originalImage - The original image buffer and content type
 * @param key - The S3 key for the image
 * @param size - The desired size in format "WIDTHxHEIGHT" (e.g., "800x600")
 * @param options - Optional Sharp resize options to override defaults
 * @returns Promise resolving to the resized image buffer and content type
 * @throws {InvalidSizeParameter} If size format is invalid
 * @throws {ImageNotFound} If original image doesn't exist
 */
export async function getOrCreateResizedImage(
    originalImage: { buffer: Buffer; contentType: string; },
    key: string,
    size: string,
    options: Partial<ResizeOptions> = {}
): Promise<{ buffer: Buffer; contentType: string; }> {
    const { width, height } = validateSize(size);
    const resizedKey = `${ key }_${ size }`;

    try {
        // Try to get existing resized image
        return await getImage(resizedKey);
    } catch (error) {
        // If not found, create new resized image
        const resizeOptions: ResizeOptions = {
            width,
            height,
            fit: 'inside',  // Maintains aspect ratio
            withoutEnlargement: true,  // Prevents upscaling
            kernel: 'lanczos3',  // Best quality for downscaling
            ...options
        };

        // Process the image with error handling
        const resizedBuffer = await sharp(originalImage.buffer, {
            failOnError: false  // Don't fail on corrupt images
        })
            .resize(resizeOptions)
            .toBuffer();

        await s3.putObject(env.BUCKET_NAME, resizedKey, resizedBuffer, originalImage.contentType);
        return { buffer: resizedBuffer, contentType: originalImage.contentType };
    }
}

/**
 * Extracts metadata from an image buffer.
 * This includes EXIF, IPTC, XMP, and other metadata depending on the image format.
 * 
 * @param buffer - The image buffer to extract metadata from
 * @returns Promise resolving to an object containing the extracted metadata
 * @throws {InvalidImageProvided} If the image is invalid or metadata cannot be extracted
 */
export async function extractImageMetadata(buffer: Buffer): Promise<Record<string, any>> {
    try {
        const tags = ExifReader.load(buffer);
        // Convert tags to a more friendly format
        const metadata: Record<string, any> = {};

        metadata.exif = tags;

        // Add image dimensions from Sharp metadata
        const sharpMetadata = await sharp(buffer).metadata();
        metadata.dimensions = {
            width: sharpMetadata.width,
            height: sharpMetadata.height,
            format: sharpMetadata.format,
            size: sharpMetadata.size,
            space: sharpMetadata.space,
            channels: sharpMetadata.channels,
            depth: sharpMetadata.depth,
            density: sharpMetadata.density,
            compression: sharpMetadata.compression,
            hasProfile: sharpMetadata.hasProfile,
            hasAlpha: sharpMetadata.hasAlpha,
            orientation: sharpMetadata.orientation
        };

        return metadata;
    } catch (error) {
        console.error('Error extracting metadata:', error);
        return {};
    }
}