/**
 * AgapeNotes Pattern PIN Authentication Service
 * 
 * Handles swipe pattern PIN storage and validation using SHA-256 hashing.
 * Pattern is stored as a sequence of node indices (0-8 for a 3x3 grid).
 */

const PinAuth = {
    STORAGE_KEY: 'agape-pin-hash',
    QUOTE_KEY: 'agape-lock-quote',
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

    /**
     * Set custom lock screen quote
     * @param {string} quote
     */
    setQuote(quote) {
        if (quote) {
            localStorage.setItem(this.QUOTE_KEY, quote);
        } else {
            localStorage.removeItem(this.QUOTE_KEY);
        }
    },

    /**
     * Get custom lock screen quote
     * @returns {string|null}
     */
    getQuote() {
        return localStorage.getItem(this.QUOTE_KEY) || '';
    }
};
