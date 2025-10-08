// Error handling system for Scrabble Scorer
class ErrorHandler {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.errorTypes = {
            BLOCKING: 'blocking',
            WARNING: 'warning',
            INFO: 'info',
            NETWORK: 'network'
        };
        
        this.errorCategories = {
            VALIDATION: 'validation',
            PLACEMENT: 'placement',
            NETWORK: 'network',
            UI: 'ui',
            GAME_STATE: 'game_state',
            SYSTEM: 'system'
        };
        
        // Error history
        this.errorHistory = [];
        this.maxHistorySize = 100;
        
        // Error handling strategies
        this.strategies = new Map();
        this.defaultStrategies = new Map();
        
        // Error recovery mechanisms
        this.recoveryMechanisms = new Map();
        
        // Setup default strategies and recovery mechanisms
        this.setupDefaultStrategies();
        this.setupRecoveryMechanisms();
        
        // Subscribe to error events
        this.setupEventSubscriptions();
    }
    
    /**
     * Handle an error
     * @param {Error|Object} error - Error object or error data
     * @param {Object} context - Error context
     * @param {Object} options - Error handling options
     * @returns {Promise<Object>} Error handling result
     */
    async handleError(error, context = {}, options = {}) {
        const errorData = this.normalizeError(error, context);
        
        // Add to history
        this.addToHistory(errorData);
        
        // Log error
        this.logError(errorData);
        
        // Publish error event
        this.eventBus.publish(this.eventBus.eventTypes.ERROR, {
            type: 'error_occurred',
            error: errorData,
            context,
            options
        }, { source: 'ErrorHandler' });
        
        // Determine handling strategy
        const strategy = this.determineStrategy(errorData, options);
        
        // Execute strategy
        const result = await this.executeStrategy(strategy, errorData, context, options);
        
        // Attempt recovery if possible
        if (result.canRecover) {
            const recoveryResult = await this.attemptRecovery(errorData, context, options);
            result.recovery = recoveryResult;
        }
        
        return result;
    }
    
    /**
     * Normalize error to standard format
     * @param {Error|Object} error - Error object or error data
     * @param {Object} context - Error context
     * @returns {Object} Normalized error data
     */
    normalizeError(error, context) {
        const timestamp = Date.now();
        const id = this.generateErrorId();
        
        if (error instanceof Error) {
            return {
                id,
                timestamp,
                type: this.errorTypes.BLOCKING,
                category: this.errorCategories.SYSTEM,
                message: error.message,
                originalError: error,
                stack: error.stack,
                context,
                severity: this.determineSeverity(error, context)
            };
        } else if (typeof error === 'object' && error !== null) {
            return {
                id,
                timestamp,
                type: error.type || this.errorTypes.BLOCKING,
                category: error.category || this.errorCategories.SYSTEM,
                message: error.message || 'Unknown error',
                data: error.data || {},
                originalError: error,
                context,
                severity: error.severity || this.determineSeverity(error, context)
            };
        } else {
            return {
                id,
                timestamp,
                type: this.errorTypes.BLOCKING,
                category: this.errorCategories.SYSTEM,
                message: String(error),
                originalError: error,
                context,
                severity: this.determineSeverity(error, context)
            };
        }
    }
    
    /**
     * Determine error severity
     * @param {*} error - Error object or data
     * @param {Object} context - Error context
     * @returns {string} Error severity
     */
    determineSeverity(error, context) {
        // Network errors are usually less severe
        if (error.category === this.errorCategories.NETWORK) {
            return 'medium';
        }
        
        // Validation errors are typically user-correctable
        if (error.category === this.errorCategories.VALIDATION) {
            return 'low';
        }
        
        // System errors are more severe
        if (error.category === this.errorCategories.SYSTEM) {
            return 'high';
        }
        
        // Default to medium
        return 'medium';
    }
    
    /**
     * Determine error handling strategy
     * @param {Object} errorData - Normalized error data
     * @param {Object} options - Handling options
     * @returns {string} Strategy name
     */
    determineStrategy(errorData, options) {
        // Check for explicit strategy in options
        if (options.strategy) {
            return options.strategy;
        }
        
        // Check for registered strategy for this error type/category
        const strategyKey = `${errorData.category}_${errorData.type}`;
        if (this.strategies.has(strategyKey)) {
            return strategyKey;
        }
        
        // Check for category-specific strategy
        if (this.strategies.has(errorData.category)) {
            return errorData.category;
        }
        
        // Check for type-specific strategy
        if (this.strategies.has(errorData.type)) {
            return errorData.type;
        }
        
        // Check if we have a default strategy for this type that actually exists
        const defaultStrategy = this.defaultStrategies.get(errorData.type);
        if (defaultStrategy && this.strategies.has(defaultStrategy)) {
            return defaultStrategy;
        }
        
        // Use 'default' strategy (handled by executeDefaultStrategy)
        return 'default';
    }
    
    /**
     * Execute error handling strategy
     * @param {string} strategy - Strategy name
     * @param {Object} errorData - Error data
     * @param {Object} context - Error context
     * @param {Object} options - Handling options
     * @returns {Promise<Object>} Strategy execution result
     */
    async executeStrategy(strategy, errorData, context, options) {
        // Handle 'default' strategy directly
        if (strategy === 'default') {
            return this.executeDefaultStrategy(errorData, context, options);
        }
        
        const strategyFunction = this.strategies.get(strategy);
        
        if (!strategyFunction) {
            console.warn(`⚠️ ErrorHandler: Unknown strategy '${strategy}', using default`);
            return this.executeDefaultStrategy(errorData, context, options);
        }
        
        try {
            const result = await strategyFunction(errorData, context, options);
            return {
                strategy,
                success: true,
                canRecover: result.canRecover || false,
                userMessage: result.userMessage || errorData.message,
                technicalMessage: result.technicalMessage || errorData.message,
                actions: result.actions || [],
                ...result
            };
        } catch (strategyError) {
            console.error(`⚠️ ErrorHandler: Strategy '${strategy}' failed:`, strategyError);
            return this.executeDefaultStrategy(errorData, context, options);
        }
    }
    
    /**
     * Execute default error handling strategy
     * @param {Object} errorData - Error data
     * @param {Object} context - Error context
     * @param {Object} options - Handling options
     * @returns {Object} Default strategy result
     */
    executeDefaultStrategy(errorData, context, options) {
        const userMessages = {
            [this.errorTypes.BLOCKING]: 'An error occurred. Please try again.',
            [this.errorTypes.WARNING]: 'Warning: ' + errorData.message,
            [this.errorTypes.INFO]: errorData.message,
            [this.errorTypes.NETWORK]: 'Network error. Please check your connection.'
        };
        
        return {
            strategy: 'default',
            success: true,
            canRecover: errorData.type !== this.errorTypes.BLOCKING,
            userMessage: userMessages[errorData.type] || errorData.message,
            technicalMessage: errorData.message,
            actions: this.getDefaultActions(errorData)
        };
    }
    
    /**
     * Get default actions for an error
     * @param {Object} errorData - Error data
     * @returns {Array} Default actions
     */
    getDefaultActions(errorData) {
        const actions = [];
        
        switch (errorData.type) {
            case this.errorTypes.BLOCKING:
                actions.push({
                    type: 'retry',
                    label: 'Retry',
                    action: 'retry'
                });
                break;
                
            case this.errorTypes.WARNING:
                actions.push({
                    type: 'acknowledge',
                    label: 'OK',
                    action: 'acknowledge'
                });
                break;
                
            case this.errorTypes.NETWORK:
                actions.push({
                    type: 'retry',
                    label: 'Retry',
                    action: 'retry'
                });
                actions.push({
                    type: 'offline_mode',
                    label: 'Work Offline',
                    action: 'offline_mode'
                });
                break;
        }
        
        return actions;
    }
    
    /**
     * Attempt error recovery
     * @param {Object} errorData - Error data
     * @param {Object} context - Error context
     * @param {Object} options - Recovery options
     * @returns {Promise<Object>} Recovery result
     */
    async attemptRecovery(errorData, context, options) {
        const recoveryKey = `${errorData.category}_${errorData.type}`;
        const recoveryMechanism = this.recoveryMechanisms.get(recoveryKey) ||
                               this.recoveryMechanisms.get(errorData.category);
        
        if (!recoveryMechanism) {
            return {
                attempted: false,
                reason: 'No recovery mechanism available'
            };
        }
        
        try {
            const result = await recoveryMechanism(errorData, context, options);
            return {
                attempted: true,
                success: result.success || false,
                message: result.message || 'Recovery attempted',
                data: result.data || {}
            };
        } catch (recoveryError) {
            console.error('⚠️ ErrorHandler: Recovery mechanism failed:', recoveryError);
            return {
                attempted: true,
                success: false,
                reason: recoveryError.message
            };
        }
    }
    
    /**
     * Register an error handling strategy
     * @param {string} name - Strategy name
     * @param {Function} strategy - Strategy function
     */
    registerStrategy(name, strategy) {
        this.strategies.set(name, strategy);
        console.log(`🛡️ ErrorHandler: Registered strategy '${name}'`);
    }
    
    /**
     * Register a recovery mechanism
     * @param {string} key - Recovery key (category_type or category)
     * @param {Function} mechanism - Recovery mechanism function
     */
    registerRecoveryMechanism(key, mechanism) {
        this.recoveryMechanisms.set(key, mechanism);
        console.log(`🛡️ ErrorHandler: Registered recovery mechanism '${key}'`);
    }
    
    /**
     * Get error history
     * @param {Object} filters - Filters to apply
     * @returns {Array} Filtered error history
     */
    getErrorHistory(filters = {}) {
        let history = [...this.errorHistory];
        
        if (filters.type) {
            history = history.filter(error => error.type === filters.type);
        }
        
        if (filters.category) {
            history = history.filter(error => error.category === filters.category);
        }
        
        if (filters.severity) {
            history = history.filter(error => error.severity === filters.severity);
        }
        
        if (filters.since) {
            history = history.filter(error => error.timestamp >= filters.since);
        }
        
        if (filters.limit) {
            history = history.slice(-filters.limit);
        }
        
        return history;
    }
    
    /**
     * Clear error history
     * @param {Object} filters - Optional filters for selective clearing
     */
    clearErrorHistory(filters = {}) {
        if (Object.keys(filters).length === 0) {
            this.errorHistory = [];
        } else {
            this.errorHistory = this.errorHistory.filter(error => {
                if (filters.type && error.type === filters.type) return false;
                if (filters.category && error.category === filters.category) return false;
                if (filters.severity && error.severity === filters.severity) return false;
                if (filters.olderThan && error.timestamp < filters.olderThan) return false;
                return true;
            });
        }
    }
    
    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStatistics() {
        const stats = {
            total: this.errorHistory.length,
            byType: {},
            byCategory: {},
            bySeverity: {},
            recent: this.errorHistory.filter(e => Date.now() - e.timestamp < 3600000).length // Last hour
        };
        
        for (const error of this.errorHistory) {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
            stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
        }
        
        return stats;
    }
    
    /**
     * Setup default error handling strategies
     */
    setupDefaultStrategies() {
        // Validation error strategy
        this.registerStrategy('validation', (errorData, context, options) => {
            return {
                canRecover: true,
                userMessage: errorData.message,
                technicalMessage: `Validation failed: ${errorData.message}`,
                actions: [
                    {
                        type: 'fix_input',
                        label: 'Fix Input',
                        action: 'fix_input'
                    },
                    {
                        type: 'clear',
                        label: 'Clear',
                        action: 'clear'
                    }
                ]
            };
        });
        
        // Network error strategy
        this.registerStrategy('network', (errorData, context, options) => {
            return {
                canRecover: true,
                userMessage: 'Network connection issue. Please check your internet connection.',
                technicalMessage: `Network error: ${errorData.message}`,
                actions: [
                    {
                        type: 'retry',
                        label: 'Retry',
                        action: 'retry'
                    },
                    {
                        type: 'offline_mode',
                        label: 'Work Offline',
                        action: 'offline_mode'
                    }
                ]
            };
        });
        
        // Placement error strategy
        this.registerStrategy('placement', (errorData, context, options) => {
            return {
                canRecover: true,
                userMessage: errorData.message,
                technicalMessage: `Placement error: ${errorData.message}`,
                actions: [
                    {
                        type: 'clear_placement',
                        label: 'Clear Placement',
                        action: 'clear_placement'
                    },
                    {
                        type: 'retry',
                        label: 'Try Again',
                        action: 'retry'
                    }
                ]
            };
        });
        
        // Set default strategies by type
        this.defaultStrategies.set(this.errorTypes.BLOCKING, 'blocking');
        this.defaultStrategies.set(this.errorTypes.WARNING, 'warning');
        this.defaultStrategies.set(this.errorTypes.INFO, 'info');
        this.defaultStrategies.set(this.errorTypes.NETWORK, 'network');
    }
    
    /**
     * Setup recovery mechanisms
     */
    setupRecoveryMechanisms() {
        // Validation recovery
        this.registerRecoveryMechanism('validation', async (errorData, context, options) => {
            // Clear invalid input
            if (window.placementState) {
                window.placementState.set('currentWord', '');
                window.placementState.set('blankTileIndices', new Set());
            }
            
            return {
                success: true,
                message: 'Invalid input cleared'
            };
        });
        
        // Network recovery
        this.registerRecoveryMechanism('network', async (errorData, context, options) => {
            // Check if we're back online
            if (navigator.onLine) {
                return {
                    success: true,
                    message: 'Network connection restored'
                };
            }
            
            return {
                success: false,
                message: 'Still offline'
            };
        });
        
        // Placement recovery
        this.registerRecoveryMechanism('placement', async (errorData, context, options) => {
            // Reset placement state
            if (window.placementState) {
                window.placementState.reset();
            }
            
            return {
                success: true,
                message: 'Placement reset'
            };
        });
    }
    
    /**
     * Setup event subscriptions
     */
    setupEventSubscriptions() {
        // Listen to validation errors
        this.eventBus.subscribe(this.eventBus.eventTypes.VALIDATION, (event) => {
            if (event.type === 'validation_error') {
                this.handleError({
                    type: this.errorTypes.BLOCKING,
                    category: this.errorCategories.VALIDATION,
                    message: event.data.message || 'Validation failed',
                    data: event.data
                }, event.context);
            }
        });
        
        // Listen to network errors
        this.eventBus.subscribe(this.eventBus.eventTypes.NETWORK, (event) => {
            if (event.type === 'network_error') {
                this.handleError({
                    type: this.errorTypes.NETWORK,
                    category: this.errorCategories.NETWORK,
                    message: event.data.message || 'Network error',
                    data: event.data
                }, event.context);
            }
        });
    }
    
    /**
     * Add error to history
     * @param {Object} errorData - Error data
     */
    addToHistory(errorData) {
        this.errorHistory.push(errorData);
        
        // Keep history size manageable
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * Log error
     * @param {Object} errorData - Error data
     */
    logError(errorData) {
        const logLevel = errorData.type === this.errorTypes.BLOCKING ? 'error' : 'warn';
        console[logLevel](`🛡️ ErrorHandler [${errorData.category}/${errorData.type}]:`, errorData.message, errorData);
    }
    
    /**
     * Generate unique error ID
     * @returns {string} Error ID
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Create global error handler instance with initialization guard
function initializeErrorHandler() {
    if (window.eventBus) {
        window.errorHandler = new ErrorHandler(window.eventBus);
        console.log('🛡️ ErrorHandler: Initialized successfully');
    } else {
        console.error('🛡️ ErrorHandler: EventBus not available for initialization');
        // Retry after a short delay
        setTimeout(initializeErrorHandler, 100);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeErrorHandler);
} else {
    initializeErrorHandler();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ErrorHandler, errorHandler: window.errorHandler };
}
