// Word Preview System - Real-time word placement preview on the main board
class WordPreview {
    constructor() {
        this.isActive = false;
        this.currentWord = '';
        this.startRow = null;
        this.startCol = null;
        this.direction = null;
        this.blankIndices = new Set();
        this.previewTiles = [];
        this.validationResult = null;
        
        // DOM elements
        this.boardElement = null;
        this.previewContainer = null;
        
        // Visual feedback classes
        this.classes = {
            preview: 'word-preview-tile',
            valid: 'word-preview-valid',
            invalid: 'word-preview-invalid',
            existing: 'word-preview-existing',
            blank: 'word-preview-blank'
        };
    }

    // Initialize the word preview system
    initialize() {
        this.boardElement = document.getElementById('scrabble-board');
        if (!this.boardElement) {
            console.error('WordPreview: Board element not found');
            return false;
        }

        // Create preview container
        this.createPreviewContainer();
        
        // Add styles
        this.addStyles();
        
        return true;
    }

    // Create preview container overlay
    createPreviewContainer() {
        if (this.previewContainer) {
            this.previewContainer.remove();
        }

        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'word-preview-container';
        this.previewContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
        `;

        this.boardElement.appendChild(this.previewContainer);
    }

    // Add preview styles to the document
    addStyles() {
        const styleId = 'word-preview-styles';
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .word-preview-tile {
                position: absolute;
                width: 36px;
                height: 36px;
                border: 2px solid;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 16px;
                text-transform: uppercase;
                background: rgba(255, 255, 255, 0.9);
                transition: all 0.2s ease;
                animation: wordPreviewFadeIn 0.3s ease;
            }

            .word-preview-valid {
                border-color: #10b981;
                background: rgba(16, 185, 129, 0.1);
                color: #059669;
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
            }

            .word-preview-invalid {
                border-color: #ef4444;
                background: rgba(239, 68, 68, 0.1);
                color: #dc2626;
                box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
                animation: wordPreviewInvalid 0.5s ease infinite alternate;
            }

            .word-preview-existing {
                border-color: #6b7280;
                background: rgba(107, 114, 128, 0.1);
                color: #4b5563;
                opacity: 0.6;
            }

            .word-preview-blank {
                background: rgba(255, 255, 255, 0.5);
                border-style: dashed;
                border-color: #d1d5db;
            }

            @keyframes wordPreviewFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            @keyframes wordPreviewInvalid {
                from { transform: translateX(-2px); }
                to { transform: translateX(2px); }
            }

            /* Responsive adjustments */
            @media (max-width: 640px) {
                .word-preview-tile {
                    width: 28px;
                    height: 28px;
                    font-size: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Start preview for a word
    startPreview(word, startRow, startCol, direction, blankIndices = new Set()) {
        this.currentWord = word.toUpperCase();
        this.startRow = startRow;
        this.startCol = startCol;
        this.direction = direction;
        this.blankIndices = blankIndices;
        this.isActive = true;

        this.updatePreview();
    }

    // Update the word preview
    updatePreview() {
        if (!this.isActive) return;

        // Clear existing preview
        this.clearPreview();

        if (!this.currentWord || !this.direction) {
            return;
        }

        // Calculate preview positions
        const previewPositions = this.calculatePreviewPositions();

        // Determine validation result
        this.validationResult = this.validatePlacement(previewPositions);

        // Create preview tiles
        this.createPreviewTiles(previewPositions);

        // Show validation feedback
        this.showValidationFeedback();
    }

    // Calculate preview positions for the word
    calculatePreviewPositions() {
        const positions = [];
        
        for (let i = 0; i < this.currentWord.length; i++) {
            const letter = this.currentWord[i];
            const row = this.direction === 'across' ? this.startRow : this.startRow + i;
            const col = this.direction === 'across' ? this.startCol + i : this.startCol;
            const isBlank = this.blankIndices.has(i);

            positions.push({
                row,
                col,
                letter,
                isBlank,
                wordIndex: i,
                isValidPosition: this.isValidPosition(row, col)
            });
        }

        return positions;
    }

    // Check if a position is valid
    isValidPosition(row, col) {
        return row >= 0 && row < 15 && col >= 0 && col < 15;
    }

    // Validate the placement using existing game logic
    validatePlacement(positions) {
        // Try to get the global game state
        const gameState = window.gameState;
        if (!gameState) {
            return { valid: false, error: "Game state not available" };
        }

        // Use the existing validation method
        const blankIndicesSet = new Set([...this.blankIndices]);
        const validation = gameState.validateTurnPlacement(
            this.currentWord,
            this.startRow,
            this.startCol,
            this.direction,
            blankIndicesSet
        );

        return validation;
    }

    // Create preview tile elements
    createPreviewTiles(positions) {
        positions.forEach(position => {
            if (!position.isValidPosition) {
                return;
            }

            const tile = document.createElement('div');
            tile.className = this.classes.preview;

            // Add letter content
            tile.textContent = position.isBlank ? '' : position.letter;

            // Add styling based on validation and position
            this.stylePreviewTile(tile, position);

            // Add tooltip with position info
            tile.title = `Position: (${position.row}, ${position.col})${position.isBlank ? ' - Blank' : ''}`;

            // Position the tile on the board
            this.positionTile(tile, position.row, position.col);

            this.previewContainer.appendChild(tile);
            this.previewTiles.push(tile);
        });
    }

    // Style individual preview tile
    stylePreviewTile(tile, position) {
        // Base classes
        tile.classList.add(this.classes.preview);

        // Determine if tile is valid, invalid, or based on existing board
        let tileState = 'valid'; // default
        if (this.validationResult && !this.validationResult.valid) {
            tileState = 'invalid';
        } else {
            // Check if this position has an existing tile on the board
            const gameState = window.gameState;
            if (gameState && gameState.boardState[position.row] && gameState.boardState[position.row][position.col]) {
                tileState = 'existing';
            }
        }

        tile.classList.add(this.classes[tileState]);

        // Handle blank tiles
        if (position.isBlank) {
            tile.classList.add(this.classes.blank);
        }
    }

    // Position tile on board
    positionTile(tile, row, col) {
        // Get the target board cell to position correctly
        const boardCell = this.getBoardCell(row, col);
        if (!boardCell) {
            console.warn(`WordPreview: Could not find board cell for position (${row}, ${col})`);
            return;
        }

        const rect = boardCell.getBoundingClientRect();
        const boardRect = this.boardElement.getBoundingClientRect();

        // Calculate position relative to the board
        const relativeLeft = rect.left - boardRect.left;
        const relativeTop = rect.top - boardRect.top;

        tile.style.left = `${relativeLeft}px`;
        tile.style.top = `${relativeTop}px`;
    }

    // Get the board cell element for a position
    getBoardCell(row, col) {
        // Look for grid cell with data coordinates
        const cells = this.boardElement.querySelectorAll('[data-row][data-col]');
        for (const cell of cells) {
            if (cell.dataset.row == row && cell.dataset.col == col) {
                return cell;
            }
        }
        
        // Better fallback: use CSS Grid positioning
        const boardRect = this.boardElement.getBoundingClientRect();
        const gridStyle = window.getComputedStyle(this.boardElement);
        const gap = parseFloat(gridStyle.gap) || 2;
        const totalGap = gap * 14; // 14 gaps in a 15x15 grid
        const cellSize = (boardRect.width - totalGap) / 15;
        
        const left = col * (cellSize + gap) + gap;
        const top = row * (cellSize + gap) + gap;
        
        return { 
            getBoundingClientRect: () => ({
                left: boardRect.left + left,
                top: boardRect.top + top,
                width: cellSize,
                height: cellSize
            })
        };
    }

    // Show validation feedback
    showValidationFeedback() {
        if (!this.validationResult) return;

        if (!this.validationResult.valid && this.validationResult.error) {
            // Show error message briefly
            this.showErrorMessage(this.validationResult.error);
        }

        // Show warnings if any
        if (this.validationResult.tileValidation && this.validationResult.tileValidation.warnings) {
            this.validationResult.tileValidation.warnings.forEach(warning => {
                console.log('Word preview warning:', warning);
            });
        }
    }

    // Show error message temporarily
    showErrorMessage(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'word-preview-error';
        errorElement.textContent = message;
        errorElement.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(239, 68, 68, 0.95);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: wordPreviewErrorFadeIn 0.3s ease;
        `;
        
        this.previewContainer.appendChild(errorElement);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.remove();
            }
        }, 3000);
    }

    // Update word preview as user types
    updateWord(word) {
        this.currentWord = word.toUpperCase();
        this.updatePreview();
    }

    // Update blank tile indices
    updateBlankIndices(blankIndices) {
        this.blankIndices = blankIndices;
        this.updatePreview();
    }

    // Clear the current preview
    clearPreview() {
        this.previewTiles.forEach(tile => {
            if (tile.parentNode) {
                tile.remove();
            }
        });
        this.previewTiles = [];
        this.validationResult = null;
    }

    // Stop preview and clean up
    stopPreview() {
        this.isActive = false;
        this.clearPreview();
        this.currentWord = '';
        this.startRow = null;
        this.startCol = null;
        this.direction = null;
        this.blankIndices.clear();
    }

    // Get current preview state
    getPreviewState() {
        return {
            isActive: this.isActive,
            word: this.currentWord,
            startPosition: { row: this.startRow, col: this.startCol },
            direction: this.direction,
            blankIndices: [...this.blankIndices],
            validation: this.validationResult,
            tileCount: this.previewTiles.length
        };
    }

    // Check if preview is active
    isPreviewActive() {
        return this.isActive;
    }

    // Get current validation result
    getValidationResult() {
        return this.validationResult;
    }

    // Add debug information to preview tiles
    addDebugInfo() {
        this.previewTiles.forEach((tile, index) => {
            const debugInfo = document.createElement('div');
            debugInfo.textContent = `${index}`;
            debugInfo.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                width: 12px;
                height: 12px;
                font-size: 8px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 20;
            `;
            tile.appendChild(debugInfo);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WordPreview;
}

window.WordPreview = WordPreview;
