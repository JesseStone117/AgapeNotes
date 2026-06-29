/**
 * AgapeNotes Data Models
 * 
 * Factory functions and schemas for data entities
 */

/**
 * Categories enum
 */
const Categories = {
    STAFF: 'staff',
    STUDENTS: 'students',
    SUPPORTERS: 'supporters'
};

/**
 * Category display names
 */
const CategoryLabels = {
    [Categories.STAFF]: 'Staff',
    [Categories.STUDENTS]: 'Students',
    [Categories.SUPPORTERS]: 'Supporters'
};

/**
 * Ministry status options
 */
const Statuses = {
    ENGAGE: 'engage',
    EVANGELIZE: 'evangelize',
    ESTABLISH: 'establish',
    EQUIP: 'equip'
};

/**
 * Status display names
 */
const StatusLabels = {
    [Statuses.ENGAGE]: 'Engage',
    [Statuses.EVANGELIZE]: 'Evangelize',
    [Statuses.ESTABLISH]: 'Establish',
    [Statuses.EQUIP]: 'Equip'
};

/**
 * Last contact method options
 */
const LastContactMethods = {
    IN_PERSON: 'in-person',
    TEXT: 'text',
    PHONE_CALL: 'phone-call',
    EMAIL: 'email',
    MAIL: 'mail'
};

/**
 * Last contact method display names
 */
const LastContactMethodLabels = {
    [LastContactMethods.IN_PERSON]: 'In-Person',
    [LastContactMethods.TEXT]: 'Text',
    [LastContactMethods.PHONE_CALL]: 'Phone Call',
    [LastContactMethods.EMAIL]: 'Email',
    [LastContactMethods.MAIL]: 'Mail'
};

/**
 * Create a new person object
 * @param {string} category - The category (staff/students/supporters)
 * @returns {Object} New person object
 */
function createPerson(category) {
    const person = {
        id: Date.now().toString(),
        firstName: '',
        lastName: '',
        profilePicture: null,
        basicInfo: {
            status: '',
            region: '',
            phone: '',
            email: '',
            major: '',
            occupation: '',
            birthday: '',
            family: '',
            church: '',
            howIKnowThem: '',
            mailingAddress: '',
            lastContactMethod: '',
            lastContactDate: ''
        },
        ministryPlan: {},
        timeline: [],
        funFacts: [],
        notes: [],
        prayerRequests: [],
        actionPlans: [],
        growthPlans: [],
        isPinned: false,
        isArchived: false
    };

    if (category === Categories.SUPPORTERS) {
        person.supportInfo = {
            monthlyAmount: '',
            startDate: ''
        };
    }

    return person;
}

function createGrowthPlan(opts = {}) {
    return {
        id: opts.id || Date.now().toString() + Math.random().toString(36).slice(2, 6),
        semester: opts.semester || '',
        goals: [
            createGrowthPlanGoal(opts.goals?.[0]),
            createGrowthPlanGoal(opts.goals?.[1])
        ],
        createdAt: opts.createdAt || new Date().toISOString(),
        updatedAt: opts.updatedAt || new Date().toISOString()
    };
}

function createGrowthPlanGoal(opts = {}) {
    return {
        title: opts?.title || '',
        methods: normalizeGrowthPlanItems(opts?.methods),
        evidences: normalizeGrowthPlanItems(opts?.evidences)
    };
}

function normalizeGrowthPlanItems(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, 10);
}

/**
 * Create a new note object
 * @param {string} content - Note content
 * @returns {Object} New note object
 */
