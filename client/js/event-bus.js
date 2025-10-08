// Event-driven architecture backbone for Scrabble Scorer
class EventBus {
    constructor(options = {}) {
        this.handlers = new Map();
        this.eventHistory = [];
        this.maxHistorySize = options.maxHistorySize || 1000;
        this.debugMode = options.debugMode || false;
        this.eventTypes = {
            GAME_STATE: 'gameState',
            PLACEMENT: 'placement',
            VALIDATION: 'validation',
            UI: 'ui',
            NETWORK: 'network',
            ERROR: 'error'
        };
        
        // Performance tracking
        this.metrics = {
            totalEvents: 0,
            eventCounts: new Map(),
            averageProcessingTime: 0,
            slowEvents: []
        };
    }

    /**
     * Subscribe to an event type with a handler function
     * @param {string} eventType - The event type to subscribe to
     * @param {Function} handler - The handler function
     * @param {Object} options - Subscription options
     * @returns {Object} Subscription object with unsubscribe method
     */
    subscribe(eventType, handler, options = {}) {
        if (typeof handler !== 'function') {
            throw new Error('Event handler must be a function');
        }

        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }

        const subscription = {
            id: this.generateSubscriptionId(),
            handler,
            options: {
                once: options.once || false,
                priority: options.priority || 0,
                context: options.context || null
            }
        };

        this.handlers.get(eventType).add(subscription);

        if (this.debugMode) {
            console.log(`📡 EventBus: Subscribed to ${eventType} with ID ${subscription.id}`);
        }

