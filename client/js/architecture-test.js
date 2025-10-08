// Phase 2 Architecture Integration Test
class ArchitectureTest {
    constructor() {
        this.testResults = [];
        this.passedTests = 0;
        this.failedTests = 0;
    }
    
    /**
     * Run all architecture tests
     * @returns {Object} Test results
     */
    async runAllTests() {
        console.log('🧪 Starting Phase 2 Architecture Integration Tests...');
        
        // Test EventBus
        await this.testEventBus();
        
        // Test State Machine
        await this.testStateMachine();
        
        // Test Validation Pipeline
        await this.testValidationPipeline();
        
        // Test Placement State
        await this.testPlacementState();
        
        // Test Error Handler
        await this.testErrorHandler();
        
        // Test Integration
        await this.testIntegration();
        
        this.printResults();
        return this.getResults();
    }
    
    /**
     * Test EventBus functionality
     */
    async testEventBus() {
        console.log('📡 Testing EventBus...');
        
        try {
            // Test basic publish/subscribe
            let received = false;
            const subscription = window.eventBus.subscribe('test-event', (event) => {
                received = true;
                this.assert(event.data === 'test-data', 'EventBus: Basic publish/subscribe');
            });
            
            window.eventBus.publish('test-event', 'test-data');
            this.assert(received, 'EventBus: Event received');
            
            // Test unsubscribe
            received = false;
            subscription.unsubscribe();
            window.eventBus.publish('test-event', 'test-data-2');
            this.assert(!received, 'EventBus: Unsubscribe works');
            
            // Test event history
            const history = window.eventBus.getHistory({ eventType: 'test-event' });
            this.assert(history.length > 0, 'EventBus: Event history tracking');
            
            // Test metrics
            const metrics = window.eventBus.getMetrics();
            this.assert(metrics.totalEvents > 0, 'EventBus: Metrics tracking');
            
            this.recordTest('EventBus', true);
            
        } catch (error) {
            console.error('EventBus test failed:', error);
            this.recordTest('EventBus', false, error.message);
        }
    }
    
    /**
     * Test State Machine functionality
     */
    async testStateMachine() {
        console.log('🔄 Testing State Machine...');
        
        try {
            const stateMachine = window.placementStateMachine;
            
            // Test initial state
            this.assert(stateMachine.getCurrentState() === 'idle', 'StateMachine: Initial state');
            
            // Test state transition
            const success = stateMachine.transitionTo('cell_selected', { row: 7, col: 7 });
            this.assert(success, 'StateMachine: Valid transition');
            this.assert(stateMachine.getCurrentState() === 'cell_selected', 'StateMachine: State changed');
            
            // Test invalid transition
            const invalidSuccess = stateMachine.transitionTo('submitting');
            this.assert(!invalidSuccess, 'StateMachine: Invalid transition rejected');
            
            // Test state metadata
            const metadata = stateMachine.getCurrentStateMetadata();
            this.assert(metadata && metadata.name === 'Cell Selected', 'StateMachine: State metadata');
            
            // Test state history
            const history = stateMachine.getStateHistory();
            this.assert(history.length > 0, 'StateMachine: State history');
            
            // Reset for next tests
            stateMachine.reset();
            
            this.recordTest('StateMachine', true);
            
        } catch (error) {
            console.error('StateMachine test failed:', error);
            this.recordTest('StateMachine', false, error.message);
        }
    }
    
