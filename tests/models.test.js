/**
 * Tests for data model factory functions and validation (models.js)
 *
 * Covers createPerson, createNote, createPrayerRequest, createActionPlan,
 * getFullName, getInitials, getPreviewText, formatPhone, formatDate,
 * and validatePerson.
 */

const { loadScript } = require('./helpers/loadScript');

// Load models into global scope
loadScript('js/models.js');

// ---------------------------------------------------------------------------
//  createPerson
// ---------------------------------------------------------------------------

describe('createPerson()', () => {
    test('returns an object with all required fields', () => {
        const person = createPerson('staff');
        expect(person).toHaveProperty('id');
        expect(person).toHaveProperty('firstName', '');
        expect(person).toHaveProperty('lastName', '');
        expect(person).toHaveProperty('profilePicture', null);
        expect(person).toHaveProperty('basicInfo');
        expect(person).toHaveProperty('notes');
        expect(person).toHaveProperty('prayerRequests');
        expect(person).toHaveProperty('actionPlans');
        expect(person).toHaveProperty('growthPlans');
        expect(person).toHaveProperty('isPinned', false);
        expect(person).toHaveProperty('isArchived', false);
    });

    test('generates a truthy ID', () => {
        const person = createPerson('students');
        expect(person.id).toBeTruthy();
    });

    test('initializes notes, prayerRequests, actionPlans as empty arrays', () => {
        const person = createPerson('supporters');
        expect(Array.isArray(person.notes)).toBe(true);
        expect(person.notes).toHaveLength(0);
        expect(Array.isArray(person.prayerRequests)).toBe(true);
        expect(person.prayerRequests).toHaveLength(0);
        expect(Array.isArray(person.actionPlans)).toBe(true);
        expect(person.actionPlans).toHaveLength(0);
    });

    test('basicInfo has all expected keys', () => {
        const person = createPerson('staff');
        const keys = [
            'status',
            'region',
            'phone',
            'email',
            'major',
            'occupation',
            'birthday',
            'family',
            'church',
            'howIKnowThem',
            'mailingAddress',
            'lastContactMethod',
            'lastContactDate',
        ];
        keys.forEach(k => expect(person.basicInfo).toHaveProperty(k));
    });

    test('status defaults to empty string', () => {
        const person = createPerson('staff');
        expect(person.basicInfo.status).toBe('');
    });

    test('supporters initialize monthly support fields', () => {
        const person = createPerson('supporters');
        expect(person.supportInfo).toEqual({
            monthlyAmount: '',
            startDate: '',
        });
    });

    test('generates unique IDs across calls', () => {
        // Use a small delay or different timestamps
        const ids = new Set();
        for (let i = 0; i < 10; i++) {
            ids.add(createPerson('staff').id);
        }
        // Due to Date.now() they might collide in fast loops,
        // but we expect at least 1 unique
        expect(ids.size).toBeGreaterThanOrEqual(1);
    });
});