        return {
            unsubscribe: () => this.unsubscribe(eventType, subscription.id)
        };
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventType - The event type
     * @param {string} subscriptionId - The subscription ID
     */
    unsubscribe(eventType, subscriptionId) {
        if (!this.handlers.has(eventType)) {
            return false;
        }

        const subscriptions = this.handlers.get(eventType);
        for (const subscription of subscriptions) {
            if (subscription.id === subscriptionId) {
                subscriptions.delete(subscription);
                
                if (subscriptions.size === 0) {
                    this.handlers.delete(eventType);
                }

                if (this.debugMode) {
                    console.log(`📡 EventBus: Unsubscribed from ${eventType} with ID ${subscriptionId}`);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Publish an event to all subscribers
     * @param {string} eventType - The event type
     * @param {*} data - The event data
     * @param {Object} metadata - Additional event metadata
     */
    publish(eventType, data, metadata = {}) {
        const startTime = performance.now();
        
        const event = {
            id: this.generateEventId(),
            type: eventType,
            data,
            metadata: {
                timestamp: Date.now(),
                source: metadata.source || 'unknown',
                ...metadata
            }
        };

        // Update metrics
        this.metrics.totalEvents++;
        this.metrics.eventCounts.set(eventType, (this.metrics.eventCounts.get(eventType) || 0) + 1);

        // Add to history
        this.addToHistory(event);

        if (this.debugMode) {
            console.log(`📡 EventBus: Publishing ${eventType}`, event);
        }

        // Get handlers for this event type
        const subscriptions = this.handlers.get(eventType);
        if (!subscriptions || subscriptions.size === 0) {
            if (this.debugMode) {
                console.log(`📡 EventBus: No handlers for ${eventType}`);
            }
            return;
        }

        // Sort handlers by priority (higher priority first)
        const sortedSubscriptions = Array.from(subscriptions).sort((a, b) => 
            b.options.priority - a.options.priority
        );

        // Execute handlers
        const handlersToRemove = [];
        for (const subscription of sortedSubscriptions) {
            try {
                const context = subscription.options.context || this;
                subscription.handler.call(context, event);

                // Remove 'once' handlers after execution
                if (subscription.options.once) {
                    handlersToRemove.push(subscription.id);
                }
            } catch (error) {
                console.error(`📡 EventBus: Error in handler for ${eventType}:`, error);
                this.publish(this.eventTypes.ERROR, {
                    error,
                    eventType,
                    handlerId: subscription.id
                }, { source: 'EventBus' });
            }
        }

        // Remove 'once' handlers
        for (const id of handlersToRemove) {
            this.unsubscribe(eventType, id);
        }

        // Update performance metrics
        const processingTime = performance.now() - startTime;
        this.updatePerformanceMetrics(eventType, processingTime);

        if (this.debugMode) {
            console.log(`📡 EventBus: Processed ${eventType} in ${processingTime.toFixed(2)}ms`);
        }
    }

    /**
     * Subscribe to multiple event types at once
     * @param {Object} eventHandlers - Map of event types to handlers
     * @param {Object} options - Subscription options
     * @returns {Array} Array of subscription objects
     */
    subscribeMultiple(eventHandlers, options = {}) {
        const subscriptions = [];
        
        for (const [eventType, handler] of Object.entries(eventHandlers)) {
            subscriptions.push(this.subscribe(eventType, handler, options));
        }
        
        return subscriptions;
    }

    /**
     * Publish multiple events in sequence
     * @param {Array} events - Array of event objects {type, data, metadata}
     */
    publishMultiple(events) {
        for (const event of events) {
            this.publish(event.type, event.data, event.metadata);
        }
    }

    /**
     * Get event history
     * @param {Object} filters - Filters to apply to history
     * @returns {Array} Filtered event history
     */
    getHistory(filters = {}) {
        let history = [...this.eventHistory];
        
        if (filters.eventType) {
            history = history.filter(event => event.type === filters.eventType);
        }
        
        if (filters.since) {
            history = history.filter(event => event.metadata.timestamp >= filters.since);
        }
        
        if (filters.limit) {
            history = history.slice(-filters.limit);
        }
        
        return history;
    }

    /**
     * Clear event history
     * @param {Object} filters - Optional filters for selective clearing
     */
    clearHistory(filters = {}) {
        if (Object.keys(filters).length === 0) {
            this.eventHistory = [];
        } else {
            this.eventHistory = this.eventHistory.filter(event => {
                if (filters.eventType && event.type === filters.eventType) {
                    return false;
                }
                if (filters.olderThan && event.metadata.timestamp < filters.olderThan) {
                    return false;
                }
                return true;
            });
        }
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            averageProcessingTime: this.metrics.averageProcessingTime.toFixed(2),
            handlerCounts: new Map(
                Array.from(this.handlers.entries()).map(([type, handlers]) => [type, handlers.size])
            )
        };
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.metrics = {
            totalEvents: 0,
            eventCounts: new Map(),
            averageProcessingTime: 0,
            slowEvents: []
        };
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`📡 EventBus: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get all active subscriptions
     * @returns {Object} Map of event types to subscription counts
     */
    getActiveSubscriptions() {
        const result = {};
        for (const [eventType, subscriptions] of this.handlers.entries()) {
            result[eventType] = subscriptions.size;
        }
        return result;
    }

    /**
     * Remove all subscriptions (useful for testing)
     */
    clearAllSubscriptions() {
        this.handlers.clear();
        if (this.debugMode) {
            console.log('📡 EventBus: All subscriptions cleared');
        }
    }

    // Private methods

    /**
     * Generate a unique subscription ID
     * @returns {string} Unique subscription ID
     */
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate a unique event ID
     * @returns {string} Unique event ID
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add event to history with size limit
     * @param {Object} event - The event to add
     */
    addToHistory(event) {
        this.eventHistory.push(event);
        
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Update performance metrics
     * @param {string} eventType - The event type
     * @param {number} processingTime - Time taken to process
     */
    updatePerformanceMetrics(eventType, processingTime) {
        // Update average processing time
        const totalEvents = this.metrics.totalEvents;
        const currentAvg = this.metrics.averageProcessingTime;
        this.metrics.averageProcessingTime = (currentAvg * (totalEvents - 1) + processingTime) / totalEvents;

        // Track slow events (> 10ms)
        if (processingTime > 10) {
            this.metrics.slowEvents.push({
                eventType,
                processingTime,
                timestamp: Date.now()
            });
            
            // Keep only last 50 slow events
            if (this.metrics.slowEvents.length > 50) {
                this.metrics.slowEvents.shift();
            }
        }
    }
}

// Create global event bus instance
window.eventBus = new EventBus({
    debugMode: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    maxHistorySize: 500
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBus, eventBus: window.eventBus };
}
