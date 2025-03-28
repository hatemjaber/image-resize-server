import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";

type OptionsType = {
    c: Context;
    [key: string]: any;
};

const createClass = (className: string, properties: Record<string, any>) => {
    const { code, message, cause, errorCode } = properties;
    return class extends HTTPException {
        [key: string]: any;

        constructor (options?: OptionsType) {
            const { c, ...rest } = options || {};
            const res = c?.json({ message, cause, errorCode, ...rest }, code);
            super(code, { res, message, cause });
            this.name = className;
            if (rest) {
                for (const [key, value] of Object.entries(rest)) {
                    this[key] = value;
                }
            }
        }
    };
};

/**
 * Custom exception handlers for the image processing service.
 * These exceptions provide detailed error information for different failure scenarios.
 */
export const handlers = {
    /**
     * Exception thrown when an invalid key is provided for storage operations.
     */
    InvalidKey: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Invalid key',
        cause: 'Invalid key',
        errorCode: 'INVALID_KEY',
    },

    /** 
     * Exception thrown when a key is required for storage operations.
     */
    KeyRequired: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Key is required',
        cause: 'Key is required',
        errorCode: 'KEY_REQUIRED',
    },

    /**
     * Exception thrown when no image is provided in the request.
     */
    NoImageProvided: {
        code: StatusCodes.BAD_REQUEST,
        message: 'No image provided',
        cause: 'No image provided',
        errorCode: 'NO_IMAGE_PROVIDED',
    },

    /**
     * Exception thrown when no URL is provided for image operations.
     */
    NoUrlProvided: {
        code: StatusCodes.BAD_REQUEST,
        message: 'No URL provided',
        cause: 'No URL provided',
        errorCode: 'NO_URL_PROVIDED',
    },

    /**
     * Exception thrown when an empty image is provided.
     */
    EmptyImageProvided: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Empty image provided',
        cause: 'Empty image provided',
        errorCode: 'EMPTY_IMAGE_PROVIDED',
    },

    /**
     * Exception thrown when an invalid or corrupted image is provided.
     */
    InvalidImageProvided: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Empty or invalid image file',
        cause: 'Empty or invalid image file',
        errorCode: 'INVALID_IMAGE_PROVIDED',
    },

    /**
     * Exception thrown when validation fails for input parameters.
     */
    ValidationError: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Validation error',
        cause: 'Validation error',
        errorCode: 'VALIDATION_ERROR',
    },

    /**
     * Exception thrown when an image cannot be found in storage.
     */
    ImageNotFound: {
        code: StatusCodes.NOT_FOUND,
        message: 'Image not found',
        cause: 'Image not found',
        errorCode: 'IMAGE_NOT_FOUND',
    },

    /**
     * Exception thrown when an invalid size parameter is provided for image resizing.
     */
    InvalidSizeParameter: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Invalid size parameter',
        cause: 'Invalid size parameter',
        errorCode: 'INVALID_SIZE_PARAMETER',
    },

    /**
     * Exception thrown when stream to buffer conversion fails.
     */
    StreamToBufferFailed: {
        code: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to convert stream to buffer',
        cause: 'Failed to convert stream to buffer',
        errorCode: 'STREAM_TO_BUFFER_FAILED',
    },

    /**
     * Exception thrown when cleanup of resized variants fails.
     */
    CleanupResizedVariantsFailed: {
        code: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to cleanup resized variants',
        cause: 'Failed to cleanup resized variants',
        errorCode: 'CLEANUP_RESIZED_VARIANTS_FAILED',
    },

    /**
     * Exception thrown when health check operation fails.
     */
    HealthCheckFailed: {
        code: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to perform health check',
        cause: 'Failed to perform health check',
        errorCode: 'HEALTH_CHECK_FAILED',
    },

    /**
     * Exception thrown when health check image creation fails.
     */
    CreateHealthCheckImageFailed: {
        code: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to create health check image',
        cause: 'Failed to create health check image',
        errorCode: 'CREATE_HEALTH_CHECK_IMAGE_FAILED',
    },

    /**
     * Exception thrown for unknown or unexpected errors.
     */
    Unknown: {
        code: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Unknown error',
        cause: 'Unknown error',
        errorCode: 'UNKNOWN',
    },

    /**
     * Exception thrown when a requested path is not found.
     */
    PathNotFound: {
        code: StatusCodes.NOT_FOUND,
        message: 'Path not found',
        cause: 'Path not found',
        errorCode: 'PATH_NOT_FOUND',
    },

    /**
     * Exception thrown when no file is provided in the request.
     */
    NoFileProvided: {
        code: StatusCodes.BAD_REQUEST,
        message: 'No file provided in the request',
        cause: 'No file provided in the request',
        errorCode: 'NO_FILE_PROVIDED',
    },

    /**
     * Exception thrown when an unsupported image format is provided.
     */
    UnsupportedImageFormat: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Unsupported image format. Only image files are allowed',
        cause: 'Unsupported image format',
        errorCode: 'UNSUPPORTED_IMAGE_FORMAT',
    },

    /**
     * Exception thrown when a prefix is required in the path.
     */
    PrefixRequired: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Prefix is required in the path',
        cause: 'Prefix is required in the path',
        errorCode: 'PREFIX_REQUIRED',
    },

    /**
     * Exception thrown when an invalid prefix format is provided.
     */
    InvalidPrefixFormat: {
        code: StatusCodes.BAD_REQUEST,
        message: 'Prefix can only contain alphanumeric characters, hyphens, and underscores',
        cause: 'Invalid prefix format',
        errorCode: 'INVALID_PREFIX_FORMAT',
    },
} as Record<string, any>;

Object.entries(handlers).forEach(([key, value]) => {
    const { code, message, cause, errorCode } = value;
    handlers[key] = createClass(key, { code, message, cause, errorCode });
});
