/**
 * AgapeNotes Main App Entry Point
 * 
 * Initializes the application
 */

(async function () {
    'use strict';

    /**
     * Initialize the application
     */
    async function init() {
        try {
            // Check if PIN is set and show PIN screen first
            if (PinAuth.hasPin()) {
                // Hide app content until PIN is entered
                document.getElementById('app').style.display = 'none';

                PinScreen.show(async () => {
                    document.getElementById('app').style.display = '';
                    await initializeApp();
                });
            } else {
                await initializeApp();
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }

    /**
     * Core app initialization after PIN validation
     */
    async function initializeApp() {
        // Initialize storage
        await storage.initialize();

        // Load data into state
        await refreshPeopleData();

        // Initialize history manager (for back button support)
        HistoryManager.init();

        // Initialize dialog (custom popups)
        Dialog.init();

        // Initialize modal
        Modal.init();

        // Initialize navigation
        Navigation.init();

        // Initialize search overlay
        SearchOverlay.init();

        // Render initial view
        NotesView.render();

        // Add some demo data if empty (remove in production)
        const total = appState.get('staff').length +
            appState.get('students').length +
            appState.get('supporters').length;

        if (total === 0) {
            await addDemoData();
        }

        // Re-lock app when returning from background
        let pinAuthenticated = true; // just authenticated on load

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                pinAuthenticated = false;
            }
            if (document.visibilityState === 'visible' && PinAuth.hasPin() && !pinAuthenticated) {
                document.getElementById('app').style.display = 'none';
                PinScreen.show(() => {
                    document.getElementById('app').style.display = '';
                    pinAuthenticated = true;
                });
            }
        });

        console.log('AgapeNotes initialized successfully');

        // Initialize update checker (non-blocking)
        AppUpdater.init();
    }

    /**
     * Add demo data for first-time users
     */
    async function addDemoData() {
        const demoPeople = [
            {
                category: Categories.SUPPORTERS,
                data: {
                    id: Date.now().toString(),
                    firstName: 'Jesse',
                    lastName: 'Stone',
                    basicInfo: {
                        phone: '',
                        email: '',
                        major: '',
                        occupation: '',
                        birthday: '',
                        family: 'Me',
                        church: ''
                    },
                    ministryPlan: {},
                    timeline: [],
                    funFacts: ['League of Legends'],
                    notes: []
                }
            }
        ];

        for (const { category, data } of demoPeople) {
            await storage.savePerson(category, data);
        }

        await refreshPeopleData();
        NotesView.renderPersonList();
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
