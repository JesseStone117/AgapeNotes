/**
 * AgapeNotes Storage Layer
 * 
 * Abstract storage interface with localStorage implementation.
 * Designed to be easily swapped with Google Drive adapter in the future.
 */

const STORAGE_KEY = 'agape-notes-data';
const STORAGE_VERSION = 8;

/**
 * Default data structure
 */
function getDefaultData() {
    return {
        version: STORAGE_VERSION,
        lastSync: null,
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
 * LocalStorage Adapter - Implements StorageService using browser localStorage
 */
class LocalStorageAdapter extends StorageService {
    constructor() {
        super();
        this.data = null;
    }

    async initialize() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.data = JSON.parse(stored);
                // Migration check
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

    async getAllData() {
        return { ...this.data };
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
        // LocalStorage is synchronous, so this is a no-op
        // Future Google Drive adapter will implement actual sync
        this.data.lastSync = new Date().toISOString();
        await this._persist();
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
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
            return true;
        } catch (error) {
            console.error('Failed to persist data:', error);
            return false;
        }
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

        return {
            ...getDefaultData(),
            ...oldData,
            version: STORAGE_VERSION
        };
    }
}

/**
 * Future: GoogleDriveAdapter
 * 
 * class GoogleDriveAdapter extends StorageService {
 *     constructor(authToken) {
 *         super();
 *         this.authToken = authToken;
 *     }
 *     
 *     async sync() {
 *         // Implement Google Drive sync logic
 *     }
 * }
 */

// Export singleton instance
const storage = new LocalStorageAdapter();
