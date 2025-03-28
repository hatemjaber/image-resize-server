import { type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { handlers } from "../utils/exceptions.js";
import { getImage, getOrCreateResizedImage } from "../utils/image-operations.js";
import { validateSizeParameter } from "../utils/helpers.js";
import { encryptionService } from "../utils/encryption.js";

/**
 * Get an image from storage with optional resizing.
 * 
 * Request:
 * - Method: GET
 * - Path: /image/{key}
 * - Query Parameters:
 *   - size (optional): Desired size in format WxH (e.g., "800x600")
 * 
 * Response:
 * - 200: Image data with appropriate content type
 * - 400: Invalid size parameter
 * - 404: Image not found
 * - 500: Server error during processing
 */
export async function getImageWithResize(c: Context) {
    const key = c.req.query("key");
    const size = c.req.query("size");

    if (!key) {
        throw new handlers.KeyRequired(c);
    }

    // always get the original image
    const s3_key = encryptionService.decrypt(key.trim());
    const originalImage = await getImage(s3_key);

    try {

        // If no size parameter, return original image
        if (!size) {
            return c.body(originalImage.buffer, 200, {
                "Content-Type": originalImage.contentType
            });
        }

        // Validate and process size parameter
        validateSizeParameter(size.toLowerCase());
        const resizedImage = await getOrCreateResizedImage(originalImage, s3_key, size.toLowerCase());

        return c.body(resizedImage.buffer, 200, {
            "Content-Type": resizedImage.contentType
        });
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        throw new handlers.Unknown();
    }
} 