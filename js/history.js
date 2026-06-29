/**
 * AgapeNotes History Manager
 * 
 * Manages browser history for back button navigation
 */

const HistoryManager = {
    stack: [],

    /**
     * Initialize history manager
     */
    init() {
        // Listen for popstate (back button)
        window.addEventListener('popstate', (e) => {
            this._handleBack(e);
        });

        // Push initial state
        if (!history.state) {
            history.replaceState({ type: 'root' }, '');
        }
    },

    /**
     * Push a new state onto the history
     * @param {string} type - State type (modal, dialog, search, etc.)
     * @param {Object} data - Additional state data
     */
    push(type, data = {}) {
        const state = { type, ...data, timestamp: Date.now() };
        this.stack.push(state);
        history.pushState(state, '');
    },

    /**
     * Handle back button press
     * @private
     */
    _handleBack(e) {
        const state = this.stack.pop();

        if (!state) {
            // No state to go back to, let default behavior happen
            return;
        }

        // Prevent default navigation
        e.preventDefault();

        // Handle based on state type
        switch (state.type) {
            case 'modal':
                if (Modal.isOpen()) {
                    Modal.close();
                }
                break;

            case 'dialog':
                if (Dialog.isOpen()) {
                    Dialog.close(null);
                }
                break;

            case 'search':
                if (typeof SearchOverlay !== 'undefined' && SearchOverlay.isOpen()) {
                    SearchOverlay.close();
                }
                break;

            case 'view':
                // Navigate back to notes if on settings
                if (appState.get('currentView') === 'settings') {
                    Navigation.navigate('notes');
                }
                break;

            default:
                break;
        }
    },

    /**
     * Remove the last state without triggering back
     */
    pop() {
        if (this.stack.length > 0) {
            this.stack.pop();
            // Go back in browser history without triggering popstate handler
            history.back();
        }
    },

    /**
     * Clear history stack
     */
    clear() {
        this.stack = [];
    }
};
