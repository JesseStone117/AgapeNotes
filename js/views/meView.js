/**
 * AgapeNotes Me View
 *
 * Personal tasks and growth plans.
 */

const MeView = {
    _personal: { growthPlans: [], tasks: [] },

    async render() {
        const main = document.getElementById('main-content');
        main.innerHTML = '';
        main.className = 'main-content animate-fade-in';

        const headerAction = document.getElementById('header-action');
        if (headerAction) headerAction.innerHTML = '';

        this._personal = await storage.getPersonalData();

        const container = document.createElement('div');
        container.className = 'me-view';
        container.innerHTML = `
            <section class="detail-section tasks-section">
                <div class="section-header"><h3 class="section-title">Tasks</h3></div>
                <div class="form-group">
                    <div class="action-edit-item" style="display:flex;gap:var(--spacing-sm);align-items:center;">
                        <input type="text" class="form-input" id="me-task-input" placeholder="New task">
                        <button class="btn btn-primary btn-sm" id="me-add-task">Add</button>
                    </div>
                </div>
                <div id="me-task-list" class="action-list"></div>
            </section>

            <section class="detail-section personal-growth-plan-section">
                <div class="section-header"><h3 class="section-title">Personal Growth Plan</h3></div>
                <button class="btn btn-ghost me-add-growth-plan-btn" id="me-add-growth-plan">+ Add Growth Plan</button>
                <div id="me-growth-plans"></div>
            </section>
        `;

        main.appendChild(container);
        this._renderTasks();
        this._renderGrowthPlans();
        this._bind();
    },

    _bind() {
        document.getElementById('me-add-growth-plan')?.addEventListener('click', () => {
            this._openGrowthPlanForm();
        });

        document.getElementById('me-add-task')?.addEventListener('click', () => {
            this._addTask();
        });

        document.getElementById('me-task-input')?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this._addTask();
        });
    },

    _renderGrowthPlans() {
        const list = document.getElementById('me-growth-plans');
        if (!list) return;

        const plans = this._sortGrowthPlans(this._personal.growthPlans || []);
        this._personal.growthPlans = plans;

        if (plans.length === 0) {
            list.innerHTML = '<div class="empty-state-text">No personal growth plans yet.</div>';
            return;
        }

        const currentPlan = plans[0];
        const previousPlans = plans.slice(1);

        list.innerHTML = `
            <div class="growth-plan-current">
                ${PersonDetail._renderGrowthPlanCard(currentPlan)}
            </div>
            ${previousPlans.length > 0 ? `
                <details class="previous-semesters">
                    <summary>Previous Semesters</summary>
                    <div class="growth-plan-list previous-semester-list">
                        ${previousPlans.map(plan => PersonDetail._renderGrowthPlanCard(plan)).join('')}
                    </div>
                </details>
            ` : ''}
        `;

        list.querySelectorAll('[data-edit-growth-plan]').forEach(btn => {
            btn.addEventListener('click', () => {
                const plan = plans.find(p => p.id === btn.dataset.editGrowthPlan);
                if (plan) this._openGrowthPlanForm(plan);
            });
        });

        list.querySelectorAll('[data-copy-growth-plan]').forEach(btn => {
            btn.addEventListener('click', () => {
                const plan = plans.find(p => p.id === btn.dataset.copyGrowthPlan);
                if (plan) this._openGrowthPlanForm(PersonDetail._copyGrowthPlan(plan), true);
            });
        });
    },

    _renderTasks() {
        const list = document.getElementById('me-task-list');
        if (!list) return;

        const tasks = this._personal.tasks || [];
        if (tasks.length === 0) {
            list.innerHTML = '<div class="empty-state-text">No tasks yet.</div>';
            return;
        }

        list.innerHTML = tasks.map((task, index) => `
            <div class="action-item action-${task.status || 'todo'}" data-task-index="${index}" title="${task.status === 'done' ? 'Tap to mark incomplete' : 'Tap to complete'}">
                <span class="task-status-indicator" aria-hidden="true"></span>
                <span class="action-content">${this._escapeHtml(task.content)}</span>
                <button type="button" class="chip-remove" data-task-remove="${index}" aria-label="Remove task">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('[data-task-index]').forEach(item => {
            item.addEventListener('click', async (event) => {
                if (event.target.closest('[data-task-remove]')) return;
                const index = Number(item.dataset.taskIndex);
                const task = this._personal.tasks[index];
                task.status = task.status === 'done' ? 'todo' : 'done';
                await this._save();
                this._renderTasks();
            });
        });

        list.querySelectorAll('[data-task-remove]').forEach(btn => {
            btn.addEventListener('click', async () => {
                this._personal.tasks.splice(Number(btn.dataset.taskRemove), 1);
                await this._save();
                this._renderTasks();
            });
        });
    },

    async _addTask() {
        const input = document.getElementById('me-task-input');
        const content = input?.value.trim();
        if (!content) return;

        this._personal.tasks.push(createActionPlan(content));
        input.value = '';
        await this._save();
        this._renderTasks();
    },

    _openGrowthPlanForm(existingPlan = null, isCopy = false) {
        const plan = existingPlan || createGrowthPlan();
        const body = PersonDetail._buildGrowthPlanForm(plan);

        Modal.open({
            title: isCopy ? 'Copy Growth Plan' : existingPlan ? 'Edit Growth Plan' : 'Add Growth Plan',
            body: body,
        });

        setTimeout(() => {
            document.getElementById('growth-plan-cancel')?.addEventListener('click', () => Modal.close());
            document.getElementById('growth-plan-form')?.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this._saveGrowthPlan(plan, !!existingPlan && !isCopy);
            });
        }, 0);
    },

    async _saveGrowthPlan(plan, updateExisting) {
        const semester = document.getElementById('growth-semester')?.value.trim() || '';
        if (!semester) {
            await Dialog.alert('Please enter a semester.', 'Required');
            return;
        }

        const updatedPlan = {
            ...plan,
            semester,
            goals: [0, 1].map(index => ({
                title: document.getElementById(`growth-goal-${index}`)?.value.trim() || '',
                methods: PersonDetail._readLines(`growth-methods-${index}`),
                evidences: PersonDetail._readLines(`growth-evidences-${index}`)
            })),
            createdAt: plan.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!this._personal.growthPlans) this._personal.growthPlans = [];

        const index = this._personal.growthPlans.findIndex(p => p.id === updatedPlan.id);
        if (updateExisting && index >= 0) {
            this._personal.growthPlans[index] = updatedPlan;
        } else {
            this._personal.growthPlans.unshift(updatedPlan);
        }
        this._personal.growthPlans = this._sortGrowthPlans(this._personal.growthPlans);

        await this._save();
        Modal.close();
        this._renderGrowthPlans();
    },

    _sortGrowthPlans(plans = []) {
        return [...plans]
            .map((plan, index) => ({ plan, index }))
            .sort((a, b) => {
                const diff = this._growthPlanTimestamp(b.plan) - this._growthPlanTimestamp(a.plan);
                return diff || a.index - b.index;
            })
            .map(({ plan }) => plan);
    },

    _growthPlanTimestamp(plan) {
        const explicitDate = Date.parse(plan?.createdAt || plan?.updatedAt || '');
        if (!Number.isNaN(explicitDate)) return explicitDate;

        const idTimestamp = String(plan?.id || '').match(/^\d+/)?.[0];
        return idTimestamp ? Number(idTimestamp) : 0;
    },

    async _save() {
        this._personal.growthPlans = this._sortGrowthPlans(this._personal.growthPlans || []);
        await storage.savePersonalData(this._personal);
    },

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
