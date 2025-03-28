import crypto from 'crypto';
import { env } from './env.js'; // Assuming this correctly loads your environment variable

// --- Constants ---

/** Cryptographic algorithm used for encryption (AES with Galois/Counter Mode). */
const ALGORITHM = 'aes-256-gcm';
/** Recommended Initialization Vector (IV) length for AES-GCM (96 bits). */
const IV_LENGTH = 12;
/** Recommended Salt length for scrypt key derivation (>= 128 bits). */
const SALT_LENGTH = 16;
/** Default GCM authentication tag length (128 bits). */
const TAG_LENGTH = 16;
/** Desired key length for AES-256 (256 bits). */
const KEY_LENGTH = 32;
/** Options for the scrypt key derivation function. Adjust N, r, p based on security needs/performance. */
const SCRYPT_OPTIONS = {
    N: 16384, // CPU/memory cost parameter (power of 2)
    r: 8,     // Block size parameter
    p: 1,     // Parallelization parameter
    maxmem: 64 * 1024 * 1024 // Optional: Adjust memory limit if needed (Bytes)
};

// --- Helper Function for Key Derivation ---

/**
 * Derives a cryptographic key from a master key and salt using scrypt.
 * @param masterKey - The master key material (Buffer).
 * @param salt - The salt buffer (must be unique per encryption).
 * @returns A derived key buffer of KEY_LENGTH bytes.
 * @internal
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
    // Ensure masterKey is a Buffer
    if (!Buffer.isBuffer(masterKey)) {
        throw new Error("deriveKey expects masterKey to be a Buffer.");
    }
    return crypto.scryptSync(masterKey, salt, KEY_LENGTH, SCRYPT_OPTIONS);
}

// --- Encryption Service Class ---

/**
 * Provides methods for encrypting and decrypting text using AES-256-GCM
 * with scrypt-derived keys and Base64 URL Safe encoding for output.
 *
 * Instantiated once with a master key. Each encryption uses a unique salt.
 * The output format is a Base64 URL Safe string containing:
 * [salt (SALT_LENGTH bytes)][iv (IV_LENGTH bytes)][authTag (TAG_LENGTH bytes)][ciphertext]
 */
export class EncryptionService {
    /** The master encryption key, stored as a buffer for internal use. */
    private readonly masterKey: Buffer;

    /**
     * Initializes the EncryptionService with a master encryption key.
     * @param masterKeyString - The master encryption key (UTF-8 encoded string). Must be kept secret.
     * @throws Error if masterKeyString is empty.
     */
    constructor (masterKeyString: string) {
        if (!masterKeyString) {
            throw new Error('Encryption master key string is required.');
        }
        // Store the master key as a buffer immediately for consistent internal use
        this.masterKey = Buffer.from(masterKeyString, 'utf8');

        // Optional: Warn if the provided key material seems short, although scrypt strengthens it.
        if (this.masterKey.length < 16) { // Arbitrary threshold for warning
            console.warn(`Warning: Master key material has low byte length (${ this.masterKey.length }). Ensure the original string has sufficient entropy.`);
        }
        // Verify key derivation works with current settings
        try {
            deriveKey(this.masterKey, crypto.randomBytes(SALT_LENGTH));
        } catch (err) {
            console.error("Failed initial key derivation check. Master key or scrypt settings might be incompatible.", err);
            throw new Error("EncryptionService initialization failed: Could not derive test key.");
        }
    }

    /**
     * Encrypts a plaintext string using AES-256-GCM.
     * @param plainText - The UTF-8 string to encrypt.
     * @returns A Base64 URL Safe encoded string containing salt, IV, auth tag, and ciphertext.
     *          This string is safe to use in URLs and filenames.
     */
    encrypt(plainText: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);

        // Derive a unique key for this specific encryption operation
        const key = deriveKey(this.masterKey, salt);

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt the text (input as buffer)
        const plainTextBuffer = Buffer.from(plainText, 'utf8');
        const encryptedBuffer = Buffer.concat([
            cipher.update(plainTextBuffer),
            cipher.final(),
        ]);

        // Get the authentication tag (must be done after final())
        const tag = cipher.getAuthTag();

        // Combine all parts: [salt][iv][tag][ciphertext]
        const resultBuffer = Buffer.concat([salt, iv, tag, encryptedBuffer]);

