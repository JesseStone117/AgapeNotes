/**
 * AgapeNotes Modal Component
 * 
 * Reusable modal system with layered slide-up animations.
 * Supports stacking multiple modals on top of each other.
 */

const Modal = {
    container: null,
    backdrop: null,
    panels: [], // Stack of active modal panel objects: { element, onClose }

    /**
     * Initialize modal container
     */
    init() {
        this.container = document.getElementById('modal-container');
        this.backdrop = this.container.querySelector('.modal-backdrop');

        // Close top modal on backdrop click
        this.backdrop.addEventListener('click', () => {
            if (this.isOpen()) {
                this.close();
            }
        });

        // Close top modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    },

    /**
     * Check if any modal is open
     * @returns {boolean}
     */
    isOpen() {
        return this.panels.length > 0;
    },

    /**
     * Open a new modal layer
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string|HTMLElement} options.body - Modal body content
     * @param {Function} options.onClose - Callback when modal closes
     */
    open(options = {}) {
        const { title = '', body = '', onClose: providedOnClose = null } = options;

        // Create new modal panel element
        const panelEl = document.createElement('div');
        panelEl.className = 'modal-content';

        // Set CSS custom property for depth index
        const depthIndex = this.panels.length;
        panelEl.style.setProperty('--modal-index', depthIndex);

        panelEl.innerHTML = `
            <div class="modal-header">
                <div class="modal-drag-handle"></div>
                <div class="modal-header-content">
                    <h2 class="modal-title">${title}</h2>
                    <button class="modal-close" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="modal-body"></div>
        `;

        // Insert body content
        const bodyContainer = panelEl.querySelector('.modal-body');
        if (typeof body === 'string') {
            bodyContainer.innerHTML = body;
        } else {
            bodyContainer.appendChild(body);
        }

        // Bind close button
        const closeBtn = panelEl.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.close());

        // --- Drag to dismiss logic ---
        const headerEl = panelEl.querySelector('.modal-header');
        let isDragging = false;
        let startY = 0;
        let currentTranslate = 0;

        const onDragStart = (e) => {
            isDragging = true;
            startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            panelEl.classList.add('modal-dragging');
        };

        const onDragMove = (e) => {
            if (!isDragging) return;
            const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            const deltaY = currentY - startY;

            // Only allow dragging downwards
            if (deltaY > 0) {
                currentTranslate = deltaY;
                panelEl.style.transform = `translateY(${deltaY}px)`;
                e.preventDefault(); // prevent pull-to-refresh
            }
        };

        const onDragEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            panelEl.classList.remove('modal-dragging');
            panelEl.style.transform = ''; // Clear inline styles

            if (currentTranslate > 100) {
                // Dragged far enough, close it
                this.close();
            }
            currentTranslate = 0;
        };

        headerEl.addEventListener('touchstart', onDragStart, { passive: true });
        headerEl.addEventListener('touchmove', onDragMove, { passive: false });
        headerEl.addEventListener('touchend', onDragEnd);

        headerEl.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);

        // Clean up drag listeners on close
        const cleanupDrag = () => {
            headerEl.removeEventListener('touchstart', onDragStart);
            headerEl.removeEventListener('touchmove', onDragMove);
            headerEl.removeEventListener('touchend', onDragEnd);
            headerEl.removeEventListener('mousedown', onDragStart);
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
        };
        const onClose = () => {
            cleanupDrag();
            if (providedOnClose) providedOnClose();
        };

        // Add panel to stack
        this.panels.push({
            element: panelEl,
            onClose: onClose
        });

        // Append to container
        this.container.appendChild(panelEl);

        // Show container and lock body scroll if this is the first modal
        if (this.panels.length === 1) {
            this.container.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            appState.set('isModalOpen', true);
        }

        // Push history state for back button support
        HistoryManager.push('modal');

        // Update CSS classes for layered animation effect
        this._updateLayering();

        // Focus first focusable element
        // We defer this slightly so the animation starts first
        setTimeout(() => {
            const focusable = panelEl.querySelector('input, button, [tabindex="0"]');
            if (focusable) focusable.focus();
        }, 300);

        // Trigger enter animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                panelEl.classList.add('modal-visible');
            });
        });
    },

    /**
     * Close the top modal layer
     */
    close() {
        if (!this.isOpen()) return;

        // Pop the top panel off the stack
        const topPanel = this.panels.pop();

        // Trigger slide down animation
        topPanel.element.classList.remove('modal-visible');

        // Update classes on remaining background panels
        this._updateLayering();

        // Call close callback for the closed panel
        if (topPanel.onClose) {
            topPanel.onClose();
        }

        // Clean up DOM after animation finishes
        setTimeout(() => {
            if (topPanel.element.parentNode) {
                topPanel.element.parentNode.removeChild(topPanel.element);
            }
        }, 350); // var(--transition-slow) is usually 0.3s or 0.35s

        // If no more panels, close the whole container
        if (this.panels.length === 0) {
            this.container.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            appState.update({
                isModalOpen: false,
                modalType: null,
                activePerson: null,
                activePersonCategory: null
            });
        }
    },

    /**
     * Update modal title of the top layer
     * @param {string} title - New title
     */
    setTitle(title) {
        if (!this.isOpen()) return;
        const topPanel = this.panels[this.panels.length - 1];
        const titleEl = topPanel.element.querySelector('.modal-title');
        if (titleEl) titleEl.textContent = title;
    },

    /**
     * Get the body container of the current active (top) modal
     * (Useful for re-rendering contents without closing)
     * @returns {HTMLElement|null}
     */
    getActiveBody() {
        if (!this.isOpen()) return null;
        const topPanel = this.panels[this.panels.length - 1];
        return topPanel.element.querySelector('.modal-body');
    },

    /**
     * Apply layered CSS classes based on stack depth
     * @private
     */
    _updateLayering() {
        const total = this.panels.length;
        if (total === 0) return;

        this.panels.forEach((panel, i) => {
            const el = panel.element;
            // Clear old background classes
            el.classList.remove('modal-background');

            // The last item in array is the top panel
            const isTop = (i === total - 1);
            if (!isTop) {
                el.classList.add('modal-background');
            }
        });
    }
};
