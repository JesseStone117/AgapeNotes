/**
 * Tests for LocalStorageAdapter (storage.js)
 *
 * Validates all CRUD operations, data isolation between categories,
 * persistence to localStorage, and data integrity through save/load cycles.
 */

const { loadScript } = require('./helpers/loadScript');

// Load the storage module into the global scope
loadScript('js/storage.js');

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function createTestPerson(overrides = {}) {
    return {
        id: overrides.id || Date.now().toString(),
        firstName: overrides.firstName || 'John',
        lastName: overrides.lastName || 'Doe',
        profilePicture: null,
        basicInfo: {
            phone: '5551234567',
            email: 'john@example.com',
            major: '',
            occupation: 'Engineer',
            birthday: '1990-01-15',
            family: '',
            church: 'Grace Church',
            howIKnowThem: 'College friend',
        },
        ministryPlan: {},
        timeline: [],
        funFacts: ['Loves chess'],
        notes: overrides.notes || [
            { id: 'n1', content: 'First note', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
            { id: 'n2', content: 'Second note', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
        ],
        prayerRequests: overrides.prayerRequests || [
            { id: 'pr1', content: 'Health', createdAt: '2025-01-01T00:00:00Z', isAnswered: false },
        ],
        actionPlans: overrides.actionPlans || [
            { id: 'ap1', content: 'Follow up', createdAt: '2025-01-01T00:00:00Z', status: 'todo' },
        ],
        isPinned: false,
        isArchived: false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
//  Test suites
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter', () => {
    let adapter;

    beforeEach(() => {
        localStorage.clear();
        adapter = new LocalStorageAdapter();
    });

    // -----------------------------------------------------------------------
    //  Initialize
    // -----------------------------------------------------------------------

    describe('initialize()', () => {
        test('creates default data on first run', async () => {
            await adapter.initialize();
            const data = await adapter.getAllData();
            expect(data.version).toBe(STORAGE_VERSION);
            expect(data.staff).toEqual([]);
            expect(data.students).toEqual([]);
            expect(data.supporters).toEqual([]);
        });

        test('loads existing data from localStorage', async () => {
            const existing = { version: STORAGE_VERSION, lastSync: null, staff: [{ id: '1', firstName: 'Existing' }], students: [], supporters: [] };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
            await adapter.initialize();
            const people = await adapter.getPeople('staff');
            expect(people).toHaveLength(1);
            expect(people[0].firstName).toBe('Existing');
        });

        test('handles corrupt JSON gracefully', async () => {
            localStorage.setItem(STORAGE_KEY, '{corrupt json!!!');
            const result = await adapter.initialize();
            expect(result).toBe(false);
            const data = await adapter.getAllData();
            // Should fall back to defaults
            expect(data.staff).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    //  savePerson
    // -----------------------------------------------------------------------

    describe('savePerson()', () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        test('adds a new person to the correct category', async () => {
            const person = createTestPerson({ id: 'p1' });
            await adapter.savePerson('staff', person);
            const people = await adapter.getPeople('staff');
            expect(people).toHaveLength(1);
            expect(people[0].id).toBe('p1');
        });

        test('updates an existing person by ID without losing other people', async () => {
            const alice = createTestPerson({ id: 'alice', firstName: 'Alice' });
            const bob = createTestPerson({ id: 'bob', firstName: 'Bob' });
            await adapter.savePerson('students', alice);
            await adapter.savePerson('students', bob);

            // Update Alice
            alice.firstName = 'Alice Updated';
            await adapter.savePerson('students', alice);

            const people = await adapter.getPeople('students');
            expect(people).toHaveLength(2);
            expect(people.find(p => p.id === 'alice').firstName).toBe('Alice Updated');
            expect(people.find(p => p.id === 'bob').firstName).toBe('Bob');
        });

        test('persists to localStorage', async () => {
            const person = createTestPerson({ id: 'persist-test' });
            await adapter.savePerson('supporters', person);
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
            expect(raw.supporters).toHaveLength(1);
            expect(raw.supporters[0].id).toBe('persist-test');
        });

        test('throws on invalid category', async () => {
            const person = createTestPerson();
            await expect(adapter.savePerson('invalid', person)).rejects.toThrow('Invalid category');
        });

        test('preserves notes array through save', async () => {
            const person = createTestPerson({
                id: 'notes-test',
                notes: [
                    { id: 'n1', content: 'Important note', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
                    { id: 'n2', content: 'Another note', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
                ],
            });
            await adapter.savePerson('staff', person);
            const saved = await adapter.getPerson('staff', 'notes-test');
            expect(saved.notes).toHaveLength(2);
            expect(saved.notes[0].id).toBe('n1');
            expect(saved.notes[0].content).toBe('Important note');
            expect(saved.notes[1].id).toBe('n2');
            expect(saved.notes[1].content).toBe('Another note');
        });

        test('preserves prayer requests through save', async () => {
            const person = createTestPerson({
                id: 'prayer-test',
                prayerRequests: [
                    { id: 'pr1', content: 'Healing', createdAt: '2025-01-01T00:00:00Z', isAnswered: true },
                ],
            });
            await adapter.savePerson('staff', person);
            const saved = await adapter.getPerson('staff', 'prayer-test');
            expect(saved.prayerRequests).toHaveLength(1);
            expect(saved.prayerRequests[0].content).toBe('Healing');
            expect(saved.prayerRequests[0].isAnswered).toBe(true);
        });

        test('preserves action plans through save', async () => {
            const person = createTestPerson({
                id: 'action-test',
                actionPlans: [
                    { id: 'ap1', content: 'Call back', createdAt: '2025-01-01T00:00:00Z', status: 'in-progress' },
                ],
            });
            await adapter.savePerson('staff', person);
            const saved = await adapter.getPerson('staff', 'action-test');
            expect(saved.actionPlans).toHaveLength(1);
            expect(saved.actionPlans[0].status).toBe('in-progress');
        });
    });

    // -----------------------------------------------------------------------
    //  getPerson
    // -----------------------------------------------------------------------

    describe('getPerson()', () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        test('retrieves the correct person by ID', async () => {
            const person = createTestPerson({ id: 'find-me', firstName: 'Jane' });
            await adapter.savePerson('staff', person);
            const found = await adapter.getPerson('staff', 'find-me');
            expect(found).not.toBeNull();
            expect(found.firstName).toBe('Jane');
        });

        test('returns null for non-existent ID', async () => {
            const found = await adapter.getPerson('staff', 'does-not-exist');
            expect(found).toBeNull();
        });

        test('returns null for non-existent category', async () => {
            const found = await adapter.getPerson('nonexistent', '123');
            expect(found).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    //  getPeople
    // -----------------------------------------------------------------------

    describe('getPeople()', () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        test('returns array copy, not a reference', async () => {
            const person = createTestPerson({ id: 'ref-test' });
            await adapter.savePerson('staff', person);
            const list1 = await adapter.getPeople('staff');
            const list2 = await adapter.getPeople('staff');
            expect(list1).not.toBe(list2); // different arrays
            expect(list1).toEqual(list2);  // same content
        });

        test('returns empty array for non-existent category', async () => {
            const people = await adapter.getPeople('nonexistent');
            expect(people).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    //  deletePerson
    // -----------------------------------------------------------------------

    describe('deletePerson()', () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        test('removes person by ID', async () => {
            const person = createTestPerson({ id: 'delete-me' });
            await adapter.savePerson('staff', person);
            const result = await adapter.deletePerson('staff', 'delete-me');
            expect(result).toBe(true);
            const people = await adapter.getPeople('staff');
            expect(people).toHaveLength(0);
        });

        test('returns false if person not found', async () => {
            const result = await adapter.deletePerson('staff', 'ghost');
            expect(result).toBe(false);
        });

        test('persists deletion to localStorage', async () => {
            const person = createTestPerson({ id: 'persist-del' });
            await adapter.savePerson('staff', person);
            await adapter.deletePerson('staff', 'persist-del');
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
            expect(raw.staff).toHaveLength(0);
        });

        test('throws on invalid category', async () => {
            await expect(adapter.deletePerson('nope', '123')).rejects.toThrow('Invalid category');
        });
    });

    // -----------------------------------------------------------------------
    //  Data isolation
    // -----------------------------------------------------------------------

    describe('Data isolation', () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        test('saving one person does not wipe other people in the same category', async () => {
            const alice = createTestPerson({ id: 'alice', firstName: 'Alice' });
            const bob = createTestPerson({ id: 'bob', firstName: 'Bob' });
            await adapter.savePerson('staff', alice);
            await adapter.savePerson('staff', bob);

            const people = await adapter.getPeople('staff');
            expect(people).toHaveLength(2);
        });

        test('saving to one category does not affect other categories', async () => {
            const staffPerson = createTestPerson({ id: 'staff-1', firstName: 'Staff' });
            const studentPerson = createTestPerson({ id: 'student-1', firstName: 'Student' });
            await adapter.savePerson('staff', staffPerson);
            await adapter.savePerson('students', studentPerson);

            expect(await adapter.getPeople('staff')).toHaveLength(1);
            expect(await adapter.getPeople('students')).toHaveLength(1);
            expect(await adapter.getPeople('supporters')).toHaveLength(0);
        });

        test('deleting from one category does not affect others', async () => {
            const s1 = createTestPerson({ id: 'a', firstName: 'A' });
            const s2 = createTestPerson({ id: 'b', firstName: 'B' });
            await adapter.savePerson('staff', s1);
            await adapter.savePerson('students', s2);
            await adapter.deletePerson('staff', 'a');

            expect(await adapter.getPeople('staff')).toHaveLength(0);
            expect(await adapter.getPeople('students')).toHaveLength(1);
        });
    });

    describe('transferPerson()', () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        test('moves a person from one category to another', async () => {
            const person = createTestPerson({ id: 'move-me', firstName: 'Mia' });
            await adapter.savePerson('students', person);

            const moved = await adapter.transferPerson('students', 'staff', 'move-me');

            expect(moved.id).toBe('move-me');
            expect(await adapter.getPeople('students')).toHaveLength(0);
            expect(await adapter.getPeople('staff')).toHaveLength(1);
        });

        test('updates linked meeting category when a person moves', async () => {
            const person = createTestPerson({ id: 'meeting-person' });
            await adapter.savePerson('students', person);
            await adapter.saveMeeting({
                id: 'meeting-1',
                personId: 'meeting-person',
                personCategory: 'students',
                date: '2025-09-01',
                time: '09:00'
            });

            await adapter.transferPerson('students', 'supporters', 'meeting-person');

            const meetings = await adapter.getMeetings();
            expect(meetings[0].personCategory).toBe('supporters');
        });
    });

    // -----------------------------------------------------------------------
    //  Import / Export
    // -----------------------------------------------------------------------

    describe('exportData / importData', () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        test('round-trips data faithfully', async () => {
            const person = createTestPerson({ id: 'export-1' });
            await adapter.savePerson('staff', person);
            const json = await adapter.exportData();

            // new adapter to simulate reimport
            localStorage.clear();
            const adapter2 = new LocalStorageAdapter();
            await adapter2.initialize();
            const imported = await adapter2.importData(json);
            expect(imported).toBe(true);
            const people = await adapter2.getPeople('staff');
            expect(people).toHaveLength(1);
            expect(people[0].id).toBe('export-1');
        });

        test('importData rejects invalid format', async () => {
            const result = await adapter.importData('{"random": true}');
            expect(result).toBe(false);
        });

        test('importData rejects invalid JSON', async () => {
            const result = await adapter.importData('not json at all');
            expect(result).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    //  Migration — status field
    // -----------------------------------------------------------------------

    describe('Migration: version 3 → 4 (status field)', () => {
        test('adds status field to existing persons on migration', async () => {
            // Seed with version 3 data that lacks the status field
            const v3Data = {
                version: 3,
                lastSync: null,
                staff: [{
                    id: 'old-person',
                    firstName: 'Legacy',
                    lastName: 'User',
                    profilePicture: null,
                    basicInfo: {
                        phone: '555',
                        email: 'legacy@test.com',
                        major: '',
                        occupation: '',
                        birthday: '',
                        family: '',
                        church: '',
                        howIKnowThem: 'Old friend',
                    },
                    ministryPlan: {},
                    timeline: [],
                    funFacts: [],
                    notes: [{ id: 'n1', content: 'old note', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }],
                    prayerRequests: [],
                    actionPlans: [],
                    isPinned: false,
                    isArchived: false,
                }],
                students: [],
                supporters: [],
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(v3Data));

            const migrated = new LocalStorageAdapter();
            await migrated.initialize();

            const person = await migrated.getPerson('staff', 'old-person');
            expect(person.basicInfo.status).toBe('');
            // Other fields should be preserved
            expect(person.basicInfo.phone).toBe('555');
            expect(person.basicInfo.howIKnowThem).toBe('Old friend');
            expect(person.notes).toHaveLength(1);
        });

        test('preserves existing status values during migration', async () => {
            const v3Data = {
                version: 3,
                lastSync: null,
                staff: [{
                    id: 'has-status',
                    firstName: 'Already',
                    lastName: 'Set',
                    profilePicture: null,
                    basicInfo: {
                        status: 'engage',
                        phone: '',
                        email: '',
                        major: '',
                        occupation: '',
                        birthday: '',
                        family: '',
                        church: '',
                        howIKnowThem: '',
                    },
                    ministryPlan: {},
                    timeline: [],
                    funFacts: [],
                    notes: [],
                    prayerRequests: [],
                    actionPlans: [],
                    isPinned: false,
                    isArchived: false,
                }],
                students: [],
                supporters: [],
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(v3Data));

            const migrated = new LocalStorageAdapter();
            await migrated.initialize();

            const person = await migrated.getPerson('staff', 'has-status');
            expect(person.basicInfo.status).toBe('engage');
        });
    });
});
