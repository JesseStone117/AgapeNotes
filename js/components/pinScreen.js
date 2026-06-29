/**
 * AgapeNotes Pattern PIN Screen Component
 * 
 * Displays a 3x3 grid for swipe pattern authentication.
 * Users draw a pattern by connecting dots.
 */

const PinScreen = {
    overlay: null,
    canvas: null,
    ctx: null,
    nodes: [],
    selectedNodes: [],
    implicitNodeIndexes: new Set(),
    isDrawing: false,
    currentPos: { x: 0, y: 0 },
    onSuccess: null,
    isSetupMode: false,
    setupPattern: null,
    isConfirmMode: false,

    // Grid configuration
    GRID_SIZE: 3,
    NODE_RADIUS: 20,
    NODE_SPACING: 100,
    GRID_OFFSET: 50,

    /**
     * Show the pattern lock screen
     * @param {Function} onSuccess - Callback when pattern is correct
     */
    show(onSuccess) {
        this.onSuccess = onSuccess;
        this.isSetupMode = false;
        this.isConfirmMode = false;
        this._createScreen();
    },

    /**
     * Show pattern setup screen
     * @param {Function} onComplete - Callback with new pattern
     */
    showSetup(onComplete) {
        this.onSuccess = onComplete;
        this.isSetupMode = true;
        this.isConfirmMode = false;
        this.setupPattern = null;
        this._createScreen();
    },

    /**
     * Create and display the pattern screen
     * @private
     */
    _createScreen() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }

        this.overlay = document.createElement('div');
        this.overlay.className = 'pattern-screen';
        this.overlay.innerHTML = this._createHTML();
        document.body.appendChild(this.overlay);

        // Initialize canvas and nodes
        this._initializeCanvas();
        this._initializeNodes();
        this._bindEvents();
        this._draw();

        // Animate in
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
        });
    },

    /**
     * Create HTML structure
     * @private
     */
    _createHTML() {
        const quote = PinAuth.getQuote();
        const title = this.isSetupMode
            ? (this.isConfirmMode ? 'Confirm Pattern' : 'Draw a Pattern')
            : 'Agape<span class="gold">Notes</span>';
        const subtitle = this.isSetupMode
            ? (this.isConfirmMode ? 'Draw the same pattern again' : 'Connect at least 4 dots')
            : 'Draw your pattern to unlock';

        return `
            <div class="pattern-screen-content">
                <div class="pattern-header">
                    <h1 class="pattern-title">${title}</h1>
                    <p class="pattern-subtitle">${subtitle}</p>
                    ${!this.isSetupMode && quote ? `<p class="pattern-quote">"${this._escapeHtml(quote)}"</p>` : ''}
                </div>
                
                <div class="pattern-grid-container">
                    <canvas id="pattern-canvas" width="340" height="340"></canvas>
                </div>
                
                <p class="pattern-error" id="pattern-error"></p>
                
                ${this.isSetupMode ? `
                    <button class="btn btn-ghost pattern-cancel" id="pattern-cancel">Cancel</button>
                ` : ''}
            </div>
        `;
    },

    /**
     * Initialize canvas
     * @private
     */
    _initializeCanvas() {
        this.canvas = document.getElementById('pattern-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    },

    /**
     * Initialize node positions
     * @private
     */
    _initializeNodes() {
        this.nodes = [];
        const startX = (340 - (this.GRID_SIZE - 1) * this.NODE_SPACING) / 2;
        const startY = (340 - (this.GRID_SIZE - 1) * this.NODE_SPACING) / 2;

        for (let row = 0; row < this.GRID_SIZE; row++) {
            for (let col = 0; col < this.GRID_SIZE; col++) {
                this.nodes.push({
                    x: startX + col * this.NODE_SPACING,
                    y: startY + row * this.NODE_SPACING,
                    index: row * this.GRID_SIZE + col,
                    selected: false
                });
            }
        }
    },

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this._handleStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this._handleMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this._handleEnd(e));

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this._handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this._handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._handleEnd(e));
        this.canvas.addEventListener('mouseleave', (e) => this._handleEnd(e));

        // Cancel button
        const cancelBtn = document.getElementById('pattern-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this._close());
        }
    },

    /**
     * Get position from event
     * @private
     */
    _getPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    },

    /**
     * Handle start of pattern drawing
     * @private
     */
    _handleStart(e) {
        e.preventDefault();
        this.isDrawing = true;
        this.selectedNodes = [];
        this.implicitNodeIndexes = new Set();
        this.nodes.forEach(n => n.selected = false);
        this._clearError();

        const pos = this._getPosition(e);
        this.currentPos = pos;
        this._checkNodeHit(pos);
        this._draw();
    },

    /**
     * Handle pattern drawing movement
     * @private
     */
    _handleMove(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        const pos = this._getPosition(e);
        this.currentPos = pos;
        this._checkNodeHit(pos);
        this._draw();
    },

    /**
     * Handle end of pattern drawing
     * @private
     */
    async _handleEnd(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const pattern = this.selectedNodes.map(n => n.index);

        if (pattern.length < PinAuth.MIN_NODES) {
            this._showError(`Connect at least ${PinAuth.MIN_NODES} dots`);
            this._resetPattern();
            return;
        }

        if (this.isSetupMode) {
            await this._handleSetup(pattern);
        } else {
            await this._handleValidation(pattern);
        }
    },

    /**
     * Check if a node is hit
     * @private
     */
    _checkNodeHit(pos) {
        for (const node of this.nodes) {
            if (node.selected) continue;

            const dist = Math.sqrt(
                Math.pow(pos.x - node.x, 2) +
                Math.pow(pos.y - node.y, 2)
            );

            if (dist < this.NODE_RADIUS * 1.5) {
                this._selectNodeWithSkippedNodes(node);

                // Haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(20);
                }
                break;
            }
        }
    },

    _selectNodeWithSkippedNodes(node) {
        const lastNode = this.selectedNodes[this.selectedNodes.length - 1];

        if (lastNode) {
            this._getSkippedNodes(lastNode, node).forEach(skippedNode => {
                this._selectNode(skippedNode, true);
            });
        }

        this._selectNode(node);
    },

    _selectNode(node, isImplicit = false) {
        if (!node || node.selected) return false;

        node.selected = true;
        this.selectedNodes.push(node);
        if (isImplicit) this.implicitNodeIndexes.add(node.index);
        return true;
    },

    _getSkippedNodes(fromNode, toNode) {
        if (!fromNode || !toNode || fromNode.index === toNode.index) return [];

        const fromRow = Math.floor(fromNode.index / this.GRID_SIZE);
        const fromCol = fromNode.index % this.GRID_SIZE;
        const toRow = Math.floor(toNode.index / this.GRID_SIZE);
        const toCol = toNode.index % this.GRID_SIZE;
        const rowDelta = toRow - fromRow;
        const colDelta = toCol - fromCol;
        const steps = this._greatestCommonDivisor(Math.abs(rowDelta), Math.abs(colDelta));

        if (steps <= 1) return [];

        const rowStep = rowDelta / steps;
        const colStep = colDelta / steps;
        const skippedNodes = [];

        for (let step = 1; step < steps; step++) {
            const skippedRow = fromRow + rowStep * step;
            const skippedCol = fromCol + colStep * step;
            const skippedIndex = skippedRow * this.GRID_SIZE + skippedCol;
            const skippedNode = this.nodes.find(n => n.index === skippedIndex);

            if (skippedNode && !skippedNode.selected) {
                skippedNodes.push(skippedNode);
            }
        }

        return skippedNodes;
    },

    _greatestCommonDivisor(a, b) {
        while (b !== 0) {
            const next = b;
            b = a % b;
            a = next;
        }
        return a;
    },

    /**
     * Handle pattern setup flow
     * @private
     */
    async _handleSetup(pattern) {
        if (!this.isConfirmMode) {
            // First pattern entry
            this.setupPattern = pattern;
            this.isConfirmMode = true;
            this._resetPattern();

            // Update UI
            document.querySelector('.pattern-title').textContent = 'Confirm Pattern';
            document.querySelector('.pattern-subtitle').textContent = 'Draw the same pattern again';
        } else {
            // Confirm pattern
            if (this._patternsMatch(pattern, this.setupPattern)) {
                await PinAuth.setPattern(pattern);
                this._showSuccess();
                setTimeout(() => {
                    this._close();
                    if (this.onSuccess) this.onSuccess(pattern);
                }, 500);
            } else {
                this._showError('Patterns do not match');
                this._resetPattern();
                // Reset to first entry
                this.isConfirmMode = false;
                this.setupPattern = null;
                document.querySelector('.pattern-title').textContent = 'Draw a Pattern';
                document.querySelector('.pattern-subtitle').textContent = 'Connect at least 4 dots';
            }
        }
    },

    /**
     * Handle pattern validation
     * @private
     */
    async _handleValidation(pattern) {
        let isValid = await PinAuth.validatePattern(pattern);
        const legacyPattern = this._getLegacyPattern(pattern);

        if (!isValid && legacyPattern && legacyPattern.length >= PinAuth.MIN_NODES) {
            isValid = await PinAuth.validatePattern(legacyPattern);
        }

        if (isValid) {
            this._showSuccess();
            setTimeout(() => {
                this._close();
                if (this.onSuccess) this.onSuccess();
            }, 400);
        } else {
            this._showError('Incorrect pattern');
            this._shakeGrid();
            setTimeout(() => this._resetPattern(), 500);
        }
    },

    _getLegacyPattern(pattern) {
        if (!this.implicitNodeIndexes || this.implicitNodeIndexes.size === 0) return null;

        const legacyPattern = pattern.filter(index => !this.implicitNodeIndexes.has(index));
        return legacyPattern.length === pattern.length ? null : legacyPattern;
    },

    /**
     * Check if two patterns match
     * @private
     */
    _patternsMatch(p1, p2) {
        if (p1.length !== p2.length) return false;
        return p1.every((val, idx) => val === p2[idx]);
    },

    /**
     * Get theme-aware colors
     * @private
     */
    _getColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            gold: '#D4A853',
            goldFill: 'rgba(212, 168, 83, 0.3)',
            nodeFill: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            nodeStroke: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)',
            dotFill: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.25)'
        };
    },

    /**
     * Draw the pattern grid
     * @private
     */
    _draw() {
        const ctx = this.ctx;
        const colors = this._getColors();
        ctx.clearRect(0, 0, 340, 340);

        // Draw connecting lines
        if (this.selectedNodes.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = colors.gold;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const first = this.selectedNodes[0];
            ctx.moveTo(first.x, first.y);

            for (let i = 1; i < this.selectedNodes.length; i++) {
                ctx.lineTo(this.selectedNodes[i].x, this.selectedNodes[i].y);
            }

            // Line to current position while drawing
            if (this.isDrawing) {
                ctx.lineTo(this.currentPos.x, this.currentPos.y);
            }

            ctx.stroke();
        }

        // Draw nodes
        for (const node of this.nodes) {
            // Outer circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, this.NODE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = node.selected ? colors.goldFill : colors.nodeFill;
            ctx.fill();
            ctx.strokeStyle = node.selected ? colors.gold : colors.nodeStroke;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner dot
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.selected ? 10 : 6, 0, Math.PI * 2);
            ctx.fillStyle = node.selected ? colors.gold : colors.dotFill;
            ctx.fill();
        }
    },

    /**
     * Reset the pattern
     * @private
     */
    _resetPattern() {
        this.selectedNodes = [];
        this.implicitNodeIndexes = new Set();
        this.nodes.forEach(n => n.selected = false);
        this._draw();
    },

    /**
     * Show error message
     * @private
     */
    _showError(message) {
        const error = document.getElementById('pattern-error');
        if (error) {
            error.textContent = message;
            error.classList.add('visible');
        }
    },

    /**
     * Clear error message
     * @private
     */
    _clearError() {
        const error = document.getElementById('pattern-error');
        if (error) {
            error.textContent = '';
            error.classList.remove('visible');
        }
    },

    /**
     * Show success animation and reset pattern
     * @private
     */
    _showSuccess() {
        const container = this.overlay.querySelector('.pattern-grid-container');
        if (container) {
            container.classList.add('success');
        }
        // Reset pattern after brief delay so user sees success state
        setTimeout(() => this._resetPattern(), 200);
    },

    /**
     * Shake animation for incorrect pattern
     * @private
     */
    _shakeGrid() {
        const container = this.overlay.querySelector('.pattern-grid-container');
        if (container) {
            container.classList.add('shake');
            setTimeout(() => container.classList.remove('shake'), 500);
        }

        const colors = this._getColors();
        const errorColor = '#EF4444';
        const errorFill = 'rgba(239, 68, 68, 0.3)';

        // Draw in red
        this.ctx.clearRect(0, 0, 340, 340);

        // Red lines
        if (this.selectedNodes.length > 0) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = errorColor;
            this.ctx.lineWidth = 4;
            const first = this.selectedNodes[0];
            this.ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.selectedNodes.length; i++) {
                this.ctx.lineTo(this.selectedNodes[i].x, this.selectedNodes[i].y);
            }
            this.ctx.stroke();
        }

        // Red nodes
        for (const node of this.nodes) {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, this.NODE_RADIUS, 0, Math.PI * 2);
            this.ctx.fillStyle = node.selected ? errorFill : colors.nodeFill;
            this.ctx.fill();
            this.ctx.strokeStyle = node.selected ? errorColor : colors.nodeStroke;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.selected ? 10 : 6, 0, Math.PI * 2);
            this.ctx.fillStyle = node.selected ? errorColor : colors.dotFill;
            this.ctx.fill();
        }
    },

    /**
     * Close the pattern screen
     * @private
     */
    _close() {
        if (this.overlay) {
            const overlayToClose = this.overlay;
            overlayToClose.classList.remove('active');
            
            if (this.overlay === overlayToClose) {
                this.overlay = null;
            }

            setTimeout(() => {
                if (document.body.contains(overlayToClose)) {
                    overlayToClose.remove();
                }
            }, 300);
        }
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
