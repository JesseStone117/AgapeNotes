/**
 * AgapeNotes Person Card Component
 * 
 * Displays a person summary in a list
 */

const PersonCard = {
    /**
     * Create a person card element
     * @param {Object} person - Person data
     * @param {string} category - Person's category
     * @param {number} index - Index for stagger animation
     * @returns {HTMLElement} Card element
     */
    create(person, category, index = 0) {
        const card = document.createElement('div');
        card.className = `person-card animate-slide-up stagger-${Math.min(index + 1, 5)}`;
        card.dataset.personId = person.id;
        card.dataset.category = category;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `View ${getFullName(person)}`);

        const avatarContent = person.profilePicture
            ? `<img class="profile-pic-avatar" src="${person.profilePicture}" alt="${this._escapeHtml(getFullName(person))}">`
            : getInitials(person);

        // Check if it's the person's birthday month
        const birthdayStr = person.basicInfo?.birthday || '';
        let birthdayCake = '';
        if (birthdayStr) {
            const parts = birthdayStr.split('-');
            let bdayMonth = -1;
            if (parts.length === 3) {
                // Legacy YYYY-MM-DD
                bdayMonth = parseInt(parts[1], 10) - 1;
            } else if (parts.length === 2) {
                // New MM-DD
                bdayMonth = parseInt(parts[0], 10) - 1;
            }
            
            const currentMonth = new Date().getMonth();
            if (bdayMonth === currentMonth) {
                birthdayCake = ' 🎂';
            }
        }

        card.innerHTML = `
            <div class="person-avatar">${avatarContent}</div>
            <div class="person-info">
                <div class="person-name">
                    ${person.isPinned ? '<span class="pin-indicator">★</span>' : ''}
                    ${this._escapeHtml(getFullName(person))}${birthdayCake}
                </div>
                <div class="person-preview">${this._escapeHtml(getPreviewText(person))}</div>
            </div>
            <svg class="person-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        `;

        // Bind click handler
        card.addEventListener('click', () => {
            this.openDetail(person, category);
        });

        // Keyboard support
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.openDetail(person, category);
            }
        });

        return card;
    },

    /**
     * Open person detail modal
     * @param {Object} person - Person data
     * @param {string} category - Person's category
     */
    openDetail(person, category) {
        appState.update({
            activePerson: person,
            activePersonCategory: category,
            modalType: 'view'
        });

        PersonDetail.showView(person, category);
    },

    /**
     * Render empty state
     * @returns {HTMLElement} Empty state element
     */
    createEmptyState() {
        const empty = document.createElement('div');
        empty.className = 'empty-state animate-fade-in';

        const categoryLabel = CategoryLabels[appState.get('currentCategory')];

        empty.innerHTML = `
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h3 class="empty-state-title">No ${categoryLabel} Yet</h3>
            <p class="empty-state-text">
                Tap the + button to add your first ${categoryLabel.toLowerCase().slice(0, -1)}.
            </p>
        `;

        return empty;
    },

    /**
     * Create loading skeleton cards
     * @param {number} count - Number of skeletons
     * @returns {HTMLElement} Container with skeleton cards
     */
    createSkeletons(count = 3) {
        const container = document.createElement('div');
        container.className = 'person-list';

        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'person-card';
            skeleton.innerHTML = `
                <div class="skeleton skeleton-avatar"></div>
                <div class="person-info">
                    <div class="skeleton skeleton-text" style="width: 60%"></div>
                    <div class="skeleton skeleton-text" style="width: 80%"></div>
                </div>
            `;
            container.appendChild(skeleton);
        }

        return container;
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
