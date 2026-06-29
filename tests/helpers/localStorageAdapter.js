const STORAGE_KEY = 'agape-notes-data';

class LocalStorageAdapter extends DataAdapter {
    async initialize() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.data = JSON.parse(stored);
                if (this.data.version !== STORAGE_VERSION) {
                    this.data = this._migrate(this.data);
                    await this._persist();
                }
            } else {
                this.data = getDefaultData();
                await this._persist();
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize storage:', error);
            this.data = getDefaultData();
            return false;
        }
    }

    async sync() {
        this.data.lastSync = new Date().toISOString();
        await this._persist();
        return { success: true, lastSync: this.data.lastSync };
    }

    async _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
            return true;
        } catch (error) {
            console.error('Failed to persist data:', error);
            return false;
        }
    }
}
