import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SEPARATOR = ":";

function getEncryptionKey(): string {
	const key = process.env.FIELD_ENCRYPTION_KEY;
	if (!key) {
		throw new Error(
			"FIELD_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32",
		);
	}
	return key;
}

function deriveKey(salt: Buffer): Buffer {
	return scryptSync(getEncryptionKey(), salt, KEY_LENGTH);
}

export function encryptField(plaintext: string): string {
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);
	const key = deriveKey(salt);

	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return [
		"enc_v1",
		salt.toString("hex"),
		iv.toString("hex"),
		authTag.toString("hex"),
		encrypted.toString("hex"),
	].join(SEPARATOR);
}

export function decryptField(ciphertext: string): string {
	if (!ciphertext.startsWith("enc_v1:")) {
		return ciphertext;
	}

	const parts = ciphertext.split(SEPARATOR);
	if (parts.length !== 5) {
		throw new Error("Invalid encrypted field format");
	}

	const [, saltHex, ivHex, authTagHex, encryptedHex] = parts;
	const salt = Buffer.from(saltHex, "hex");
	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const encrypted = Buffer.from(encryptedHex, "hex");

	const key = deriveKey(salt);
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(encrypted),
		decipher.final(),
	]);

	return decrypted.toString("utf8");
}

export function isEncrypted(value: string | null | undefined): boolean {
	return value?.startsWith("enc_v1:") ?? false;
}

const SENSITIVE_EMAIL_FIELDS = [
	"accessToken",
	"refreshToken",
	"imapPassword",
	"appSecret",
] as const;

type SensitiveField = (typeof SENSITIVE_EMAIL_FIELDS)[number];

export function encryptSensitiveFields<
	T extends Partial<Record<SensitiveField, string | null>>,
>(data: T): T {
	const result = { ...data };
	for (const field of SENSITIVE_EMAIL_FIELDS) {
		const value = result[field];
		if (value && !isEncrypted(value)) {
			(result as Record<string, string>)[field] = encryptField(value);
		}
	}
	return result;
}

export function decryptSensitiveFields<
	T extends Partial<Record<SensitiveField, string | null>>,
>(data: T): T {
	const result = { ...data };
	for (const field of SENSITIVE_EMAIL_FIELDS) {
		const value = result[field];
		if (value && isEncrypted(value)) {
			(result as Record<string, string>)[field] = decryptField(value);
		}
	}
	return result;
}
