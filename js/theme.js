/**
 * AgapeNotes Theme Manager
 * 
 * Handles dark mode toggle without browser storage persistence.
 */

const ThemeManager = {
    /**
     * Initialize the non-persistent session theme.
     */
    init() {
        this.setTheme('light');
    },

    /**
     * Check if current theme is dark
     * @returns {boolean}
     */
    isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    },

    /**
     * Get current theme
     * @returns {string} 'light' or 'dark'
     */
    getTheme() {
        return this.isDark() ? 'dark' : 'light';
    },

    /**
     * Set theme
     * @param {string} theme - 'light' or 'dark'
     */
    setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            this._updateMetaThemeColor('#0F0F0F');
        } else {
            document.documentElement.removeAttribute('data-theme');
            this._updateMetaThemeColor('#D4A853');
        }

        // Toggle settings icon between gear and moon
        this._updateSettingsIcon(theme === 'dark');
    },

    /**
     * Update settings nav icon to show moon in dark mode
     * @private
     */
    _updateSettingsIcon(isDark) {
        const lightIcon = document.querySelector('.settings-icon-light');
        const darkIcon = document.querySelector('.settings-icon-dark');

        if (lightIcon && darkIcon) {
            lightIcon.style.display = isDark ? 'none' : 'block';
            darkIcon.style.display = isDark ? 'block' : 'none';
        }
    },

    /**
     * Toggle between light and dark
     */
    toggle() {
        this.setTheme(this.isDark() ? 'light' : 'dark');
    },

    /**
     * Update the meta theme-color for browser chrome
     * @private
     */
    _updateMetaThemeColor(color) {
        const meta = document.getElementById('theme-color-meta');
        if (meta) {
            meta.setAttribute('content', color);
        }
    }
};
