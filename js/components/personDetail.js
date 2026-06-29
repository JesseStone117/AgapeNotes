/**
 * AgapeNotes Person Detail Component
 * 
 * Full person view and edit modal with Quill WYSIWYG editing.
 * Users never see raw formatting syntax – everything is visual.
 */

const PersonDetail = {
    currentPerson: null,
    currentCategory: null,
    isEditing: false,
    _formEditors: [],   // Quill instances for the edit form

    // =========================================================
    //  Public API
    // =========================================================

    showView(person, category) {
        this.currentPerson = { ...person };
        this.currentCategory = category;
        this.isEditing = false;

        const body = this._createViewBody(person, category);
        Modal.open({
            title: '',
            body: body,
            onClose: () => {
                this.currentPerson = null;
                this.currentCategory = null;
            }
        });
    },

    showAdd(category) {
        const person = createPerson(category);
        this.currentPerson = person;
        this.currentCategory = category;
        this.isEditing = true;

        appState.update({
            activePerson: person,
            activePersonCategory: category,
            modalType: 'add'
        });

        const body = this._createEditBody(person, category, true);
        Modal.open({
            title: `Add ${CategoryLabels[category].slice(0, -1)}`,
            body: body,
            onClose: () => {
                this._destroyFormEditors();
                this.currentPerson = null;
                this.currentCategory = null;
            }
        });
    },

    showEdit(person, category) {
        this.currentPerson = { ...person };
        this.currentCategory = category;
        this.isEditing = true;
        appState.set('modalType', 'edit');

        const body = this._createEditBody(person, category, false);
        Modal.open({
            title: 'Edit',
            body: body,
            onClose: () => {
                this._destroyFormEditors();
            }
        });
    },

    // =========================================================
    //  Quill WYSIWYG Management
    // =========================================================

    /**
     * Create a Quill editor on a container div.
     * Custom handlers auto-select the word under the cursor when there is
     * no active selection, so the user can just place their cursor and
     * press Bold/Italic/Underline to format the whole word.
     * @private
     * @returns {Quill} Quill instance
     */
    _createQuill(container, initialHtml) {
        if (typeof Quill === 'undefined') {
            console.warn('Quill not loaded');
            return null;
        }

        const makeWordHandler = (formatName) => {
            return function () {
                const quill = this.quill;
                const range = quill.getSelection();
                if (!range) return;

                if (range.length === 0) {
                    // No selection – expand to the word under the cursor
                    const text = quill.getText();
                    const pos = range.index;

                    let start = pos;
                    let end = pos;
                    while (start > 0 && /\S/.test(text[start - 1])) start--;
                    while (end < text.length && /\S/.test(text[end])) end++;

                    if (end > start) {
                        const fmt = quill.getFormat(start, end - start);
                        quill.formatText(start, end - start, formatName, !fmt[formatName]);
                    } else {
                        // Cursor in whitespace – toggle for future typing
                        const fmt = quill.getFormat(range);
                        quill.format(formatName, !fmt[formatName]);
                    }
                } else {
                    // Has selection – toggle on the selection
                    const fmt = quill.getFormat(range);
                    quill.format(formatName, !fmt[formatName]);
                }
            };
        };

        const quill = new Quill(container, {
            theme: 'snow',
            placeholder: 'Write your note…',
            modules: {
                toolbar: {
                    container: [['bold', 'italic', 'underline']],
                    handlers: {
                        bold: makeWordHandler('bold'),
                        italic: makeWordHandler('italic'),
                        underline: makeWordHandler('underline')
                    }
                }
            }
        });

        // Load initial content
        if (initialHtml && initialHtml.trim()) {
            // Convert legacy markdown to HTML first
            const html = renderMarkdown(initialHtml);
            quill.clipboard.dangerouslyPasteHTML(html);
        }

        return quill;
    },

    /**
     * Destroy all form-level Quill editors
     * @private
     */
    _destroyFormEditors() {
        // Quill doesn't have a built-in destroy, but removing DOM is sufficient
        this._formEditors = [];
    },

    /**
     * Read HTML from a Quill instance, returning '' if effectively empty
     * @private
     */
    _readQuillContent(quill) {
        if (!quill) return '';
        const text = quill.getText().trim();
        if (!text) return '';
        return quill.root.innerHTML;
    },

    // =========================================================
    //  View Mode
    // =========================================================

    _createViewBody(person, category) {
        const container = document.createElement('div');
        container.className = 'detail-view';

        // Header with profile picture
        const avatarContent = person.profilePicture
            ? `<img class="profile-pic-avatar profile-pic-large" src="${person.profilePicture}" alt="${this._escapeHtml(getFullName(person))}">`
            : getInitials(person);

        container.innerHTML = `
            <div class="detail-header">
                <div class="detail-avatar">${avatarContent}</div>
                <div class="detail-name-section">
                    <h2 class="detail-name">${this._escapeHtml(getFullName(person))}</h2>
                    <span class="detail-category">${CategoryLabels[category]}</span>
                </div>
            </div>
        `;

        // Basic Info
        const basicInfo = person.basicInfo || {};
        const infoFields = [
            { label: 'Status', value: StatusLabels[basicInfo.status] || '' },
            { label: 'Region', value: basicInfo.region },
            { label: 'Phone', value: formatPhone(basicInfo.phone) },
            { label: 'Email', value: basicInfo.email },
            { label: 'How I Know Them', value: basicInfo.howIKnowThem },
            { label: 'Occupation', value: basicInfo.occupation },
            { label: 'Major', value: basicInfo.major },
            { label: 'Birthday', value: this._formatBirthday(basicInfo.birthday) },
            { label: 'Family', value: basicInfo.family },
            { label: 'Church', value: basicInfo.church },
            { label: 'Mailing Address', value: basicInfo.mailingAddress }
        ].filter(f => f.value);

        if (infoFields.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'detail-section';
            sec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Info</h3></div>
                <div class="info-list">
                    ${infoFields.map(f => `
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title">${f.label}</div>
                                <div class="settings-item-desc">${this._formatInfoValue(f.value)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(sec);
        }

        // Last Contact
        const lastContactFields = [
            { label: 'Type', value: LastContactMethodLabels[basicInfo.lastContactMethod] || '' },
            { label: 'Date', value: formatNumericDate(basicInfo.lastContactDate) }
        ].filter(f => f.value);

        if (lastContactFields.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'detail-section';
            sec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Last Contact</h3></div>
                <div class="info-list">
                    ${lastContactFields.map(f => `
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title">${f.label}</div>
                                <div class="settings-item-desc">${this._escapeHtml(f.value)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(sec);
        }

        // Monthly Support
        const monthlySupportSummary = category === Categories.SUPPORTERS
            ? formatMonthlySupportSummary(person.supportInfo)
            : '';
        if (monthlySupportSummary) {
            const sec = document.createElement('div');
            sec.className = 'detail-section';
            sec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Monthly Support</h3></div>
                <div class="settings-item support-profile-item">
                    <div class="settings-item-info">
                        <div class="settings-item-desc support-profile-summary">${this._escapeHtml(monthlySupportSummary)}</div>
                    </div>
                </div>
            `;
            container.appendChild(sec);
        }

        // Next Meeting
        // Async — render placeholder, then fill in when data loads
        const meetingSec = document.createElement('div');
        meetingSec.className = 'next-meeting-section';
        meetingSec.id = 'next-meeting-placeholder';
        container.appendChild(meetingSec);

        // Load meetings async and render if found
        (async () => {
            await ScheduleView.ensureMeetingsLoaded();
            const nextMeeting = ScheduleView.getNextMeetingForPerson(person.id);
            if (!nextMeeting) return;

            const d = parseLocalDate(nextMeeting.date);
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const timeFormatted = ScheduleView._formatTime(nextMeeting.time);

            meetingSec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Next Meeting</h3></div>
                <div class="next-meeting-card" id="next-meeting-card">
                    <div class="next-meeting-icon">📅</div>
                    <div class="next-meeting-info">
                        <div class="next-meeting-datetime">${dayNames[d.getDay()]}, ${formatDate(nextMeeting.date)} · ${this._escapeHtml(timeFormatted)}</div>
                        ${nextMeeting.location ? `<div class="next-meeting-details">📍 ${this._escapeHtml(nextMeeting.location)}</div>` : ''}
                    </div>
                    <svg class="next-meeting-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </div>
            `;

            document.getElementById('next-meeting-card')?.addEventListener('click', () => {
                // Close all modals and navigate to the meeting
                while (Modal.isOpen()) Modal.close();
                ScheduleView.openMeetingFromProfile(nextMeeting.id);
            });
        })();

        container.appendChild(this._renderFunFactsSection(person, category));

        // Timeline
        if (person.timeline && person.timeline.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'detail-section';
            sec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Timeline</h3></div>
                <div class="timeline">
                    ${person.timeline.map(t => `
                        <div class="timeline-item">
                            <div class="timeline-date">${formatDate(t.date)}</div>
                            <div class="timeline-content">${this._escapeHtml(t.content)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(sec);
        }

        // Prayer Requests
        if (person.prayerRequests && person.prayerRequests.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'detail-section';
            sec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Prayer Requests</h3></div>
                <div class="prayer-list">
                    ${person.prayerRequests.map(pr => `
                        <div class="prayer-item ${pr.isAnswered ? 'answered' : ''}">
                            <span class="prayer-icon">${pr.isAnswered ? '✓' : '🙏'}</span>
                            <span class="prayer-content">${this._escapeHtml(pr.content)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(sec);
        }

        // Action Plans
        if (person.actionPlans && person.actionPlans.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'detail-section';
            sec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Action Plan</h3></div>
                <div class="action-list">
                    ${person.actionPlans.map((ap, i) => `
                        <div class="action-item action-${ap.status}" data-action-index="${i}" style="cursor: pointer; transition: all 0.2s ease;" title="Tap to cycle status">
                            <span class="action-status-icon">${ap.status === 'done' ? '✓' : ap.status === 'in-progress' ? '◐' : '○'}</span>
                            <span class="action-content">${this._escapeHtml(ap.content)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(sec);

            setTimeout(() => {
                const items = sec.querySelectorAll('.action-item');
                items.forEach(item => {
                    item.addEventListener('click', async () => {
                        const idx = parseInt(item.dataset.actionIndex, 10);
                        const ap = person.actionPlans[idx];
                        if (ap) {
                            // Cycle status
                            if (ap.status === 'todo') {
                                ap.status = 'in-progress';
                            } else if (ap.status === 'in-progress') {
                                ap.status = 'done';
                            } else {
                                ap.status = 'todo';
                            }
                            
                            // Update DOM inline for fast feedback
                            item.className = `action-item action-${ap.status}`;
                            const iconSpan = item.querySelector('.action-status-icon');
                            if (iconSpan) {
                                iconSpan.textContent = ap.status === 'done' ? '✓' : ap.status === 'in-progress' ? '◐' : '○';
                            }
                            
                            // Save in background
                            await storage.savePerson(category, person);
                            await refreshPeopleData();
                        }
                    });
                });
            }, 0);
        }

        // Notes – Collapsible (last section), sorted most-recent-first
        {
            const sortedNotes = [...(person.notes || [])].sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            const sec = document.createElement('div');
            sec.className = 'detail-section';
            sec.innerHTML = `
                <div class="section-header"><h3 class="section-title">Notes</h3></div>
                
                <button class="btn btn-ghost" id="view-add-note-btn" style="margin-bottom:var(--spacing-sm); width:100%; justify-content:flex-start;">+ Add Note</button>
                <div id="view-add-note-editor" style="display:none; margin-bottom:var(--spacing-md);">
                    <div id="view-add-note-quill"></div>
                    <div class="note-inline-actions" style="margin-top:var(--spacing-sm);">
                        <button class="btn btn-primary btn-sm" id="view-add-note-save">Save</button>
                        <button class="btn btn-ghost btn-sm" id="view-add-note-cancel">Cancel</button>
                    </div>
                </div>

                ${sortedNotes.length > 0 ? `
                <div class="notes-list" id="view-notes-list">
                    ${sortedNotes.map(n => this._renderCollapsibleNote(n)).join('')}
                </div>` : ''}
            `;
            container.appendChild(sec);
            setTimeout(() => {
                this._bindCollapsibleNotes(person, category);
                this._bindViewAddNote(person, category);
            }, 0);
        }

        // Action Buttons — clean icon bar
        const actions = document.createElement('div');
        actions.className = 'detail-actions-bar';
        actions.innerHTML = `
            <button class="detail-action-item" id="edit-person-btn">
                <div class="detail-action-icon detail-action-icon--primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </div>
                <span class="detail-action-label">Edit</span>
            </button>
            <button class="detail-action-item" id="pin-person-btn">
                <div class="detail-action-icon ${person.isPinned ? 'detail-action-icon--active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${person.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                    </svg>
                </div>
                <span class="detail-action-label">${person.isPinned ? 'Pinned' : 'Pin'}</span>
            </button>
            <button class="detail-action-item" id="transfer-person-btn">
                <div class="detail-action-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 1l4 4-4 4"/>
                        <path d="M3 11V9a4 4 0 014-4h14"/>
                        <path d="M7 23l-4-4 4-4"/>
                        <path d="M21 13v2a4 4 0 01-4 4H3"/>
                    </svg>
                </div>
                <span class="detail-action-label">Move</span>
            </button>
            <button class="detail-action-item" id="archive-person-btn">
                <div class="detail-action-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="21 8 21 21 3 21 3 8"/>
                        <rect x="1" y="3" width="22" height="5"/>
                        <line x1="10" y1="12" x2="14" y2="12"/>
                    </svg>
                </div>
                <span class="detail-action-label">${person.isArchived ? 'Unarchive' : 'Archive'}</span>
            </button>
            <button class="detail-action-item" id="delete-person-btn">
                <div class="detail-action-icon detail-action-icon--danger">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </div>
                <span class="detail-action-label">Delete</span>
            </button>
        `;
        container.appendChild(actions);

        // Bind action buttons
        setTimeout(() => {
            document.getElementById('edit-person-btn')?.addEventListener('click', () => {
                this.showEdit(person, category);
            });
            document.getElementById('delete-person-btn')?.addEventListener('click', () => {
                this._confirmDelete(person, category);
            });
            document.getElementById('pin-person-btn')?.addEventListener('click', async () => {
                person.isPinned = !person.isPinned;
                await storage.savePerson(category, person);
                await refreshPeopleData();
                Modal.close();
                NotesView.renderPersonList();
            });
            document.getElementById('transfer-person-btn')?.addEventListener('click', () => {
                this._openTransferDialog(person, category);
            });
            document.getElementById('archive-person-btn')?.addEventListener('click', async () => {
                const action = person.isArchived ? 'unarchive' : 'archive';
                const ok = await Dialog.confirm(
                    `Are you sure you want to ${action} ${getFullName(person)}?`,
                    `${action.charAt(0).toUpperCase() + action.slice(1)} Contact`
                );
                if (ok) {
                    person.isArchived = !person.isArchived;
                    await storage.savePerson(category, person);
                    await refreshPeopleData();
                    Modal.close();
                    NotesView.renderPersonList();
                }
            });
        }, 0);

        return container;
    },

    _renderFunFactsSection(person, category) {
        const facts = person.funFacts || [];
        const sec = document.createElement('div');
        sec.className = 'detail-section';
        sec.innerHTML = `
            <div class="section-header">
                <h3 class="section-title">Fun Facts</h3>
                <button type="button" class="btn btn-ghost btn-sm" data-add-fun-fact>+ Add</button>
            </div>
            ${facts.length > 0 ? `
                <div class="chip-list">
                    ${facts.map(f => `<span class="chip">${this._escapeHtml(f)}</span>`).join('')}
                </div>
            ` : '<div class="empty-state-text">No fun facts yet.</div>'}
        `;

        sec.querySelector('[data-add-fun-fact]')?.addEventListener('click', async () => {
            const fact = await Dialog.prompt('Enter a fun fact:', '', 'Add Fun Fact');
            if (!fact?.trim()) return;

            const updatedPerson = await storage.getPerson(category, person.id) || person;
            if (!updatedPerson.funFacts) updatedPerson.funFacts = [];
            updatedPerson.funFacts.push(fact.trim());

            await storage.savePerson(category, updatedPerson);
            await refreshPeopleData();
            NotesView.renderPersonList();
            await this._refreshActivePersonView(updatedPerson, category);
        });

        return sec;
    },

    async _refreshActivePersonView(person, category) {
        const updatedPerson = await storage.getPerson(category, person.id);
        if (!updatedPerson) return;

        this.currentPerson = updatedPerson;
        const viewBodyEl = Modal.getActiveBody();
        if (viewBodyEl) {
            viewBodyEl.innerHTML = '';
            viewBodyEl.appendChild(this._createViewBody(updatedPerson, category));
        }
    },

    // ---- Collapsible notes in view mode ----

    _renderCollapsibleNote(note) {
        const nid = note.id;
        const plainText = stripMarkdown(note.content);
        const preview = plainText.length > 80 ? plainText.substring(0, 80) + '…' : plainText;

        return `
            <div class="note-collapsible" data-note-id="${nid}">
                <div class="note-collapse-header" data-note-toggle="${nid}">
                    <div class="note-collapse-info">
                        <div class="note-date">${formatDate(note.createdAt)}</div>
                        <div class="note-preview">${this._escapeHtml(preview)}</div>
                    </div>
                    <svg class="note-collapse-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </div>
                <div class="note-collapse-body" data-note-body="${nid}">
                    <div class="note-content-rendered" data-note-content="${nid}">${renderMarkdown(note.content)}</div>
                    <button class="btn btn-ghost note-edit-btn" data-note-edit="${nid}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                    </button>
                </div>
            </div>
        `;
    },

    _bindCollapsibleNotes(person, category) {
        document.querySelectorAll('[data-note-toggle]').forEach(h => {
            h.addEventListener('click', () => h.closest('.note-collapsible').classList.toggle('expanded'));
        });
        document.querySelectorAll('[data-note-edit]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this._startInlineEdit(person, category, btn.dataset.noteEdit);
            });
        });
    },

    /**
     * Find a note in person.notes by its unique ID
     * @private
     */
    _findNoteById(person, noteId) {
        return person.notes.find(n => n.id === noteId) || null;
    },

    /**
     * Inline edit a single note in view mode with a Quill editor.
     * Uses note ID (not array index) to avoid mismatches after sorting.
     */
    _startInlineEdit(person, category, noteId) {
        const note = this._findNoteById(person, noteId);
        if (!note) return;

        const contentEl = document.querySelector(`[data-note-content="${noteId}"]`);
        const editBtn = document.querySelector(`[data-note-edit="${noteId}"]`);
        if (!contentEl || !editBtn) return;

        editBtn.style.display = 'none';

        const editorWrap = document.createElement('div');
        editorWrap.className = 'note-inline-editor';
        editorWrap.innerHTML = `
            <div id="inline-quill-${noteId}"></div>
            <div class="note-inline-actions">
                <button class="btn btn-primary btn-sm" data-inline-save="${noteId}">Save</button>
                <button class="btn btn-ghost btn-sm" data-inline-cancel="${noteId}">Cancel</button>
            </div>
        `;
        contentEl.style.display = 'none';
        contentEl.parentNode.insertBefore(editorWrap, contentEl.nextSibling);

        const quill = this._createQuill(
            document.getElementById(`inline-quill-${noteId}`),
            note.content
        );

        // Scroll editor into view so keyboard doesn't obscure it
        setTimeout(() => {
            editorWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        const cleanup = () => {
            editorWrap.remove();
            contentEl.style.display = '';
            editBtn.style.display = '';
        };

        editorWrap.querySelector(`[data-inline-save="${noteId}"]`).addEventListener('click', async () => {
            const newContent = this._readQuillContent(quill);
            if (newContent) {
                note.content = newContent;
                note.updatedAt = new Date().toISOString();
                await storage.savePerson(category, person);
                await refreshPeopleData();
                contentEl.innerHTML = renderMarkdown(newContent);
                const plain = stripMarkdown(newContent);
                const preview = plain.length > 80 ? plain.substring(0, 80) + '…' : plain;
                const previewEl = contentEl.closest('.note-collapsible').querySelector('.note-preview');
                if (previewEl) previewEl.textContent = preview;
            }
            cleanup();
        });

        editorWrap.querySelector(`[data-inline-cancel="${noteId}"]`).addEventListener('click', cleanup);
    },

    /**
     * Bind the "Add Note" button in view mode to show an inline Quill editor
     */
    _bindViewAddNote(person, category) {
        const addBtn = document.getElementById('view-add-note-btn');
        const editorWrap = document.getElementById('view-add-note-editor');
        if (!addBtn || !editorWrap) return;

        let quill = null;

        addBtn.addEventListener('click', () => {
            addBtn.style.display = 'none';
            editorWrap.style.display = '';
            if (!quill) {
                quill = this._createQuill(
                    document.getElementById('view-add-note-quill'),
                    ''
                );
            }
            if (quill) quill.focus();
            // Scroll editor into view so keyboard doesn't cover it
            setTimeout(() => {
                editorWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        });

        document.getElementById('view-add-note-save')?.addEventListener('click', async () => {
            const content = this._readQuillContent(quill);
            if (content) {
                if (!person.notes) person.notes = [];
                const note = createNote(content);
                person.notes.push(note);
                await storage.savePerson(category, person);
                await refreshPeopleData();
                NotesView.renderPersonList();

                // Refresh view in place without closing the modal
                const updatedPerson = await storage.getPerson(category, person.id);
                if (updatedPerson) {
                    this.currentPerson = updatedPerson;
                    const viewBodyEl = Modal.getActiveBody();
                    if (viewBodyEl) {
                        viewBodyEl.innerHTML = '';
                        viewBodyEl.appendChild(this._createViewBody(updatedPerson, category));
                    }
                }
            }
        });

        document.getElementById('view-add-note-cancel')?.addEventListener('click', () => {
            editorWrap.style.display = 'none';
            addBtn.style.display = '';
            if (quill) quill.setText('');
        });
    },

    /**
     * Bind the collapsible Notes section toggle in edit mode.
     * Quill editors are lazy-initialized on first expand.
     */
    _notesEditorsInitialized: false,

    _bindNotesCollapsible(person) {
        const toggle = document.getElementById('notes-section-toggle');
        const body = document.getElementById('notes-section-body');
        const section = document.getElementById('notes-collapsible-section');
        if (!toggle || !body || !section) return;

        this._notesEditorsInitialized = false;

        toggle.addEventListener('click', () => {
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : '';
            section.classList.toggle('expanded', !isOpen);

            // Lazy-init Quill editors on first expand
            if (!isOpen && !this._notesEditorsInitialized) {
                this._notesEditorsInitialized = true;
                setTimeout(() => {
                    this._initFormEditors(person);
                    this._bindNoteRemoveButtons(person);
                }, 50);
            }
        });
    },

    _renderGrowthPlanCard(plan) {
        const goals = [0, 1].map(index => createGrowthPlanGoal(plan.goals?.[index]));
        const goalHtml = goals
            .map((goal, index) => ({ goal, index }))
            .filter(({ goal }) => goal.title || goal.methods.length || goal.evidences.length)
            .map(({ goal, index }) => `
                <div class="growth-goal">
                    <div class="growth-goal-title">Goal ${index + 1}${goal.title ? `: ${this._escapeHtml(goal.title)}` : ''}</div>
                    ${this._renderGrowthPlanItems('Methods', goal.methods)}
                    ${this._renderGrowthPlanItems('Evidences', goal.evidences)}
                </div>
            `).join('');

        const planId = this._escapeHtml(plan.id || '');

        return `
            <div class="growth-plan-card">
                <div class="growth-plan-card-header">
                    <div class="growth-plan-semester">${this._escapeHtml(plan.semester || 'Unlabeled semester')}</div>
                    <div class="growth-plan-actions">
                        <button class="btn btn-ghost btn-sm" data-copy-growth-plan="${planId}">Copy</button>
                        <button class="btn btn-secondary btn-sm" data-edit-growth-plan="${planId}">Edit</button>
                    </div>
                </div>
                ${goalHtml || '<div class="empty-state-text">No goals entered yet.</div>'}
            </div>
        `;
    },

    _renderGrowthPlanItems(label, items = []) {
        const filtered = normalizeGrowthPlanItems(items);
        if (filtered.length === 0) return '';
        return `
            <div class="growth-plan-sublist">
                <div class="growth-plan-subtitle">${label}</div>
                <ul>
                    ${filtered.map(item => `<li>${this._escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
        `;
    },

    _copyGrowthPlan(plan) {
        return createGrowthPlan({
            semester: this._nextSemesterName(plan.semester),
            goals: (plan.goals || []).map(goal => ({
                title: goal.title || '',
                methods: [...(goal.methods || [])],
                evidences: [...(goal.evidences || [])]
            }))
        });
    },

    _nextSemesterName(semester = '') {
        const match = semester.match(/\b(Spring|Summer|Fall)\b\s+(\d{4})/i);
        if (!match) return '';

        const season = match[1].toLowerCase();
        const year = Number(match[2]);
        if (season === 'spring') return `Fall ${year}`;
        if (season === 'summer') return `Fall ${year}`;
        return `Spring ${year + 1}`;
    },

    _buildGrowthPlanForm(plan) {
        const body = document.createElement('div');
        body.className = 'growth-plan-form';
        body.innerHTML = `
            <form id="growth-plan-form">
                <div class="form-group">
                    <label class="form-label" for="growth-semester">Semester</label>
                    <input type="text" class="form-input" id="growth-semester" value="${this._escapeHtml(plan.semester || '')}" placeholder="e.g. Fall 2025" required>
                </div>
                ${[0, 1].map(index => this._renderGrowthGoalForm(plan.goals?.[index], index)).join('')}
                <div class="edit-sticky-actions">
                    <button type="submit" class="btn btn-primary btn-full">Save Growth Plan</button>
                    <button type="button" class="btn btn-secondary" id="growth-plan-cancel">Cancel</button>
                </div>
            </form>
        `;
        return body;
    },

    _renderGrowthGoalForm(goal = {}, index) {
        return `
            <div class="growth-goal-form">
                <div class="form-group">
                    <label class="form-label" for="growth-goal-${index}">Goal Title ${index + 1}</label>
                    <input type="text" class="form-input" id="growth-goal-${index}" value="${this._escapeHtml(goal.title || '')}" placeholder="Goal title">
                </div>
                ${this._renderGrowthTextArea(index, 'methods', 'Methods', goal.methods)}
                ${this._renderGrowthTextArea(index, 'evidences', 'Evidences', goal.evidences)}
            </div>
        `;
    },

    _renderGrowthTextArea(goalIndex, field, label, items = []) {
        return `
            <div class="form-group">
                <label class="form-label" for="growth-${field}-${goalIndex}">${label}</label>
                <textarea class="form-input" id="growth-${field}-${goalIndex}" rows="5" placeholder="One per line, up to 10">${this._escapeHtml((items || []).join('\n'))}</textarea>
            </div>
        `;
    },

    _readLines(elementId) {
        const value = document.getElementById(elementId)?.value || '';
        return value
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 10);
    },

    _openTransferDialog(person, currentCategory) {
        const categories = [Categories.STAFF, Categories.STUDENTS, Categories.SUPPORTERS]
            .filter(category => category !== currentCategory);
        const body = document.createElement('div');
        body.className = 'transfer-person-form';
        body.innerHTML = `
            <p class="settings-item-desc" style="margin-bottom:var(--spacing-md);">
                Move ${this._escapeHtml(getFullName(person))} from ${CategoryLabels[currentCategory]} to another list.
            </p>
            <div class="transfer-options">
                ${categories.map(category => `
                    <button class="btn btn-secondary btn-full" data-transfer-category="${category}">
                        ${CategoryLabels[category]}
                    </button>
                `).join('')}
            </div>
        `;

        Modal.open({
            title: 'Move Profile',
            body: body,
        });

        setTimeout(() => {
            body.querySelectorAll('[data-transfer-category]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await this._transferPerson(person, currentCategory, btn.dataset.transferCategory);
                });
            });
        }, 0);
    },

    async _transferPerson(person, fromCategory, toCategory) {
        const movedPerson = await storage.transferPerson(fromCategory, toCategory, person.id);
        if (!movedPerson) {
            await Dialog.alert('Could not move this profile.', 'Move Failed');
            return;
        }

        await refreshPeopleData();
        appState.set('currentCategory', toCategory);

        while (Modal.isOpen()) {
            Modal.close();
        }

        NotesView.render();
        this.showView(movedPerson, toCategory);
    },

    // =========================================================
    //  Edit Mode
    // =========================================================

    _createEditBody(person, category, isNew) {
        const container = document.createElement('div');
        container.className = 'edit-form';
        const basicInfo = person.basicInfo || {};
        const supportInfo = person.supportInfo || {};
        const supporterFields = category === Categories.SUPPORTERS ? `
                <div class="form-group support-edit-section">
                    <div class="form-input-row">
                        <div>
                            <label class="form-label support-label" for="monthlySupportAmount">Monthly Support Amount</label>
                            <div class="money-input">
                                <span class="money-prefix">$</span>
                                <input type="number" class="form-input money-input-field support-amount-input" id="monthlySupportAmount" name="monthlySupportAmount"
                                       value="${this._supportAmountInputValue(supportInfo.monthlyAmount)}" min="0" step="0.01" inputmode="decimal" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="form-label" for="monthlySupportStartDate">Started</label>
                            <input type="date" class="form-input" id="monthlySupportStartDate" name="monthlySupportStartDate"
                                   value="${this._escapeHtml(supportInfo.startDate || '')}">
                        </div>
                    </div>
                </div>
        ` : '';

        const profilePicSection = person.profilePicture
            ? `<div class="profile-pic-edit-preview">
                    <img class="profile-pic-avatar profile-pic-large" src="${person.profilePicture}" alt="Profile">
                    <button type="button" class="btn btn-ghost btn-sm" id="remove-profile-pic">Remove photo</button>
               </div>`
            : `<div class="profile-pic-edit-preview" id="profile-pic-preview-wrap" style="display:none;">
                    <img class="profile-pic-avatar profile-pic-large" id="profile-pic-preview-img" src="" alt="Profile">
                    <button type="button" class="btn btn-ghost btn-sm" id="remove-profile-pic">Remove photo</button>
               </div>`;

        container.innerHTML = `
            <form id="person-form">
                <!-- Profile Picture -->
                <div class="form-group" style="text-align:center;">
                    ${profilePicSection}
                    <label class="btn btn-secondary btn-sm profile-pic-upload" for="profile-pic-input">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
                        </svg>
                        ${person.profilePicture ? 'Change photo' : 'Add photo'}
                    </label>
                    <input type="file" id="profile-pic-input" accept="image/*" style="display:none;">
                </div>

                <div class="form-input-row">
                    <div class="form-group">
                        <label class="form-label" for="firstName">First Name</label>
                        <input type="text" class="form-input" id="firstName" name="firstName"
                               value="${this._escapeHtml(person.firstName)}" placeholder="First name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="lastName">Last Name</label>
                        <input type="text" class="form-input" id="lastName" name="lastName"
                               value="${this._escapeHtml(person.lastName)}" placeholder="Last name">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="status">Status</label>
                    <select class="form-input" id="status" name="status">
                        <option value="" ${!basicInfo.status ? 'selected' : ''}>— Select —</option>
                        <option value="engage" ${basicInfo.status === 'engage' ? 'selected' : ''}>Engage</option>
                        <option value="evangelize" ${basicInfo.status === 'evangelize' ? 'selected' : ''}>Evangelize</option>
                        <option value="establish" ${basicInfo.status === 'establish' ? 'selected' : ''}>Establish</option>
                        <option value="equip" ${basicInfo.status === 'equip' ? 'selected' : ''}>Equip</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" for="howIKnowThem">How I Know Them</label>
                    <input type="text" class="form-input" id="howIKnowThem" name="howIKnowThem"
                           value="${this._escapeHtml(basicInfo.howIKnowThem || '')}" placeholder="How you met or connection">
                </div>

                <div class="form-group">
                    <label class="form-label" for="region">Region</label>
                    <input type="text" class="form-input" id="region" name="region"
                           value="${this._escapeHtml(basicInfo.region || '')}" placeholder="e.g. North Campus, East Side">
                </div>

                <div class="form-group">
                    <label class="form-label">Last Contact</label>
                    <div class="form-input-row">
                        <select class="form-input" id="lastContactMethod" name="lastContactMethod">
                            <option value="" ${!basicInfo.lastContactMethod ? 'selected' : ''}>-- Select --</option>
                            ${this._renderLastContactOptions(basicInfo.lastContactMethod)}
                        </select>
                        <input type="date" class="form-input" id="lastContactDate" name="lastContactDate"
                               value="${this._escapeHtml(basicInfo.lastContactDate || '')}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="phone">Phone</label>
                    <input type="tel" class="form-input" id="phone" name="phone"
                           value="${this._escapeHtml(basicInfo.phone || '')}" placeholder="(555) 123-4567">
                </div>
                <div class="form-group">
                    <label class="form-label" for="email">Email</label>
                    <input type="email" class="form-input" id="email" name="email"
                           value="${this._escapeHtml(basicInfo.email || '')}" placeholder="email@example.com">
                </div>
                <div class="form-group">
                    <label class="form-label" for="mailingAddress">Mailing Address</label>
                    <textarea class="form-input" id="mailingAddress" name="mailingAddress" rows="3"
                              placeholder="Street, city, state, ZIP">${this._escapeHtml(basicInfo.mailingAddress || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="occupation">Occupation</label>
                    <input type="text" class="form-input" id="occupation" name="occupation"
                           value="${this._escapeHtml(basicInfo.occupation || '')}" placeholder="Job title or role">
                </div>
                <div class="form-group">
                    <label class="form-label" for="major">Major</label>
                    <input type="text" class="form-input" id="major" name="major"
                           value="${this._escapeHtml(basicInfo.major || '')}" placeholder="Field of study">
                </div>
                <div class="form-group">
                    <label class="form-label">Birthday</label>
                    <div class="form-input-row">
                        <select class="form-input" id="birthday-month" name="birthday-month">
                            <option value="">Month</option>
                            <option value="01" ${this._bdayMonth(basicInfo.birthday) === '01' ? 'selected' : ''}>January</option>
                            <option value="02" ${this._bdayMonth(basicInfo.birthday) === '02' ? 'selected' : ''}>February</option>
                            <option value="03" ${this._bdayMonth(basicInfo.birthday) === '03' ? 'selected' : ''}>March</option>
                            <option value="04" ${this._bdayMonth(basicInfo.birthday) === '04' ? 'selected' : ''}>April</option>
                            <option value="05" ${this._bdayMonth(basicInfo.birthday) === '05' ? 'selected' : ''}>May</option>
                            <option value="06" ${this._bdayMonth(basicInfo.birthday) === '06' ? 'selected' : ''}>June</option>
                            <option value="07" ${this._bdayMonth(basicInfo.birthday) === '07' ? 'selected' : ''}>July</option>
                            <option value="08" ${this._bdayMonth(basicInfo.birthday) === '08' ? 'selected' : ''}>August</option>
                            <option value="09" ${this._bdayMonth(basicInfo.birthday) === '09' ? 'selected' : ''}>September</option>
                            <option value="10" ${this._bdayMonth(basicInfo.birthday) === '10' ? 'selected' : ''}>October</option>
                            <option value="11" ${this._bdayMonth(basicInfo.birthday) === '11' ? 'selected' : ''}>November</option>
                            <option value="12" ${this._bdayMonth(basicInfo.birthday) === '12' ? 'selected' : ''}>December</option>
                        </select>
                        <select class="form-input" id="birthday-day" name="birthday-day">
                            <option value="">Day</option>
                            ${Array.from({length: 31}, (_, i) => {
                                const d = String(i + 1).padStart(2, '0');
                                return `<option value="${d}" ${this._bdayDay(basicInfo.birthday) === d ? 'selected' : ''}>${i + 1}</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="family">Family</label>
                    <input type="text" class="form-input" id="family" name="family"
                           value="${this._escapeHtml(basicInfo.family || '')}" placeholder="Family info">
                </div>
                <div class="form-group">
                    <label class="form-label" for="church">Church</label>
                    <input type="text" class="form-input" id="church" name="church"
                           value="${this._escapeHtml(basicInfo.church || '')}" placeholder="Church name">
                </div>

                ${supporterFields}

                <!-- Fun Facts -->
                <div class="form-group">
                    <label class="form-label">Fun Facts</label>
                    <div class="chip-list" id="fun-facts-list">
                        ${(person.funFacts || []).map((fact, i) => `
                            <span class="chip">
                                ${this._escapeHtml(fact)}
                                <button type="button" class="chip-remove" data-index="${i}" aria-label="Remove">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                            </span>
                        `).join('')}
                        <button type="button" class="chip chip-add" id="add-fun-fact">+ Add</button>
                    </div>
                </div>

                <!-- Prayer Requests -->
                <div class="form-group">
                    <label class="form-label">Prayer Requests</label>
                    <div id="prayer-list">
                        ${(person.prayerRequests || []).map((pr, i) => `
                            <div class="prayer-edit-item" style="margin-bottom:var(--spacing-sm);display:flex;gap:var(--spacing-sm);align-items:center;">
                                <input type="checkbox" class="prayer-answered" data-index="${i}" ${pr.isAnswered ? 'checked' : ''}>
                                <input type="text" class="form-input prayer-input" data-index="${i}" value="${this._escapeHtml(pr.content)}" style="flex:1;">
                                <button type="button" class="chip-remove prayer-remove" data-index="${i}" aria-label="Remove">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-ghost" id="add-prayer" style="margin-top:var(--spacing-sm);">+ Add Prayer Request</button>
                </div>

                <!-- Action Plans -->
                <div class="form-group">
                    <label class="form-label">Action Plan</label>
                    <div id="action-list">
                        ${(person.actionPlans || []).map((ap, i) => `
                            <div class="action-edit-item" style="margin-bottom:var(--spacing-sm);display:flex;gap:var(--spacing-sm);align-items:center;">
                                <select class="form-input action-status" data-index="${i}" style="width:auto;min-width:100px;">
                                    <option value="todo" ${ap.status === 'todo' ? 'selected' : ''}>To Do</option>
                                    <option value="in-progress" ${ap.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="done" ${ap.status === 'done' ? 'selected' : ''}>Done</option>
                                </select>
                                <input type="text" class="form-input action-input" data-index="${i}" value="${this._escapeHtml(ap.content)}" style="flex:1;">
                                <button type="button" class="chip-remove action-remove" data-index="${i}" aria-label="Remove">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-ghost" id="add-action" style="margin-top:var(--spacing-sm);">+ Add Action Item</button>
                </div>

                <!-- Notes – Collapsible, collapsed by default -->
                <div class="form-group collapsible-section" id="notes-collapsible-section">
                    <div class="collapsible-section-header" id="notes-section-toggle">
                        <label class="form-label" style="cursor:pointer;margin:0;">Notes (${(person.notes || []).length})</label>
                        <svg class="collapsible-section-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 9l6 6 6-6"/>
                        </svg>
                    </div>
                    <div class="collapsible-section-body" id="notes-section-body" style="display:none;">
                        <div id="notes-list">
                            ${(person.notes || []).map((note, i) => `
                                <div class="note-edit-item" data-note-idx="${i}">
                                    <div class="note-quill-wrap" id="note-editor-${i}"></div>
                                    <button type="button" class="chip-remove note-remove-btn" data-note-remove="${i}" aria-label="Remove note" title="Remove note">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                            <path d="M18 6L6 18M6 6l12 12"/>
                                        </svg>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-ghost" id="add-note" style="margin-top:var(--spacing-sm);">+ Add Note</button>
                    </div>
                </div>
                </div>

                <div class="edit-sticky-actions">
                    <button type="submit" class="detail-action-item">
                        <div class="detail-action-icon detail-action-icon--primary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                        </div>
                        <span class="detail-action-label">${isNew ? 'Add' : 'Save'}</span>
                    </button>
                    <button type="button" class="detail-action-item" id="cancel-edit">
                        <div class="detail-action-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </div>
                        <span class="detail-action-label">Cancel</span>
                    </button>
                </div>
            </form>
        `;

        setTimeout(() => {
            this._bindFormHandlers(person, category, isNew);
            // Lazy-init: Quill editors only created when section is expanded
            this._bindNotesCollapsible(person);
        }, 0);

        return container;
    },

    /**
     * Initialize Quill editors on all note containers in the form
     */
    _initFormEditors(person) {
        this._destroyFormEditors();
        (person.notes || []).forEach((note, i) => {
            const el = document.getElementById(`note-editor-${i}`);
            if (el) {
                const q = this._createQuill(el, note.content);
                if (q) this._formEditors.push(q);
            }
        });
    },

    _bindFormHandlers(person, category, isNew) {
        const form = document.getElementById('person-form');
        const cancelBtn = document.getElementById('cancel-edit');

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this._savePerson(person, category, isNew);
            });
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this._destroyFormEditors();
                Modal.close();
            });
        }

        // Profile picture
        document.getElementById('profile-pic-input')?.addEventListener('change', e => {
            if (e.target.files[0]) this._processProfilePicture(e.target.files[0], person);
        });
        document.getElementById('remove-profile-pic')?.addEventListener('click', () => {
            person.profilePicture = null;
            const wrap = document.querySelector('.profile-pic-edit-preview');
            if (wrap) wrap.style.display = 'none';
            const lbl = document.querySelector('.profile-pic-upload');
            if (lbl) lbl.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                </svg> Add photo`;
        });

        // Fun Facts
        document.getElementById('add-fun-fact')?.addEventListener('click', async () => {
            const fact = await Dialog.prompt('Enter a fun fact:', '', 'Add Fun Fact');
            if (fact?.trim()) {
                if (!person.funFacts) person.funFacts = [];
                person.funFacts.push(fact.trim());
                this._refreshFunFacts(person);
            }
        });
        document.querySelectorAll('#fun-facts-list .chip-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                person.funFacts.splice(parseInt(btn.dataset.index), 1);
                this._refreshFunFacts(person);
            });
        });

        // Notes
        document.getElementById('add-note')?.addEventListener('click', () => {
            if (!person.notes) person.notes = [];
            person.notes.push(createNote());
            this._refreshNotes(person);
        });
        this._bindNoteRemoveButtons(person);

        // Prayer Requests
        document.getElementById('add-prayer')?.addEventListener('click', async () => {
            const c = await Dialog.prompt('Enter prayer request:', '', 'Add Prayer Request');
            if (c?.trim()) {
                if (!person.prayerRequests) person.prayerRequests = [];
                person.prayerRequests.push(createPrayerRequest(c.trim()));
                this._refreshPrayerRequests(person);
            }
        });
        document.querySelectorAll('.prayer-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                person.prayerRequests.splice(parseInt(btn.dataset.index), 1);
                this._refreshPrayerRequests(person);
            });
        });

        // Action Plans
        document.getElementById('add-action')?.addEventListener('click', async () => {
            const c = await Dialog.prompt('Enter action item:', '', 'Add Action Item');
            if (c?.trim()) {
                if (!person.actionPlans) person.actionPlans = [];
                person.actionPlans.push(createActionPlan(c.trim()));
                this._refreshActionPlans(person);
            }
        });
        document.querySelectorAll('.action-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                person.actionPlans.splice(parseInt(btn.dataset.index), 1);
                this._refreshActionPlans(person);
            });
        });
    },

    _bindNoteRemoveButtons(person) {
        document.querySelectorAll('[data-note-remove]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = Number.parseInt(btn.dataset.noteRemove, 10);
                if (Number.isNaN(idx)) return;
                await this._deleteNoteAtIndex(person, idx);
            });
        });
    },

    async _deleteNoteAtIndex(person, idx) {
        if (!person?.notes || idx < 0 || idx >= person.notes.length) return false;

        const ok = await Dialog.confirm(
            'Are you sure you want to delete this note? This action cannot be undone.',
            'Delete Note'
        );
        if (!ok) return false;

        // Sync once before splice; avoid re-syncing stale editor indexes after delete.
        this._syncEditorValues(person);
        person.notes.splice(idx, 1);
        this._refreshNotes(person, { syncEditors: false });
        return true;
    },

    _processProfilePicture(file, person) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 200;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                const min = Math.min(img.width, img.height);
                ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                person.profilePicture = dataUrl;

                let wrap = document.querySelector('.profile-pic-edit-preview');
                if (wrap) {
                    wrap.style.display = '';
                    const i = wrap.querySelector('img');
                    if (i) i.src = dataUrl;
                } else {
                    wrap = document.getElementById('profile-pic-preview-wrap');
                    if (wrap) {
                        wrap.style.display = '';
                        const i = document.getElementById('profile-pic-preview-img');
                        if (i) i.src = dataUrl;
                    }
                }
                const lbl = document.querySelector('.profile-pic-upload');
                if (lbl) lbl.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                    </svg> Change photo`;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // =========================================================
    //  Refresh helpers
    // =========================================================

    _refreshFunFacts(person) {
        const list = document.getElementById('fun-facts-list');
        if (!list) return;
        list.innerHTML = `
            ${(person.funFacts || []).map((f, i) => `
                <span class="chip">${this._escapeHtml(f)}
                    <button type="button" class="chip-remove" data-index="${i}" aria-label="Remove">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </span>
            `).join('')}
            <button type="button" class="chip chip-add" id="add-fun-fact">+ Add</button>
        `;
        document.getElementById('add-fun-fact').addEventListener('click', async () => {
            const fact = await Dialog.prompt('Enter a fun fact:', '', 'Add Fun Fact');
            if (fact?.trim()) { person.funFacts.push(fact.trim()); this._refreshFunFacts(person); }
        });
        document.querySelectorAll('#fun-facts-list .chip-remove').forEach(btn => {
            btn.addEventListener('click', () => { person.funFacts.splice(parseInt(btn.dataset.index), 1); this._refreshFunFacts(person); });
        });
    },

    _refreshNotes(person, options = {}) {
        const { syncEditors = true } = options;
        if (syncEditors) {
            this._syncEditorValues(person);
        }
        this._destroyFormEditors();
        const list = document.getElementById('notes-list');
        if (!list) return;
        list.innerHTML = (person.notes || []).map((n, i) => `
            <div class="note-edit-item" data-note-idx="${i}">
                <div class="note-quill-wrap" id="note-editor-${i}"></div>
                <button type="button" class="chip-remove note-remove-btn" data-note-remove="${i}" aria-label="Remove note" title="Remove note">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `).join('');
        setTimeout(() => {
            this._initFormEditors(person);
            this._bindNoteRemoveButtons(person);
        }, 50);
    },

    _syncEditorValues(person) {
        this._formEditors.forEach((q, i) => {
            if (person.notes && person.notes[i]) {
                person.notes[i].content = this._readQuillContent(q);
            }
        });
    },

    _refreshPrayerRequests(person) {
        const list = document.getElementById('prayer-list');
        if (!list) return;
        list.innerHTML = (person.prayerRequests || []).map((pr, i) => `
            <div class="prayer-edit-item" style="margin-bottom:var(--spacing-sm);display:flex;gap:var(--spacing-sm);align-items:center;">
                <input type="checkbox" class="prayer-answered" data-index="${i}" ${pr.isAnswered ? 'checked' : ''}>
                <input type="text" class="form-input prayer-input" data-index="${i}" value="${this._escapeHtml(pr.content)}" style="flex:1;">
                <button type="button" class="chip-remove prayer-remove" data-index="${i}" aria-label="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `).join('');
        document.querySelectorAll('.prayer-remove').forEach(btn => {
            btn.addEventListener('click', () => { person.prayerRequests.splice(parseInt(btn.dataset.index), 1); this._refreshPrayerRequests(person); });
        });
    },

    _refreshActionPlans(person) {
        const list = document.getElementById('action-list');
        if (!list) return;
        list.innerHTML = (person.actionPlans || []).map((ap, i) => `
            <div class="action-edit-item" style="margin-bottom:var(--spacing-sm);display:flex;gap:var(--spacing-sm);align-items:center;">
                <select class="form-input action-status" data-index="${i}" style="width:auto;min-width:100px;">
                    <option value="todo" ${ap.status === 'todo' ? 'selected' : ''}>To Do</option>
                    <option value="in-progress" ${ap.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                    <option value="done" ${ap.status === 'done' ? 'selected' : ''}>Done</option>
                </select>
                <input type="text" class="form-input action-input" data-index="${i}" value="${this._escapeHtml(ap.content)}" style="flex:1;">
                <button type="button" class="chip-remove action-remove" data-index="${i}" aria-label="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `).join('');
        document.querySelectorAll('.action-remove').forEach(btn => {
            btn.addEventListener('click', () => { person.actionPlans.splice(parseInt(btn.dataset.index), 1); this._refreshActionPlans(person); });
        });
    },

    // =========================================================
    //  Save & Delete
    // =========================================================

    async _savePerson(person, category, isNew) {
        const form = document.getElementById('person-form');
        const fd = new FormData(form);

        person.firstName = fd.get('firstName')?.trim() || '';
        person.lastName = fd.get('lastName')?.trim() || '';

        if (category === Categories.SUPPORTERS) {
            const monthlyAmount = parseMonthlySupportAmount(fd.get('monthlySupportAmount'));
            person.supportInfo = {
                ...(person.supportInfo || {}),
                monthlyAmount: monthlyAmount === null ? '' : monthlyAmount.toFixed(2),
                startDate: fd.get('monthlySupportStartDate') || ''
            };
        }

        person.basicInfo = {
            status: fd.get('status') || '',
            region: fd.get('region')?.trim() || '',
            phone: fd.get('phone')?.trim() || '',
            email: fd.get('email')?.trim() || '',
            mailingAddress: fd.get('mailingAddress')?.trim() || '',
            lastContactMethod: fd.get('lastContactMethod') || '',
            lastContactDate: fd.get('lastContactDate') || '',
            occupation: fd.get('occupation')?.trim() || '',
            major: fd.get('major')?.trim() || '',
            birthday: (() => {
                const m = document.getElementById('birthday-month')?.value || '';
                const d = document.getElementById('birthday-day')?.value || '';
                if (m && d) return m + '-' + d;
                return '';
            })(),
            family: fd.get('family')?.trim() || '',
            church: fd.get('church')?.trim() || '',
            howIKnowThem: fd.get('howIKnowThem')?.trim() || ''
        };

        // Read notes from Quill editors — but ONLY if the notes section
        // was expanded and editors were actually initialized.  When the
        // collapsible is never opened, _formEditors stays empty and we
        // must preserve whatever notes already exist on the person object.
        if (this._notesEditorsInitialized) {
            person.notes = this._formEditors.map((q, i) => ({
                ...(person.notes?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
                content: this._readQuillContent(q),
                updatedAt: new Date().toISOString()
            })).filter(n => n.content);
        }
        // else: leave person.notes untouched

        // Prayer requests
        const prayerInputs = document.querySelectorAll('.prayer-input');
        const prayerChecks = document.querySelectorAll('.prayer-answered');
        person.prayerRequests = Array.from(prayerInputs).map((inp, i) => ({
            ...(person.prayerRequests?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
            content: inp.value.trim(),
            isAnswered: prayerChecks[i]?.checked || false
        })).filter(pr => pr.content);

        // Action plans
        const actionInputs = document.querySelectorAll('.action-input');
        const actionStatuses = document.querySelectorAll('.action-status');
        person.actionPlans = Array.from(actionInputs).map((inp, i) => ({
            ...(person.actionPlans?.[i] || { id: Date.now().toString(), createdAt: new Date().toISOString() }),
            content: inp.value.trim(),
            status: actionStatuses[i]?.value || 'todo'
        })).filter(ap => ap.content);

        const v = validatePerson(person);
        if (!v.valid) { await Dialog.alert(v.errors.join('\n'), 'Validation Error'); return; }

        try {
            this._destroyFormEditors();
            await storage.savePerson(category, person);
            await refreshPeopleData();
            NotesView.renderPersonList();

            // Pop the current Edit/Add modal layer
            Modal.close();

            // If the View modal is still underneath, refresh it seamlessly
            if (Modal.isOpen()) {
                const updatedPerson = await storage.getPerson(category, person.id);
                if (updatedPerson) {
                    this.currentPerson = updatedPerson;
                    const viewBodyEl = Modal.getActiveBody();
                    if (viewBodyEl) {
                        viewBodyEl.innerHTML = '';
                        viewBodyEl.appendChild(this._createViewBody(updatedPerson, category));
                    }
                }
            }
        } catch (err) {
            console.error('Save failed:', err);
            await Dialog.alert('Failed to save. Please try again.', 'Error');
        }
    },

    async _confirmDelete(person, category) {
        const ok = await Dialog.confirm(`Are you sure you want to delete ${getFullName(person)}?`, 'Delete Person');
        if (!ok) return;
        try {
            await storage.deletePerson(category, person.id);
            await refreshPeopleData();

            // Close all modal layers
            while (Modal.isOpen()) {
                Modal.close();
            }

            NotesView.renderPersonList();
        } catch (err) {
            console.error('Delete failed:', err);
            await Dialog.alert('Failed to delete. Please try again.', 'Error');
        }
    },

    _renderLastContactOptions(selectedMethod) {
        return Object.entries(LastContactMethodLabels).map(([value, label]) => (
            `<option value="${value}" ${selectedMethod === value ? 'selected' : ''}>${label}</option>`
        )).join('');
    },

    _supportAmountInputValue(value) {
        const amount = parseMonthlySupportAmount(value);
        return amount === null ? '' : amount.toFixed(2);
    },

    _formatInfoValue(value) {
        return this._escapeHtml(value).replace(/\n/g, '<br>');
    },

    _escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },

    /**
     * Format birthday string for display. Handles both "MM-DD" and legacy "YYYY-MM-DD".
     */
    _formatBirthday(bday) {
        if (!bday) return '';
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const parts = bday.split('-');
        let month, day;
        if (parts.length === 3) {
            // Legacy YYYY-MM-DD
            month = parseInt(parts[1], 10);
            day = parseInt(parts[2], 10);
        } else if (parts.length === 2) {
            // New MM-DD
            month = parseInt(parts[0], 10);
            day = parseInt(parts[1], 10);
        } else {
            return bday;
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${monthNames[month - 1]} ${day}`;
        }
        return bday;
    },

    /**
     * Extract month part from birthday string ("01" from "01-15" or "2000-01-15")
     */
    _bdayMonth(bday) {
        if (!bday) return '';
        const parts = bday.split('-');
        if (parts.length === 3) return parts[1]; // YYYY-MM-DD
        if (parts.length === 2) return parts[0]; // MM-DD
        return '';
    },

    /**
     * Extract day part from birthday string ("15" from "01-15" or "2000-01-15")
     */
    _bdayDay(bday) {
        if (!bday) return '';
        const parts = bday.split('-');
        if (parts.length === 3) return parts[2]; // YYYY-MM-DD
        if (parts.length === 2) return parts[1]; // MM-DD
        return '';
    }
};
