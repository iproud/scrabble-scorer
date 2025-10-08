// Unified placement state management for Scrabble Scorer
class PlacementState {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.state = {
            // Cell selection
            selectedCell: { row: null, col: null },
            
            // Word and direction
            currentWord: '',
            wordDirection: null,
            
            // Blank tiles
            blankTileIndices: new Set(),
            
            // Validation and scoring
            lastValidationResult: null,
            lastScoreBreakdown: null,
            lastCalculatedScore: 0,
            
            // UI state
            isSubmitting: false,
            bingoActive: false,
            
            // Turn metadata
            turnStartTime: null,
            turnModificationCount: 0
        };
        
        // State validation schema
        this.stateSchema = {
            selectedCell: {
                type: 'object',
                properties: {
                    row: { type: 'number', minimum: 0, maximum: 14, nullable: true },
                    col: { type: 'number', minimum: 0, maximum: 14, nullable: true }
                }
            },
            currentWord: {
                type: 'string',
                pattern: '^[A-Z]*$',
                maxLength: 15
            },
            wordDirection: {
                type: 'string',
                enum: ['across', 'down', null]
            },
            blankTileIndices: {
                type: 'object',
                instanceOf: 'Set'
            },
            isSubmitting: {
                type: 'boolean'
            },
            bingoActive: {
                type: 'boolean'
            }
        };
        
        // State change handlers
        this.stateChangeHandlers = new Map();
        
        // Initialize state
        this.reset();
        