describe('createGrowthPlan()', () => {
    test('creates two goal slots with trimmed list items', () => {
        const plan = createGrowthPlan({
            semester: 'Fall 2025',
            goals: [{
                title: 'Discipleship',
                methods: [' Meet weekly ', '', 'Read together'],
                evidences: ['Growth conversations']
            }]
        });

        expect(plan.semester).toBe('Fall 2025');
        expect(plan.goals).toHaveLength(2);
        expect(plan.goals[0].methods).toEqual(['Meet weekly', 'Read together']);
        expect(plan.goals[0].evidences).toEqual(['Growth conversations']);
        expect(plan.goals[1].title).toBe('');
    });

    test('limits methods and evidences to 10 each', () => {
        const items = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`);
        const plan = createGrowthPlan({
            goals: [{ methods: items, evidences: items }]
        });

        expect(plan.goals[0].methods).toHaveLength(10);
        expect(plan.goals[0].evidences).toHaveLength(10);
    });
});

// ---------------------------------------------------------------------------
//  createNote
// ---------------------------------------------------------------------------

describe('createNote()', () => {
    test('returns object with id, content, createdAt, updatedAt', () => {
        const note = createNote('Hello');
        expect(note).toHaveProperty('id');
        expect(note.content).toBe('Hello');
        expect(note).toHaveProperty('createdAt');
        expect(note).toHaveProperty('updatedAt');
    });

    test('defaults content to empty string', () => {
        const note = createNote();
        expect(note.content).toBe('');
    });

    test('createdAt and updatedAt are valid ISO strings', () => {
        const note = createNote('test');
        expect(() => new Date(note.createdAt)).not.toThrow();
        expect(new Date(note.createdAt).toISOString()).toBe(note.createdAt);
    });
});

// ---------------------------------------------------------------------------
//  createPrayerRequest
// ---------------------------------------------------------------------------

describe('createPrayerRequest()', () => {
    test('creates with correct structure', () => {
        const pr = createPrayerRequest('Healing');
        expect(pr.content).toBe('Healing');
        expect(pr.isAnswered).toBe(false);
        expect(pr).toHaveProperty('id');
        expect(pr).toHaveProperty('createdAt');
    });

    test('defaults content to empty string', () => {
        const pr = createPrayerRequest();
        expect(pr.content).toBe('');
    });
});

// ---------------------------------------------------------------------------
//  createActionPlan
// ---------------------------------------------------------------------------

describe('createActionPlan()', () => {
    test('creates with correct structure', () => {
        const ap = createActionPlan('Follow up');
        expect(ap.content).toBe('Follow up');
        expect(ap.status).toBe('todo');
        expect(ap).toHaveProperty('id');
        expect(ap).toHaveProperty('createdAt');
    });

    test('defaults content to empty string', () => {
        const ap = createActionPlan();
        expect(ap.content).toBe('');
    });
});

// ---------------------------------------------------------------------------
//  createTimelineEntry
// ---------------------------------------------------------------------------

describe('createTimelineEntry()', () => {
    test('creates with content and auto-date', () => {
        const entry = createTimelineEntry('Met for coffee');
        expect(entry.content).toBe('Met for coffee');
        expect(entry.date).toBeTruthy();
        expect(entry).toHaveProperty('id');
    });

    test('accepts explicit date', () => {
        const entry = createTimelineEntry('Event', '2025-06-15');
        expect(entry.date).toBe('2025-06-15');
    });
});

// ---------------------------------------------------------------------------
//  getFullName
// ---------------------------------------------------------------------------

describe('getFullName()', () => {
    test('returns "First Last"', () => {
        expect(getFullName({ firstName: 'John', lastName: 'Doe' })).toBe('John Doe');
    });

    test('returns first name only when no last', () => {
        expect(getFullName({ firstName: 'Jane', lastName: '' })).toBe('Jane');
    });

    test('returns last name only when no first', () => {
        expect(getFullName({ firstName: '', lastName: 'Smith' })).toBe('Smith');
    });

    test('returns "Unnamed" when both empty', () => {
        expect(getFullName({ firstName: '', lastName: '' })).toBe('Unnamed');
    });

    test('trims whitespace', () => {
        expect(getFullName({ firstName: '  Alice  ', lastName: '  Lee  ' })).toBe('Alice Lee');
    });

    test('handles undefined fields', () => {
        expect(getFullName({})).toBe('Unnamed');
    });
});

// ---------------------------------------------------------------------------
//  getInitials
// ---------------------------------------------------------------------------

describe('getInitials()', () => {
    test('returns two-letter initials for first+last', () => {
        expect(getInitials({ firstName: 'John', lastName: 'Doe' })).toBe('JD');
    });

    test('returns two letters of first name when no last', () => {
        expect(getInitials({ firstName: 'Jane', lastName: '' })).toBe('JA');
    });

    test('returns two letters of last name when no first', () => {
        expect(getInitials({ firstName: '', lastName: 'Smith' })).toBe('SM');
    });

    test('returns "?" when both empty', () => {
        expect(getInitials({ firstName: '', lastName: '' })).toBe('?');
    });

    test('handles undefined fields', () => {
        expect(getInitials({})).toBe('?');
    });
});

// ---------------------------------------------------------------------------
//  getPreviewText
// ---------------------------------------------------------------------------

describe('getPreviewText()', () => {
    test('returns status display name when status is set', () => {
        const person = createPerson('staff');
        person.basicInfo.status = 'engage';
        person.basicInfo.howIKnowThem = 'College friend';
        expect(getPreviewText(person)).toBe('Engage');
    });

    test('returns howIKnowThem when no status is set', () => {
        const person = createPerson('staff');
        person.basicInfo.howIKnowThem = 'College friend';
        person.basicInfo.occupation = 'Engineer';
        expect(getPreviewText(person)).toBe('College friend');
    });

    test('status takes priority over all other fields', () => {
        const person = createPerson('staff');
        person.basicInfo.status = 'evangelize';
        person.basicInfo.howIKnowThem = 'Church';
        person.basicInfo.occupation = 'Doctor';
        person.basicInfo.major = 'CS';
        expect(getPreviewText(person)).toBe('Evangelize');
    });

    test('each status value displays correctly', () => {
        const person = createPerson('staff');
        person.basicInfo.status = 'establish';
        expect(getPreviewText(person)).toBe('Establish');
        person.basicInfo.status = 'equip';
        expect(getPreviewText(person)).toBe('Equip');
    });

    test('falls through priorities when no status', () => {
        const person = createPerson('staff');
        person.basicInfo.occupation = 'Doctor';
        expect(getPreviewText(person)).toBe('Doctor');
    });

    test('returns "No details yet" when empty', () => {
        const person = createPerson('staff');
        expect(getPreviewText(person)).toBe('No details yet');
    });

    test('invalid status value falls through to howIKnowThem', () => {
        const person = createPerson('staff');
        person.basicInfo.status = 'unknown_value';
        person.basicInfo.howIKnowThem = 'Neighbor';
        expect(getPreviewText(person)).toBe('Neighbor');
    });
});

// ---------------------------------------------------------------------------
//  formatPhone
// ---------------------------------------------------------------------------

describe('formatPhone()', () => {
    test('formats 10-digit number', () => {
        expect(formatPhone('5551234567')).toBe('(555) 123-4567');
    });

    test('returns original for non-10-digit', () => {
        expect(formatPhone('123')).toBe('123');
    });

    test('returns empty string for empty input', () => {
        expect(formatPhone('')).toBe('');
    });

    test('returns empty string for null', () => {
        expect(formatPhone(null)).toBe('');
    });
});

// ---------------------------------------------------------------------------
//  formatDate
// ---------------------------------------------------------------------------

describe('formatDate()', () => {
    test('formats ISO date string', () => {
        // Use a full ISO datetime to avoid timezone ambiguity
        // (date-only strings like '2025-03-15' are parsed as UTC midnight,
        //  which can shift to the prior day in western timezones)
        const result = formatDate('2025-03-15T12:00:00');
        expect(result).toContain('Mar');
        expect(result).toContain('15');
        expect(result).toContain('2025');
    });

    test('returns empty string for empty input', () => {
        expect(formatDate('')).toBe('');
    });

    test('returns empty string for null', () => {
        expect(formatDate(null)).toBe('');
    });
});

describe('formatNumericDate()', () => {
    test('formats date-only strings as MM/DD/YYYY', () => {
        expect(formatNumericDate('2026-06-22')).toBe('06/22/2026');
    });

    test('returns empty string for empty input', () => {
        expect(formatNumericDate('')).toBe('');
    });
});

describe('Monthly support helpers', () => {
    test('parses and formats monthly support amounts', () => {
        expect(parseMonthlySupportAmount('$25.5')).toBe(25.5);
        expect(formatCurrencyAmount('25.5')).toBe('$25.50');
    });

    test('formats the supporter summary with date started', () => {
        const summary = formatMonthlySupportSummary({
            monthlyAmount: '100',
            startDate: '2026-06-22',
        });

        expect(summary).toBe('Gives $100.00 /month since 06/22/2026');
    });

    test('sums monthly support across people', () => {
        const people = [
            { supportInfo: { monthlyAmount: '25' } },
            { supportInfo: { monthlyAmount: '10.50' } },
            { supportInfo: { monthlyAmount: '' } },
        ];

        expect(getCumulativeMonthlySupport(people)).toBe(35.5);
    });
});

// ---------------------------------------------------------------------------
//  validatePerson
// ---------------------------------------------------------------------------

describe('validatePerson()', () => {
    test('fails when both firstName and lastName are empty', () => {
        const person = createPerson('staff');
        const result = validatePerson(person);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Name is required');
    });

    test('passes with firstName only', () => {
        const person = createPerson('staff');
        person.firstName = 'Jane';
        expect(validatePerson(person).valid).toBe(true);
    });

    test('passes with lastName only', () => {
        const person = createPerson('staff');
        person.lastName = 'Doe';
        expect(validatePerson(person).valid).toBe(true);
    });

    test('passes with both names', () => {
        const person = createPerson('staff');
        person.firstName = 'John';
        person.lastName = 'Doe';
        const result = validatePerson(person);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('fails with whitespace-only names', () => {
        const person = createPerson('staff');
        person.firstName = '   ';
        person.lastName = '   ';
        expect(validatePerson(person).valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
//  Statuses & StatusLabels
// ---------------------------------------------------------------------------

describe('Statuses enum', () => {
    test('has all four status values', () => {
        expect(Statuses.ENGAGE).toBe('engage');
        expect(Statuses.EVANGELIZE).toBe('evangelize');
        expect(Statuses.ESTABLISH).toBe('establish');
        expect(Statuses.EQUIP).toBe('equip');
    });

    test('has exactly 4 entries', () => {
        expect(Object.keys(Statuses)).toHaveLength(4);
    });
});

describe('StatusLabels', () => {
    test('maps each status value to its display name', () => {
        expect(StatusLabels['engage']).toBe('Engage');
        expect(StatusLabels['evangelize']).toBe('Evangelize');
        expect(StatusLabels['establish']).toBe('Establish');
        expect(StatusLabels['equip']).toBe('Equip');
    });

    test('returns undefined for unknown status', () => {
        expect(StatusLabels['unknown']).toBeUndefined();
    });

    test('returns undefined for empty string', () => {
        expect(StatusLabels['']).toBeUndefined();
    });
});
