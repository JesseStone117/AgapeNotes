/**
 * AgapeNotes Resources View
 * 
 * Discipleship Resources - user-managed topics with auto-derived sources view.
 * Topics are fully CRUD. Sources are computed from resource citations.
 */

const ResourcesView = {
    _currentTab: 'topics', // 'topics' | 'books'
    _topics: [],

    /**
     * Render the resources view
     */
    async render() {
        const main = document.getElementById('main-content');
        main.innerHTML = '';
        main.className = 'main-content animate-fade-in';

        // Clear header action
        const headerAction = document.getElementById('header-action');
        if (headerAction) headerAction.innerHTML = '';

        // Load topics from storage
        this._topics = await storage.getTopics();

        const container = document.createElement('div');
        container.className = 'resources-view';
        container.innerHTML = `
            <div class="resources-tab-bar">
                <button class="category-tab ${this._currentTab === 'topics' ? 'active' : ''}" data-res-tab="topics">Topics</button>
                <button class="category-tab ${this._currentTab === 'books' ? 'active' : ''}" data-res-tab="books">Sources</button>
            </div>
            <div id="resources-content"></div>
        `;
        main.appendChild(container);

        // Tab switching
        container.querySelectorAll('[data-res-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._currentTab = btn.dataset.resTab;
                container.querySelectorAll('[data-res-tab]').forEach(b => b.classList.toggle('active', b.dataset.resTab === this._currentTab));
                this._renderContent();
            });
        });

        this._renderContent();
    },

    /**
     * Render the active tab content
     */
    _renderContent() {
        const contentEl = document.getElementById('resources-content');
        if (!contentEl) return;

        if (this._currentTab === 'topics') {
            this._renderTopics(contentEl);
        } else {
            this._renderBooks(contentEl);
        }
    },

    // =========================================================
    //  Topics Tab
    // =========================================================

    _renderTopics(container) {
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'topic-grid';

        // Topic cards
        this._topics.forEach(topic => {
            const card = document.createElement('button');
            card.className = 'topic-card animate-scale-in';
            card.innerHTML = `
                <span class="topic-card-icon">${this._escapeHtml(topic.icon || '📖')}</span>
                <span class="topic-card-name">${this._escapeHtml(topic.name)}</span>
                <span class="topic-card-count">${(topic.resources || []).length} resource${(topic.resources || []).length !== 1 ? 's' : ''}</span>
            `;
            card.addEventListener('click', () => this._openTopic(topic));
            grid.appendChild(card);
        });

        // Add topic card
        const addCard = document.createElement('button');
        addCard.className = 'topic-card topic-card-add';
        addCard.innerHTML = `
            <svg class="topic-card-add-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span class="topic-card-name">Add Topic</span>
        `;
        addCard.addEventListener('click', () => this._addTopic());
        grid.appendChild(addCard);

        container.appendChild(grid);
    },

    async _addTopic() {
        const name = await Dialog.prompt('Topic name:', '', 'New Topic');
        if (!name?.trim()) return;

        // Simple emoji picker via prompt
        const icon = await Dialog.prompt('Choose an emoji icon:', '📖', 'Topic Icon');
        if (icon === null) return;

        const topic = {
            id: Date.now().toString(),
            name: name.trim(),
            icon: (icon || '📖').trim().substring(0, 2),
            resources: [],
            createdAt: new Date().toISOString()
        };

        await storage.saveTopic(topic);
        this._topics = await storage.getTopics();
        this._renderContent();
    },

    // =========================================================
    //  Topic Detail Modal — resource list
    // =========================================================

    _openTopic(topic) {
        const body = document.createElement('div');
        body.className = 'topic-detail-view';

        this._renderTopicBody(body, topic);

        Modal.open({
            title: `${topic.icon || '📖'} ${topic.name}`,
            body: body,
        });
    },

    _renderTopicBody(container, topic) {
        container.innerHTML = '';

        // Add resource button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-ghost';
        addBtn.style.cssText = 'width:100%;justify-content:flex-start;margin-bottom:var(--spacing-md);';
        addBtn.textContent = '+ Add Resource';
        addBtn.addEventListener('click', () => this._addResource(topic, container));
        container.appendChild(addBtn);

        // Resource list
        if (!topic.resources || topic.resources.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = `
                <div class="empty-state-icon" style="font-size:3rem;">📝</div>
                <div class="empty-state-title">No resources yet</div>
                <div class="empty-state-text">Add discipleship quotes, tips, and action suggestions to this topic.</div>
            `;
            container.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'resource-list';

        topic.resources.forEach(resource => {
            const item = document.createElement('div');
            item.className = 'resource-list-item';
            const preview = resource.quote.length > 100 ? resource.quote.substring(0, 100) + '…' : resource.quote;
            item.innerHTML = `
                ${resource.title ? `<div class="resource-list-title">${this._escapeHtml(resource.title)}</div>` : ''}
                <div class="resource-list-quote">${this._escapeHtml(preview)}</div>
                <div class="resource-list-meta">
                    ${resource.book ? `<span class="resource-list-book">${this._escapeHtml(resource.book)}</span>` : ''}
                    ${resource.author ? `<span class="resource-list-author">— ${this._escapeHtml(resource.author)}</span>` : ''}
                </div>
            `;
            item.addEventListener('click', () => this._openResourceDetail(resource, topic.name));

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'resource-list-delete';
            delBtn.setAttribute('aria-label', 'Delete resource');
            delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = await Dialog.confirm('Delete this resource?', 'Delete Resource');
                if (!ok) return;
                const idx = topic.resources.findIndex(r => r.id === resource.id);
                if (idx >= 0) {
                    topic.resources.splice(idx, 1);
                    await storage.saveTopic(topic);
                    this._topics = await storage.getTopics();
                    this._renderContent();
                    this._renderTopicBody(container, topic);
                }
            });
            item.appendChild(delBtn);

            list.appendChild(item);
        });

        container.appendChild(list);

        // Delete topic button at the bottom
        const deleteSection = document.createElement('div');
        deleteSection.style.cssText = 'margin-top:var(--spacing-xl);padding-top:var(--spacing-lg);border-top:1px solid var(--color-border-light);';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-full';
        deleteBtn.textContent = 'Delete Topic';
        deleteBtn.addEventListener('click', async () => {
            const ok = await Dialog.confirm(
                `Delete "${topic.name}" and all its resources? This cannot be undone.`,
                'Delete Topic'
            );
            if (!ok) return;
            await storage.deleteTopic(topic.id);
            this._topics = await storage.getTopics();
            Modal.close();
            this._renderContent();
        });
        deleteSection.appendChild(deleteBtn);
        container.appendChild(deleteSection);
    },

    // =========================================================
    //  Add Resource Form
    // =========================================================

    /**
     * Normalize resource to ensure suggestedActions is always an array.
     * Handles backward compat from old single-string suggestedAction field.
     */
    _getActions(resource) {
        if (Array.isArray(resource.suggestedActions) && resource.suggestedActions.length > 0) {
            return resource.suggestedActions;
        }
        if (resource.suggestedAction) {
            return [resource.suggestedAction];
        }
        return [];
    },

    /**
     * Collect all action items from the form
     */
    _collectActions() {
        const inputs = document.querySelectorAll('#res-actions-list .res-action-input');
        const actions = [];
        inputs.forEach(input => {
            const val = input.value.trim();
            if (val) actions.push(val);
        });
        return actions;
    },

    _buildResourceForm(existingResource = null) {
        const isEdit = !!existingResource;
        const existingActions = existingResource ? this._getActions(existingResource) : [];

        const body = document.createElement('div');
        body.className = 'resource-form';
        body.innerHTML = `
            <form id="resource-form">
                <div class="form-group">
                    <label class="form-label" for="res-title">Title</label>
                    <input type="text" class="form-input" id="res-title" placeholder="e.g. See The Good" value="${this._escapeHtml(existingResource?.title || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="res-quote">Quote / Tip *</label>
                    <textarea class="form-input" id="res-quote" rows="4" placeholder="Enter the discipleship quote or tip..." required>${this._escapeHtml(existingResource?.quote || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="res-book">Source</label>
                    <input type="text" class="form-input" id="res-book" placeholder="e.g. The Problem of Pain, article, podcast" value="${this._escapeHtml(existingResource?.book || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="res-author">Author</label>
                    <input type="text" class="form-input" id="res-author" placeholder="e.g. C.S. Lewis" value="${this._escapeHtml(existingResource?.author || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="res-citation">Citation Details</label>
                    <input type="text" class="form-input" id="res-citation" placeholder="e.g. Chapter 6, p. 91" value="${this._escapeHtml(existingResource?.citation || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Suggested Action Plan Items</label>
                    <div id="res-actions-list" class="action-items-editor"></div>
                    <button type="button" class="btn btn-ghost" id="res-add-action" style="width:100%;justify-content:flex-start;margin-top:var(--spacing-xs);">+ Add Action Item</button>
                </div>
                <div class="edit-sticky-actions">
                    <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Save Changes' : 'Add Resource'}</button>
                    <button type="button" class="btn btn-secondary" id="res-cancel">Cancel</button>
                </div>
            </form>
        `;

        // Set up the dynamic action items after the DOM is built
        setTimeout(() => {
            const listEl = body.querySelector('#res-actions-list');
            const addBtn = body.querySelector('#res-add-action');

            const addActionRow = (value = '') => {
                const row = document.createElement('div');
                row.className = 'action-item-row';
                row.innerHTML = `
                    <textarea class="form-input res-action-input" rows="2" placeholder="e.g. Read Chapter 6 and journal reflections...">${this._escapeHtml(value)}</textarea>
                    <button type="button" class="action-item-remove" aria-label="Remove action item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                `;
                row.querySelector('.action-item-remove').addEventListener('click', () => row.remove());
                listEl.appendChild(row);
                return row;
            };

            // Seed with existing actions or one empty row
            if (existingActions.length > 0) {
                existingActions.forEach(a => addActionRow(a));
            } else {
                addActionRow('');
            }

            addBtn.addEventListener('click', () => {
                const row = addActionRow('');
                row.querySelector('textarea').focus();
            });
        }, 0);

        return body;
    },

    _addResource(topic, topicContainer) {
        const body = this._buildResourceForm();

        Modal.open({
            title: 'Add Resource',
            body: body,
        });

        // Bind
        setTimeout(() => {
            document.getElementById('res-cancel')?.addEventListener('click', () => Modal.close());
            document.getElementById('resource-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const quote = document.getElementById('res-quote').value.trim();
                if (!quote) return;

                const resource = {
                    id: Date.now().toString(),
                    title: document.getElementById('res-title').value.trim(),
                    quote: quote,
                    book: document.getElementById('res-book').value.trim(),
                    author: document.getElementById('res-author').value.trim(),
                    citation: document.getElementById('res-citation').value.trim(),
                    suggestedActions: this._collectActions(),
                    createdAt: new Date().toISOString()
                };

                if (!topic.resources) topic.resources = [];
                topic.resources.push(resource);
                await storage.saveTopic(topic);
                this._topics = await storage.getTopics();
                this._renderContent();

                // Update the topic reference for re-rendering
                const updatedTopic = this._topics.find(t => t.id === topic.id);
                if (updatedTopic) {
                    topic.resources = updatedTopic.resources;
                }

                Modal.close(); // close form
                this._renderTopicBody(topicContainer, topic);
            });
        }, 0);
    },

    // =========================================================
    //  Resource Detail Modal
    // =========================================================

    _openResourceDetail(resource, topicName) {
        // Find the topic object for editing
        const topic = this._topics.find(t => t.name === topicName);

        const body = document.createElement('div');
        body.className = 'resource-detail';

        // Build citation string
        let citationParts = [];
        if (resource.author) citationParts.push(resource.author);
        if (resource.book) citationParts.push(this._escapeHtml(resource.book));
        if (resource.citation) citationParts.push(resource.citation);
        const citationHtml = citationParts.join(', ');
        const actions = this._getActions(resource);

        body.innerHTML = `
            <div class="resource-detail-topic-badge">
                <span class="chip">${this._escapeHtml(topicName)}</span>
            </div>

            ${resource.title ? `<div class="resource-detail-title">${this._escapeHtml(resource.title)}</div>` : ''}

            <blockquote class="resource-quote-block">
                ${this._escapeHtml(resource.quote)}
            </blockquote>

            ${citationHtml ? `
                <div class="resource-citation-line">
                    — ${citationHtml}
                </div>
            ` : ''}

            ${actions.length > 0 ? `
                <div class="resource-suggested-action">
                    <div class="resource-suggested-label">Suggested Action Plan Items</div>
                    ${actions.map((a, i) => `
                        <div class="resource-action-item">
                            <div class="resource-suggested-text">${actions.length > 1 ? `<span class="action-number">${i + 1}.</span> ` : ''}${this._escapeHtml(a)}</div>
                            <button class="btn btn-ghost btn-assign-single" data-action-index="${i}" title="Assign this item">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M22 21v-2a4 4 0 00-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 010 7.75"/>
                                </svg>
                                Assign
                            </button>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="resource-detail-actions">
                <button class="btn btn-secondary btn-full" id="edit-resource-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Resource
                </button>
                ${actions.length > 1 ? `
                    <button class="btn btn-primary btn-full" id="assign-all-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 00-3-3.87"/>
                            <path d="M16 3.13a4 4 0 010 7.75"/>
                        </svg>
                        Assign All Items (${actions.length})
                    </button>
                ` : ''}
                ${actions.length === 0 ? `
                    <button class="btn btn-primary btn-full" id="assign-quote-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 00-3-3.87"/>
                            <path d="M16 3.13a4 4 0 010 7.75"/>
                        </svg>
                        Assign Quote to Action Plan
                    </button>
                ` : ''}
            </div>
        `;

        Modal.open({
            title: resource.title || 'Resource',
            body: body,
        });

        setTimeout(() => {
            // Individual assign buttons
            body.querySelectorAll('.btn-assign-single').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.actionIndex);
                    this._openPersonPicker([actions[idx]]);
                });
            });
            // Assign all button
            document.getElementById('assign-all-btn')?.addEventListener('click', () => {
                this._openPersonPicker(actions);
            });
            // Assign quote (when no action items exist)
            document.getElementById('assign-quote-btn')?.addEventListener('click', () => {
                this._openPersonPicker([resource.quote]);
            });
            document.getElementById('edit-resource-btn')?.addEventListener('click', () => {
                if (topic) {
                    this._editResource(resource, topic, topicName);
                }
            });
        }, 0);
    },

    // =========================================================
    //  Edit Resource Form
    // =========================================================

    _editResource(resource, topic, topicName) {
        const body = this._buildResourceForm(resource);

        Modal.open({
            title: 'Edit Resource',
            body: body,
        });

        setTimeout(() => {
            document.getElementById('res-cancel')?.addEventListener('click', () => Modal.close());
            document.getElementById('resource-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const quote = document.getElementById('res-quote').value.trim();
                if (!quote) return;

                // Update the resource in-place
                resource.title = document.getElementById('res-title').value.trim();
                resource.quote = quote;
                resource.book = document.getElementById('res-book').value.trim();
                resource.author = document.getElementById('res-author').value.trim();
                resource.citation = document.getElementById('res-citation').value.trim();
                resource.suggestedActions = this._collectActions();
                delete resource.suggestedAction; // clear old single-value field

                // Save to storage
                const idx = topic.resources.findIndex(r => r.id === resource.id);
                if (idx >= 0) {
                    topic.resources[idx] = { ...resource };
                }
                await storage.saveTopic(topic);
                this._topics = await storage.getTopics();

                // Refresh the background topics tab
                this._renderContent();

                // Close the edit form modal
                Modal.close();

                // Close the stale resource detail modal behind it
                if (Modal.isOpen()) {
                    Modal.close();
                }

                // Refresh the topic body in the underlying topic modal
                const topicBody = Modal.getActiveBody();
                if (topicBody) {
                    const updatedTopic = this._topics.find(t => t.id === topic.id);
                    if (updatedTopic) {
                        const detailContainer = topicBody.querySelector('.topic-detail-view');
                        if (detailContainer) {
                            this._renderTopicBody(detailContainer, updatedTopic);
                        }
                    }
                }

                // Re-open fresh resource detail on top
                const freshTopic = this._topics.find(t => t.id === topic.id);
                if (freshTopic) {
                    const freshResource = freshTopic.resources.find(r => r.id === resource.id);
                    if (freshResource) {
                        this._openResourceDetail(freshResource, topicName);
                    }
                }

                this._showToast('Resource updated');
            });
        }, 0);
    },

    // =========================================================
    //  Person Picker Modal
    // =========================================================

    _openPersonPicker(actionTexts) {
        const body = document.createElement('div');
        body.className = 'person-picker';

        // Gather all non-archived people
        const staff = (appState.get('staff') || []).filter(p => !p.isArchived);
        const students = (appState.get('students') || []).filter(p => !p.isArchived);
        const supporters = (appState.get('supporters') || []).filter(p => !p.isArchived);

        const previewText = actionTexts.join(' | ');

        body.innerHTML = `
            <div class="person-picker-header">
                <div class="person-picker-action-preview">
                    <div class="resource-suggested-label">Will add to action plan${actionTexts.length > 1 ? ` (${actionTexts.length} items)` : ''}:</div>
                    <div class="resource-suggested-text">${this._escapeHtml(previewText.length > 120 ? previewText.substring(0, 120) + '\u2026' : previewText)}</div>
                </div>
                <input type="text" class="form-input person-picker-search" id="picker-search" placeholder="Search people...">
            </div>
            <div class="person-picker-list" id="picker-list"></div>
        `;

        Modal.open({
            title: 'Assign to Person',
            body: body,
        });

        const renderList = (filter = '') => {
            const listEl = document.getElementById('picker-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            const filterLower = filter.toLowerCase();
            const groups = [
                { label: CategoryLabels[Categories.STAFF], category: Categories.STAFF, people: staff },
                { label: CategoryLabels[Categories.STUDENTS], category: Categories.STUDENTS, people: students },
                { label: CategoryLabels[Categories.SUPPORTERS], category: Categories.SUPPORTERS, people: supporters },
            ];

            let anyShown = false;

            groups.forEach(group => {
                const filtered = group.people.filter(p => {
                    const name = getFullName(p).toLowerCase();
                    return !filter || name.includes(filterLower);
                });

                if (filtered.length === 0) return;
                anyShown = true;

                const header = document.createElement('div');
                header.className = 'person-picker-group-header';
                header.textContent = group.label;
                listEl.appendChild(header);

                filtered.forEach(person => {
                    const item = document.createElement('button');
                    item.className = 'person-picker-item';

                    const avatarContent = person.profilePicture
                        ? `<img class="person-picker-avatar-img" src="${person.profilePicture}" alt="">`
                        : getInitials(person);

                    item.innerHTML = `
                        <div class="person-picker-avatar">${avatarContent}</div>
                        <div class="person-picker-name">${this._escapeHtml(getFullName(person))}</div>
                    `;

                    item.addEventListener('click', async () => {
                        await this._assignToPerson(person, group.category, actionTexts);
                    });

                    listEl.appendChild(item);
                });
            });

            if (!anyShown) {
                listEl.innerHTML = `
                    <div class="empty-state" style="padding:var(--spacing-xl);">
                        <div class="empty-state-text">${filter ? 'No matching people found' : 'No people added yet'}</div>
                    </div>
                `;
            }
        };

        setTimeout(() => {
            renderList();
            document.getElementById('picker-search')?.addEventListener('input', (e) => {
                renderList(e.target.value);
            });
        }, 0);
    },

    async _assignToPerson(person, category, actionTexts) {
        if (!person.actionPlans) person.actionPlans = [];
        actionTexts.forEach(text => {
            person.actionPlans.push(createActionPlan(text));
        });

        await storage.savePerson(category, person);
        await refreshPeopleData();

        // Close the person picker
        Modal.close();

        // Show toast confirmation
        const countLabel = actionTexts.length > 1 ? `${actionTexts.length} items` : '1 item';
        this._showToast(`Added ${countLabel} to ${getFullName(person)}'s Action Plan`);
    },

    // =========================================================
    //  Sources Tab (auto-derived)
    // =========================================================

    _renderBooks(container) {
        container.innerHTML = '';

        // Gather all resources that have a source field
        const bookMap = new Map(); // key: "book|||author" → { book, author, resources: [{resource, topicName}] }

        this._topics.forEach(topic => {
            (topic.resources || []).forEach(resource => {
                if (!resource.book || !resource.book.trim()) return;

                const key = `${resource.book.trim().toLowerCase()}|||${(resource.author || '').trim().toLowerCase()}`;
                if (!bookMap.has(key)) {
                    bookMap.set(key, {
                        book: resource.book.trim(),
                        author: (resource.author || '').trim(),
                        resources: []
                    });
                }
                bookMap.get(key).resources.push({
                    resource: resource,
                    topicName: topic.name
                });
            });
        });

        if (bookMap.size === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding-top:var(--spacing-2xl);">
                    <div class="empty-state-icon" style="font-size:3rem;">📚</div>
                    <div class="empty-state-title">No sources yet</div>
                    <div class="empty-state-text">Sources appear here automatically when you add resources with a source citation in your topics.</div>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'book-list';

        // Sort alphabetically
        const books = [...bookMap.values()].sort((a, b) => a.book.localeCompare(b.book));

        books.forEach(bookEntry => {
            const card = document.createElement('button');
            card.className = 'book-card';
            card.innerHTML = `
                <div class="book-card-icon">📕</div>
                <div class="book-card-info">
                    <div class="book-card-title">${this._escapeHtml(bookEntry.book)}</div>
                    ${bookEntry.author ? `<div class="book-card-author">${this._escapeHtml(bookEntry.author)}</div>` : ''}
                </div>
                <div class="book-card-badge">${bookEntry.resources.length}</div>
            `;
            card.addEventListener('click', () => this._openBook(bookEntry));
            list.appendChild(card);
        });

        container.appendChild(list);
    },

    _openBook(bookEntry) {
        const body = document.createElement('div');
        body.className = 'book-detail-view';

        if (bookEntry.author) {
            const authorEl = document.createElement('div');
            authorEl.className = 'book-detail-author';
            authorEl.textContent = `by ${bookEntry.author}`;
            body.appendChild(authorEl);
        }

        const countEl = document.createElement('div');
        countEl.className = 'book-detail-count';
        countEl.textContent = `${bookEntry.resources.length} resource${bookEntry.resources.length !== 1 ? 's' : ''} from your topics`;
        body.appendChild(countEl);

        const list = document.createElement('div');
        list.className = 'resource-list';
        list.style.marginTop = 'var(--spacing-md)';

        bookEntry.resources.forEach(({ resource, topicName }) => {
            const item = document.createElement('div');
            item.className = 'resource-list-item';
            const preview = resource.quote.length > 100 ? resource.quote.substring(0, 100) + '…' : resource.quote;
            item.innerHTML = `
                ${resource.title ? `<div class="resource-list-title">${this._escapeHtml(resource.title)}</div>` : ''}
                <div class="resource-list-quote">${this._escapeHtml(preview)}</div>
                <div class="resource-list-meta">
                    <span class="chip" style="font-size:0.7rem;padding:2px 8px;">${this._escapeHtml(topicName)}</span>
                    ${resource.citation ? `<span class="resource-list-citation">${this._escapeHtml(resource.citation)}</span>` : ''}
                </div>
            `;
            item.addEventListener('click', () => this._openResourceDetail(resource, topicName));
            list.appendChild(item);
        });

        body.appendChild(list);

        Modal.open({
            title: `Source: ${bookEntry.book}`,
            body: body,
        });
    },

    // =========================================================
    //  Toast
    // =========================================================

    _showToast(message) {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
            <span>${this._escapeHtml(message)}</span>
        `;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('toast-visible');
            });
        });

        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },

    // =========================================================
    //  Util
    // =========================================================

    _escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
};
