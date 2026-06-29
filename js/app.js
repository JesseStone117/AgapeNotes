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
            const isAuthenticated = await requireGoogleAuthentication();
            if (!isAuthenticated) return;

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

        const vaultReady = await requireRemoteVault();
        if (!vaultReady) return;

        await bootApp();
    }

    /**
     * Core app startup once auth and vault requirements are satisfied.
     */
    async function bootApp() {
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
     * Require a Google session before any app functionality is shown.
     */
    async function requireGoogleAuthentication() {
        if (typeof ApiClient === 'undefined' || typeof storage.refreshRemoteSession !== 'function') {
            renderAuthScreen({
                title: 'AgapeNotes',
                message: 'The AgapeNotes server is not available yet.',
                action: 'Retry',
                onAction: () => window.location.reload()
            });
            return false;
        }

        try {
            await storage.refreshRemoteSession();
        } catch (error) {
            console.error('Failed to check Google session:', error);
        }

        if (storage.isRemoteAuthenticated()) {
            exitAuthMode();
            return true;
        }

        if (!storage.remoteAvailable) {
            renderAuthScreen({
                title: 'AgapeNotes',
                message: 'The AgapeNotes server is not reachable yet.',
                action: 'Retry',
                onAction: () => window.location.reload()
            });
            return false;
        }

        renderAuthScreen({
            title: 'AgapeNotes',
            message: 'Sign in to access your encrypted ministry notes.',
            action: 'Continue with Google',
            onAction: () => ApiClient.signInWithGoogle(),
            showGoogleMark: true
        });
        return false;
    }

    /**
     * Require the encrypted vault to be unlocked before rendering the app.
     */
    async function requireRemoteVault() {
        if (!storage.isRemoteAuthenticated()) {
            return false;
        }

        if (storage.isRemoteUnlocked()) {
            exitAuthMode();
            return true;
        }

        renderAuthScreen({
            title: 'Unlock Vault',
            message: 'Enter your vault passphrase to decrypt your notes on this device.',
            action: 'Unlock Vault',
            onAction: async () => {
                try {
                    const unlocked = await storage.unlockRemoteVault();
                    if (unlocked) {
                        exitAuthMode();
                        await bootApp();
                    }
                } catch (error) {
                    console.error('Vault unlock failed:', error);
                    renderAuthScreen({
                        title: 'Vault Locked',
                        message: 'That vault could not be unlocked. Check your passphrase and try again.',
                        action: 'Try Again',
                        onAction: async () => {
                            const unlocked = await storage.unlockRemoteVault();
                            if (unlocked) {
                                exitAuthMode();
                                await bootApp();
                            }
                        }
                    });
                }
            }
        });
        return false;
    }

    function renderAuthScreen({ title, message, action, onAction, showGoogleMark = false }) {
        const app = document.getElementById('app');
        const main = document.getElementById('main-content');
        const headerAction = document.getElementById('header-action');

        app.classList.add('auth-mode');
        if (headerAction) headerAction.innerHTML = '';

        main.className = 'main-content auth-content animate-fade-in';
        main.innerHTML = `
            <section class="auth-screen" aria-labelledby="auth-title">
                <div class="auth-panel">
                    <div class="auth-brand">Agape<span>Notes</span></div>
                    <h1 class="auth-title" id="auth-title">${escapeHtml(title)}</h1>
                    <p class="auth-message">${escapeHtml(message)}</p>
                    <button class="auth-google-btn" id="auth-primary-action">
                        ${showGoogleMark ? '<span class="auth-google-mark" aria-hidden="true">G</span>' : ''}
                        <span>${escapeHtml(action)}</span>
                    </button>
                </div>
            </section>
        `;

        document.getElementById('auth-primary-action')?.addEventListener('click', onAction);
    }

    function exitAuthMode() {
        const app = document.getElementById('app');
        app.classList.remove('auth-mode');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
