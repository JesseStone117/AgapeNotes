/**
 * AgapeNotes App Updater
 *
 * Uses the Vite-stamped service worker build to receive app updates
 * automatically. When a new worker takes over, the app reloads once and
 * shows a temporary notification after the updated files are loaded.
 */

const AppUpdater = {
    _registration: null,
    _initialized: false,
    _pendingWorker: null,
    _hasController: false,
    _refreshing: false,
    _checkingStarted: false,
    _bannerVisible: false,
    _bannerTimer: null,
    _noticeKey: 'agapenotes-update-received',

    init() {
        if (!('serviceWorker' in navigator)) return;

        this._hasController = Boolean(navigator.serviceWorker.controller);
        this._initialized = true;
        this._showQueuedUpdateNotice();

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!this._hasController) {
                this._hasController = true;
                return;
            }

            if (this._refreshing) return;
            this._refreshing = true;

            try {
                sessionStorage.setItem(this._noticeKey, '1');
            } catch {
                // A reload is still enough to move onto the new build.
            }

            window.location.reload();
        });

        if (this._registration && this._registration.waiting && navigator.serviceWorker.controller) {
            this._activateWaitingWorker(this._registration.waiting);
        } else if (this._pendingWorker) {
            this._activateWaitingWorker(this._pendingWorker);
            this._pendingWorker = null;
        }

        this._startAutomaticChecks();
    },

    observeRegistration(registration) {
        if (!registration) return;

        this._registration = registration;

        if (registration.waiting && navigator.serviceWorker.controller) {
            this._handleWaitingWorker(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
            this._watchInstallingWorker(registration.installing);
        });

        this._startAutomaticChecks();
    },

    onWaitingSW(sw) {
        this._handleWaitingWorker(sw);
    },

    async checkForUpdate() {
        if (!this._registration || typeof this._registration.update !== 'function') {
            return false;
        }

        try {
            await this._registration.update();
            return true;
        } catch (err) {
            console.log('Update check skipped (offline or error):', err.message);
            return false;
        }
    },

    _startAutomaticChecks() {
        if (this._checkingStarted || !this._registration) return;
        this._checkingStarted = true;

        setTimeout(() => this.checkForUpdate(), 3000);
        setInterval(() => this.checkForUpdate(), 15 * 60 * 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkForUpdate();
            }
        });

        window.addEventListener('online', () => this.checkForUpdate());
    },

    _watchInstallingWorker(worker) {
        if (!worker) return;

        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                this._handleWaitingWorker(worker);
            }
        });
    },

    _handleWaitingWorker(worker) {
        if (!worker) return;

        if (!this._initialized) {
            this._pendingWorker = worker;
            return;
        }

        this._activateWaitingWorker(worker);
    },

    _activateWaitingWorker(worker) {
        if (!worker) return;

        worker.postMessage({ type: 'SKIP_WAITING' });
    },

    _showQueuedUpdateNotice() {
        let shouldShow = false;

        try {
            shouldShow = sessionStorage.getItem(this._noticeKey) === '1';
            sessionStorage.removeItem(this._noticeKey);
        } catch {
            shouldShow = false;
        }

        if (shouldShow) {
            setTimeout(() => this._showUpdateNotice(), 500);
        }
    },

    _showUpdateNotice() {
        if (this._bannerVisible) return;
        this._bannerVisible = true;

        const existing = document.getElementById('update-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'update-banner';
        banner.className = 'update-banner';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.innerHTML = `
            <div class="update-banner-content">
                <div class="update-banner-text">
                    <svg class="update-banner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <span>AgapeNotes was updated with the latest changes.</span>
                </div>
            </div>
        `;

        document.body.prepend(banner);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                banner.classList.add('visible');
            });
        });

        this._bannerTimer = setTimeout(() => {
            this._hideUpdateNotice(banner);
        }, 5000);
    },

    _hideUpdateNotice(banner) {
        if (!banner) return;

        clearTimeout(this._bannerTimer);
        banner.classList.remove('visible');
        banner.addEventListener('transitionend', () => {
            banner.remove();
            this._bannerVisible = false;
        }, { once: true });
    }
};
