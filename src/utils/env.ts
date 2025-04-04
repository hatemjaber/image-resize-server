import { z } from "zod";

/**
 * Environment variable schema for the application.
 * Defines the required environment variables and their types.
 */
const envSchema = z.object({
    /**
     * The current environment (development, production, etc.)
     */
    NODE_ENV: z.string().default("development"),

/**
 * The host address the server will listen on
 */
    HOST: z.string().default("0.0.0.0"),

    /**
     * The port number the server will listen on
     */
    PORT: z.coerce.number().default(3000),

    /**
     * The token for the X API
     */
    X_API_KEY: z.string(),

    /**
     * The secret for the X API
     */
    X_API_SECRET: z.string(),

    /**
     * The signing key for the X API
     */
    X_API_TOKEN_SIGN_KEY: z.string(),

    /**
     * The region for the R2 bucket (e.g., "auto")
     */
    BUCKET_REGION: z.string(),

    /**
     * The endpoint URL for the R2 bucket
     */
    BUCKET_ENDPOINT: z.string(),

    /**
     * The name of the R2 bucket
     */
    BUCKET_NAME: z.string(),

    /**
     * The access key ID for R2 authentication
     */
    BUCKET_ACCESS_KEY_ID: z.string(),

    /**
     * The secret access key for R2 authentication
     */
    BUCKET_ACCESS_KEY: z.string(),

    /**
     * The key for the health check image in the bucket
     */
    HEALTH_CHECK_IMAGE_KEY: z.string(),

    /**
     * The key used for encrypting/decrypting image keys
     */
    IMAGE_KEY_ENCRYPTION_KEY: z.string(),
});

/**
 * Validates and exports environment variables.
 * Throws an error if any required environment variables are missing or invalid.
 */
export const env = envSchema.parse(process.env);
