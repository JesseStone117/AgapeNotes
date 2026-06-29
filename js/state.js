/**
 * AgapeNotes State Management
 * 
 * Simple reactive state management with event-based updates
 */

/**
 * State Manager - Simple observable state container
 */
class StateManager {
    constructor(initialState = {}) {
        this._state = { ...initialState };
        this._listeners = new Map();
        this._globalListeners = [];
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    get state() {
        return { ...this._state };
    }

    /**
     * Get a specific state value
     * @param {string} key - State key
     * @returns {*} State value
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Set a state value and notify listeners
     * @param {string} key - State key
     * @param {*} value - New value
     */
    set(key, value) {
        const oldValue = this._state[key];
        if (oldValue === value) return;

        this._state[key] = value;
        this._notify(key, value, oldValue);
    }

    /**
     * Update multiple state values at once
     * @param {Object} updates - Key-value pairs to update
     */
    update(updates) {
        const changes = [];

        for (const [key, value] of Object.entries(updates)) {
            const oldValue = this._state[key];
            if (oldValue !== value) {
                this._state[key] = value;
                changes.push({ key, value, oldValue });
            }
        }

        // Notify all changes
        changes.forEach(({ key, value, oldValue }) => {
            this._notify(key, value, oldValue);
        });
    }

    /**
     * Subscribe to changes on a specific key
     * @param {string} key - State key to watch
     * @param {Function} callback - Called with (newValue, oldValue)
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this._listeners.get(key);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }

    /**
     * Subscribe to all state changes
     * @param {Function} callback - Called with (key, newValue, oldValue)
     * @returns {Function} Unsubscribe function
     */
    subscribeAll(callback) {
        this._globalListeners.push(callback);

        return () => {
            const index = this._globalListeners.indexOf(callback);
            if (index > -1) {
                this._globalListeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify listeners of a state change
     * @private
     */
    _notify(key, newValue, oldValue) {
        // Notify specific key listeners
        const listeners = this._listeners.get(key) || [];
        listeners.forEach(cb => {
            try {
                cb(newValue, oldValue);
            } catch (error) {
                console.error(`State listener error for ${key}:`, error);
            }
        });

        // Notify global listeners
        this._globalListeners.forEach(cb => {
            try {
                cb(key, newValue, oldValue);
            } catch (error) {
                console.error('Global state listener error:', error);
            }
        });
    }
}

// Application State
const appState = new StateManager({
    // Current view
    currentView: 'notes', // 'notes' | 'resources' | 'schedule' | 'settings'

    // Current category in notes view
    currentCategory: Categories.STAFF,

    // People data (cached from storage)
    staff: [],
    students: [],
    supporters: [],

    // Currently selected/editing person
    activePerson: null,
    activePersonCategory: null,

    // UI states
    isLoading: false,
    isModalOpen: false,
    modalType: null, // 'view' | 'edit' | 'add'

    // Sync status
    lastSync: null,
    isSyncing: false
});

/**
 * Helper to get people for current category
 * @returns {Array} People in current category
 */
function getCurrentPeople() {
    const category = appState.get('currentCategory');
    return appState.get(category) || [];
}

/**
 * Helper to refresh people data from storage
 */
async function refreshPeopleData() {
    appState.set('isLoading', true);

    try {
        const [staff, students, supporters] = await Promise.all([
            storage.getPeople(Categories.STAFF),
            storage.getPeople(Categories.STUDENTS),
            storage.getPeople(Categories.SUPPORTERS)
        ]);

        appState.update({ staff, students, supporters });
    } catch (error) {
        console.error('Failed to refresh data:', error);
    } finally {
        appState.set('isLoading', false);
    }
}
