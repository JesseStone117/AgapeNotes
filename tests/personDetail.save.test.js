/**
 * Tests for _savePerson data extraction logic (personDetail.js)
 *
 * This is the most critical test file — it validates that notes, prayer
 * requests, and action plans are correctly preserved when editing user data.
 * The note-loss bug likely stems from this save path.
 *
 * Strategy: we isolate the pure data-mapping logic that _savePerson performs
 * and test it with mock DOM inputs and mock Quill editor objects, without
 * needing the actual Quill library.
 */

const { loadScript } = require('./helpers/loadScript');

// Load models and storage into global scope
loadScript('js/models.js');
loadScript('js/storage.js');

// ---------------------------------------------------------------------------
//  Helpers — simulate the data-extraction logic from _savePerson
// ---------------------------------------------------------------------------

/**
 * Replicate the exact note-mapping logic from _savePerson (lines 914-918):
 *
 *   person.notes = this._formEditors.map((q, i) => ({
 *       ...(person.notes?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
 *       content: this._readQuillContent(q),
 *       updatedAt: new Date().toISOString()
 *   })).filter(n => n.content);
 */
function extractNotes(existingNotes, editors, readQuillContent) {
    return editors
        .map((q, i) => ({
            ...(existingNotes?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
            content: readQuillContent(q),
            updatedAt: new Date().toISOString(),
        }))
        .filter(n => n.content);
}

/**
 * Replicate the prayer-request extraction from _savePerson (lines 923-927):
 *
 *   person.prayerRequests = Array.from(prayerInputs).map((inp, i) => ({
 *       ...(person.prayerRequests?.[i] || { id: ..., createdAt: ... }),
 *       content: inp.value.trim(),
 *       isAnswered: prayerChecks[i]?.checked || false
 *   })).filter(pr => pr.content);
 */
function extractPrayerRequests(existingPRs, inputValues, checkedStates) {
    return inputValues
        .map((value, i) => ({
            ...(existingPRs?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
            content: value.trim(),
            isAnswered: checkedStates[i] || false,
        }))
        .filter(pr => pr.content);
}

/**
 * Replicate the action-plan extraction:
 *
 *   person.actionPlans = Array.from(actionInputs).map((inp, i) => ({
 *       ...(person.actionPlans?.[i] || { id: ..., createdAt: ... }),
 *       content: inp.value.trim(),
 *       status: actionStatuses[i]?.value || 'todo'
 *   })).filter(ap => ap.content);
 */
function extractActionPlans(existingAPs, inputValues, statuses) {
    return inputValues
        .map((value, i) => ({
            ...(existingAPs?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
            content: value.trim(),
            status: statuses[i] || 'todo',
        }))
        .filter(ap => ap.content);
}

/**
 * Replicate _readQuillContent:
 *   if (!quill) return '';
 *   const text = quill.getText().trim();
 *   if (!text) return '';
 *   return quill.root.innerHTML;
 */
function readQuillContent(quill) {
    if (!quill) return '';
    const text = quill.getText().trim();
    if (!text) return '';
    return quill.root.innerHTML;
}

/**
 * Create a mock Quill editor object.
 */
function mockQuill(text, html) {
    return {
        getText: () => text,
        root: { innerHTML: html },
    };
}

/**
 * Replicate _syncEditorValues:
 *   this._formEditors.forEach((q, i) => {
 *       if (person.notes && person.notes[i]) {
 *           person.notes[i].content = this._readQuillContent(q);
 *       }
 *   });
 */
function syncEditorValues(editors, notes) {
    editors.forEach((q, i) => {
        if (notes && notes[i]) {
            notes[i].content = readQuillContent(q);
        }
    });
}

// ---------------------------------------------------------------------------
//  Test Suites
// ---------------------------------------------------------------------------

describe('Note extraction logic (_savePerson notes mapping)', () => {
    const existingNotes = [
        { id: 'n1', content: 'Original first', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
        { id: 'n2', content: 'Original second', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
        { id: 'n3', content: 'Original third', createdAt: '2025-03-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z' },
    ];

    test('notes with content are kept after save', () => {
        const editors = [
            mockQuill('first', '<p>first</p>'),
            mockQuill('second', '<p>second</p>'),
            mockQuill('third', '<p>third</p>'),
        ];
        const result = extractNotes(existingNotes, editors, readQuillContent);
        expect(result).toHaveLength(3);
    });

    test('empty notes are filtered out', () => {
        const editors = [
            mockQuill('hello', '<p>hello</p>'),
            mockQuill('', ''),         // empty editor
            mockQuill('world', '<p>world</p>'),
        ];
        const result = extractNotes(existingNotes, editors, readQuillContent);
        expect(result).toHaveLength(2);
        expect(result[0].content).toBe('<p>hello</p>');
        expect(result[1].content).toBe('<p>world</p>');
    });

    test('note IDs and createdAt are preserved on existing notes', () => {
        const editors = [
            mockQuill('updated', '<p>updated content</p>'),
            mockQuill('also updated', '<p>also updated</p>'),
        ];
        const result = extractNotes(existingNotes, editors, readQuillContent);
        expect(result[0].id).toBe('n1');
        expect(result[0].createdAt).toBe('2025-01-01T00:00:00Z');
        expect(result[1].id).toBe('n2');
        expect(result[1].createdAt).toBe('2025-02-01T00:00:00Z');
    });

    test('note content is correctly read from editors', () => {
        const editors = [
            mockQuill('Hello world', '<p><strong>Hello</strong> world</p>'),
        ];
        const result = extractNotes(existingNotes, editors, readQuillContent);
        expect(result[0].content).toBe('<p><strong>Hello</strong> world</p>');
    });

    test('updatedAt is refreshed on save', () => {
        const before = new Date().toISOString();
        const editors = [mockQuill('content', '<p>content</p>')];
        const result = extractNotes(existingNotes, editors, readQuillContent);
        expect(result[0].updatedAt >= before).toBe(true);
    });

    test('new note gets a generated ID when no existing note at that index', () => {
        const editors = [
            mockQuill('first', '<p>first</p>'),
            mockQuill('second', '<p>second</p>'),
            mockQuill('third', '<p>third</p>'),
            mockQuill('brand new', '<p>brand new</p>'), // index 3 — no existing note
        ];
        const result = extractNotes(existingNotes, editors, readQuillContent);
        expect(result).toHaveLength(4);
        expect(result[3].id).toBeTruthy();
        expect(result[3].createdAt).toBeTruthy();
    });

    test('whitespace-only editor content is treated as empty (filtered out)', () => {
        const editors = [
            mockQuill('   ', '<p>   </p>'), // only whitespace
        ];
        const result = extractNotes(existingNotes, editors, readQuillContent);
        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe('Note ↔ editor index alignment', () => {
    test('when editors match notes 1:1, all data maps correctly', () => {
        const notes = [
            { id: 'a', content: 'old-a', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
            { id: 'b', content: 'old-b', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
        ];
        const editors = [
            mockQuill('new-a', '<p>new-a</p>'),
            mockQuill('new-b', '<p>new-b</p>'),
        ];
        const result = extractNotes(notes, editors, readQuillContent);
        expect(result[0].id).toBe('a');
        expect(result[0].content).toBe('<p>new-a</p>');
        expect(result[1].id).toBe('b');
        expect(result[1].content).toBe('<p>new-b</p>');
    });

    test('fewer editors than notes only maps the first N notes', () => {
        const notes = [
            { id: 'a', content: 'old-a', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
            { id: 'b', content: 'old-b', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
            { id: 'c', content: 'old-c', createdAt: '2025-03-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z' },
        ];
        const editors = [
            mockQuill('new-a', '<p>new-a</p>'),
        ];
        // This is what actually happens: only 1 editor → only 1 note mapped
        // Notes b and c are LOST. This is the likely bug vector!
        const result = extractNotes(notes, editors, readQuillContent);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('a');
    });

    test('when a note is removed mid-array and array is spliced, remaining notes shift indices', () => {
        // Simulate: user has 3 notes, deletes note at index 1
        const notes = [
            { id: 'a', content: 'keep-a', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
            // note b was spliced out
            { id: 'c', content: 'keep-c', createdAt: '2025-03-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z' },
        ];
        const editors = [
            mockQuill('keep-a', '<p>keep-a</p>'),
            mockQuill('keep-c', '<p>keep-c</p>'),
        ];
        const result = extractNotes(notes, editors, readQuillContent);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('a');
        expect(result[1].id).toBe('c');
    });
});

// ---------------------------------------------------------------------------

describe('_syncEditorValues logic', () => {
    test('syncs editor content back to notes array', () => {
        const notes = [
            { id: 'n1', content: 'old content', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
            { id: 'n2', content: 'also old', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
        ];
        const editors = [
            mockQuill('new content', '<p>new content</p>'),
            mockQuill('updated too', '<p>updated too</p>'),
        ];
        syncEditorValues(editors, notes);
        expect(notes[0].content).toBe('<p>new content</p>');
        expect(notes[1].content).toBe('<p>updated too</p>');
    });

    test('does not crash when editors outnumber notes', () => {
        const notes = [
            { id: 'n1', content: 'original', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
        ];
        const editors = [
            mockQuill('a', '<p>a</p>'),
            mockQuill('b', '<p>b</p>'), // no matching note
        ];
        expect(() => syncEditorValues(editors, notes)).not.toThrow();
        expect(notes[0].content).toBe('<p>a</p>');
        expect(notes).toHaveLength(1); // no extra note created
    });

    test('does not crash with empty notes array', () => {
        const editors = [mockQuill('a', '<p>a</p>')];
        expect(() => syncEditorValues(editors, [])).not.toThrow();
    });

    test('does not crash with null notes', () => {
        const editors = [mockQuill('a', '<p>a</p>')];
        expect(() => syncEditorValues(editors, null)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------

describe('Prayer request extraction', () => {
    const existingPRs = [
        { id: 'pr1', content: 'Health', createdAt: '2025-01-01T00:00:00Z', isAnswered: false },
        { id: 'pr2', content: 'Job', createdAt: '2025-02-01T00:00:00Z', isAnswered: true },
    ];

    test('existing prayer requests keep their IDs through save', () => {
        const result = extractPrayerRequests(existingPRs, ['New health', 'New job'], [false, true]);
        expect(result[0].id).toBe('pr1');
        expect(result[1].id).toBe('pr2');
    });

    test('empty prayer requests are filtered', () => {
        const result = extractPrayerRequests(existingPRs, ['Health', ''], [false, false]);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Health');
    });

    test('whitespace-only prayer requests are filtered', () => {
        const result = extractPrayerRequests(existingPRs, ['  ', '  '], [false, false]);
        expect(result).toHaveLength(0);
    });

    test('isAnswered state is preserved', () => {
        const result = extractPrayerRequests(existingPRs, ['Health', 'Job'], [true, false]);
        expect(result[0].isAnswered).toBe(true);
        expect(result[1].isAnswered).toBe(false);
    });

    test('new prayer request at index beyond existing gets generated metadata', () => {
        const result = extractPrayerRequests(existingPRs, ['A', 'B', 'New one'], [false, false, false]);
        expect(result).toHaveLength(3);
        expect(result[2].id).toBeTruthy();
        expect(result[2].createdAt).toBeTruthy();
    });

    test('handles undefined existing prayer requests', () => {
        const result = extractPrayerRequests(undefined, ['Test'], [false]);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Test');
        expect(result[0].id).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------

describe('Action plan extraction', () => {
    const existingAPs = [
        { id: 'ap1', content: 'Follow up', createdAt: '2025-01-01T00:00:00Z', status: 'todo' },
        { id: 'ap2', content: 'Call back', createdAt: '2025-02-01T00:00:00Z', status: 'in-progress' },
    ];

    test('existing action plans keep their IDs through save', () => {
        const result = extractActionPlans(existingAPs, ['Follow up', 'Call back'], ['todo', 'in-progress']);
        expect(result[0].id).toBe('ap1');
        expect(result[1].id).toBe('ap2');
    });

    test('status values are preserved', () => {
        const result = extractActionPlans(existingAPs, ['A', 'B'], ['done', 'in-progress']);
        expect(result[0].status).toBe('done');
        expect(result[1].status).toBe('in-progress');
    });

    test('empty entries are filtered', () => {
        const result = extractActionPlans(existingAPs, ['Keep', ''], ['todo', 'todo']);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Keep');
    });

    test('new action plan gets generated metadata', () => {
        const result = extractActionPlans(existingAPs, ['A', 'B', 'C'], ['todo', 'todo', 'done']);
        expect(result).toHaveLength(3);
        expect(result[2].id).toBeTruthy();
    });

    test('handles undefined existing APs', () => {
        const result = extractActionPlans(undefined, ['Test'], ['todo']);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBeTruthy();
    });

    test('defaults status to "todo" when missing', () => {
        const result = extractActionPlans([], ['Something'], [undefined]);
        expect(result[0].status).toBe('todo');
    });
});

// ---------------------------------------------------------------------------

describe('BasicInfo extraction from FormData', () => {
    function createFormWithBasicInfo(fields) {
        const form = document.createElement('form');
        form.id = 'person-form';
        Object.entries(fields).forEach(([name, value]) => {
            const input = document.createElement('input');
            input.name = name;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        return form;
    }

    afterEach(() => {
        const form = document.getElementById('person-form');
        if (form) form.remove();
    });

    test('all profile fields are read from FormData (including status and contact fields)', () => {
        const fields = {
            firstName: 'John',
            lastName: 'Doe',
            status: 'engage',
            region: 'North Campus',
            phone: '5551234567',
            email: 'john@test.com',
            mailingAddress: '123 Main St',
            lastContactMethod: 'text',
            lastContactDate: '2026-06-22',
            occupation: 'Engineer',
            major: 'CS',
            birthday: '1990-01-15',
            family: 'Married',
            church: 'Grace',
            howIKnowThem: 'College',
        };
        const form = createFormWithBasicInfo(fields);
        const fd = new FormData(form);

        const basicInfo = {
            status: fd.get('status') || '',
            region: fd.get('region')?.trim() || '',
            phone: fd.get('phone')?.trim() || '',
            email: fd.get('email')?.trim() || '',
            mailingAddress: fd.get('mailingAddress')?.trim() || '',
            lastContactMethod: fd.get('lastContactMethod') || '',
            lastContactDate: fd.get('lastContactDate') || '',
            occupation: fd.get('occupation')?.trim() || '',
            major: fd.get('major')?.trim() || '',
            birthday: fd.get('birthday') || '',
            family: fd.get('family')?.trim() || '',
            church: fd.get('church')?.trim() || '',
            howIKnowThem: fd.get('howIKnowThem')?.trim() || '',
        };

        expect(basicInfo.status).toBe('engage');
        expect(basicInfo.region).toBe('North Campus');
        expect(basicInfo.phone).toBe('5551234567');
        expect(basicInfo.email).toBe('john@test.com');
        expect(basicInfo.mailingAddress).toBe('123 Main St');
        expect(basicInfo.lastContactMethod).toBe('text');
        expect(basicInfo.lastContactDate).toBe('2026-06-22');
        expect(basicInfo.occupation).toBe('Engineer');
        expect(basicInfo.major).toBe('CS');
        expect(basicInfo.birthday).toBe('1990-01-15');
        expect(basicInfo.family).toBe('Married');
        expect(basicInfo.church).toBe('Grace');
        expect(basicInfo.howIKnowThem).toBe('College');
    });

    test('status defaults to empty string when not provided', () => {
        const form = createFormWithBasicInfo({ firstName: 'Test' });
        const fd = new FormData(form);
        expect(fd.get('status') || '').toBe('');
    });

    test('status accepts all valid values', () => {
        ['engage', 'evangelize', 'establish', 'equip'].forEach(status => {
            const form = createFormWithBasicInfo({ firstName: 'Test', status });
            const fd = new FormData(form);
            expect(fd.get('status')).toBe(status);
            form.remove();
        });
    });

    test('whitespace is trimmed', () => {
        const form = createFormWithBasicInfo({
            firstName: '  John  ',
            lastName: '  Doe  ',
            phone: '  555  ',
            email: '',
            occupation: '',
            major: '',
            birthday: '',
            family: '',
            church: '',
            howIKnowThem: '',
        });
        const fd = new FormData(form);
        expect(fd.get('firstName')?.trim()).toBe('John');
        expect(fd.get('lastName')?.trim()).toBe('Doe');
        expect(fd.get('phone')?.trim()).toBe('555');
    });

    test('missing fields default to empty string', () => {
        const form = createFormWithBasicInfo({ firstName: 'Solo' });
        const fd = new FormData(form);
        expect(fd.get('email')?.trim() || '').toBe('');
        expect(fd.get('phone')?.trim() || '').toBe('');
    });
});

// ---------------------------------------------------------------------------

describe('Edge cases — full person save flow', () => {
    test('person with no notes saves cleanly', () => {
        const result = extractNotes([], [], readQuillContent);
        expect(result).toEqual([]);
    });

    test('person with no prayer requests saves cleanly', () => {
        const result = extractPrayerRequests([], [], []);
        expect(result).toEqual([]);
    });

    test('person with no action plans saves cleanly', () => {
        const result = extractActionPlans([], [], []);
        expect(result).toEqual([]);
    });

    test('saving person with undefined notes does not crash', () => {
        expect(() => extractNotes(undefined, [], readQuillContent)).not.toThrow();
    });

    test('saving person with undefined prayerRequests does not crash', () => {
        expect(() => extractPrayerRequests(undefined, [], [])).not.toThrow();
    });

    test('saving person with undefined actionPlans does not crash', () => {
        expect(() => extractActionPlans(undefined, [], [])).not.toThrow();
    });

    test('null quill editor returns empty content (filtered out)', () => {
        const result = extractNotes(
            [{ id: 'x', content: 'old', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }],
            [null],
            readQuillContent
        );
        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe('_readQuillContent logic', () => {
    test('returns empty string for null quill', () => {
        expect(readQuillContent(null)).toBe('');
    });

    test('returns empty string for undefined quill', () => {
        expect(readQuillContent(undefined)).toBe('');
    });

    test('returns empty string when getText is only whitespace', () => {
        const quill = mockQuill('   \n  ', '<p><br></p>');
        expect(readQuillContent(quill)).toBe('');
    });

    test('returns innerHTML when getText has real text', () => {
        const quill = mockQuill('Hello world', '<p>Hello <strong>world</strong></p>');
        expect(readQuillContent(quill)).toBe('<p>Hello <strong>world</strong></p>');
    });
});

// ---------------------------------------------------------------------------

describe('End-to-end: storage + save-person data integrity', () => {
    let adapter;

    beforeEach(async () => {
        localStorage.clear();
        adapter = new LocalStorageAdapter();
        await adapter.initialize();
    });

    test('notes survive a full save → retrieve cycle', async () => {
        const person = {
            id: 'e2e-1',
            firstName: 'Jane',
            lastName: 'Smith',
            profilePicture: null,
            basicInfo: { phone: '', email: '', major: '', occupation: '', birthday: '', family: '', church: '', howIKnowThem: '' },
            ministryPlan: {},
            timeline: [],
            funFacts: [],
            notes: [
                { id: 'n1', content: '<p>Important note</p>', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
                { id: 'n2', content: '<p>Also important</p>', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
            ],
            prayerRequests: [
                { id: 'pr1', content: 'Healing', createdAt: '2025-01-01T00:00:00Z', isAnswered: false },
            ],
            actionPlans: [
                { id: 'ap1', content: 'Call', createdAt: '2025-01-01T00:00:00Z', status: 'todo' },
            ],
            isPinned: false,
            isArchived: false,
        };

        await adapter.savePerson('staff', person);

        // Simulate accessing the person, editing basic info, and re-saving
        const retrieved = await adapter.getPerson('staff', 'e2e-1');
        retrieved.firstName = 'Janet'; // changed first name

        // Simulate the save-person extraction with the same notes
        const editors = [
            mockQuill('Important note', '<p>Important note</p>'),
            mockQuill('Also important', '<p>Also important</p>'),
        ];
        retrieved.notes = extractNotes(retrieved.notes, editors, readQuillContent);

        await adapter.savePerson('staff', retrieved);

        const final = await adapter.getPerson('staff', 'e2e-1');
        expect(final.firstName).toBe('Janet');
        expect(final.notes).toHaveLength(2);
        expect(final.notes[0].id).toBe('n1');
        expect(final.notes[0].content).toBe('<p>Important note</p>');
        expect(final.notes[1].id).toBe('n2');
        expect(final.notes[1].content).toBe('<p>Also important</p>');
        expect(final.prayerRequests).toHaveLength(1);
        expect(final.actionPlans).toHaveLength(1);
    });

    test('editing basicInfo does not drop notes when editors are present', async () => {
        const person = {
            id: 'e2e-2',
            firstName: 'Mark',
            lastName: 'Lee',
            profilePicture: null,
            basicInfo: { phone: '555', email: 'mark@test.com', major: '', occupation: '', birthday: '', family: '', church: '', howIKnowThem: '' },
            ministryPlan: {},
            timeline: [],
            funFacts: ['Fun!'],
            notes: [
                { id: 'n-mark-1', content: '<p>Mark note 1</p>', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
                { id: 'n-mark-2', content: '<p>Mark note 2</p>', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' },
                { id: 'n-mark-3', content: '<p>Mark note 3</p>', createdAt: '2025-03-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z' },
            ],
            prayerRequests: [],
            actionPlans: [],
            isPinned: false,
            isArchived: false,
        };
        await adapter.savePerson('students', person);

        const retrieved = await adapter.getPerson('students', 'e2e-2');
        retrieved.basicInfo.phone = '9998887777';

        // All 3 editors are present — simulating all notes loaded correctly
        const editors = [
            mockQuill('Mark note 1', '<p>Mark note 1</p>'),
            mockQuill('Mark note 2', '<p>Mark note 2</p>'),
            mockQuill('Mark note 3', '<p>Mark note 3</p>'),
        ];
        retrieved.notes = extractNotes(retrieved.notes, editors, readQuillContent);

        await adapter.savePerson('students', retrieved);

        const final = await adapter.getPerson('students', 'e2e-2');
        expect(final.basicInfo.phone).toBe('9998887777');
        expect(final.notes).toHaveLength(3);
        expect(final.notes.map(n => n.id)).toEqual(['n-mark-1', 'n-mark-2', 'n-mark-3']);
    });

    test('concurrent saves to different people do not interfere', async () => {
        const alice = {
            id: 'alice', firstName: 'Alice', lastName: 'A', profilePicture: null,
            basicInfo: { phone: '', email: '', major: '', occupation: '', birthday: '', family: '', church: '', howIKnowThem: '' },
            ministryPlan: {}, timeline: [], funFacts: [],
            notes: [{ id: 'an1', content: '<p>Alice note</p>', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }],
            prayerRequests: [], actionPlans: [], isPinned: false, isArchived: false,
        };
        const bob = {
            id: 'bob', firstName: 'Bob', lastName: 'B', profilePicture: null,
            basicInfo: { phone: '', email: '', major: '', occupation: '', birthday: '', family: '', church: '', howIKnowThem: '' },
            ministryPlan: {}, timeline: [], funFacts: [],
            notes: [{ id: 'bn1', content: '<p>Bob note</p>', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }],
            prayerRequests: [], actionPlans: [], isPinned: false, isArchived: false,
        };

        await adapter.savePerson('staff', alice);
        await adapter.savePerson('staff', bob);

        // Edit alice
        const a = await adapter.getPerson('staff', 'alice');
        a.firstName = 'Alicia';
        await adapter.savePerson('staff', a);

        // Bob should still be there intact
        const b = await adapter.getPerson('staff', 'bob');
        expect(b.firstName).toBe('Bob');
        expect(b.notes).toHaveLength(1);
        expect(b.notes[0].content).toBe('<p>Bob note</p>');
    });
});
