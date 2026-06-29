/**
 * AgapeNotes Custom Dialog Component
 * 
 * Replaces native alert, confirm, and prompt dialogs
 */

const Dialog = {
    container: null,
    resolveCallback: null,

    /**
     * Initialize dialog container
     */
    init() {
        // Create dialog container if it doesn't exist
        if (!document.getElementById('dialog-container')) {
            const container = document.createElement('div');
            container.id = 'dialog-container';
            container.className = 'dialog-container';
            container.setAttribute('aria-hidden', 'true');
            container.innerHTML = `
                <div class="dialog-backdrop"></div>
                <div class="dialog-box">
                    <div class="dialog-content">
                        <h3 class="dialog-title"></h3>
                        <p class="dialog-message"></p>
                        <input type="text" class="dialog-input form-input" style="display: none;">
                    </div>
                    <div class="dialog-actions"></div>
                </div>
            `;
            document.body.appendChild(container);
        }

        this.container = document.getElementById('dialog-container');

        // Close on backdrop click for alerts
        this.container.querySelector('.dialog-backdrop').addEventListener('click', () => {
            if (this.container.dataset.type === 'alert') {
                this.close(null);
            }
        });
    },

    /**
     * Show an alert dialog
     * @param {string} message - Message to display
     * @param {string} title - Optional title
     * @returns {Promise<void>}
     */
    alert(message, title = '') {
        return this._show({
            type: 'alert',
            title,
            message,
            buttons: [{ text: 'OK', primary: true, value: true }]
        });
    },

    /**
     * Show a confirm dialog
     * @param {string} message - Message to display
     * @param {string} title - Optional title
     * @returns {Promise<boolean>}
     */
    confirm(message, title = '') {
        return this._show({
            type: 'confirm',
            title,
            message,
            buttons: [
                { text: 'Cancel', primary: false, value: false },
                { text: 'Confirm', primary: true, value: true }
            ]
        });
    },

    /**
     * Show a prompt dialog
     * @param {string} message - Message to display
     * @param {string} defaultValue - Default input value
     * @param {string} title - Optional title
     * @returns {Promise<string|null>}
     */
    prompt(message, defaultValue = '', title = '') {
        return this._show({
            type: 'prompt',
            title,
            message,
            defaultValue,
            buttons: [
                { text: 'Cancel', primary: false, value: null },
                { text: 'OK', primary: true, value: 'input' }
            ]
        });
    },

    /**
     * Internal show method
     * @private
     */
    _show(options) {
        return new Promise((resolve) => {
            this.resolveCallback = resolve;

            const titleEl = this.container.querySelector('.dialog-title');
            const messageEl = this.container.querySelector('.dialog-message');
            const inputEl = this.container.querySelector('.dialog-input');
            const actionsEl = this.container.querySelector('.dialog-actions');

            // Set content
            titleEl.textContent = options.title;
            titleEl.style.display = options.title ? 'block' : 'none';
            messageEl.textContent = options.message;

            // Handle input for prompt
            if (options.type === 'prompt') {
                inputEl.style.display = 'block';
                inputEl.value = options.defaultValue || '';
                setTimeout(() => inputEl.focus(), 100);
            } else {
                inputEl.style.display = 'none';
            }

            // Create buttons
            actionsEl.innerHTML = options.buttons.map(btn => `
                <button class="btn ${btn.primary ? 'btn-primary' : 'btn-secondary'}" data-value="${btn.value}">
                    ${btn.text}
                </button>
            `).join('');

            // Bind button clicks
            actionsEl.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    let value = btn.dataset.value;
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    else if (value === 'null') value = null;
                    else if (value === 'input') value = inputEl.value;

                    this.close(value);
                });
            });

            // Store type for backdrop click behavior
            this.container.dataset.type = options.type;

            // Show dialog
            this.container.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';

            // Push history state for back button
            HistoryManager.push('dialog');
        });
    },

    /**
     * Close the dialog
     * @param {*} value - Value to resolve with
     */
    close(value) {
        if (!this.container) return;

        this.container.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (this.resolveCallback) {
            this.resolveCallback(value);
            this.resolveCallback = null;
        }
    },

    /**
     * Check if dialog is open
     * @returns {boolean}
     */
    isOpen() {
        return this.container && this.container.getAttribute('aria-hidden') === 'false';
    }
};
