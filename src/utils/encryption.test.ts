import { EncryptionService } from './encryption.js';

// Initialize the encryption service with a test key
const encryptionService = EncryptionService.getInstance('test-encryption-key-123');

const originalKey = "200000000000000000/1743173495610-9b450f4a-9713-4c96-a2b5-cbfbe575112c";

// Encrypt the key
const encryptedKey = encryptionService.encrypt(originalKey);

// Decrypt to verify
const decryptedKey = encryptionService.decrypt(encryptedKey);

console.log('Original key:', originalKey);
console.log('Encrypted key:', encryptedKey);
console.log('Decrypted key:', decryptedKey);
console.log('Verification:', originalKey === decryptedKey);

// Create a test URL
console.log('\nTest URL:');
console.log(`http://localhost:5555/image?key=${ encodeURIComponent(encryptedKey) }`); 