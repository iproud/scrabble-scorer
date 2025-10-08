// Validation pipeline for chainable validation logic
class ValidationPipeline {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.validators = new Map();
        this.pipelines = new Map();
        this.errorTypes = {
            BLOCKING: 'blocking',
            WARNING: 'warning',
            INFO: 'info'
        };
        
        // Register built-in validators
        this.registerBuiltInValidators();
    }
    
    /**
     * Register a validator
     * @param {string} name - Validator name
     * @param {Function} validator - Validator function
     * @param {Object} options - Validator options
     */
    registerValidator(name, validator, options = {}) {
        this.validators.set(name, {
            validator,
            options: {
                type: options.type || this.errorTypes.BLOCKING,
                timeout: options.timeout || 5000,
                async: options.async || false,
                ...options
            }
        });
    }
    
    /**
     * Create a validation pipeline
     * @param {string} name - Pipeline name
     * @param {Array} validatorNames - Array of validator names
     * @param {Object} options - Pipeline options
     * @returns {Object} Pipeline object
     */
    createPipeline(name, validatorNames, options = {}) {
        const pipeline = {
            name,
            validators: validatorNames,
            options: {
                stopOnFirstError: options.stopOnFirstError !== false,
                collectAllErrors: options.collectAllErrors || false,
                timeout: options.timeout || 10000,
                ...options
            }
        };
        
        this.pipelines.set(name, pipeline);
        return pipeline;
    }
    
    /**
     * Execute a validation pipeline
     * @param {string} pipelineName - Name of pipeline to execute
     * @param {*} data - Data to validate
     * @param {Object} context - Validation context
     * @returns {Promise<Object>} Validation result
     */
    async executePipeline(pipelineName, data, context = {}) {
        const pipeline = this.pipelines.get(pipelineName);
        if (!pipeline) {
            throw new Error(`Pipeline '${pipelineName}' not found`);
        }
        
        const startTime = performance.now();
        const results = {
            valid: true,
            errors: [],
            warnings: [],
            info: [],
            metadata: {
                pipelineName,
                executionTime: 0,
                validatorsExecuted: 0,
                timestamp: Date.now()
            }
        };
        
        try {
            // Publish validation started event
            this.eventBus.publish(this.eventBus.eventTypes.VALIDATION, {
                type: 'validation_started',
                pipelineName,
                data,
                context
            }, { source: 'ValidationPipeline' });
            
            // Execute validators in sequence
            for (const validatorName of pipeline.validators) {
                const validator = this.validators.get(validatorName);
                if (!validator) {
                    console.warn(`⚠️ ValidationPipeline: Validator '${validatorName}' not found`);
                    continue;
                }
                
                try {
                    const validatorResult = await this.executeValidator(
                        validatorName, 
                        validator, 
                        data, 
                        context
                    );
                    
                    results.metadata.validatorsExecuted++;
                    
                    // Process validator result
                    if (validatorResult.valid === false) {
                        results.valid = false;
                        
                        const error = {
                            type: validator.options.type,
                            validator: validatorName,
                            message: validatorResult.message || 'Validation failed',
                            data: validatorResult.data || {},
                            context: validatorResult.context || {}
                        };
                        
                        if (validator.options.type === this.errorTypes.BLOCKING) {
                            results.errors.push(error);
                            if (pipeline.options.stopOnFirstError) {
                                break;
                            }
                        } else if (validator.options.type === this.errorTypes.WARNING) {
                            results.warnings.push(error);
                        } else {
                            results.info.push(error);
                        }
                    }
                    
                    // Add validator-specific data to result
                    if (validatorResult.data) {
                        results[validatorName] = validatorResult.data;
                    }
                    
                } catch (error) {
                    console.error(`⚠️ ValidationPipeline: Error in validator '${validatorName}':`, error);
                    
                    results.valid = false;
                    results.errors.push({
                        type: this.errorTypes.BLOCKING,
                        validator: validatorName,
                        message: `Validator error: ${error.message}`,
                        data: { originalError: error },
                        context
                    });
                    
                    if (pipeline.options.stopOnFirstError) {
                        break;
                    }
                }
            }
            
        } catch (error) {
            console.error(`⚠️ ValidationPipeline: Pipeline execution error:`, error);
            results.valid = false;
            results.errors.push({
                type: this.errorTypes.BLOCKING,
                validator: 'pipeline',
                message: `Pipeline error: ${error.message}`,
                data: { originalError: error },
                context
            });
        }
        
        // Calculate execution time
        results.metadata.executionTime = performance.now() - startTime;
        
        // Publish validation completed event
        this.eventBus.publish(this.eventBus.eventTypes.VALIDATION, {
            type: 'validation_completed',
            pipelineName,
            results,
            data,
            context
        }, { source: 'ValidationPipeline' });
        
        return results;
    }
    
    /**
     * Execute a single validator
     * @param {string} name - Validator name
     * @param {Object} validator - Validator object
     * @param {*} data - Data to validate
     * @param {Object} context - Validation context
     * @returns {Promise<Object>} Validator result
     */
    async executeValidator(name, validator, data, context) {
        const timeout = validator.options.timeout;
        
        if (validator.options.async) {
            // Async validator with timeout
            return await this.executeWithTimeout(
                validator.validator(data, context),
                timeout,
                `Validator '${name}' timed out`
            );
        } else {
            // Sync validator
            return validator.validator(data, context);
        }
    }
    
    /**
     * Execute a function with timeout
     * @param {Promise} promise - Promise to execute
     * @param {number} timeout - Timeout in milliseconds
     * @param {string} timeoutMessage - Timeout message
     * @returns {Promise} Result with timeout handling
     */
    async executeWithTimeout(promise, timeout, timeoutMessage) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(timeoutMessage)), timeout);
        });
        
        return Promise.race([promise, timeoutPromise]);
    }
    
    /**
     * Get all registered validators
     * @returns {Array} Array of validator information
     */
    getValidators() {
        return Array.from(this.validators.entries()).map(([name, validator]) => ({
            name,
            options: validator.options
        }));
    }
    
    /**
     * Get all pipelines
     * @returns {Array} Array of pipeline information
     */
    getPipelines() {
        return Array.from(this.pipelines.entries()).map(([name, pipeline]) => ({
            name,
            validators: pipeline.validators,
            options: pipeline.options
        }));
    }
    
    /**
     * Remove a validator
     * @param {string} name - Validator name
     * @returns {boolean} Whether validator was removed
     */
    removeValidator(name) {
        return this.validators.delete(name);
    }
    
    /**
     * Remove a pipeline
     * @param {string} name - Pipeline name
     * @returns {boolean} Whether pipeline was removed
     */
    removePipeline(name) {
        return this.pipelines.delete(name);
    }
    
    /**
     * Register built-in validators
     */
    registerBuiltInValidators() {
        // Boundary Validator
        this.registerValidator('boundary', (data, context) => {
            const { word, startRow, startCol, direction } = data;
            
            if (!word || startRow === null || startCol === null || !direction) {
                return {
                    valid: false,
                    message: 'Missing required placement data',
                    data: { word, startRow, startCol, direction }
                };
            }
            
            // Check if word fits within board boundaries
            const endRow = direction === 'across' ? startRow : startRow + word.length - 1;
            const endCol = direction === 'across' ? startCol + word.length - 1 : startCol;
            
            if (startRow < 0 || startCol < 0 || endRow >= 15 || endCol >= 15) {
                return {
                    valid: false,
                    message: `Word extends beyond board boundaries. End position (${endRow}, ${endCol}) is invalid.`,
                    data: { startRow, startCol, endRow, endCol, direction, wordLength: word.length }
                };
            }
            
            return { valid: true };
        }, {
            type: this.errorTypes.BLOCKING,
            timeout: 1000
        });
        
        // Connection Validator
        this.registerValidator('connection', (data, context) => {
            const { word, startRow, startCol, direction, boardState } = data;
            
            if (!boardState) {
                return {
                    valid: false,
                    message: 'Board state is required for connection validation',
                    data: {}
                };
            }
            
            // Check if board is empty
            const hasExistingTiles = boardState.some(row => row.some(cell => cell !== null));
            
            if (!hasExistingTiles) {
                // First word must cover center star
                const wordPath = [];
                for (let i = 0; i < word.length; i++) {
                    const row = direction === 'across' ? startRow : startRow + i;
                    const col = direction === 'across' ? startCol + i : startCol;
                    wordPath.push({ row, col });
                }
                
                const coversCenter = wordPath.some(p => p.row === 7 && p.col === 7);
                if (!coversCenter) {
                    return {
                        valid: false,
                        message: 'The first word must cover the center star',
                        data: { wordPath, coversCenter }
                    };
                }
            } else {
                // Subsequent words must connect to existing tiles
                let usesExistingTile = false;
                let isAdjacentToExisting = false;
                
                for (let i = 0; i < word.length; i++) {
                    const row = direction === 'across' ? startRow : startRow + i;
                    const col = direction === 'across' ? startCol + i : startCol;
                    
                    // Check if using existing tile
                    if (boardState[row] && boardState[row][col]) {
                        usesExistingTile = true;
                    }
                    
                    // Check if adjacent to existing tiles
                    const adjacentPositions = [
                        { row: row - 1, col },
                        { row: row + 1, col },
                        { row, col: col - 1 },
                        { row, col: col + 1 }
                    ];
                    
                    for (const adj of adjacentPositions) {
                        if (adj.row >= 0 && adj.row < 15 && adj.col >= 0 && adj.col < 15) {
                            if (boardState[adj.row] && boardState[adj.row][adj.col]) {
                                isAdjacentToExisting = true;
                                break;
                            }
                        }
                    }
                }
                
                if (!usesExistingTile && !isAdjacentToExisting) {
                    return {
                        valid: false,
                        message: 'New words must connect to existing words',
                        data: { usesExistingTile, isAdjacentToExisting }
                    };
                }
            }
            
            return { valid: true };
        }, {
            type: this.errorTypes.BLOCKING,
            timeout: 1000
        });
        
        // Tile Availability Validator
        this.registerValidator('tile_availability', (data, context) => {
            const { word, startRow, startCol, direction, blankIndices, tileSupply, newPlacements } = data;
            
            if (!tileSupply || !newPlacements) {
                return {
                    valid: false,
                    message: 'Tile supply and new placements are required for availability validation',
                    data: {}
                };
            }
            
            // Count required tiles for new placements only
            const requiredTiles = {};
            const actuallyNewPlacements = newPlacements.filter(p => p.isNew);
            
            for (const placement of actuallyNewPlacements) {
                const letter = placement.letter;
                const isBlank = blankIndices && blankIndices.has(placement.wordIndex);
                
                if (isBlank) {
                    requiredTiles['BLANK'] = (requiredTiles['BLANK'] || 0) + 1;
                } else {
                    requiredTiles[letter] = (requiredTiles[letter] || 0) + 1;
                }
            }
            
            // Check if required tiles are available
            const missingTiles = [];
            for (const [letter, needed] of Object.entries(requiredTiles)) {
                const available = tileSupply[letter] || 0;
                if (available < needed) {
                    missingTiles.push({
                        letter,
                        needed,
                        available,
                        shortage: needed - available
                    });
                }
            }
            
            if (missingTiles.length > 0) {
                const missingTileMessages = missingTiles.map(tile => 
                    `${tile.letter}: ${tile.shortage} needed (${tile.available} available)`
                ).join(', ');
                
                return {
                    valid: false,
                    message: `Not enough tiles in bag. Missing: ${missingTileMessages}`,
                    data: { requiredTiles, missingTiles, tileSupply }
                };
            }
            
            return { valid: true };
        }, {
            type: this.errorTypes.BLOCKING,
            timeout: 1000
        });
        
        // Word Formation Validator
        this.registerValidator('word_formation', (data, context) => {
            const { word, startRow, startCol, direction, boardState } = data;
            
            if (!word || !boardState) {
                return {
                    valid: false,
                    message: 'Word and board state are required for word formation validation',
                    data: {}
                };
            }
            
            // Check if user is trying to add letters to both sides of an existing word
            const existingWord = this.findExistingWordAtPosition(startRow, startCol, direction, boardState);
            
            if (existingWord) {
                const startIndex = word.indexOf(existingWord.word);
                const hasLettersBefore = startIndex > 0;
                const hasLettersAfter = (startIndex + existingWord.word.length) < word.length;
                
                if (hasLettersBefore && hasLettersAfter) {
                    return {
                        valid: false,
                        message: 'Cannot add letters to both sides of an existing word',
                        data: { existingWord: existingWord.word, startIndex, hasLettersBefore, hasLettersAfter }
                    };
                }
            }
            
            return { valid: true };
        }, {
            type: this.errorTypes.BLOCKING,
            timeout: 1000
        });
        
        // Create default validation pipeline
        this.createPipeline('turn_validation', [
            'boundary',
            'connection', 
            'tile_availability',
            'word_formation'
        ], {
            stopOnFirstError: true,
            collectAllErrors: false,
            timeout: 5000
        });
    }
    
    /**
     * Find existing word at position
     * @param {number} startRow - Starting row
     * @param {number} startCol - Starting column
     * @param {string} direction - Direction ('across' or 'down')
     * @param {Array} boardState - Board state
     * @returns {Object|null} Existing word data or null
     */
    findExistingWordAtPosition(startRow, startCol, direction, boardState) {
        if (startRow === null || startCol === null || !direction || !boardState) {
            return null;
        }
        
        let word = '';
        let newStartRow = startRow;
        let newStartCol = startCol;
        
        // Trace backward to find word start
        let traceBackR = startRow;
        let traceBackC = startCol;
        
        if (direction === 'across') {
            while (traceBackC > 0 && boardState[traceBackR] && boardState[traceBackR][traceBackC - 1]) {
                traceBackC--;
            }
        } else {
            while (traceBackR > 0 && boardState[traceBackR - 1] && boardState[traceBackR - 1][traceBackC]) {
                traceBackR--;
            }
        }
        
        newStartRow = traceBackR;
        newStartCol = traceBackC;
        
        // Trace forward to build word
        let traceForwardR = newStartRow;
        let traceForwardC = newStartCol;
        
        if (direction === 'across') {
            while (traceForwardC < 15 && boardState[traceForwardR] && boardState[traceForwardR][traceForwardC]) {
                word += boardState[traceForwardR][traceForwardC].letter;
                traceForwardC++;
            }
        } else {
            while (traceForwardR < 15 && boardState[traceForwardR] && boardState[traceForwardR][traceForwardC]) {
                word += boardState[traceForwardR][traceForwardC].letter;
                traceForwardR++;
            }
        }
        
        return word.length > 0 ? { word, startRow: newStartRow, startCol: newStartCol } : null;
    }
}

// Create global validation pipeline instance with initialization guard
function initializeValidationPipeline() {
    if (window.eventBus) {
        window.validationPipeline = new ValidationPipeline(window.eventBus);
        console.log('✅ ValidationPipeline: Initialized successfully');
    } else {
        console.error('✅ ValidationPipeline: EventBus not available for initialization');
        // Retry after a short delay
        setTimeout(initializeValidationPipeline, 100);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeValidationPipeline);
} else {
    initializeValidationPipeline();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ValidationPipeline, validationPipeline: window.validationPipeline };
}