    /**
     * Test Validation Pipeline functionality
     */
    async testValidationPipeline() {
        console.log('✅ Testing Validation Pipeline...');
        
        try {
            const pipeline = window.validationPipeline;
            
            // Test validator registration
            let validatorCalled = false;
            pipeline.registerValidator('test-validator', () => {
                validatorCalled = true;
                return { valid: true };
            });
            
            // Test pipeline creation
            const testPipeline = pipeline.createPipeline('test-pipeline', ['test-validator']);
            this.assert(testPipeline && testPipeline.name === 'test-pipeline', 'ValidationPipeline: Pipeline creation');
            
            // Test pipeline execution
            const result = await pipeline.executePipeline('test-pipeline', {});
            this.assert(result.valid === true, 'ValidationPipeline: Pipeline execution');
            this.assert(validatorCalled, 'ValidationPipeline: Validator called');
            
            // Test built-in validators
            const boundaryResult = await pipeline.executePipeline('turn_validation', {
                word: 'TEST',
                startRow: 0,
                startCol: 0,
                direction: 'across'
            });
            this.assert(boundaryResult.valid === true, 'ValidationPipeline: Boundary validator');
            
            this.recordTest('ValidationPipeline', true);
            
        } catch (error) {
            console.error('ValidationPipeline test failed:', error);
            this.recordTest('ValidationPipeline', false, error.message);
        }
    }
    
    /**
     * Test Placement State functionality
     */
    async testPlacementState() {
        console.log('📍 Testing Placement State...');
        
        try {
            const placementState = window.placementState;
            
            // Test state get/set
            placementState.set('currentWord', 'TEST');
            this.assert(placementState.get('currentWord') === 'TEST', 'PlacementState: Basic get/set');
            
            // Test state validation
            const invalidSet = placementState.set('currentWord', 'invalid123');
            this.assert(!invalidSet, 'PlacementState: State validation');
            
            // Test state reset
            placementState.reset();
            this.assert(placementState.get('currentWord') === '', 'PlacementState: Reset');
            
            // Test state completion check
            placementState.setMultiple({
                'selectedCell': { row: 7, col: 7 },
                'wordDirection': 'across',
                'currentWord': 'HELLO'
            });
            this.assert(placementState.isPlacementComplete(), 'PlacementState: Completion check');
            
            // Test state change handlers
            let handlerCalled = false;
            placementState.addStateChangeHandler('currentWord', () => {
                handlerCalled = true;
            });
            placementState.set('currentWord', 'WORLD');
            this.assert(handlerCalled, 'PlacementState: State change handlers');
            
            this.recordTest('PlacementState', true);
            
        } catch (error) {
            console.error('PlacementState test failed:', error);
            this.recordTest('PlacementState', false, error.message);
        }
    }
    
    /**
     * Test Error Handler functionality
     */
    async testErrorHandler() {
        console.log('🛡️ Testing Error Handler...');
        
        try {
            const errorHandler = window.errorHandler;
            
            // Test error handling
            const result = await errorHandler.handleError('Test error', { context: 'test' });
            this.assert(result && result.userMessage, 'ErrorHandler: Basic error handling');
            
            // Test error history
            const history = errorHandler.getErrorHistory();
            this.assert(history.length > 0, 'ErrorHandler: Error history');
            
            // Test error statistics
            const stats = errorHandler.getErrorStatistics();
            this.assert(stats.total > 0, 'ErrorHandler: Error statistics');
            
            // Test strategy registration
            errorHandler.registerStrategy('test-strategy', () => {
                return { canRecover: true, userMessage: 'Test strategy' };
            });
            
            const strategyResult = await errorHandler.handleError('Test strategy error', {}, { strategy: 'test-strategy' });
            this.assert(strategyResult.strategy === 'test-strategy', 'ErrorHandler: Custom strategy');
            
            this.recordTest('ErrorHandler', true);
            
        } catch (error) {
            console.error('ErrorHandler test failed:', error);
            this.recordTest('ErrorHandler', false, error.message);
        }
    }
    
