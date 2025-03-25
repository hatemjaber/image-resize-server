import { type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { handlers } from "../utils/exceptions.js";
import { getImage, getOrCreateResizedImage } from "../utils/image-operations.js";
import { validateSizeParameter } from "../utils/helpers.js";

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
    const path = c.req.path;
    const prefix = path.match(/^\/image\/([^\/]+)/)?.[1];

    if (!prefix) {
        throw new handlers.PrefixRequired(c);
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(prefix)) {
        throw new handlers.InvalidPrefixFormat(c);
    }

    const key = path.replace("/image/", "");
    const size = c.req.query("size");

    try {
        // always get the original image
        const originalImage = await getImage(key);

        // If no size parameter, return original image
        if (!size) {
            return c.body(originalImage.buffer, 200, {
                "Content-Type": originalImage.contentType
            });
        }

        // Validate and process size parameter
        validateSizeParameter(size.toLowerCase());
        const resizedImage = await getOrCreateResizedImage(originalImage, key, size.toLowerCase());

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