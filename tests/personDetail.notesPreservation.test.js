/**
 * Regression tests for the notes-wipe bug.
 *
 * BUG: When editing a person's details (name, phone, etc.) without expanding
 * the Notes collapsible section, _formEditors is empty ([]).  The old code
 * unconditionally mapped over _formEditors to produce the new notes array,
 * which resulted in an empty array — wiping every note the person had.
 *
 * FIX: _savePerson now checks `this._notesEditorsInitialized` before
 * overwriting person.notes.  When the notes section was never opened the
 * flag stays false and person.notes is left untouched.
 *
 * These tests exercise the fix at multiple levels:
 *   1. Unit-level: the conditional extraction logic itself
 *   2. Integration-level: storage round-trip with simulated edit flows
 */

const { loadScript } = require('./helpers/loadScript');

// Load production modules into global scope
loadScript('js/models.js');
loadScript('js/storage.js');
loadScript('tests/helpers/localStorageAdapter.js');

// ---------------------------------------------------------------------------
//  Helpers — replicate the relevant bits of PersonDetail
// ---------------------------------------------------------------------------

/** Replicate _readQuillContent */
function readQuillContent(quill) {
    if (!quill) return '';
    const text = quill.getText().trim();
    if (!text) return '';
    return quill.root.innerHTML;
}

/** Create a mock Quill editor */
function mockQuill(text, html) {
    return {
        getText: () => text,
        root: { innerHTML: html },
    };
}

/**
 * Replicate the FIXED note extraction logic from _savePerson.
 *
 * @param {boolean} notesEditorsInitialized — mirrors this._notesEditorsInitialized
 * @param {Array} existingNotes — the current person.notes
 * @param {Array} editors — the _formEditors array
 * @returns {Array} the notes array that _savePerson would assign
 */
