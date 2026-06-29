/**
 * AgapeNotes Settings View
 * 
 * Settings and account management (placeholder for Google integration)
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
                <div class="settings-item disabled">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Google Account</div>
                        <div class="settings-item-desc">Sign in to sync your data to Google Drive</div>
                    </div>
                    <span class="settings-badge">Coming Soon</span>
                </div>
            </div>

            <!-- Appearance Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Appearance</h3>
                <div class="settings-item">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Dark Mode</div>
                        <div class="settings-item-desc">Switch to dark theme</div>
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
                            Data stored locally on this device
                        </div>
                    </div>
                </div>
                <button class="settings-item" id="export-data-btn" style="width: 100%; text-align: left; cursor: pointer; border: none; background: var(--color-surface);">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Export Data</div>
                        <div class="settings-item-desc">Download a backup of your data</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                </button>
                <button class="settings-item" id="import-data-btn" style="width: 100%; text-align: left; cursor: pointer; border: none; background: var(--color-surface);">
                    <div class="settings-item-info">
                        <div class="settings-item-title">Import Data</div>
                        <div class="settings-item-desc">Restore from a backup file</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                </button>
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
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-sm);">
                    <div class="settings-item" style="flex-direction: column; align-items: center; text-align: center;">
                        <div class="settings-item-title" id="staff-count">-</div>
                        <div class="settings-item-desc">Staff</div>
                    </div>
                    <div class="settings-item" style="flex-direction: column; align-items: center; text-align: center;">
                        <div class="settings-item-title" id="students-count">-</div>
                        <div class="settings-item-desc">Students</div>
                    </div>
                    <div class="settings-item" style="flex-direction: column; align-items: center; text-align: center;">
                        <div class="settings-item-title" id="supporters-count">-</div>
                        <div class="settings-item-desc">Supporters</div>
                    </div>
                </div>
            </div>

            <!-- Security Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Security</h3>
                <button class="settings-item" id="set-pin-btn" style="width: 100%; text-align: left; cursor: pointer; border: none; background: var(--color-surface);">
                    <div class="settings-item-info">
                        <div class="settings-item-title" id="pin-status-title">${PinAuth.hasPin() ? 'Change Pattern' : 'Set Pattern'}</div>
                        <div class="settings-item-desc">${PinAuth.hasPin() ? 'Update your swipe pattern' : 'Protect your notes with a pattern'}</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                </button>
                ${PinAuth.hasPin() ? `
                <button class="settings-item" id="clear-pin-btn" style="width: 100%; text-align: left; cursor: pointer; border: none; background: var(--color-surface);">
                    <div class="settings-item-info">
                        <div class="settings-item-title" style="color: #EF4444;">Remove Pattern</div>
                        <div class="settings-item-desc">Disable pattern protection</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                        <line x1="4" y1="4" x2="20" y2="20"/>
                    </svg>
                </button>
                ` : ''}
            </div>

            <!-- Personalization Section -->
            <div class="settings-section">
                <h3 class="settings-section-title">Personalization</h3>
                <div class="settings-item" style="flex-direction: column; align-items: stretch;">
                    <div class="settings-item-info" style="margin-bottom: var(--spacing-sm);">
                        <div class="settings-item-title">Lock Screen Quote</div>
                        <div class="settings-item-desc">Display a custom quote on the PIN screen</div>
                    </div>
                    <textarea class="form-input" id="quote-input" rows="2" placeholder="Enter your favorite quote...">${this._escapeHtml(PinAuth.getQuote())}</textarea>
                    <button class="btn btn-secondary" id="save-quote-btn" style="margin-top: var(--spacing-sm); align-self: flex-end;">Save Quote</button>
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
            <input type="file" id="import-file-input" accept=".json" style="display: none;">
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
                    await Dialog.alert('Failed to export data. Please try again.', 'Export Error');
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
                    'This will replace all current data. Are you sure?',
                    'Import Data'
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
                        await Dialog.alert('Data imported successfully!', 'Success');
                    } else {
                        await Dialog.alert('Invalid backup file format.', 'Import Error');
                    }
                } catch (error) {
                    console.error('Import failed:', error);
                    await Dialog.alert('Failed to import data. Please check the file format.', 'Import Error');
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

        // Set/Change Pattern PIN
        const setPinBtn = document.getElementById('set-pin-btn');
        if (setPinBtn) {
            setPinBtn.addEventListener('click', async () => {
                const currentHasPin = PinAuth.hasPin();

                if (currentHasPin) {
                    // Verify current pattern first
                    PinScreen.show(async () => {
                        // After successful verification, show setup for new pattern
                        setTimeout(() => {
                            PinScreen.showSetup(async () => {
                                await Dialog.alert('Pattern set successfully!', 'Success');
                                this.render();
                            });
                        }, 400);
                    });
                } else {
                    // No existing pattern, go straight to setup
                    PinScreen.showSetup(async () => {
                        await Dialog.alert('Pattern set successfully!', 'Success');
                        this.render();
                    });
                }
            });
        }

        // Clear Pattern PIN
        const clearPinBtn = document.getElementById('clear-pin-btn');
        if (clearPinBtn) {
            clearPinBtn.addEventListener('click', async () => {
                // Verify current pattern first
                PinScreen.show(async () => {
                    const confirmed = await Dialog.confirm(
                        'Are you sure you want to remove pattern protection?',
                        'Remove Pattern'
                    );

                    if (confirmed) {
                        PinAuth.clearPin();
                        await Dialog.alert('Pattern removed', 'Success');
                        this.render();
                    }
                });
            });
        }

        // Save Quote
        const saveQuoteBtn = document.getElementById('save-quote-btn');
        const quoteInput = document.getElementById('quote-input');
        if (saveQuoteBtn && quoteInput) {
            saveQuoteBtn.addEventListener('click', async () => {
                PinAuth.setQuote(quoteInput.value.trim());
                await Dialog.alert('Quote saved!', 'Success');
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
                        <div class="settings-item-desc" style="color: var(--color-text-tertiary);">No archived contacts</div>
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
