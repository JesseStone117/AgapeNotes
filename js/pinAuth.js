/**
 * AgapeNotes Pattern PIN Authentication Service
 * 
 * Handles swipe pattern storage and per-device vault unlock wrapping.
 * Pattern is stored as a sequence of node indices (0-8 for a 3x3 grid).
 */

const PinAuth = {
    STORAGE_KEY: 'agape-pin-hash',
    VAULT_UNLOCK_PREFIX: 'agape-vault-unlock-v1:',
    KDF_ITERATIONS: 210000,
    MIN_NODES: 4,  // Minimum nodes required for a valid pattern

    /**
     * Hash a pattern using SHA-256
     * @param {number[]} pattern - Array of node indices
     * @returns {Promise<string>} Hashed pattern
     */
    async hashPattern(pattern) {
        const patternStr = pattern.join('-');
        const encoder = new TextEncoder();
        const data = encoder.encode(patternStr + 'agape-pattern-salt-2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Set a new pattern PIN
     * @param {number[]} pattern - Array of node indices
     */
    async setPattern(pattern) {
        if (!pattern || pattern.length < this.MIN_NODES) {
            throw new Error(`Pattern must include at least ${this.MIN_NODES} points`);
        }
        const hash = await this.hashPattern(pattern);
        localStorage.setItem(this.STORAGE_KEY, hash);
    },

    /**
     * Validate a pattern against stored hash
     * @param {number[]} pattern - Pattern to validate
     * @returns {Promise<boolean>} True if valid
     */
    async validatePattern(pattern) {
        const storedHash = localStorage.getItem(this.STORAGE_KEY);
        if (!storedHash) return false;

        const inputHash = await this.hashPattern(pattern);
        return inputHash === storedHash;
    },

    /**
     * Check if a pattern PIN is set
     * @returns {boolean}
     */
    hasPin() {
        return !!localStorage.getItem(this.STORAGE_KEY);
    },

    /**
     * Clear the stored pattern PIN
     */
    clearPin() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    async setVaultUnlock(userId, pattern, dekBytes) {
        if (!userId) throw new Error('Cannot save device unlock without a user.');
        if (!pattern || pattern.length < this.MIN_NODES) {
            throw new Error(`Pattern must include at least ${this.MIN_NODES} points`);
        }

        const rawDek = typeof dekBytes === 'string'
            ? this._base64ToBytes(dekBytes)
            : dekBytes;
        const salt = this._randomBytes(16);
        const nonce = this._randomBytes(12);
        const key = await this._derivePatternKey(pattern, salt, userId);
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            key,
            rawDek
        );

        await this.setPattern(pattern);
        localStorage.setItem(this._vaultUnlockKey(userId), JSON.stringify({
            version: 1,
            userId,
            kdf: {
                name: 'PBKDF2-SHA256',
                iterations: this.KDF_ITERATIONS,
                salt: this._bytesToBase64(salt)
            },
            cipher: {
                alg: 'AES-GCM',
                nonce: this._bytesToBase64(nonce),
                ciphertext: this._bytesToBase64(new Uint8Array(ciphertext))
            },
            createdAt: new Date().toISOString()
        }));
    },

    hasVaultUnlock(userId) {
        if (!userId || !this.hasPin()) return false;
        return !!localStorage.getItem(this._vaultUnlockKey(userId));
    },

    clearVaultUnlock(userId) {
        if (userId) {
            localStorage.removeItem(this._vaultUnlockKey(userId));
        }
        this.clearPin();
    },

    async unlockVaultDek(userId, pattern) {
        if (!await this.validatePattern(pattern)) {
            throw new Error('Incorrect pattern');
        }

        const saved = localStorage.getItem(this._vaultUnlockKey(userId));
        if (!saved) {
            throw new Error('No device unlock is saved for this account');
        }

        const envelope = JSON.parse(saved);
        if (envelope.version !== 1 || envelope.userId !== userId) {
            throw new Error('Unsupported device unlock data');
        }

        const key = await this._derivePatternKey(
            pattern,
            this._base64ToBytes(envelope.kdf.salt),
            userId,
            envelope.kdf.iterations
        );
        const dekBytes = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: this._base64ToBytes(envelope.cipher.nonce) },
            key,
            this._base64ToBytes(envelope.cipher.ciphertext)
        );

        return this._bytesToBase64(new Uint8Array(dekBytes));
    },

    /**
     * @returns {string|null}
     */
    getQuote() {
        return '';
    },

    _vaultUnlockKey(userId) {
        return `${this.VAULT_UNLOCK_PREFIX}${userId}`;
    },

    async _derivePatternKey(pattern, saltBytes, userId, iterations = this.KDF_ITERATIONS) {
        const patternStr = `${userId}:${pattern.join('-')}`;
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(patternStr),
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
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
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
