/**
 * AgapeNotes Settings View
 * 
 * Settings and account management for the encrypted server vault.
 */

const SettingsView = {
    /**
     * Render the settings view
     */
    render() {
        const main = document.getElementById('main-content');
        main.innerHTML = '';
        main.className = 'main-content animate-fade-in';

        // Clear header action (no search in settings)
        const headerAction = document.getElementById('header-action');
        if (headerAction) {
            headerAction.innerHTML = '';
        }

        const container = document.createElement('div');
        container.className = 'settings-view';

        container.innerHTML = `
            <!-- Account Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Account</h3>
                <div id="account-settings-panel">
                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-title">Checking Account</div>
                            <div class="settings-item-desc">Loading sign-in status...</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Appearance Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Appearance</h3>
                <div class="settings-item">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Dark Mode</div>
                        <div class="settings-item-desc">Switch to dark theme for this session</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="dark-mode-toggle" ${ThemeManager.isDark() ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <!-- Sync Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Data</h3>
                <div class="settings-item" id="sync-status-item">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Sync Status</div>
                        <div class="settings-item-desc" id="sync-status">
                            Checking encrypted vault status...
                        </div>
                    </div>
                </div>
                <button class="settings-item settings-button" id="export-data-btn">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Export Decrypted Backup</div>
                        <div class="settings-item-desc">Download a JSON copy from the unlocked vault</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                </button>
                <button class="settings-item settings-button" id="import-data-btn">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Import Legacy JSON</div>
                        <div class="settings-item-desc">Encrypt an old export and save it to the server vault</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                </button>
            </div>

            <!-- Device Unlock Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Device Unlock</h3>
                <div class="settings-item">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Swipe Pattern</div>
                        <div class="settings-item-desc" id="device-unlock-status">
                            ${this._deviceUnlockStatusText()}
                        </div>
                    </div>
                    <div class="settings-actions">
                        <button class="btn btn-secondary" id="configure-device-unlock-btn">
                            ${storage.hasDeviceUnlock?.() ? 'Change Pattern' : 'Set Pattern'}
                        </button>
                        ${storage.hasDeviceUnlock?.() ? '<button class="btn btn-ghost" id="clear-device-unlock-btn">Remove</button>' : ''}
                    </div>
                </div>
            </div>

            <!-- Reminder Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Reminders</h3>
                <div class="settings-item">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Meeting Notifications</div>
                        <div class="settings-item-desc" id="reminder-status">Checking reminder status...</div>
                    </div>
                    <div class="settings-actions" id="reminder-actions"></div>
                </div>
            </div>

            <!-- Stats Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Statistics</h3>
                <div class="settings-item">
                    <div class="settings-item-info">
                        <div class="settings-item-title" id="total-count">Loading...</div>
                        <div class="settings-item-desc">Total people tracked</div>
                    </div>
                </div>
                <div class="settings-stats-grid">
                    <div class="settings-item settings-stat-card">
                        <div class="settings-item-title" id="staff-count">-</div>
                        <div class="settings-item-desc">Staff</div>
                    </div>
                    <div class="settings-item settings-stat-card">
                        <div class="settings-item-title" id="students-count">-</div>
                        <div class="settings-item-desc">Students</div>
                    </div>
                    <div class="settings-item settings-stat-card">
                        <div class="settings-item-title" id="supporters-count">-</div>
                        <div class="settings-item-desc">Supporters</div>
                    </div>
                </div>
            </div>

            <!-- Archive Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Archived Contacts</h3>
                <div id="archived-contacts-list">
                    ${this._renderArchivedContacts()}
                </div>
            </div>

            <!-- About Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">About</h3>
                <div class="settings-item">
                    <div class="settings-item-info">
                        <div class="settings-item-title">AgapeNotes</div>
                        <div class="settings-item-desc" id="settings-app-version">Loading version...</div>
                    </div>
                </div>
            </div>

            <!-- Hidden file input for import -->
            <input type="file" id="import-file-input" class="hidden-file-input" accept=".json">
        `;

        main.appendChild(container);

        // Fetch display version dynamically
        fetch('/manifest.json').then(r => r.json()).then(m => {
            const verEl = document.getElementById('settings-app-version');
            if (verEl && m.version) verEl.textContent = `Version ${m.version}`;
        }).catch(() => {
            const verEl = document.getElementById('settings-app-version');
            if (verEl) verEl.textContent = 'Version Unavailable';
        });

        // Update stats
        this._updateStats();
        this._updateSyncStatus();
        this._updateAccountSection();
        this._updateReminderSection();

        // Bind handlers
        this._bindHandlers();
    },

    /**
     * Update statistics display
     * @private
     */
    _updateStats() {
        const staff = appState.get('staff') || [];
        const students = appState.get('students') || [];
        const supporters = appState.get('supporters') || [];
        const total = staff.length + students.length + supporters.length;

        document.getElementById('total-count').textContent = total.toString();
        document.getElementById('staff-count').textContent = staff.length.toString();
        document.getElementById('students-count').textContent = students.length.toString();
        document.getElementById('supporters-count').textContent = supporters.length.toString();
    },

    /**
     * Update account controls after checking the API session.
     * @private
     */
    async _updateAccountSection() {
        const panel = document.getElementById('account-settings-panel');
        if (!panel) return;

        if (typeof ApiClient === 'undefined' || typeof storage.refreshRemoteSession !== 'function') {
            panel.innerHTML = this._accountStatusHtml(
                'Server Required',
                'AgapeNotes data requires the encrypted server vault.',
                ''
            );
            return;
        }

        await storage.refreshRemoteSession();
        this._updateSyncStatus();

        if (!storage.remoteAvailable) {
            panel.innerHTML = this._accountStatusHtml(
                'Server Unavailable',
                'Data cannot be loaded until the AgapeNotes server is reachable.',
                ''
            );
            return;
        }

        if (!storage.isRemoteAuthenticated()) {
            panel.innerHTML = this._accountStatusHtml(
                'Google Account',
                'Sign in to use an end-to-end encrypted server vault.',
                '<button class="btn btn-primary" id="google-sign-in-btn">Sign In</button>'
            );
            document.getElementById('google-sign-in-btn')?.addEventListener('click', () => {
                ApiClient.signInWithGoogle();
            });
            return;
        }

        const user = storage.getRemoteUser();
        const email = this._escapeHtml(user?.email || 'Signed in');
        const isUnlocked = storage.isRemoteUnlocked();
        const status = isUnlocked
            ? 'Encrypted vault unlocked. Changes are saved to the server.'
            : 'Signed in. Unlock the encrypted vault before using app data.';
        const actions = isUnlocked
            ? `
                <button class="btn btn-secondary" id="lock-vault-btn">Lock Vault</button>
                <button class="btn btn-ghost" id="google-sign-out-btn">Sign Out</button>
            `
            : `
                <button class="btn btn-primary" id="unlock-vault-btn">Unlock Vault</button>
                <button class="btn btn-ghost" id="google-sign-out-btn">Sign Out</button>
            `;

        panel.innerHTML = this._accountStatusHtml(email, status, actions);

        document.getElementById('unlock-vault-btn')?.addEventListener('click', async () => {
            try {
                const unlocked = await storage.unlockRemoteVault();
                if (!unlocked) return;
                await refreshPeopleData();
                this.render();
            } catch (error) {
                console.error('Vault unlock failed:', error);
                await Dialog.alert('Could not unlock the encrypted vault. Check your passphrase and try again.', 'Vault Locked');
            }
        });

        document.getElementById('lock-vault-btn')?.addEventListener('click', () => {
            storage.lockRemoteVault();
            window.location.reload();
        });

        document.getElementById('google-sign-out-btn')?.addEventListener('click', async () => {
            const confirmed = await Dialog.confirm(
                'Sign out of this Google account on this device?',
                'Sign Out'
            );
            if (!confirmed) return;

            await storage.logoutRemote();
            window.location.reload();
        });
    },

    _accountStatusHtml(title, description, actions) {
        return `
            <div class="settings-item settings-status-card">
                <div class="settings-item-info">
                    <div class="settings-item-title">${title}</div>
                    <div class="settings-item-desc">${description}</div>
                </div>
                ${actions ? `<div class="settings-actions">${actions}</div>` : ''}
            </div>
        `;
    },

    _updateSyncStatus() {
        const syncStatus = document.getElementById('sync-status');
        if (!syncStatus || typeof storage.getStorageMode !== 'function') return;

        const mode = storage.getStorageMode();
        if (mode === 'remote') {
            const revision = storage.getRemoteVaultSummary()?.revision;
            syncStatus.textContent = revision
                ? `Encrypted vault synced to the AgapeNotes server at revision ${revision}`
                : 'Encrypted vault synced to the AgapeNotes server';
        } else if (mode === 'locked') {
            syncStatus.textContent = 'Signed in, but the encrypted vault is locked';
        } else if (mode === 'signed-out') {
            syncStatus.textContent = 'Sign in with Google to load your encrypted vault';
        } else {
            syncStatus.textContent = 'Server unavailable; app data is not loaded locally';
        }
    },

    _deviceUnlockStatusText() {
        if (!storage.isRemoteUnlocked?.()) {
            return 'Unlock your vault with the passphrase before setting a device pattern.';
        }

        if (storage.hasDeviceUnlock?.()) {
            return 'This device can unlock the vault with a swipe pattern. Keep your passphrase saved for new devices and recovery.';
        }

        return 'Set a swipe pattern for this device after entering your passphrase once.';
    },

    async _updateReminderSection() {
        const statusEl = document.getElementById('reminder-status');
        const actionsEl = document.getElementById('reminder-actions');
        if (!statusEl || !actionsEl) return;

        if (typeof ReminderManager === 'undefined') {
            statusEl.textContent = 'PWA reminders are not loaded.';
            actionsEl.innerHTML = '';
            return;
        }

        const status = await ReminderManager.getStatus();
        if (!status.supported) {
            statusEl.textContent = 'This browser does not support PWA push reminders.';
            actionsEl.innerHTML = '';
            return;
        }
        if (!status.configured) {
            statusEl.textContent = 'Reminder push notifications are not configured on the server yet.';
            actionsEl.innerHTML = '';
            return;
        }
        if (status.permission === 'denied') {
            statusEl.textContent = 'Notifications are blocked in this browser.';
            actionsEl.innerHTML = '';
            return;
        }

        statusEl.textContent = status.subscribed
            ? 'This device can receive meeting reminders.'
            : 'Enable notifications on this device to receive meeting reminders.';
        actionsEl.innerHTML = status.subscribed
            ? '<button class="btn btn-ghost" id="disable-reminders-btn">Turn Off</button>'
            : '<button class="btn btn-secondary" id="enable-reminders-btn">Enable</button>';

        document.getElementById('enable-reminders-btn')?.addEventListener('click', async () => {
            const enabled = await ReminderManager.ensureReadyForMeetingReminders();
            if (enabled) {
                await Dialog.alert('Meeting reminders are enabled for this device.', 'Reminders');
            }
            await this._updateReminderSection();
        });

        document.getElementById('disable-reminders-btn')?.addEventListener('click', async () => {
            const confirmed = await Dialog.confirm('Turn off meeting reminder notifications on this device?', 'Reminders');
            if (!confirmed) return;
            await ReminderManager.disableForDevice();
            await this._updateReminderSection();
        });
    },

    /**
     * Bind event handlers
     * @private
     */
    _bindHandlers() {
        // Export data
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                try {
                    const data = await storage.exportData();
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `agapenotes-backup-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (error) {
                    console.error('Export failed:', error);
                    await Dialog.alert('Unlock the encrypted vault before exporting data.', 'Export Error');
                }
            });
        }

        // Import data
        const importBtn = document.getElementById('import-data-btn');
        const importInput = document.getElementById('import-file-input');

        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => {
                importInput.click();
            });

            importInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const confirmed = await Dialog.confirm(
                    'This will replace the encrypted vault data stored on the server with the contents of this legacy JSON export. Continue?',
                    'Import Legacy JSON'
                );

                if (!confirmed) {
                    importInput.value = '';
                    return;
                }

                try {
                    const text = await file.text();
                    const success = await storage.importData(text);

                    if (success) {
                        await refreshPeopleData();
                        this._updateStats();
                        this._updateSyncStatus();
                        await Dialog.alert('Legacy data was encrypted and saved to the server vault.', 'Success');
                    } else {
                        await Dialog.alert('Invalid legacy export format.', 'Import Error');
                    }
                } catch (error) {
                    console.error('Import failed:', error);
                    await Dialog.alert('Import failed before the server vault could be updated.', 'Import Error');
                }

                importInput.value = '';
            });
        }

        // Dark mode toggle
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', (e) => {
                ThemeManager.setTheme(e.target.checked ? 'dark' : 'light');
            });
        }

        const configureDeviceUnlockBtn = document.getElementById('configure-device-unlock-btn');
        if (configureDeviceUnlockBtn) {
            configureDeviceUnlockBtn.addEventListener('click', async () => {
                try {
                    const saved = await storage.configureDeviceUnlock();
                    if (saved) {
                        await Dialog.alert('Swipe pattern saved for this device.', 'Device Unlock');
                        this.render();
                    }
                } catch (error) {
                    console.error('Failed to configure device unlock:', error);
                    await Dialog.alert('Unlock the vault before setting a swipe pattern.', 'Device Unlock');
                }
            });
        }

        const clearDeviceUnlockBtn = document.getElementById('clear-device-unlock-btn');
        if (clearDeviceUnlockBtn) {
            clearDeviceUnlockBtn.addEventListener('click', async () => {
                const confirmed = await Dialog.confirm(
                    'Remove swipe-pattern unlock from this device? Your vault data on the server will not be changed.',
                    'Remove Device Unlock'
                );
                if (!confirmed) return;

                storage.clearDeviceUnlock();
                await Dialog.alert('Swipe pattern removed from this device.', 'Device Unlock');
                this.render();
            });
        }

        // Unarchive buttons
        document.querySelectorAll('.unarchive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const personId = e.currentTarget.dataset.personId;
                const category = e.currentTarget.dataset.category;
                const people = appState.get(category) || [];
                const person = people.find(p => p.id === personId);

                if (person) {
                    person.isArchived = false;
                    await storage.savePerson(category, person);
                    await refreshPeopleData();
                    this.render();
                }
            });
        });
    },

    /**
     * Render archived contacts list
     * @private
     */
    _renderArchivedContacts() {
        const staff = appState.get('staff') || [];
        const students = appState.get('students') || [];
        const supporters = appState.get('supporters') || [];

        const archivedContacts = [
            ...staff.filter(p => p.isArchived).map(p => ({ ...p, category: 'staff' })),
            ...students.filter(p => p.isArchived).map(p => ({ ...p, category: 'students' })),
            ...supporters.filter(p => p.isArchived).map(p => ({ ...p, category: 'supporters' }))
        ];

        if (archivedContacts.length === 0) {
            return `
                <div class="settings-item">
                    <div class="settings-item-info">
                        <div class="settings-item-desc settings-empty-desc">No archived contacts</div>
                    </div>
                </div>
            `;
        }

        return archivedContacts.map(person => `
            <div class="settings-item">
                <div class="settings-item-info">
                    <div class="settings-item-title">${this._escapeHtml(getFullName(person))}</div>
                    <div class="settings-item-desc">${CategoryLabels[person.category]}</div>
                </div>
                <button class="btn btn-ghost unarchive-btn" data-person-id="${person.id}" data-category="${person.category}">
                    Unarchive
                </button>
            </div>
        `).join('');
    },

    /**
     * Escape HTML
     * @private
     */
    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