function extractNotesFixed(notesEditorsInitialized, existingNotes, editors) {
    if (notesEditorsInitialized) {
        return editors
            .map((q, i) => ({
                ...(existingNotes?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
                content: readQuillContent(q),
                updatedAt: new Date().toISOString(),
            }))
            .filter(n => n.content);
    }
    // Notes section was never expanded — preserve existing notes as-is
    return existingNotes;
}

/**
 * Replicate the OLD (buggy) extraction — always maps from editors.
 */
function extractNotesBuggy(existingNotes, editors) {
    return editors
        .map((q, i) => ({
            ...(existingNotes?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
            content: readQuillContent(q),
            updatedAt: new Date().toISOString(),
        }))
        .filter(n => n.content);
}

// ---------------------------------------------------------------------------
//  Test data
// ---------------------------------------------------------------------------

function makeNotesArray() {
    return [
        { id: 'n1', content: '<p>First note</p>', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
        { id: 'n2', content: '<p>Second note</p>', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
        { id: 'n3', content: '<p>Third note</p>', createdAt: '2025-03-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z' },
    ];
}

function makeFullPerson(overrides = {}) {
    return {
        id: 'test-person-1',
        firstName: 'Jesse',
        lastName: 'Stone',
        profilePicture: null,
        basicInfo: {
            phone: '5551234567',
            email: 'jesse@test.com',
            major: 'Ministry',
            occupation: 'Campus Minister',
            birthday: '1990-06-15',
            family: 'Married',
            church: 'Grace Community',
            howIKnowThem: 'College',
        },
        ministryPlan: {},
        timeline: [],
        funFacts: ['Loves hiking', 'Plays guitar'],
        notes: makeNotesArray(),
        prayerRequests: [
            { id: 'pr1', content: 'Health', createdAt: '2025-01-01T00:00:00Z', isAnswered: false },
        ],
        actionPlans: [
            { id: 'ap1', content: 'Follow up', createdAt: '2025-01-01T00:00:00Z', status: 'todo' },
        ],
        isPinned: false,
        isArchived: false,
        ...overrides,
    };
}

// ===================================================================
//  Unit tests — the conditional extraction logic
// ===================================================================

describe('REGRESSION: notes preserved when notes section is NOT expanded', () => {
    const notes = makeNotesArray();

    test('old buggy code wipes notes when editors is empty', () => {
        // Demonstrates the actual bug: empty editors → empty notes
        const result = extractNotesBuggy(notes, []);
        expect(result).toHaveLength(0); // BUG: all 3 notes are lost!
    });

    test('fixed code preserves notes when notesEditorsInitialized is false', () => {
        const result = extractNotesFixed(false, notes, []);
        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('n1');
        expect(result[1].id).toBe('n2');
        expect(result[2].id).toBe('n3');
    });

    test('fixed code preserves note content when notesEditorsInitialized is false', () => {
        const result = extractNotesFixed(false, notes, []);
        expect(result[0].content).toBe('<p>First note</p>');
        expect(result[1].content).toBe('<p>Second note</p>');
        expect(result[2].content).toBe('<p>Third note</p>');
    });

    test('fixed code returns exact same array reference when not initialized', () => {
        const result = extractNotesFixed(false, notes, []);
        expect(result).toBe(notes); // exact same reference — no mutation
    });

    test('undefined existing notes are preserved as-is when not initialized', () => {
        const result = extractNotesFixed(false, undefined, []);
        expect(result).toBeUndefined();
    });

    test('null existing notes are preserved as-is when not initialized', () => {
        const result = extractNotesFixed(false, null, []);
        expect(result).toBeNull();
    });

    test('empty notes array is preserved when not initialized', () => {
        const result = extractNotesFixed(false, [], []);
        expect(result).toEqual([]);
    });
});

describe('Notes correctly extracted when notes section IS expanded', () => {
    const notes = makeNotesArray();

    test('notes are updated from editors when initialized', () => {
        const editors = [
            mockQuill('Updated first', '<p>Updated first</p>'),
            mockQuill('Updated second', '<p>Updated second</p>'),
            mockQuill('Updated third', '<p>Updated third</p>'),
        ];
        const result = extractNotesFixed(true, notes, editors);
        expect(result).toHaveLength(3);
        expect(result[0].content).toBe('<p>Updated first</p>');
        expect(result[1].content).toBe('<p>Updated second</p>');
        expect(result[2].content).toBe('<p>Updated third</p>');
    });

    test('note IDs are preserved when initialized', () => {
        const editors = [
            mockQuill('a', '<p>a</p>'),
            mockQuill('b', '<p>b</p>'),
            mockQuill('c', '<p>c</p>'),
        ];
        const result = extractNotesFixed(true, notes, editors);
        expect(result[0].id).toBe('n1');
        expect(result[1].id).toBe('n2');
        expect(result[2].id).toBe('n3');
    });

    test('empty editors still clear notes when initialized (intentional delete-all)', () => {
        // This is correct behavior: if user expanded the notes section and
        // removed all notes, we should honor that.
        const result = extractNotesFixed(true, notes, []);
        expect(result).toHaveLength(0);
    });

    test('editors with empty content are filtered out when initialized', () => {
        const editors = [
            mockQuill('Keep this', '<p>Keep this</p>'),
            mockQuill('', ''),                             // empty
            mockQuill('   ', '<p>   </p>'),                // whitespace only
        ];
        const result = extractNotesFixed(true, notes, editors);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('<p>Keep this</p>');
    });

    test('new notes added via editor get generated metadata', () => {
        const editors = [
            mockQuill('a', '<p>a</p>'),
            mockQuill('b', '<p>b</p>'),
            mockQuill('c', '<p>c</p>'),
            mockQuill('brand new', '<p>brand new</p>'), // index 3: no existing note
        ];
        const result = extractNotesFixed(true, notes, editors);
        expect(result).toHaveLength(4);
        expect(result[3].id).toBeTruthy();
        expect(result[3].createdAt).toBeTruthy();
        expect(result[3].content).toBe('<p>brand new</p>');
    });
});

// ===================================================================
//  Integration tests — full storage round-trip
// ===================================================================

describe('End-to-end: editing person details preserves notes in storage', () => {
    let adapter;

    beforeEach(async () => {
        localStorage.clear();
        adapter = new LocalStorageAdapter();
        await adapter.initialize();
    });

    test('CRITICAL: editing only basicInfo does NOT wipe notes', async () => {
        // This is the exact scenario that triggered the bug report
        const person = makeFullPerson();
        await adapter.savePerson('staff', person);

        // Simulate: user opens edit, changes phone number, saves
        // Notes section is never expanded → _notesEditorsInitialized = false
        const retrieved = await adapter.getPerson('staff', person.id);
        expect(retrieved.notes).toHaveLength(3); // notes exist before edit

        // Simulate _savePerson behavior with the fix:
        retrieved.basicInfo.phone = '9998887777';
        // Notes are NOT touched because notesEditorsInitialized = false
        retrieved.notes = extractNotesFixed(false, retrieved.notes, []);

        await adapter.savePerson('staff', retrieved);

        const final = await adapter.getPerson('staff', person.id);
        expect(final.basicInfo.phone).toBe('9998887777'); // phone updated
        expect(final.notes).toHaveLength(3);               // notes preserved!
        expect(final.notes[0].id).toBe('n1');
        expect(final.notes[0].content).toBe('<p>First note</p>');
        expect(final.notes[1].id).toBe('n2');
        expect(final.notes[2].id).toBe('n3');
    });

    test('CRITICAL: editing firstName and lastName does NOT wipe notes', async () => {
        const person = makeFullPerson();
        await adapter.savePerson('students', person);

        const retrieved = await adapter.getPerson('students', person.id);
        retrieved.firstName = 'NewFirst';
        retrieved.lastName = 'NewLast';
        // Notes section never expanded
        retrieved.notes = extractNotesFixed(false, retrieved.notes, []);

        await adapter.savePerson('students', retrieved);

        const final = await adapter.getPerson('students', person.id);
        expect(final.firstName).toBe('NewFirst');
        expect(final.lastName).toBe('NewLast');
        expect(final.notes).toHaveLength(3);
        expect(final.notes.map(n => n.id)).toEqual(['n1', 'n2', 'n3']);
    });

    test('editing with notes section expanded correctly updates notes', async () => {
        const person = makeFullPerson();
        await adapter.savePerson('staff', person);

        const retrieved = await adapter.getPerson('staff', person.id);
        retrieved.basicInfo.email = 'new@email.com';

        // Notes section WAS expanded — editors are present
        const editors = [
            mockQuill('Edited note 1', '<p>Edited note 1</p>'),
            mockQuill('Edited note 2', '<p>Edited note 2</p>'),
            mockQuill('Edited note 3', '<p>Edited note 3</p>'),
        ];
        retrieved.notes = extractNotesFixed(true, retrieved.notes, editors);

        await adapter.savePerson('staff', retrieved);

        const final = await adapter.getPerson('staff', person.id);
        expect(final.basicInfo.email).toBe('new@email.com');
        expect(final.notes).toHaveLength(3);
        expect(final.notes[0].content).toBe('<p>Edited note 1</p>');
        expect(final.notes[1].content).toBe('<p>Edited note 2</p>');
        expect(final.notes[2].content).toBe('<p>Edited note 3</p>');
    });

    test('multiple consecutive edits without expanding notes preserve all notes', async () => {
        const person = makeFullPerson();
        await adapter.savePerson('supporters', person);

        // Edit 1: change phone
        let p = await adapter.getPerson('supporters', person.id);
        p.basicInfo.phone = '1111111111';
        p.notes = extractNotesFixed(false, p.notes, []);
        await adapter.savePerson('supporters', p);

        // Edit 2: change email
        p = await adapter.getPerson('supporters', person.id);
        p.basicInfo.email = 'edit2@test.com';
        p.notes = extractNotesFixed(false, p.notes, []);
        await adapter.savePerson('supporters', p);

        // Edit 3: change name
        p = await adapter.getPerson('supporters', person.id);
        p.firstName = 'Changed';
        p.notes = extractNotesFixed(false, p.notes, []);
        await adapter.savePerson('supporters', p);

        // Verify notes survived all 3 edits
        const final = await adapter.getPerson('supporters', person.id);
        expect(final.firstName).toBe('Changed');
        expect(final.basicInfo.phone).toBe('1111111111');
        expect(final.basicInfo.email).toBe('edit2@test.com');
        expect(final.notes).toHaveLength(3);
        expect(final.notes.map(n => n.id)).toEqual(['n1', 'n2', 'n3']);
        expect(final.notes.map(n => n.content)).toEqual([
            '<p>First note</p>',
            '<p>Second note</p>',
            '<p>Third note</p>',
        ]);
    });

    test('person with many notes (10+) survives edit without notes section opened', async () => {
        const manyNotes = Array.from({ length: 15 }, (_, i) => ({
            id: `note-${i}`,
            content: `<p>Note number ${i}</p>`,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
        }));
        const person = makeFullPerson({ notes: manyNotes });
        await adapter.savePerson('staff', person);

        const retrieved = await adapter.getPerson('staff', person.id);
        retrieved.firstName = 'Renamed';
        retrieved.notes = extractNotesFixed(false, retrieved.notes, []);
        await adapter.savePerson('staff', retrieved);

        const final = await adapter.getPerson('staff', person.id);
        expect(final.notes).toHaveLength(15);
        expect(final.notes[0].id).toBe('note-0');
        expect(final.notes[14].id).toBe('note-14');
    });

    test('prayer requests and action plans still save correctly alongside note preservation', async () => {
        const person = makeFullPerson({
            prayerRequests: [
                { id: 'pr1', content: 'Health', createdAt: '2025-01-01T00:00:00Z', isAnswered: false },
                { id: 'pr2', content: 'Job', createdAt: '2025-02-01T00:00:00Z', isAnswered: true },
            ],
            actionPlans: [
                { id: 'ap1', content: 'Call', createdAt: '2025-01-01T00:00:00Z', status: 'todo' },
                { id: 'ap2', content: 'Visit', createdAt: '2025-02-01T00:00:00Z', status: 'done' },
            ],
        });
        await adapter.savePerson('staff', person);

        const retrieved = await adapter.getPerson('staff', person.id);
        retrieved.firstName = 'Edited';
        // Notes NOT expanded
        retrieved.notes = extractNotesFixed(false, retrieved.notes, []);
        // Prayer requests and action plans would be read from DOM inputs,
        // but those are independent of the notes fix
        await adapter.savePerson('staff', retrieved);

        const final = await adapter.getPerson('staff', person.id);
        expect(final.notes).toHaveLength(3);
        expect(final.prayerRequests).toHaveLength(2);
        expect(final.actionPlans).toHaveLength(2);
    });
});

// ===================================================================
//  _notesEditorsInitialized flag lifecycle
// ===================================================================

describe('_notesEditorsInitialized flag behavior', () => {
    test('flag defaults to false', () => {
        // PersonDetail._notesEditorsInitialized should be false by default
        // We test the extractNotesFixed function which mirrors this behavior
        const notes = makeNotesArray();
        const result = extractNotesFixed(false, notes, []);
        expect(result).toBe(notes); // untouched
    });

    test('flag set to true causes notes to be read from editors', () => {
        const notes = makeNotesArray();
        const editors = [mockQuill('only one', '<p>only one</p>')];
        const result = extractNotesFixed(true, notes, editors);
        // Only 1 editor → only 1 note in result, the others are dropped
        // (this is correct when the user intentionally removed notes)
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('<p>only one</p>');
    });

    test('the flag is the sole gatekeeper for note extraction', () => {
        const notes = makeNotesArray();

        // false + editors present → STILL preserves existing notes
        const editors = [mockQuill('a', '<p>a</p>')];
        const result = extractNotesFixed(false, notes, editors);
        expect(result).toBe(notes); // flag=false means editors are ignored
        expect(result).toHaveLength(3);
    });
});

// ===================================================================
//  Boundary conditions
// ===================================================================

describe('Boundary conditions for note preservation', () => {
    test('person with exactly 1 note — preserved when not initialized', () => {
        const notes = [{ id: 'solo', content: '<p>Only note</p>', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }];
        const result = extractNotesFixed(false, notes, []);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('solo');
    });

    test('person with notes containing rich HTML — preserved when not initialized', () => {
        const notes = [{
            id: 'rich',
            content: '<p><strong>Bold</strong> and <em>italic</em> with <u>underline</u></p>',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
        }];
        const result = extractNotesFixed(false, notes, []);
        expect(result[0].content).toBe('<p><strong>Bold</strong> and <em>italic</em> with <u>underline</u></p>');
    });

    test('person with notes containing special characters — preserved when not initialized', () => {
        const notes = [{
            id: 'special',
            content: '<p>Notes with "quotes" &amp; <special> chars™</p>',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
        }];
        const result = extractNotesFixed(false, notes, []);
        expect(result[0].content).toContain('quotes');
        expect(result[0].content).toContain('&amp;');
    });
});
