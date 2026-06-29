/**
 * AgapeNotes Search Overlay
 * 
 * Full-screen search for finding people by any detail
 */

const SearchOverlay = {
    container: null,
    inputEl: null,
    resultsEl: null,
    isSearchOpen: false,

    /**
     * Initialize search overlay
     */
    init() {
        // Create overlay if it doesn't exist
        if (!document.getElementById('search-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'search-overlay';
            overlay.className = 'search-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = `
                <div class="search-header">
                    <button class="search-back-btn" aria-label="Close search">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <div class="search-input-wrapper">
                        <svg class="search-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="M21 21l-4.35-4.35"/>
                        </svg>
                        <input type="text" class="search-input" placeholder="Search people..." autocomplete="off">
                        <button class="search-clear-btn" aria-label="Clear search" style="display: none;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M15 9l-6 6M9 9l6 6"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="search-results">
                    <div class="search-empty">
                        <p class="search-empty-text">Search by name, phone, email, church, or any detail</p>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        this.container = document.getElementById('search-overlay');
        this.inputEl = this.container.querySelector('.search-input');
        this.resultsEl = this.container.querySelector('.search-results');

        // Bind events
        this._bindEvents();
    },

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Back button
        this.container.querySelector('.search-back-btn').addEventListener('click', () => {
            this.close();
        });

        // Clear button
        const clearBtn = this.container.querySelector('.search-clear-btn');
        clearBtn.addEventListener('click', () => {
            this.inputEl.value = '';
            clearBtn.style.display = 'none';
            this._showEmptyState();
            this.inputEl.focus();
        });

        // Input handling
        let debounceTimer;
        this.inputEl.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearBtn.style.display = query ? 'flex' : 'none';

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (query.length >= 1) {
                    this._search(query);
                } else {
                    this._showEmptyState();
                }
            }, 150);
        });

        // Keyboard shortcuts
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    },

    /**
     * Open search overlay
     */
    open() {
        this.isSearchOpen = true;
        this.container.setAttribute('aria-hidden', 'false');
        this.inputEl.value = '';
        this._showEmptyState();

        // Focus input after animation
        setTimeout(() => {
            this.inputEl.focus();
        }, 100);

        // Push history state
        HistoryManager.push('search');
    },

    /**
     * Close search overlay
     */
    close() {
        this.isSearchOpen = false;
        this.container.setAttribute('aria-hidden', 'true');
        this.inputEl.blur();
    },

    /**
     * Check if search is open
     * @returns {boolean}
     */
    isOpen() {
        return this.isSearchOpen;
    },

    /**
     * Perform search
     * @param {string} query - Search query
     * @private
     */
    _search(query) {
        const lowerQuery = query.toLowerCase();
        const results = [];

        // Search all categories
        const categories = [Categories.STAFF, Categories.STUDENTS, Categories.SUPPORTERS];

        categories.forEach(category => {
            const people = appState.get(category) || [];

            people.forEach(person => {
                const matches = this._findMatches(person, lowerQuery);
                if (matches.length > 0) {
                    results.push({
                        person,
                        category,
                        matches
                    });
                }
            });
        });

        this._renderResults(results, query);
    },

    /**
     * Find matching fields in a person
     * @param {Object} person - Person object
     * @param {string} query - Lowercase query
     * @returns {Array} Matching fields
     * @private
     */
    _findMatches(person, query) {
        const matches = [];

        // Check name
        const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
        if (fullName.includes(query)) {
            matches.push({ field: 'Name', value: getFullName(person) });
        }

        // Check basic info fields
        const basicInfo = person.basicInfo || {};
        const infoFields = [
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'major', label: 'Major' },
            { key: 'occupation', label: 'Occupation' },
            { key: 'family', label: 'Family' },
            { key: 'church', label: 'Church' }
        ];

        infoFields.forEach(({ key, label }) => {
            const value = basicInfo[key];
            if (value && value.toLowerCase().includes(query)) {
                matches.push({ field: label, value });
            }
        });

        // Check fun facts
        (person.funFacts || []).forEach(fact => {
            if (fact.toLowerCase().includes(query)) {
                matches.push({ field: 'Fun Fact', value: fact });
            }
        });

        // Check notes
        (person.notes || []).forEach(note => {
            if (note.content && note.content.toLowerCase().includes(query)) {
                const preview = note.content.length > 50
                    ? note.content.substring(0, 50) + '...'
                    : note.content;
                matches.push({ field: 'Note', value: preview });
            }
        });

        return matches;
    },

    /**
     * Render search results
     * @param {Array} results - Search results
     * @param {string} query - Original query for highlighting
     * @private
     */
    _renderResults(results, query) {
        if (results.length === 0) {
            this.resultsEl.innerHTML = `
                <div class="search-empty">
                    <svg class="search-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <p class="search-empty-text">No results for "${this._escapeHtml(query)}"</p>
                </div>
            `;
            return;
        }

        const html = results.map((result, index) => `
            <div class="search-result-item animate-slide-up stagger-${Math.min(index + 1, 5)}" 
                 data-person-id="${result.person.id}" 
                 data-category="${result.category}">
                <div class="person-avatar">${getInitials(result.person)}</div>
                <div class="search-result-info">
                    <div class="person-name">${this._escapeHtml(getFullName(result.person))}</div>
                    <div class="search-result-matches">
                        ${result.matches.slice(0, 2).map(m => `
                            <span class="search-match-tag">${m.field}</span>
                        `).join('')}
                        ${result.matches.length > 2 ? `<span class="search-match-more">+${result.matches.length - 2}</span>` : ''}
                    </div>
                </div>
                <span class="search-result-category">${CategoryLabels[result.category]}</span>
            </div>
        `).join('');

        this.resultsEl.innerHTML = html;

        // Bind click handlers
        this.resultsEl.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const personId = item.dataset.personId;
                const category = item.dataset.category;
                const person = (appState.get(category) || []).find(p => p.id === personId);

                if (person) {
                    this.close();
                    // Small delay for close animation
                    setTimeout(() => {
                        PersonDetail.showView(person, category);
                    }, 150);
                }
            });
        });
    },

    /**
     * Show empty/initial state
     * @private
     */
    _showEmptyState() {
        this.resultsEl.innerHTML = `
            <div class="search-empty">
                <p class="search-empty-text">Search by name, phone, email, church, or any detail</p>
            </div>
        `;
    },

    /**
     * Escape HTML
     * @private
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
