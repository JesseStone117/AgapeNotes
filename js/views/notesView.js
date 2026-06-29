/**
 * AgapeNotes Notes View
 * 
 * Main view for displaying and managing people
 */

const NotesView = {
    container: null,
    listContainer: null,

    /**
     * Render the notes view
     */
    render() {
        const main = document.getElementById('main-content');
        main.innerHTML = '';
        main.className = 'main-content animate-fade-in';

        // Add search button to header
        this._updateHeader();

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'notes-view';

        // Render category tabs
        CategoryTabs.render(this.container);

        // Create list container
        this.listContainer = document.createElement('div');
        this.listContainer.className = 'person-list-container tab-content';
        this.container.appendChild(this.listContainer);

        // Add FAB
        const fab = this._createFAB();
        this.container.appendChild(fab);

        main.appendChild(this.container);

        // Render person list
        this.renderPersonList();
    },

    /**
     * Update header with search button
     * @private
     */
    _updateHeader() {
        const headerAction = document.getElementById('header-action');
        if (headerAction) {
            headerAction.innerHTML = `
                <button class="search-btn" aria-label="Search">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                    </svg>
                </button>
            `;

            headerAction.querySelector('.search-btn').addEventListener('click', () => {
                SearchOverlay.open();
            });
        }
    },

    /**
     * Render the person list for current category
     */
    renderPersonList() {
        if (!this.listContainer) return;

        const category = appState.get('currentCategory');
        const people = appState.get(category) || [];

        this.listContainer.innerHTML = '';

        // Filter out archived contacts
        const activePeople = people.filter(p => !p.isArchived);

        if (category === Categories.SUPPORTERS) {
            this.listContainer.appendChild(this._createSupportSummary(activePeople));
        }

        if (activePeople.length === 0) {
            const emptyState = PersonCard.createEmptyState();
            this.listContainer.appendChild(emptyState);
            return;
        }

        const list = document.createElement('div');
        list.className = 'person-list';

        // Sort: pinned first, then alphabetically
        const sorted = [...activePeople].sort((a, b) => {
            // Pinned contacts first
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;

            // Then alphabetically
            const nameA = getFullName(a).toLowerCase();
            const nameB = getFullName(b).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        sorted.forEach((person, index) => {
            const card = PersonCard.create(person, category, index);
            list.appendChild(card);
        });

        this.listContainer.appendChild(list);
    },

    _createSupportSummary(people) {
        const total = getCumulativeMonthlySupport(people);
        const box = document.createElement('div');
        box.className = 'support-total-box';
        box.innerHTML = `
            <div class="support-total-label">Cumulative Monthly Support</div>
            <div class="support-total-amount">${formatCurrencyAmount(total)} <span>/month</span></div>
        `;
        return box;
    },

    /**
     * Create Floating Action Button
     * @private
     */
    _createFAB() {
        const fab = document.createElement('button');
        fab.className = 'fab';
        fab.setAttribute('aria-label', 'Add new person');
        fab.innerHTML = `
            <svg class="fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 5v14M5 12h14"/>
            </svg>
        `;

        fab.addEventListener('click', () => {
            const category = appState.get('currentCategory');
            PersonDetail.showAdd(category);
        });

        return fab;
    }
};
