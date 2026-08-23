import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

/**
 * Derives a consistent 32-byte (256-bit) key from the environment secret
 */
function getEncryptionKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || 'default-super-secret-key-placeholder';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts raw text using AES-256-CBC
 * @param {string} text Raw text
 * @returns {string} Colon-delimited IV and encrypted hex string
 */
export function encryptSecret(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a previously encrypted secret
 * @param {string} encryptedText Colon-delimited IV and hex payload
 * @returns {string} Plaintext decrypted string
 */
export function decryptSecret(encryptedText) {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted secret format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
