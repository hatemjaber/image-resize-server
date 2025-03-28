import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class EncryptionService {
    private static instance: EncryptionService;
    private key: Buffer;

    private constructor (encryptionKey: string) {
        // Create a key from the provided encryption key
        this.key = crypto.scryptSync(encryptionKey, 'salt', KEY_LENGTH);
    }

    public static getInstance(encryptionKey?: string): EncryptionService {
        if (!EncryptionService.instance) {
            if (!encryptionKey) {
                throw new Error('Encryption key is required for first initialization');
            }
            EncryptionService.instance = new EncryptionService(encryptionKey);
        }
        return EncryptionService.instance;
    }

    encrypt(text: string): string {
        // Generate a random IV
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);

        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        // Encrypt the text
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Get the auth tag
        const tag = cipher.getAuthTag();

        // Combine all components
        const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);
        return result.toString('base64');
    }

    decrypt(encryptedText: string): string {
        // Convert from base64
        const buffer = Buffer.from(encryptedText, 'base64');

        // Extract components
        const salt = buffer.subarray(0, SALT_LENGTH);
        const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(tag);

        // Decrypt the text
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    }
} 