/**
 * AgapeNotes Navigation Component
 * 
 * Bottom sticky navigation bar
 */

const Navigation = {
    container: null,
    items: null,

    /**
     * Initialize navigation
     */
    init() {
        this.container = document.querySelector('.bottom-nav');
        this.items = this.container.querySelectorAll('.nav-item');

        // Bind click handlers
        this.items.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.navigate(view);
            });
        });

        // Subscribe to state changes
        appState.subscribe('currentView', (view) => {
            this.updateActiveState(view);
        });

        // Set initial state
        this.updateActiveState(appState.get('currentView'));
    },

    /**
     * Navigate to a view
     * @param {string} view - View name
     */
    navigate(view) {
        if (view === appState.get('currentView')) return;

        appState.set('currentView', view);

        // Render the appropriate view
        if (view === 'notes') {
            NotesView.render();
        } else if (view === 'resources') {
            ResourcesView.render();
        } else if (view === 'schedule') {
            ScheduleView.render();
        } else if (view === 'me') {
            MeView.render();
        } else if (view === 'settings') {
            SettingsView.render();
        }
    },

    /**
     * Update active state visuals
     * @param {string} activeView - Current active view
     */
    updateActiveState(activeView) {
        this.items.forEach(item => {
            const isActive = item.dataset.view === activeView;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }
};
