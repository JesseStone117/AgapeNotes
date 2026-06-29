/**
 * AgapeNotes Category Tabs Component
 * 
 * Staff | Students | Supporters tabs
 */

const CategoryTabs = {
    container: null,
    swipeBound: false,

    /**
     * Render category tabs
     * @param {HTMLElement} parent - Parent element to render into
     */
    render(parent) {
        const currentCategory = appState.get('currentCategory');

        const html = `
            <div class="category-tabs">
                <button class="category-tab ${currentCategory === Categories.STAFF ? 'active' : ''}" 
                        data-category="${Categories.STAFF}">
                    Staff
                </button>
                <button class="category-tab ${currentCategory === Categories.STUDENTS ? 'active' : ''}" 
                        data-category="${Categories.STUDENTS}">
                    Students
                </button>
                <button class="category-tab ${currentCategory === Categories.SUPPORTERS ? 'active' : ''}" 
                        data-category="${Categories.SUPPORTERS}">
                    Supporters
                </button>
            </div>
        `;

        // Create temp container
        const temp = document.createElement('div');
        temp.innerHTML = html;
        this.container = temp.firstElementChild;

        // Bind click handlers
        const tabs = this.container.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                this.switchCategory(category);
            });
        });

        // Add touch swipe support once; the handler reads current state.
        this._addSwipeSupport();

        parent.appendChild(this.container);
    },

    /**
     * Switch to a different category
     * @param {string} category - Category to switch to
     */
    switchCategory(category) {
        if (category === appState.get('currentCategory')) return;

        appState.set('currentCategory', category);
        localStorage.setItem('agapenotes_last_tab', category);
        this.updateActiveState(category);

        // Animate the list container
        const listContainer = document.querySelector('.person-list-container');
        if (listContainer) {
            // Remove and re-add class to trigger animation
            listContainer.classList.remove('tab-content');
            // Force reflow
            void listContainer.offsetWidth;
            listContainer.classList.add('tab-content');
        }

        // Re-render person list
        NotesView.renderPersonList();
    },

    /**
     * Update active tab visuals
     * @param {string} activeCategory - Current active category
     */
    updateActiveState(activeCategory) {
        if (!this.container) return;

        const tabs = this.container.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            const isActive = tab.dataset.category === activeCategory;
            tab.classList.toggle('active', isActive);
        });
    },

    /**
     * Add swipe gesture support for mobile
     * @param {HTMLElement} container - Container element
     */
    _addSwipeSupport() {
        if (this.swipeBound) return;
        this.swipeBound = true;

        let startX = 0;
        let startY = 0;
        const threshold = 50;
        const restraint = 100;

        let isSwiping = false;

        document.body.addEventListener('touchstart', (e) => {
            if (appState.get('currentView') !== 'notes' || appState.get('isModalOpen')) return;
            if (e.target.closest('input, textarea, select, button, .modal-container')) return;

            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            isSwiping = true;
        }, { passive: true });

        document.body.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            isSwiping = false;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            // Check if it's a horizontal swipe
            if (Math.abs(deltaX) > threshold && Math.abs(deltaY) < restraint) {
                const categories = [Categories.STAFF, Categories.STUDENTS, Categories.SUPPORTERS];
                const currentIndex = categories.indexOf(appState.get('currentCategory'));

                if (currentIndex < 0) return;

                if (deltaX < 0 && currentIndex < categories.length - 1) {
                    this.switchCategory(categories[currentIndex + 1]);
                } else if (deltaX > 0 && currentIndex > 0) {
                    this.switchCategory(categories[currentIndex - 1]);
                }
            }
        }, { passive: true });
    }
};
