// State machine for managing turn flow and game phases
class PlacementStateMachine {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentState = null;
        this.previousState = null;
        this.stateHistory = [];
        this.stateGuards = new Map();
        this.stateEnterHandlers = new Map();
        this.stateExitHandlers = new Map();
        this.transitionHandlers = new Map();
        
        // Define states
        this.states = {
            IDLE: 'idle',
            CELL_SELECTED: 'cell_selected',
            DIRECTION_SELECTED: 'direction_selected',
            WORD_ENTRY: 'word_entry',
            VALIDATING: 'validating',
            SUBMITTING: 'submitting',
            ERROR: 'error'
        };
        
        // Define valid transitions
        this.validTransitions = new Map([
            [this.states.IDLE, [this.states.CELL_SELECTED]],
            [this.states.CELL_SELECTED, [this.states.IDLE, this.states.DIRECTION_SELECTED]],
            [this.states.DIRECTION_SELECTED, [this.states.CELL_SELECTED, this.states.WORD_ENTRY]],
            [this.states.WORD_ENTRY, [this.states.DIRECTION_SELECTED, this.states.VALIDATING, this.states.IDLE]],
            [this.states.VALIDATING, [this.states.WORD_ENTRY, this.states.SUBMITTING, this.states.ERROR]],
            [this.states.SUBMITTING, [this.states.WORD_ENTRY, this.states.IDLE]],
            [this.states.ERROR, [this.states.WORD_ENTRY, this.states.IDLE]]
        ]);
        
        // State metadata
        this.stateMetadata = new Map([
            [this.states.IDLE, {
                name: 'Idle',
                description: 'Waiting for user to select a cell',
                canSubmit: false,
                canCancel: false,
                canUndo: true
            }],
            [this.states.CELL_SELECTED, {
                name: 'Cell Selected',
                description: 'Cell selected, waiting for direction',
                canSubmit: false,
                canCancel: true,
                canUndo: true
            }],
            [this.states.DIRECTION_SELECTED, {
                name: 'Direction Selected',
                description: 'Direction selected, ready for word entry',
                canSubmit: false,
                canCancel: true,
                canUndo: true
            }],
            [this.states.WORD_ENTRY, {
                name: 'Word Entry',
                description: 'User is entering a word',
                canSubmit: true,
                canCancel: true,
                canUndo: true
            }],
            [this.states.VALIDATING, {
                name: 'Validating',
                description: 'Validating word and placement',
                canSubmit: false,
                canCancel: false,
                canUndo: false
            }],
            [this.states.SUBMITTING, {
                name: 'Submitting',
                description: 'Submitting turn to server',
                canSubmit: false,
                canCancel: false,
                canUndo: false
            }],
            [this.states.ERROR, {
                name: 'Error',
                description: 'Error occurred during validation or submission',
                canSubmit: false,
                canCancel: true,
                canUndo: true
            }]
        ]);
        
        // Initialize to idle state
        this.transitionTo(this.states.IDLE);
        