        // Subscribe to relevant events
        this.setupEventSubscriptions();
    }
    
    /**
     * Get current state (deep copy)
     * @returns {Object} Current state
     */
    getState() {
        return {
            selectedCell: { ...this.state.selectedCell },
            currentWord: this.state.currentWord,
            wordDirection: this.state.wordDirection,
            blankTileIndices: new Set(this.state.blankTileIndices),
            lastValidationResult: this.state.lastValidationResult,
            lastScoreBreakdown: this.state.lastScoreBreakdown,
            lastCalculatedScore: this.state.lastCalculatedScore,
            isSubmitting: this.state.isSubmitting,
            bingoActive: this.state.bingoActive,
            turnStartTime: this.state.turnStartTime,
            turnModificationCount: this.state.turnModificationCount
        };
    }
    
    /**
     * Get specific state property
     * @param {string} key - State property key
     * @param {*} defaultValue - Default value if property doesn't exist
     * @returns {*} State property value
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.state;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        // Return deep copy for objects and Sets
        if (value instanceof Set) {
            return new Set(value);
        } else if (value && typeof value === 'object') {
            return { ...value };
        }
        
        return value;
    }
    
    /**
     * Set state property with validation and events
     * @param {string} key - State property key
     * @param {*} value - New value
     * @param {Object} options - Set options
     * @returns {boolean} Whether the set was successful
     */
    set(key, value, options = {}) {
        const oldValue = this.get(key);
        
        // Validate the change
        if (!this.validateStateChange(key, value, oldValue)) {
            console.warn(`📍 PlacementState: Invalid state change for ${key}`, { oldValue, newValue: value });
            return false;
        }
        
        // Apply the change
        const keys = key.split('.');
        let target = this.state;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in target)) {
                target[keys[i]] = {};
            }
            target = target[keys[i]];
        }
        
        const finalKey = keys[keys.length - 1];
        
        // Handle Set specially
        if (finalKey === 'blankTileIndices' && value instanceof Set) {
            target[finalKey] = new Set(value);
        } else {
            target[finalKey] = value;
        }
        
        // Update metadata
        if (key !== 'turnStartTime' && key !== 'turnModificationCount') {
            this.state.turnModificationCount++;
        }
        
        // Publish state change event
        this.eventBus.publish(this.eventBus.eventTypes.PLACEMENT, {
            type: 'state_changed',
            key,
            oldValue,
            newValue: this.get(key),
            options
        }, { source: 'PlacementState' });
        
        // Execute state change handlers
        this.executeStateChangeHandlers(key, oldValue, this.get(key), options);
        
        console.log(`📍 PlacementState: Set ${key} from`, oldValue, 'to', this.get(key));
        return true;
    }
    
    /**
     * Set multiple state properties atomically
     * @param {Object} changes - Object with key-value pairs
     * @param {Object} options - Set options
     * @returns {boolean} Whether all changes were successful
     */
    setMultiple(changes, options = {}) {
        const oldState = this.getState();
        const appliedChanges = [];
        
        try {
            // Validate all changes first
            for (const [key, value] of Object.entries(changes)) {
                const oldValue = this.get(key);
                if (!this.validateStateChange(key, value, oldValue)) {
                    throw new Error(`Invalid state change for ${key}`);
                }
            }
            
            // Apply all changes
            for (const [key, value] of Object.entries(changes)) {
                const oldValue = this.get(key);
                this.set(key, value, { ...options, silent: true });
                appliedChanges.push({ key, oldValue, newValue: this.get(key) });
            }
            
            // Publish batch state change event
            this.eventBus.publish(this.eventBus.eventTypes.PLACEMENT, {
                type: 'batch_state_changed',
                changes: appliedChanges,
                options
            }, { source: 'PlacementState' });
            
            return true;
            
        } catch (error) {
            console.error('📍 PlacementState: Batch state change failed:', error);
            
            // Rollback changes if atomic operation failed
            if (options.atomic) {
                this.restoreState(oldState);
            }
            
            return false;
        }
    }
    
    /**
     * Reset state to initial values
     * @param {Object} options - Reset options
     */
    reset(options = {}) {
        const oldState = this.getState();
        
        this.state = {
            selectedCell: { row: null, col: null },
            currentWord: '',
            wordDirection: null,
            blankTileIndices: new Set(),
            lastValidationResult: null,
            lastScoreBreakdown: null,
            lastCalculatedScore: 0,
            isSubmitting: false,
            bingoActive: false,
            turnStartTime: Date.now(),
            turnModificationCount: 0
        };
        
        // Publish reset event
        this.eventBus.publish(this.eventBus.eventTypes.PLACEMENT, {
            type: 'state_reset',
            oldState,
            newState: this.getState(),
            options
        }, { source: 'PlacementState' });
        
        console.log('📍 PlacementState: Reset to initial state');
    }
    
    /**
     * Restore state from a snapshot
     * @param {Object} stateSnapshot - State snapshot to restore
     * @param {Object} options - Restore options
     * @returns {boolean} Whether restore was successful
     */
    restoreState(stateSnapshot, options = {}) {
        if (!this.validateState(stateSnapshot)) {
            console.error('📍 PlacementState: Invalid state snapshot');
            return false;
        }
        
        const oldState = this.getState();
        
        // Deep restore the state
        this.state = {
            selectedCell: { ...stateSnapshot.selectedCell },
            currentWord: stateSnapshot.currentWord,
            wordDirection: stateSnapshot.wordDirection,
            blankTileIndices: new Set(stateSnapshot.blankTileIndices),
            lastValidationResult: stateSnapshot.lastValidationResult,
            lastScoreBreakdown: stateSnapshot.lastScoreBreakdown,
            lastCalculatedScore: stateSnapshot.lastCalculatedScore,
            isSubmitting: stateSnapshot.isSubmitting,
            bingoActive: stateSnapshot.bingoActive,
            turnStartTime: stateSnapshot.turnStartTime || Date.now(),
            turnModificationCount: stateSnapshot.turnModificationCount || 0
        };
        
        // Publish restore event
        this.eventBus.publish(this.eventBus.eventTypes.PLACEMENT, {
            type: 'state_restored',
            oldState,
            newState: this.getState(),
            options
        }, { source: 'PlacementState' });
        
        console.log('📍 PlacementState: Restored from snapshot');
        return true;
    }
    
    /**
     * Validate a state change
     * @param {string} key - State property key
     * @param {*} newValue - New value
     * @param {*} oldValue - Current value
     * @returns {boolean} Whether the change is valid
     */
    validateStateChange(key, newValue, oldValue) {
        // Skip validation for silent operations
        if (key === 'turnStartTime' || key === 'turnModificationCount') {
            return true;
        }
        
        // Create temporary state for validation
        const tempState = { ...this.state };
        const keys = key.split('.');
        let target = tempState;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in target)) {
                target[keys[i]] = {};
            }
            target = target[keys[i]];
        }
        
        target[keys[keys.length - 1]] = newValue;
        
        return this.validateState(tempState);
    }
    
    /**
     * Validate complete state object
     * @param {Object} state - State to validate
     * @returns {boolean} Whether state is valid
     */
    validateState(state) {
        try {
            // Basic structure validation
            if (!state || typeof state !== 'object') {
                return false;
            }
            
            // Validate selectedCell
            if (!state.selectedCell || typeof state.selectedCell !== 'object') {
                return false;
            }
            
            const { row, col } = state.selectedCell;
            if ((row !== null && (typeof row !== 'number' || row < 0 || row > 14)) ||
                (col !== null && (typeof col !== 'number' || col < 0 || col > 14))) {
                return false;
            }
            
            // Validate currentWord
            if (typeof state.currentWord !== 'string' || state.currentWord.length > 15) {
                return false;
            }
            
            if (!/^[A-Z]*$/.test(state.currentWord)) {
                return false;
            }
            
            // Validate wordDirection
            if (state.wordDirection !== null && 
                state.wordDirection !== 'across' && 
                state.wordDirection !== 'down') {
                return false;
            }
            
            // Validate blankTileIndices
            if (!(state.blankTileIndices instanceof Set)) {
                return false;
            }
            
            // Validate boolean properties
            if (typeof state.isSubmitting !== 'boolean' || 
                typeof state.bingoActive !== 'boolean') {
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('📍 PlacementState: Validation error:', error);
            return false;
        }
    }
    
    /**
     * Add a state change handler
     * @param {string} key - State property key (or '*' for all changes)
     * @param {Function} handler - Handler function
     * @param {Object} options - Handler options
     */
    addStateChangeHandler(key, handler, options = {}) {
        if (!this.stateChangeHandlers.has(key)) {
            this.stateChangeHandlers.set(key, []);
        }
        
        this.stateChangeHandlers.get(key).push({
            handler,
            options
        });
    }
    
    /**
     * Remove a state change handler
     * @param {string} key - State property key
     * @param {Function} handler - Handler function to remove
     * @returns {boolean} Whether handler was removed
     */
    removeStateChangeHandler(key, handler) {
        const handlers = this.stateChangeHandlers.get(key);
        if (!handlers) {
            return false;
        }
        
        const index = handlers.findIndex(h => h.handler === handler);
        if (index !== -1) {
            handlers.splice(index, 1);
            return true;
        }
        
        return false;
    }
    
    /**
     * Execute state change handlers
     * @param {string} key - State property key
     * @param {*} oldValue - Old value
     * @param {*} newValue - New value
     * @param {Object} options - Change options
     */
    executeStateChangeHandlers(key, oldValue, newValue, options) {
        // Execute specific handlers
        const specificHandlers = this.stateChangeHandlers.get(key);
        if (specificHandlers) {
            for (const { handler, options: handlerOptions } of specificHandlers) {
                try {
                    handler(key, oldValue, newValue, { ...options, ...handlerOptions });
                } catch (error) {
                    console.error(`📍 PlacementState: Error in state change handler for ${key}:`, error);
                }
            }
        }
        
        // Execute wildcard handlers
        const wildcardHandlers = this.stateChangeHandlers.get('*');
        if (wildcardHandlers) {
            for (const { handler, options: handlerOptions } of wildcardHandlers) {
                try {
                    handler(key, oldValue, newValue, { ...options, ...handlerOptions });
                } catch (error) {
                    console.error('📍 PlacementState: Error in wildcard state change handler:', error);
                }
            }
        }
    }
    
    /**
     * Check if placement is complete (ready for validation)
     * @returns {boolean} Whether placement is complete
     */
    isPlacementComplete() {
        return this.state.selectedCell.row !== null &&
               this.state.selectedCell.col !== null &&
               this.state.wordDirection !== null &&
               this.state.currentWord.length > 0;
    }
    
    /**
     * Check if placement has new tiles
     * @param {Object} boardState - Current board state
     * @returns {boolean} Whether placement has new tiles
     */
    hasNewTiles(boardState) {
        if (!this.isPlacementComplete() || !boardState) {
            return false;
        }
        
        const { row, col } = this.state.selectedCell;
        const { wordDirection, currentWord } = this.state;
        
        for (let i = 0; i < currentWord.length; i++) {
            const tileRow = wordDirection === 'across' ? row : row + i;
            const tileCol = wordDirection === 'across' ? col + i : col;
            
            if (tileRow >= 0 && tileRow < 15 && tileCol >= 0 && tileCol < 15) {
                if (!boardState[tileRow] || !boardState[tileRow][tileCol]) {
                    return true; // Found at least one new tile placement
                }
            }
        }
        
        return false;
    }
    
    /**
     * Get placement summary for validation
     * @returns {Object} Placement summary
     */
    getPlacementSummary() {
        return {
            selectedCell: { ...this.state.selectedCell },
            word: this.state.currentWord,
            direction: this.state.wordDirection,
            blankTileIndices: Array.from(this.state.blankTileIndices),
            isComplete: this.isPlacementComplete(),
            turnDuration: Date.now() - this.state.turnStartTime,
            modificationCount: this.state.turnModificationCount
        };
    }
    
    /**
     * Setup event subscriptions
     */
    setupEventSubscriptions() {
        // Listen to validation events
        this.eventBus.subscribe(this.eventBus.eventTypes.VALIDATION, (event) => {
            this.handleValidationEvent(event);
        });
        
        // Listen to UI events
        this.eventBus.subscribe(this.eventBus.eventTypes.UI, (event) => {
            this.handleUIEvent(event);
        });
    }
    
    /**
     * Handle validation events
     * @param {Object} event - Validation event
     */
    handleValidationEvent(event) {
        const { type, data } = event;
        
        switch (type) {
            case 'validation_completed':
                this.set('lastValidationResult', data.results);
                break;
                
            case 'validation_started':
                this.set('isSubmitting', true);
                break;
        }
    }
    
    /**
     * Handle UI events
     * @param {Object} event - UI event
     */
    handleUIEvent(event) {
        const { type, data } = event;
        
        switch (type) {
            case 'submit_completed':
            case 'submit_failed':
                this.set('isSubmitting', false);
                break;
                
            case 'placement_canceled':
                this.reset();
                break;
        }
    }
}

// Create global placement state instance with initialization guard
function initializePlacementState() {
    if (window.eventBus) {
        window.placementState = new PlacementState(window.eventBus);
        console.log('📍 PlacementState: Initialized successfully');
    } else {
        console.error('📍 PlacementState: EventBus not available for initialization');
        // Retry after a short delay
        setTimeout(initializePlacementState, 100);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePlacementState);
} else {
    initializePlacementState();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlacementState, placementState: window.placementState };
}
