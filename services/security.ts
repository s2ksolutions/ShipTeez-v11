
// Encryption Service using Web Crypto API (AES-GCM)
// This ensures sensitive data in localStorage is not stored in plain text.

const ENC_ALGO = { name: "AES-GCM", length: 256 };

// Helper: Convert string to ArrayBuffer
const str2ab = (str: string) => new TextEncoder().encode(str);
// Helper: Convert ArrayBuffer to string
const ab2str = (buf: ArrayBuffer) => new TextDecoder().decode(buf);

// Helper: Buffer to Base64
const buf2b64 = (buf: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Helper: Base64 to Buffer
const b642buf = (b64: string) => {
    const binary_string = window.atob(b64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};

const isSecureContext = () => window.crypto && window.crypto.subtle;

// Generate or Retrieve a consistent Key for the device
const getAppKey = async (): Promise<CryptoKey | null> => {
    if (!isSecureContext()) return null;
    
    const APP_SECRET = 'SHIPTEEZ_SECURE_KEY_MATERIAL_V1'; 
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        str2ab(APP_SECRET),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: str2ab("SHIPTEEZ_SALT"),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        ENC_ALGO,
        true,
        ["encrypt", "decrypt"]
    );
};

export const securityService = {
    encrypt: async (data: any): Promise<string> => {
        if (!isSecureContext()) {
            // Fallback for non-secure contexts (dev/preview)
            return window.btoa(JSON.stringify(data));
        }
        try {
            const key = await getAppKey();
            if (!key) return "";
            
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const jsonStr = JSON.stringify(data);
            const encodedData = str2ab(jsonStr);

            const encryptedContent = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encodedData
            );

            // Return IV + Encrypted Data as a single Base64 string
            const combined = new Uint8Array(iv.byteLength + encryptedContent.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedContent), iv.byteLength);
            
            return buf2b64(combined.buffer);
        } catch (e) {
            console.error("Encryption failed", e);
            return "";
        }
    },

    decrypt: async (ciphertext: string): Promise<any> => {
        if (!ciphertext) return null;
        if (!isSecureContext()) {
            try {
                return JSON.parse(window.atob(ciphertext));
            } catch { return null; }
        }

        try {
            const combined = b642buf(ciphertext);
            const combinedArr = new Uint8Array(combined);
            
            // Extract IV (first 12 bytes)
            const iv = combinedArr.slice(0, 12);
            const data = combinedArr.slice(12);
            
            const key = await getAppKey();
            if (!key) return null;

            const decryptedContent = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                data
            );

            const decodedStr = ab2str(decryptedContent);
            return JSON.parse(decodedStr);
        } catch (e) {
            console.error("Decryption failed", e);
            return null;
        }
    }
};
