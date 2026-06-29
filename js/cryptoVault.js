/**
 * Client-side vault encryption.
 *
 * Google OAuth proves account ownership. The passphrase-derived wrapping key
 * never leaves the browser, so the Rust server only receives opaque ciphertext.
 */

const CryptoVault = {
    VERSION: 1,
    KDF_NAME: 'PBKDF2-SHA256',
    KDF_ITERATIONS: 310000,
    MIN_PASSPHRASE_LENGTH: 12,

    async createEncryptedVault(data, passphrase) {
        const salt = this._randomBytes(16);
        const dekBytes = this._randomBytes(32);
        const dekKey = await crypto.subtle.importKey(
            'raw',
            dekBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
        const wrappingKey = await this._deriveWrappingKey(passphrase, salt, this.KDF_ITERATIONS);
        const dekNonce = this._randomBytes(12);
        const encryptedDek = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: dekNonce },
            wrappingKey,
            dekBytes
        );
        const dataNonce = this._randomBytes(12);
        const ciphertext = await this._encryptData(data, dekKey, dataNonce);
        const cryptoMetadata = {
            version: this.VERSION,
            kdf: {
                name: this.KDF_NAME,
                hash: 'SHA-256',
                iterations: this.KDF_ITERATIONS,
                salt: this._bytesToBase64(salt)
            },
            keyWrap: {
                alg: 'AES-GCM',
                nonce: this._bytesToBase64(dekNonce),
                ciphertext: this._bytesToBase64(new Uint8Array(encryptedDek))
            },
            data: {
                alg: 'AES-GCM',
                nonce: this._bytesToBase64(dataNonce)
            }
        };

        return {
            crypto: cryptoMetadata,
            ciphertext,
            dekKey,
            dekBytes: this._bytesToBase64(dekBytes)
        };
    },

    async decryptVault(vault, passphrase) {
        const metadata = vault.crypto;
        this._validateMetadata(metadata);

        const salt = this._base64ToBytes(metadata.kdf.salt);
        const wrappingKey = await this._deriveWrappingKey(
            passphrase,
            salt,
            metadata.kdf.iterations
        );
        const dekBytes = new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: this._base64ToBytes(metadata.keyWrap.nonce) },
            wrappingKey,
            this._base64ToBytes(metadata.keyWrap.ciphertext)
        ));
        const dekKey = await this.importDekKey(dekBytes);
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: this._base64ToBytes(metadata.data.nonce) },
            dekKey,
            this._base64ToBytes(vault.ciphertext)
        );

        return {
            data: JSON.parse(new TextDecoder().decode(plaintext)),
            dekKey,
            dekBytes: this._bytesToBase64(dekBytes),
            crypto: metadata
        };
    },

    async importDekKey(dekBytes) {
        const rawBytes = typeof dekBytes === 'string'
            ? this._base64ToBytes(dekBytes)
            : dekBytes;

        return crypto.subtle.importKey(
            'raw',
            rawBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async decryptWithDek(vault, vaultState) {
        if (!vaultState?.dekKey) {
            throw new Error('Vault is not unlocked');
        }

        const metadata = vault.crypto;
        this._validateMetadata(metadata);

        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: this._base64ToBytes(metadata.data.nonce) },
            vaultState.dekKey,
            this._base64ToBytes(vault.ciphertext)
        );

        return {
            data: JSON.parse(new TextDecoder().decode(plaintext)),
            dekKey: vaultState.dekKey,
            crypto: metadata
        };
    },

    async encryptWithDek(data, vaultState) {
        if (!vaultState?.dekKey || !vaultState?.crypto) {
            throw new Error('Vault is not unlocked');
        }

        const dataNonce = this._randomBytes(12);
        const ciphertext = await this._encryptData(data, vaultState.dekKey, dataNonce);
        const cryptoMetadata = {
            ...vaultState.crypto,
            data: {
                ...vaultState.crypto.data,
                nonce: this._bytesToBase64(dataNonce)
            }
        };

        vaultState.crypto = cryptoMetadata;

        return {
            crypto: cryptoMetadata,
            ciphertext
        };
    },

    promptExistingPassphrase() {
        return window.prompt(
            'Enter your AgapeNotes vault passphrase. If you forget it, AgapeNotes cannot recover or reset access to your encrypted data.'
        ) || '';
    },

    promptNewPassphrase() {
        window.alert(
            'IMPORTANT: Save this passphrase in a password manager or another safe place. If you forget it, you will lose access to all encrypted AgapeNotes data. AgapeNotes cannot recover it for you.'
        );

        const first = window.prompt('Create an AgapeNotes vault passphrase:') || '';
        if (!first) return '';
        if (first.length < this.MIN_PASSPHRASE_LENGTH) {
            window.alert(`Use at least ${this.MIN_PASSPHRASE_LENGTH} characters for your vault passphrase.`);
            return '';
        }

        const second = window.prompt('Confirm your AgapeNotes vault passphrase:') || '';
        if (first !== second) {
            window.alert('Vault passphrases did not match.');
            return '';
        }

        const saved = window.confirm(
            'Have you saved this passphrase somewhere safe? If you forget it, your encrypted data cannot be recovered.'
        );
        if (!saved) return '';

        return first;
    },

    async _deriveWrappingKey(passphrase, saltBytes, iterations) {
        const passphraseKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt: saltBytes,
                iterations
            },
            passphraseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async _encryptData(data, dekKey, nonceBytes) {
        const plaintext = new TextEncoder().encode(JSON.stringify(data));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonceBytes },
            dekKey,
            plaintext
        );

        return this._bytesToBase64(new Uint8Array(ciphertext));
    },

    _validateMetadata(metadata) {
        if (!metadata || metadata.version !== this.VERSION) {
            throw new Error('Unsupported vault version');
        }
        if (metadata.kdf?.name !== this.KDF_NAME || metadata.kdf?.hash !== 'SHA-256') {
            throw new Error('Unsupported vault key derivation settings');
        }
        if (metadata.keyWrap?.alg !== 'AES-GCM' || metadata.data?.alg !== 'AES-GCM') {
            throw new Error('Unsupported vault cipher settings');
        }
    },

    _randomBytes(length) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return bytes;
    },

    _bytesToBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
        }
        return btoa(binary);
    },

    _base64ToBytes(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
};