function createNote(content = '') {
    return {
        id: Date.now().toString(),
        content: content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

/**
 * Create a new prayer request
 * @param {string} content - Prayer request content
 * @returns {Object} New prayer request object
 */
function createPrayerRequest(content = '') {
    return {
        id: Date.now().toString(),
        content: content,
        createdAt: new Date().toISOString(),
        isAnswered: false
    };
}

/**
 * Create a new action plan item
 * @param {string} content - Action plan content
 * @returns {Object} New action plan object
 */
function createActionPlan(content = '') {
    return {
        id: Date.now().toString(),
        content: content,
        createdAt: new Date().toISOString(),
        status: 'todo' // 'todo', 'in-progress', 'done'
    };
}

/**
 * Create a new timeline entry
 * @param {string} content - Timeline entry content
 * @param {string} date - Optional date string
 * @returns {Object} New timeline entry
 */
function createTimelineEntry(content = '', date = null) {
    return {
        id: Date.now().toString(),
        content: content,
        date: date || toLocalDateString(new Date())
    };
}

/**
 * Create a new meeting object
 * @param {Object} opts - Meeting options
 * @returns {Object} New meeting object
 */
function createMeeting(opts = {}) {
    return {
        id: opts.id || Date.now().toString() + Math.random().toString(36).slice(2, 6),
        personId: opts.personId || '',
        personCategory: opts.personCategory || '',
        date: opts.date || toLocalDateString(new Date()),
        time: opts.time || '09:00',
        location: opts.location || '',
        notes: opts.notes || '',
        repeatsWeekly: opts.repeatsWeekly || false,
        repeatEndDate: opts.repeatEndDate || '',
        seriesId: opts.seriesId || '',
        reminder: normalizeMeetingReminder(opts.reminder),
        createdAt: opts.createdAt || new Date().toISOString()
    };
}

function normalizeMeetingReminder(reminder = null) {
    if (!reminder || typeof reminder !== 'object' || !reminder.enabled) {
        return {
            enabled: false,
            mode: 'none',
            offsetMinutes: null,
            customDateTime: ''
        };
    }

    const mode = String(reminder.mode || (
        Number.isFinite(Number(reminder.offsetMinutes))
            ? String(Number(reminder.offsetMinutes))
            : 'custom'
    ));

    return {
        enabled: true,
        mode,
        offsetMinutes: Number.isFinite(Number(reminder.offsetMinutes))
            ? Number(reminder.offsetMinutes)
            : null,
        customDateTime: reminder.customDateTime || ''
    };
}

/**
 * Get person's full name
 * @param {Object} person - Person object
 * @returns {string} Full name
 */
function getFullName(person) {
    const first = person.firstName?.trim() || '';
    const last = person.lastName?.trim() || '';
    return `${first} ${last}`.trim() || 'Unnamed';
}

/**
 * Get person's initials
 * @param {Object} person - Person object
 * @returns {string} Initials (up to 2 characters)
 */
function getInitials(person) {
    const first = person.firstName?.trim() || '';
    const last = person.lastName?.trim() || '';

    if (first && last) {
        return `${first[0]}${last[0]}`.toUpperCase();
    } else if (first) {
        return first.substring(0, 2).toUpperCase();
    } else if (last) {
        return last.substring(0, 2).toUpperCase();
    }
    return '?';
}

/**
 * Get preview text for a person (first non-empty info field)
 * @param {Object} person - Person object
 * @returns {string} Preview text
 */
function getPreviewText(person) {
    const info = person.basicInfo || {};

    if (info.status && StatusLabels[info.status]) return StatusLabels[info.status];
    if (info.howIKnowThem) return info.howIKnowThem;
    if (info.region) return info.region;
    if (info.occupation) return info.occupation;
    if (info.major) return info.major;
    if (info.church) return info.church;
    if (info.email) return info.email;
    if (info.phone) return info.phone;
    if (person.funFacts?.length > 0) return person.funFacts[0];

    return 'No details yet';
}

/**
 * Render note content to HTML.
 * Detects whether content is already HTML (from Quill) or legacy markdown.
 * @param {string} text
 * @returns {string} HTML string
 */
function renderMarkdown(text) {
    if (!text) return '';
    // If already HTML (from Quill editor), return as-is
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    // Legacy markdown content — convert via marked.js
    if (typeof marked !== 'undefined') {
        return marked.parse(text, { breaks: true, gfm: true });
    }
    // Ultimate fallback
    return text.replace(/\n/g, '<br>');
}

/**
 * Strip formatting (HTML/markdown) for plain-text preview
 * @param {string} text
 * @returns {string}
 */
function stripMarkdown(text) {
    if (!text) return '';
    const el = document.createElement('div');
    el.innerHTML = text;
    return (el.textContent || el.innerText || '')
        .replace(/\n/g, ' ')
        .trim();
}

/**
 * Format phone number for display
 * @param {string} phone - Raw phone number
 * @returns {string} Formatted phone
 */
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

/**
 * Format date for display
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = parseLocalDate(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

/**
 * Format a date as MM/DD/YYYY for compact profile summaries.
 * @param {string} dateStr
 * @returns {string}
 */
function formatNumericDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = parseLocalDate(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function parseLocalDate(dateStr) {
    if (!dateStr) return new Date('');

    const dateOnlyMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateOnlyMatch) return new Date(dateStr);

    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month, day);
}

function toLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseMonthlySupportAmount(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(/[^0-9.-]/g, '').trim();
    if (!normalized) return null;

    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount) || amount < 0) return null;

    return Math.round(amount * 100) / 100;
}

function formatCurrencyAmount(value) {
    const amount = parseMonthlySupportAmount(value);
    if (amount === null) return '';
    return `$${amount.toFixed(2)}`;
}

function formatMonthlySupportSummary(supportInfo = {}) {
    const amount = formatCurrencyAmount(supportInfo.monthlyAmount);
    if (!amount) return '';

    const startDate = formatNumericDate(supportInfo.startDate);
    return startDate
        ? `Gives ${amount} /month since ${startDate}`
        : `Gives ${amount} /month`;
}

function getCumulativeMonthlySupport(people = []) {
    return people.reduce((total, person) => {
        const amount = parseMonthlySupportAmount(person?.supportInfo?.monthlyAmount);
        return total + (amount || 0);
    }, 0);
}

/**
 * Validate person object
 * @param {Object} person - Person to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validatePerson(person) {
    const errors = [];

    if (!person.firstName?.trim() && !person.lastName?.trim()) {
        errors.push('Name is required');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