    /**
     * Test integration between components
     */
    async testIntegration() {
        console.log('🔗 Testing Integration...');
        
        try {
            // Test EventBus integration
            let integrationEventReceived = false;
            window.eventBus.subscribe(window.eventBus.eventTypes.PLACEMENT, (event) => {
                if (event.type === 'state_changed') {
                    integrationEventReceived = true;
                }
            });
            
            // Trigger placement state change
            window.placementState.set('currentWord', 'INTEGRATION');
            this.assert(integrationEventReceived, 'Integration: EventBus + PlacementState');
            
            // Test State Machine integration
            let stateChangeEventReceived = false;
            window.eventBus.subscribe(window.eventBus.eventTypes.GAME_STATE, (event) => {
                if (event.type === 'state_change') {
                    stateChangeEventReceived = true;
                }
            });
            
            window.placementStateMachine.transitionTo('cell_selected', { row: 7, col: 7 });
            this.assert(stateChangeEventReceived, 'Integration: StateMachine + EventBus');
            
            // Test Validation Pipeline integration
            let validationEventReceived = false;
            window.eventBus.subscribe(window.eventBus.eventTypes.VALIDATION, (event) => {
                if (event.type === 'validation_completed') {
                    validationEventReceived = true;
                }
            });
            
            await window.validationPipeline.executePipeline('turn_validation', {
                word: 'INTEGRATION',
                startRow: 7,
                startCol: 7,
                direction: 'across',
                boardState: Array(15).fill(null).map(() => Array(15).fill(null)),
                tileSupply: {},
                newPlacements: []
            });
            this.assert(validationEventReceived, 'Integration: ValidationPipeline + EventBus');
            
            this.recordTest('Integration', true);
            
        } catch (error) {
            console.error('Integration test failed:', error);
            this.recordTest('Integration', false, error.message);
        }
    }
    
    /**
     * Assert a condition and record result
     * @param {boolean} condition - Condition to test
     * @param {string} message - Test description
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
        console.log(`  ✅ ${message}`);
    }
    
    /**
     * Record test result
     * @param {string} testName - Test name
     * @param {boolean} passed - Whether test passed
     * @param {string} error - Error message if failed
     */
    recordTest(testName, passed, error = null) {
        this.testResults.push({
            name: testName,
            passed,
            error,
            timestamp: Date.now()
        });
        
        if (passed) {
            this.passedTests++;
            console.log(`✅ ${testName} PASSED`);
        } else {
            this.failedTests++;
            console.log(`❌ ${testName} FAILED: ${error}`);
        }
    }
    
    /**
     * Print test results summary
     */
    printResults() {
        console.log('\n📊 Phase 2 Architecture Test Results:');
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`Passed: ${this.passedTests}`);
        console.log(`Failed: ${this.failedTests}`);
        console.log(`Success Rate: ${((this.passedTests / this.testResults.length) * 100).toFixed(1)}%`);
        
        if (this.failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(test => !test.passed).forEach(test => {
                console.log(`  - ${test.name}: ${test.error}`);
            });
        }
    }
    
    /**
     * Get test results
     * @returns {Object} Test results
     */
    getResults() {
        return {
            total: this.testResults.length,
            passed: this.passedTests,
            failed: this.failedTests,
            successRate: (this.passedTests / this.testResults.length) * 100,
            results: this.testResults
        };
    }
}

// Auto-run tests when page loads (if in development mode)
function runArchitectureTests() {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        // Wait for all components to be available
        const waitForComponents = () => {
            if (window.eventBus && 
                window.placementStateMachine && 
                window.placementState && 
                window.validationPipeline && 
                window.errorHandler) {
                
                // Components are ready, run tests
                setTimeout(async () => {
                    console.log('🧪 All Phase 2 components detected, running integration tests...');
                    const test = new ArchitectureTest();
                    await test.runAllTests();
                    
                    // Make results available globally for debugging
                    window.architectureTestResults = test.getResults();
                }, 500);
            } else {
                // Components not ready yet, wait and retry
                console.log('🧪 Waiting for Phase 2 components to initialize...');
                setTimeout(waitForComponents, 200);
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForComponents);
        } else {
            waitForComponents();
        }
    }
}

// Initialize test runner
runArchitectureTests();

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArchitectureTest };
}