        // Subscribe to relevant events
        this.setupEventSubscriptions();
    }
    
    /**
     * Transition to a new state
     * @param {string} newState - The target state
     * @param {Object} context - Context data for the transition
     * @returns {boolean} Whether the transition was successful
     */
    transitionTo(newState, context = {}) {
        // Validate transition
        if (!this.isValidTransition(this.currentState, newState)) {
            console.warn(`🔄 StateMachine: Invalid transition from ${this.currentState} to ${newState}`);
            return false;
        }
        
        // Check state guards
        if (!this.checkStateGuards(newState, context)) {
            console.warn(`🔄 StateMachine: State guard prevented transition to ${newState}`);
            return false;
        }
        
        const oldState = this.currentState;
        this.previousState = oldState;
        this.currentState = newState;
        
        // Add to history
        this.stateHistory.push({
            from: oldState,
            to: newState,
            timestamp: Date.now(),
            context
        });
        
        // Keep history size manageable
        if (this.stateHistory.length > 50) {
            this.stateHistory.shift();
        }
        
        // Execute exit handler for old state
        if (oldState && this.stateExitHandlers.has(oldState)) {
            try {
                this.stateExitHandlers.get(oldState)(oldState, newState, context);
            } catch (error) {
                console.error(`🔄 StateMachine: Error in exit handler for ${oldState}:`, error);
            }
        }
        
        // Execute transition handler
        const transitionKey = `${oldState}->${newState}`;
        if (this.transitionHandlers.has(transitionKey)) {
            try {
                this.transitionHandlers.get(transitionKey)(oldState, newState, context);
            } catch (error) {
                console.error(`🔄 StateMachine: Error in transition handler for ${transitionKey}:`, error);
            }
        }
        
        // Execute enter handler for new state
        if (this.stateEnterHandlers.has(newState)) {
            try {
                this.stateEnterHandlers.get(newState)(oldState, newState, context);
            } catch (error) {
                console.error(`🔄 StateMachine: Error in enter handler for ${newState}:`, error);
            }
        }
        
        // Publish state change event
        this.eventBus.publish(this.eventBus.eventTypes.GAME_STATE, {
            type: 'state_change',
            oldState,
            newState,
            context,
            metadata: this.getStateMetadata(newState)
        }, { source: 'StateMachine' });
        
        console.log(`🔄 StateMachine: Transitioned from ${oldState} to ${newState}`);
        return true;
    }
    
    /**
     * Check if a transition is valid
     * @param {string} fromState - Source state
     * @param {string} toState - Target state
     * @returns {boolean} Whether the transition is valid
     */
    isValidTransition(fromState, toState) {
        if (!fromState) {
            // First transition from null is always allowed to IDLE
            return toState === this.states.IDLE;
        }
        
        const allowedTransitions = this.validTransitions.get(fromState);
        return allowedTransitions && allowedTransitions.includes(toState);
    }
    
    /**
     * Check state guards for a target state
     * @param {string} state - Target state
     * @param {Object} context - Transition context
     * @returns {boolean} Whether the guard allows the transition
     */
    checkStateGuards(state, context) {
        const guards = this.stateGuards.get(state);
        if (!guards) {
            return true;
        }
        
        for (const guard of guards) {
            try {
                if (!guard(state, context)) {
                    return false;
                }
            } catch (error) {
                console.error(`🔄 StateMachine: Error in state guard for ${state}:`, error);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Add a guard for a state
     * @param {string} state - State to guard
     * @param {Function} guard - Guard function
     */
    addStateGuard(state, guard) {
        if (!this.stateGuards.has(state)) {
            this.stateGuards.set(state, []);
        }
        this.stateGuards.get(state).push(guard);
    }
    
    /**
     * Add an enter handler for a state
     * @param {string} state - State
     * @param {Function} handler - Enter handler function
     */
    addStateEnterHandler(state, handler) {
        this.stateEnterHandlers.set(state, handler);
    }
    
    /**
     * Add an exit handler for a state
     * @param {string} state - State
     * @param {Function} handler - Exit handler function
     */
    addStateExitHandler(state, handler) {
        this.stateExitHandlers.set(state, handler);
    }
    
    /**
     * Add a transition handler
     * @param {string} fromState - Source state
     * @param {string} toState - Target state
     * @param {Function} handler - Transition handler function
     */
    addTransitionHandler(fromState, toState, handler) {
        const transitionKey = `${fromState}->${toState}`;
        this.transitionHandlers.set(transitionKey, handler);
    }
    
    /**
     * Get current state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.currentState;
    }
    
    /**
     * Get previous state
     * @returns {string} Previous state
     */
    getPreviousState() {
        return this.previousState;
    }
    
    /**
     * Get state metadata
     * @param {string} state - State
     * @returns {Object} State metadata
     */
    getStateMetadata(state) {
        return this.stateMetadata.get(state) || {};
    }
    
    /**
     * Get current state metadata
     * @returns {Object} Current state metadata
     */
    getCurrentStateMetadata() {
        return this.getStateMetadata(this.currentState);
    }
    
    /**
     * Check if current state can submit
     * @returns {boolean} Whether current state can submit
     */
    canSubmit() {
        const metadata = this.getCurrentStateMetadata();
        return metadata.canSubmit || false;
    }
    
    /**
     * Check if current state can cancel
     * @returns {boolean} Whether current state can cancel
     */
    canCancel() {
        const metadata = this.getCurrentStateMetadata();
        return metadata.canCancel || false;
    }
    
    /**
     * Check if current state can undo
     * @returns {boolean} Whether current state can undo
     */
    canUndo() {
        const metadata = this.getCurrentStateMetadata();
        return metadata.canUndo || false;
    }
    
    /**
     * Get state history
     * @param {Object} filters - Filters to apply
     * @returns {Array} Filtered state history
     */
    getStateHistory(filters = {}) {
        let history = [...this.stateHistory];
        
        if (filters.fromState) {
            history = history.filter(entry => entry.from === filters.fromState);
        }
        
        if (filters.toState) {
            history = history.filter(entry => entry.to === filters.toState);
        }
        
        if (filters.since) {
            history = history.filter(entry => entry.timestamp >= filters.since);
        }
        
        if (filters.limit) {
            history = history.slice(-filters.limit);
        }
        
        return history;
    }
    
    /**
     * Reset state machine to idle
     */
    reset() {
        this.transitionTo(this.states.IDLE);
        this.stateHistory = [];
        console.log('🔄 StateMachine: Reset to idle state');
    }
    
    /**
     * Force transition to a state (bypassing guards)
     * @param {string} state - Target state
     * @param {Object} context - Transition context
     * @returns {boolean} Whether the transition was successful
     */
    forceTransitionTo(state, context = {}) {
        const oldState = this.currentState;
        this.previousState = oldState;
        this.currentState = state;
        
        // Add to history with force flag
        this.stateHistory.push({
            from: oldState,
            to: state,
            timestamp: Date.now(),
            context: { ...context, forced: true }
        });
        
        // Publish state change event
        this.eventBus.publish(this.eventBus.eventTypes.GAME_STATE, {
            type: 'state_change_forced',
            oldState,
            newState: state,
            context,
            metadata: this.getStateMetadata(state)
        }, { source: 'StateMachine' });
        
        console.log(`🔄 StateMachine: Forced transition from ${oldState} to ${state}`);
        return true;
    }
    
    /**
     * Setup event subscriptions
     */
    setupEventSubscriptions() {
        // Listen to placement events
        this.eventBus.subscribe(this.eventBus.eventTypes.PLACEMENT, (event) => {
            this.handlePlacementEvent(event);
        });
        
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
     * Handle placement events
     * @param {Object} event - Placement event
     */
    handlePlacementEvent(event) {
        const { type, data } = event;
        
        switch (type) {
            case 'cell_selected':
                if (this.currentState === this.states.IDLE) {
                    this.transitionTo(this.states.CELL_SELECTED, data);
                }
                break;
                
            case 'direction_selected':
                if (this.currentState === this.states.CELL_SELECTED) {
                    this.transitionTo(this.states.DIRECTION_SELECTED, data);
                }
                break;
                
            case 'word_changed':
                if (this.currentState === this.states.DIRECTION_SELECTED) {
                    this.transitionTo(this.states.WORD_ENTRY, data);
                }
                break;
                
            case 'placement_canceled':
                this.transitionTo(this.states.IDLE, data);
                break;
        }
    }
    
    /**
     * Handle validation events
     * @param {Object} event - Validation event
     */
    handleValidationEvent(event) {
        const { type, data } = event;
        
        switch (type) {
            case 'validation_started':
                if (this.currentState === this.states.WORD_ENTRY) {
                    this.transitionTo(this.states.VALIDATING, data);
                }
                break;
                
            case 'validation_completed':
                if (this.currentState === this.states.VALIDATING) {
                    if (data.valid) {
                        this.transitionTo(this.states.SUBMITTING, data);
                    } else {
                        this.transitionTo(this.states.WORD_ENTRY, data);
                    }
                }
                break;
                
            case 'validation_error':
                if (this.currentState === this.states.VALIDATING) {
                    this.transitionTo(this.states.ERROR, data);
                }
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
                if (this.currentState === this.states.SUBMITTING) {
                    this.transitionTo(this.states.IDLE, data);
                }
                break;
                
            case 'submit_failed':
                if (this.currentState === this.states.SUBMITTING) {
                    this.transitionTo(this.states.ERROR, data);
                }
                break;
                
            case 'error_dismissed':
                if (this.currentState === this.states.ERROR) {
                    this.transitionTo(this.states.WORD_ENTRY, data);
                }
                break;
        }
    }
}

// Create global state machine instance with initialization guard
function initializeStateMachine() {
    if (window.eventBus) {
        window.placementStateMachine = new PlacementStateMachine(window.eventBus);
        console.log('🔄 StateMachine: Initialized successfully');
    } else {
        console.error('🔄 StateMachine: EventBus not available for initialization');
        // Retry after a short delay
        setTimeout(initializeStateMachine, 100);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStateMachine);
} else {
    initializeStateMachine();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlacementStateMachine, placementStateMachine: window.placementStateMachine };
}