        // Encode the combined buffer to Base64 URL Safe format
        const base64String = resultBuffer.toString('base64');
        const base64UrlString = base64String
            .replace(/\+/g, '-') // Replace + with -
            .replace(/\//g, '_') // Replace / with _
            .replace(/=+$/, ''); // Remove trailing padding '='

        return base64UrlString;
    }

    /**
     * Decrypts a Base64 URL Safe encoded string that was encrypted by this service.
     * @param encryptedTextBase64Url - The Base64 URL Safe encoded string (salt + iv + tag + ciphertext).
     * @returns The original plaintext string (UTF-8 encoded).
     * @throws Error if decryption fails due to invalid format, incorrect key, tampered data, or other crypto errors.
     *         The error message is kept generic ("Decryption failed: ...") for security.
     */
    decrypt(encryptedTextBase64Url: string): string {
        if (!encryptedTextBase64Url) {
            // Throw a specific error type or use HTTP exception if in web context
            throw new Error('Decryption failed: Input string cannot be empty.');
        }

        try {
            // 1. Convert back from Base64 URL Safe to standard Base64
            let base64String = encryptedTextBase64Url
                .replace(/-/g, '+') // Replace - back to +
                .replace(/_/g, '/'); // Replace _ back to /

            // 2. Add Base64 padding back if necessary (length must be multiple of 4)
            while (base64String.length % 4) {
                base64String += '=';
            }

            // 3. Decode from standard Base64
            const dataBuffer = Buffer.from(base64String, 'base64');

            // 4. Define expected start offsets and lengths for clarity
            const saltOffset = 0;
            const ivOffset = saltOffset + SALT_LENGTH;
            const tagOffset = ivOffset + IV_LENGTH;
            const ciphertextOffset = tagOffset + TAG_LENGTH;

            // 5. Ensure buffer is long enough for all metadata components
            if (dataBuffer.length < ciphertextOffset) {
                // Don't leak specific length details in the error message
                throw new Error('Malformed encrypted data (too short).');
            }

            // 6. Extract components using efficient subarray views
            const salt = dataBuffer.subarray(saltOffset, ivOffset);
            const iv = dataBuffer.subarray(ivOffset, tagOffset);
            const tag = dataBuffer.subarray(tagOffset, ciphertextOffset);
            const encryptedData = dataBuffer.subarray(ciphertextOffset);

            // 7. Derive the decryption key using the extracted salt
            const key = deriveKey(this.masterKey, salt);

            // 8. Create decipher instance
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

            // 9. Set the expected authentication tag ( crucial for GCM verification)
            decipher.setAuthTag(tag);

            // 10. Decrypt the data and verify authentication tag
            const decryptedBuffer = Buffer.concat([
                decipher.update(encryptedData),
                // final() throws error if authentication fails (tag mismatch)
                // or if the stream is in an invalid state.
                decipher.final(),
            ]);

            // 11. Convert the decrypted buffer back to a UTF-8 string
            return decryptedBuffer.toString('utf8');

        } catch (error: unknown) {
            // Log the detailed error securely on the server-side during development/debugging
            console.error(`Decryption Error: ${ error instanceof Error ? error.message : 'Unknown error' }`, {
                inputLength: encryptedTextBase64Url.length, // Log input length for context
                // stack: error instanceof Error ? error.stack : undefined // Optional: log stack trace
            });

            // Throw a generic, user-friendly error. Avoid leaking specific crypto details
            // like "Invalid key length", "Unsupported state", "Invalid IV length", etc.
            // "Authentication failed" is a common outcome and can be mapped to a generic message.
            if (error instanceof Error) {
                if (error.message.toLowerCase().includes('authentication fail') || error.message.toLowerCase().includes('unsupported state')) {
                    throw new Error('Decryption failed: Invalid or corrupted encrypted data.');
                }
                if (error.message.toLowerCase().includes('invalid base64') || error.message.includes('Malformed encrypted data')) {
                    throw new Error('Decryption failed: Malformed encrypted data format.');
                }
            }
            // Fallback generic error
            throw new Error('Decryption failed: Unable to decrypt data.');
        }
    }
}

// --- Exported Singleton Instance ---

/**
 * A ready-to-use instance of the EncryptionService, initialized with the
 * master key from the environment variables.
 * Ensure `env.IMAGE_KEY_ENCRYPTION_KEY` is securely configured.
 */
export const encryptionService = new EncryptionService(env.IMAGE_KEY_ENCRYPTION_KEY);