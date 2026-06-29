/**
 * AgapeNotes Storage Layer
 * 
 * Abstract storage interface plus the remote encrypted vault adapter.
 */

const STORAGE_VERSION = 8;

/**
 * Default data structure
 */
function getDefaultData() {
    return {
        version: STORAGE_VERSION,
        lastSync: null,
        settings: getDefaultSettings(),
        staff: [],
        students: [],
        supporters: [],
        discipleshipTopics: [],
        meetings: [],
        personal: {
            growthPlans: [],
            tasks: []
        }
    };
}

function getDefaultSettings() {
    return {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    };
}

function normalizeSettings(settings = {}) {
    const defaults = getDefaultSettings();
    return {
        ...defaults,
        ...(settings && typeof settings === 'object' ? settings : {}),
        timeZone: isValidTimeZone(settings?.timeZone) ? settings.timeZone : defaults.timeZone
    };
}

function isValidTimeZone(timeZone) {
    if (!timeZone || typeof timeZone !== 'string') return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

/**
 * Storage Service - Abstract interface for data persistence
 */
class StorageService {
    constructor() {
        if (this.constructor === StorageService) {
            throw new Error('StorageService is abstract and cannot be instantiated directly');
        }
    }

    async initialize() {
        throw new Error('Method not implemented');
    }

    async getAllData() {
        throw new Error('Method not implemented');
    }

    async getPeople(category) {
        throw new Error('Method not implemented');
    }

    async getPerson(category, id) {
        throw new Error('Method not implemented');
    }

    async savePerson(category, person) {
        throw new Error('Method not implemented');
    }

    async deletePerson(category, id) {
        throw new Error('Method not implemented');
    }

    async sync() {
        throw new Error('Method not implemented');
    }
}

/**
 * Shared data adapter with CRUD and migration logic.
 */
class DataAdapter extends StorageService {
    constructor() {
        super();
        this.data = null;
    }

    async initialize() {
        this.data = getDefaultData();
        return true;
    }

    async getAllData() {
        return { ...this.data };
    }

    async getSettings() {
        this.data.settings = normalizeSettings(this.data.settings);
        return { ...this.data.settings };
    }

    async saveSettings(settings) {
        this.data.settings = normalizeSettings({
            ...(this.data.settings || {}),
            ...(settings || {})
        });
        await this._persist();
        return { ...this.data.settings };
    }

    async getPeople(category) {
        if (!this.data[category]) {
            return [];
        }
        return [...this.data[category]];
    }

    async getPerson(category, id) {
        if (!this.data[category]) {
            return null;
        }
        return this.data[category].find(p => p.id === id) || null;
    }

    async savePerson(category, person) {
        if (!this.data[category]) {
            throw new Error(`Invalid category: ${category}`);
        }

        const index = this.data[category].findIndex(p => p.id === person.id);

        if (index >= 0) {
            // Update existing
            this.data[category][index] = { ...person };
        } else {
            // Add new
            this.data[category].push({ ...person });
        }

        await this._persist();
        return person;
    }

    async deletePerson(category, id) {
        if (!this.data[category]) {
            throw new Error(`Invalid category: ${category}`);
        }

        const index = this.data[category].findIndex(p => p.id === id);
        if (index >= 0) {
            this.data[category].splice(index, 1);
            await this._persist();
            return true;
        }
        return false;
    }

    async transferPerson(fromCategory, toCategory, personId) {
        if (!this.data[fromCategory]) {
            throw new Error(`Invalid category: ${fromCategory}`);
        }
        if (!this.data[toCategory]) {
            throw new Error(`Invalid category: ${toCategory}`);
        }
        if (fromCategory === toCategory) {
            return null;
        }

        const index = this.data[fromCategory].findIndex(p => p.id === personId);
        if (index < 0) {
            return null;
        }

        const [person] = this.data[fromCategory].splice(index, 1);
        this.data[toCategory].push({ ...person });

        if (Array.isArray(this.data.meetings)) {
            this.data.meetings = this.data.meetings.map(meeting => {
                if (meeting.personId !== personId) return meeting;
                return { ...meeting, personCategory: toCategory };
            });
        }

        await this._persist();
        return person;
    }

    // ---- Discipleship Topics CRUD ----

    async getTopics() {
        return [...(this.data.discipleshipTopics || [])];
    }

    async saveTopic(topic) {
        if (!this.data.discipleshipTopics) {
            this.data.discipleshipTopics = [];
        }
        const index = this.data.discipleshipTopics.findIndex(t => t.id === topic.id);
        if (index >= 0) {
            this.data.discipleshipTopics[index] = { ...topic };
        } else {
            this.data.discipleshipTopics.push({ ...topic });
        }
        await this._persist();
        return topic;
    }

    async deleteTopic(topicId) {
        if (!this.data.discipleshipTopics) return false;
        const index = this.data.discipleshipTopics.findIndex(t => t.id === topicId);
        if (index >= 0) {
            this.data.discipleshipTopics.splice(index, 1);
            await this._persist();
            return true;
        }
        return false;
    }

    // ---- Meetings CRUD ----

    async getMeetings() {
        return [...(this.data.meetings || [])];
    }

    async saveMeeting(meeting) {
        if (!this.data.meetings) {
            this.data.meetings = [];
        }
        const index = this.data.meetings.findIndex(m => m.id === meeting.id);
        if (index >= 0) {
            this.data.meetings[index] = { ...meeting };
        } else {
            this.data.meetings.push({ ...meeting });
        }
        await this._persist();
        return meeting;
    }

    async saveMeetings(meetings) {
        if (!this.data.meetings) {
            this.data.meetings = [];
        }
        meetings.forEach(meeting => {
            const index = this.data.meetings.findIndex(m => m.id === meeting.id);
            if (index >= 0) {
                this.data.meetings[index] = { ...meeting };
            } else {
                this.data.meetings.push({ ...meeting });
            }
        });
        await this._persist();
        return meetings;
    }

    async deleteMeeting(meetingId) {
        if (!this.data.meetings) return false;
        const index = this.data.meetings.findIndex(m => m.id === meetingId);
        if (index >= 0) {
            this.data.meetings.splice(index, 1);
            await this._persist();
            return true;
        }
        return false;
    }

    // ---- Personal Data ----

    async getPersonalData() {
        if (!this.data.personal) {
            this.data.personal = { growthPlans: [], tasks: [] };
        }
        return {
            growthPlans: [...(this.data.personal.growthPlans || [])],
            tasks: [...(this.data.personal.tasks || [])]
        };
    }

    async savePersonalData(personal) {
        this.data.personal = {
            growthPlans: [...(personal.growthPlans || [])],
            tasks: [...(personal.tasks || [])]
        };
        await this._persist();
        return this.data.personal;
    }

    async deleteMeetings(meetingIds) {
        if (!this.data.meetings) return false;
        const idSet = new Set(meetingIds);
        const before = this.data.meetings.length;
        this.data.meetings = this.data.meetings.filter(m => !idSet.has(m.id));
        if (this.data.meetings.length < before) {
            await this._persist();
            return true;
        }
        return false;
    }

    async sync() {
        this.data.lastSync = new Date().toISOString();
        return { success: true, lastSync: this.data.lastSync };
    }

    async exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    async importData(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (imported.version && imported.staff && imported.students && imported.supporters) {
                if (!imported.discipleshipTopics) imported.discipleshipTopics = [];
                if (!imported.meetings) imported.meetings = [];
                if (!imported.personal) imported.personal = { growthPlans: [], tasks: [] };
                this.data = imported;
                await this._persist();
                return true;
            }
            throw new Error('Invalid data format');
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    }

    async _persist() {
        throw new Error('Persistent storage adapter must implement _persist');
    }

    _migrate(oldData) {
        // Handle future migrations here
        console.log('Migrating data from version', oldData.version, 'to', STORAGE_VERSION);

        // Migrate each person in each category
        ['staff', 'students', 'supporters'].forEach(category => {
            if (oldData[category]) {
                oldData[category] = oldData[category].map(person => ({
                    ...person,
                    profilePicture: person.profilePicture || null,
                    basicInfo: {
                        ...person.basicInfo,
                        status: person.basicInfo?.status || '',
                        region: person.basicInfo?.region || '',
                        howIKnowThem: person.basicInfo?.howIKnowThem || '',
                        mailingAddress: person.basicInfo?.mailingAddress || '',
                        lastContactMethod: person.basicInfo?.lastContactMethod || '',
                        lastContactDate: person.basicInfo?.lastContactDate || ''
                    },
                    supportInfo: category === 'supporters'
                        ? {
                            monthlyAmount: person.supportInfo?.monthlyAmount || '',
                            startDate: person.supportInfo?.startDate || ''
                        }
                        : person.supportInfo,
                    prayerRequests: person.prayerRequests || [],
                    actionPlans: person.actionPlans || [],
                    growthPlans: person.growthPlans || [],
                    isPinned: person.isPinned || false,
                    isArchived: person.isArchived || false
                }));
            }
        });

        // Ensure discipleshipTopics exists
        if (!oldData.discipleshipTopics) {
            oldData.discipleshipTopics = [];
        }

        // Ensure meetings exists
        if (!oldData.meetings) {
            oldData.meetings = [];
        }

        if (!oldData.personal) {
            oldData.personal = { growthPlans: [], tasks: [] };
        }

        oldData.settings = normalizeSettings(oldData.settings);

        return {
            ...getDefaultData(),
            ...oldData,
            version: STORAGE_VERSION
        };
    }
}

/**
 * Remote vault adapter - the live app path.
 *
 * The browser may hold decrypted data in memory after unlock, but all durable
 * user data is encrypted and written only through the Rust API.
 */
class RemoteVaultStorageAdapter extends DataAdapter {
    constructor() {
        super();
        this.data = getDefaultData();
        this.mode = 'locked';
        this.remoteSession = null;
        this.remoteRevision = null;
        this.vaultState = null;
        this.remoteAvailable = false;
    }

    async initialize() {
        this.data = getDefaultData();
        const shouldPromptForVault = this._consumeAuthSuccessFlag();
        await this.refreshRemoteSession();

        if (shouldPromptForVault && this.isRemoteAuthenticated()) {
            try {
                await this.unlockRemoteVault();
            } catch (error) {
                console.error('Failed to unlock remote vault after sign-in:', error);
                window.alert('Google sign-in succeeded, but the encrypted vault was not unlocked.');
            }
        }

        return this.remoteAvailable;
    }

    async refreshRemoteSession() {
        if (typeof ApiClient === 'undefined') {
            this.remoteAvailable = false;
            this.remoteSession = null;
            return null;
        }

        try {
            this.remoteSession = await ApiClient.getMe();
            this.remoteAvailable = true;
            return this.remoteSession;
        } catch (error) {
            console.warn('AgapeNotes API is unavailable.', error);
            this.remoteAvailable = false;
            this.remoteSession = null;
            return null;
        }
    }

    isRemoteAuthenticated() {
        return !!this.remoteSession?.authenticated;
    }

    isRemoteUnlocked() {
        return this.mode === 'remote';
    }

    getRemoteUser() {
        return this.remoteSession?.user || null;
    }

    getRemoteVaultSummary() {
        return this.remoteSession?.vault || null;
    }

    getStorageMode() {
        if (this.isRemoteUnlocked()) return 'remote';
        if (this.isRemoteAuthenticated()) return 'locked';
        if (this.remoteAvailable) return 'signed-out';
        return 'unavailable';
    }

    canUsePatternUnlock() {
        const userId = this.getRemoteUser()?.id;
        return !!(
            userId &&
            typeof PinAuth !== 'undefined' &&
            typeof PinAuth.hasVaultUnlock === 'function' &&
            PinAuth.hasVaultUnlock(userId)
        );
    }

    hasDeviceUnlock() {
        return this.canUsePatternUnlock();
    }

    async unlockRemoteVault() {
        if (typeof ApiClient === 'undefined' || typeof CryptoVault === 'undefined') {
            throw new Error('Encrypted vault support is not loaded.');
        }

        await this.refreshRemoteSession();
        if (!this.isRemoteAuthenticated()) {
            throw new Error('Sign in before unlocking a remote vault.');
        }

        const vault = await ApiClient.getVault();

        if (vault.exists) {
            if (this.canUsePatternUnlock() && typeof PinScreen !== 'undefined') {
                const unlockedWithPattern = await this._unlockExistingVaultWithPattern(vault);
                if (unlockedWithPattern) {
                    return true;
                }
            }

            return this._unlockExistingVaultWithPassphrase(vault);
        }

        const passphrase = CryptoVault.promptNewPassphrase();
        if (!passphrase) return false;

        this.data = getDefaultData();
        const encrypted = await CryptoVault.createEncryptedVault(this.data, passphrase);
        const saved = await ApiClient.putVault({
            expectedRevision: null,
            crypto: encrypted.crypto,
            ciphertext: encrypted.ciphertext
        });

        this.vaultState = {
            dekKey: encrypted.dekKey,
            crypto: saved.crypto || encrypted.crypto,
            dekBytes: encrypted.dekBytes
        };
        this.remoteRevision = saved.revision;
        this.mode = 'remote';
        this._updateRemoteVaultSummary(saved);
        await this._maybeSetDevicePattern(encrypted.dekBytes);

        return true;
    }

    async configureDeviceUnlock() {
        this._assertUnlocked();
        return this._setDevicePattern(this.vaultState.dekBytes);
    }

    clearDeviceUnlock() {
        const userId = this.getRemoteUser()?.id;
        if (userId && typeof PinAuth !== 'undefined' && typeof PinAuth.clearVaultUnlock === 'function') {
            PinAuth.clearVaultUnlock(userId);
        }
    }

    async _unlockExistingVaultWithPattern(vault) {
        return new Promise(resolve => {
            PinScreen.show(async (pattern) => {
                try {
                    const userId = this.getRemoteUser()?.id;
                    const dekBytes = await PinAuth.unlockVaultDek(userId, pattern);
                    const dekKey = await CryptoVault.importDekKey(dekBytes);
                    const decrypted = await CryptoVault.decryptWithDek(vault, { dekKey });
                    decrypted.dekBytes = dekBytes;
                    await this._completeVaultUnlock(vault, decrypted);
                    resolve(true);
                } catch (error) {
                    console.error('Pattern vault unlock failed:', error);
                    this.clearDeviceUnlock();
                    window.alert('This swipe pattern can no longer unlock the vault on this device. Please use your vault passphrase.');
                    resolve(false);
                }
            }, {
                fallbackLabel: 'Use Passphrase',
                onFallback: () => resolve(false)
            });
        });
    }

    async _unlockExistingVaultWithPassphrase(vault) {
        const passphrase = CryptoVault.promptExistingPassphrase();
        if (!passphrase) return false;

        const decrypted = await CryptoVault.decryptVault(vault, passphrase);
        await this._completeVaultUnlock(vault, decrypted);
        await this._maybeSetDevicePattern(decrypted.dekBytes);
        return true;
    }

    async _completeVaultUnlock(vault, decrypted) {
        const needsMigration = decrypted.data?.version !== STORAGE_VERSION;
        const hadDefaultSupporter = this._hasDefaultSupporter(decrypted.data);
        this.data = this._normalizeVaultData(decrypted.data);
        this.vaultState = {
            dekKey: decrypted.dekKey,
            crypto: decrypted.crypto,
            dekBytes: decrypted.dekBytes
        };
        this.remoteRevision = vault.revision;
        this.mode = 'remote';

        if (needsMigration || hadDefaultSupporter) {
            await this._persistRemote();
        }
    }

    async _maybeSetDevicePattern(dekBytes) {
        const userId = this.getRemoteUser()?.id;
        if (
            !userId ||
            !dekBytes ||
            typeof PinAuth === 'undefined' ||
            typeof PinScreen === 'undefined' ||
            PinAuth.hasVaultUnlock(userId)
        ) {
            return false;
        }

        const shouldSetPattern = window.confirm(
            'Set a swipe pattern for this device? Future unlocks on this device can use the pattern instead of your vault passphrase. Your notes stay encrypted on the server, and you still need the passphrase for new devices or recovery.'
        );
        if (!shouldSetPattern) return false;

        return this._setDevicePattern(dekBytes);
    }

    async _setDevicePattern(dekBytes) {
        const userId = this.getRemoteUser()?.id;
        if (!userId || typeof PinAuth === 'undefined' || typeof PinScreen === 'undefined') {
            return false;
        }

        return new Promise(resolve => {
            PinScreen.showSetup(async (pattern) => {
                try {
                    await PinAuth.setVaultUnlock(userId, pattern, dekBytes);
                    resolve(true);
                } catch (error) {
                    console.error('Failed to save device unlock pattern:', error);
                    window.alert('Could not save the swipe pattern for this device.');
                    resolve(false);
                }
            }, {
                onCancel: () => resolve(false)
            });
        });
    }

    lockRemoteVault() {
        this.mode = 'locked';
        this.remoteRevision = null;
        this.vaultState = null;
        this.data = getDefaultData();
    }

    async logoutRemote() {
        if (typeof ApiClient !== 'undefined') {
            await ApiClient.logout();
        }

        this.lockRemoteVault();
        this.remoteSession = { authenticated: false, user: null, vault: null };
    }

    async savePerson(category, person) {
        await this._ensureFreshBeforeWrite();
        return super.savePerson(category, person);
    }

    async deletePerson(category, id) {
        await this._ensureFreshBeforeWrite();
        return super.deletePerson(category, id);
    }

    async transferPerson(fromCategory, toCategory, personId) {
        await this._ensureFreshBeforeWrite();
        return super.transferPerson(fromCategory, toCategory, personId);
    }

    async saveTopic(topic) {
        await this._ensureFreshBeforeWrite();
        return super.saveTopic(topic);
    }

    async deleteTopic(topicId) {
        await this._ensureFreshBeforeWrite();
        return super.deleteTopic(topicId);
    }

    async saveMeeting(meeting) {
        await this._ensureFreshBeforeWrite();
        return super.saveMeeting(meeting);
    }

    async saveMeetings(meetings) {
        await this._ensureFreshBeforeWrite();
        return super.saveMeetings(meetings);
    }

    async deleteMeeting(meetingId) {
        await this._ensureFreshBeforeWrite();
        return super.deleteMeeting(meetingId);
    }

    async savePersonalData(personal) {
        await this._ensureFreshBeforeWrite();
        return super.savePersonalData(personal);
    }

    async saveSettings(settings) {
        await this._ensureFreshBeforeWrite();
        return super.saveSettings(settings);
    }

    async deleteMeetings(meetingIds) {
        await this._ensureFreshBeforeWrite();
        return super.deleteMeetings(meetingIds);
    }

    async sync() {
        if (!this.isRemoteUnlocked()) {
            return { success: false, skipped: true, reason: 'vault-locked' };
        }

        const updated = await this._loadRemoteIfNewer();
        return {
            success: true,
            updated,
            revision: this.remoteRevision,
            lastSync: this.data?.lastSync || null
        };
    }

    async exportData() {
        this._assertUnlocked();
        await this.sync();
        return JSON.stringify(this.data, null, 2);
    }

    async importData(jsonString) {
        this._assertUnlocked();

        try {
            await this._loadRemoteIfNewer();
            this.data = this._normalizeImportedData(jsonString);
            await this._persist();
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            if (error instanceof SyntaxError || error.message === 'Invalid data format') {
                return false;
            }
            throw error;
        }
    }

    async _persist() {
        this._assertUnlocked();
        return this._persistRemote();
    }

    async _persistRemote() {
        this._assertUnlocked();
        this.data.lastSync = new Date().toISOString();

        const encrypted = await CryptoVault.encryptWithDek(this.data, this.vaultState);

        try {
            const saved = await ApiClient.putVault({
                expectedRevision: this.remoteRevision,
                crypto: encrypted.crypto,
                ciphertext: encrypted.ciphertext
            });

            this.remoteRevision = saved.revision;
            this.vaultState.crypto = saved.crypto || encrypted.crypto;
            this._updateRemoteVaultSummary(saved);
            return true;
        } catch (error) {
            if (error?.status === 409) {
                throw new Error('Your vault changed on another device. Sync finished data first, then try the change again.');
            }
            throw error;
        }
    }

    async _ensureFreshBeforeWrite() {
        this._assertUnlocked();
        await this._loadRemoteIfNewer();
    }

    async _loadRemoteIfNewer() {
        const vault = await ApiClient.getVault();
        if (!vault.exists) {
            throw new Error('Encrypted vault was not found for this account.');
        }

        const revision = vault.revision || 0;
        if (this.remoteRevision !== null && revision <= this.remoteRevision) {
            return false;
        }

        const decrypted = await CryptoVault.decryptWithDek(vault, this.vaultState);
        this.data = this._normalizeVaultData(decrypted.data);
        this.remoteRevision = revision;
        this.vaultState.crypto = decrypted.crypto;
        this._updateRemoteVaultSummary(vault);
        return true;
    }

    _normalizeImportedData(jsonString) {
        const imported = JSON.parse(jsonString);
        return this._normalizeVaultData(imported, true);
    }

    _normalizeVaultData(data, requireLegacyShape = false) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }

        if (
            requireLegacyShape &&
            (!Array.isArray(data.staff) || !Array.isArray(data.students) || !Array.isArray(data.supporters))
        ) {
            throw new Error('Invalid data format');
        }

        const normalized = {
            ...getDefaultData(),
            ...data,
            staff: Array.isArray(data.staff) ? data.staff : [],
            students: Array.isArray(data.students) ? data.students : [],
            supporters: Array.isArray(data.supporters)
                ? data.supporters.filter(person => !this._isDefaultSupporter(person))
                : [],
            settings: normalizeSettings(data.settings),
            discipleshipTopics: Array.isArray(data.discipleshipTopics) ? data.discipleshipTopics : [],
            meetings: Array.isArray(data.meetings)
                ? data.meetings.map(meeting => ({
                    ...meeting,
                    reminder: normalizeMeetingReminder(meeting.reminder)
                }))
                : [],
            personal: {
                growthPlans: Array.isArray(data.personal?.growthPlans) ? data.personal.growthPlans : [],
                tasks: Array.isArray(data.personal?.tasks) ? data.personal.tasks : []
            }
        };

        if (!Object.prototype.hasOwnProperty.call(data, 'version')) {
            normalized.version = requireLegacyShape ? 0 : STORAGE_VERSION;
        }

        if (normalized.version !== STORAGE_VERSION) {
            return this._migrate(normalized);
        }

        return {
            ...normalized,
            version: STORAGE_VERSION
        };
    }

    _hasDefaultSupporter(data) {
        return Array.isArray(data?.supporters) && data.supporters.some(person => this._isDefaultSupporter(person));
    }

    _isDefaultSupporter(person) {
        const firstName = String(person?.firstName || '').trim().toLowerCase();
        const lastName = String(person?.lastName || '').trim().toLowerCase();
        if (firstName !== 'jesse' || lastName !== 'stone') {
            return false;
        }

        const categoryFields = [
            person.profilePicture,
            person.basicInfo?.phone,
            person.basicInfo?.email,
            person.basicInfo?.occupation,
            person.basicInfo?.birthday,
            person.basicInfo?.family,
            person.basicInfo?.church,
            person.basicInfo?.howIKnowThem,
            person.basicInfo?.mailingAddress,
            person.supportInfo?.monthlyAmount,
            person.supportInfo?.startDate
        ];
        const listFields = [
            person.timeline,
            person.funFacts,
            person.notes,
            person.prayerRequests,
            person.actionPlans,
            person.growthPlans
        ];

        const hasMeaningfulField = categoryFields.some(value => String(value || '').trim());
        const hasMeaningfulList = listFields.some(value => Array.isArray(value) && value.length > 0);
        return !hasMeaningfulField && !hasMeaningfulList;
    }

    _updateRemoteVaultSummary(saved) {
        if (!this.remoteSession) return;
        this.remoteSession.vault = {
            exists: true,
            revision: saved.revision,
            updatedAt: saved.updatedAt
        };
    }

    _assertUnlocked() {
        if (!this.isRemoteUnlocked() || !this.vaultState) {
            throw new Error('Unlock the encrypted vault before using AgapeNotes data.');
        }
    }

    _consumeAuthSuccessFlag() {
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.get('auth') !== 'success') return false;

            url.searchParams.delete('auth');
            const cleaned = `${url.pathname}${url.search}${url.hash}`;
            window.history.replaceState({}, document.title, cleaned || '/');
            return true;
        } catch {
            return false;
        }
    }
}

// Export singleton instance used by the app.
const storage = new RemoteVaultStorageAdapter();
