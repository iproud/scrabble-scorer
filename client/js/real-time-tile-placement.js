/**
 * Real-Time Tile Placement System
 * Shows tiles on the Scrabble board as the user types in real-time
 * Replaces the Word Preview system with direct board tile rendering
 */
class RealTimeTilePlacement {
    constructor(boardContainer, gameState) {
        this.boardContainer = boardContainer;
        this.gameState = gameState;
        this.isActive = false;
        this.currentTiles = new Map(); // Map of row-col to tile elements
        this.previewTiles = new Map(); // Map of row-col to preview tile elements
        this.currentWord = '';
        this.startRow = null;
        this.startCol = null;
        this.direction = null;

        // Bind methods to maintain context
        this.updateTiles = this.updateTiles.bind(this);
        this.clearTiles = this.clearTiles.bind(this);
        this.handleWordInput = this.handleWordInput.bind(this);
    }

    /**
     * Initialize the real-time tile placement system
     */
    initialize() {
        console.log('Real-Time Tile Placement: Initializing system');
        this.createPreviewTileElements();
        return true;
    }

    /**
     * Start real-time tile placement for a new word
     * @param {number} startRow - Starting row position
     * @param {number} startCol - Starting column position
     * @param {string} direction - Word direction ('across' or 'down')
     */
    startPlacement(startRow, startCol, direction) {
        console.log('Real-Time Tile Placement: Starting placement at', { startRow, startCol, direction });
        this.startRow = startRow;
        this.startCol = startCol;
        this.direction = direction;
        this.currentWord = '';
        this.isActive = true;
        this.clearTiles();
        this.updateTiles(''); // Show initial empty state
    }

    /**
     * Stop real-time tile placement
     */
    stopPlacement() {
        console.log('Real-Time Tile Placement: Stopping placement - comprehensive cleanup');
        this.isActive = false;
        this.currentWord = '';

        // Phase 1 Fix: Enhanced cleanup with validation
        try {
            this.clearTiles();

            // Reset all state variables
            this.startRow = null;
            this.startCol = null;
            this.direction = null;

            // Clear any remaining references
            this.currentTiles.clear();
            this.previewTiles.clear();

            console.log('Real-Time Tile Placement: Cleanup completed successfully');
        } catch (error) {
            console.error('Real-Time Tile Placement: Error during cleanup:', error);
            // Force cleanup even if there's an error
            this.currentTiles.clear();
            this.previewTiles.clear();
        }
    }

    /**
     * Handle word input from the main app
     * @param {string} word - The current word being typed
     */
    handleWordInput(word) {
        if (!this.isActive) return;

        this.currentWord = word.toUpperCase().replace(/[^A-Z]/g, '');
        console.log('Real-Time Tile Placement: Updating word to', this.currentWord);
        this.updateTiles(this.currentWord);
    }

    /**
     * Update tiles on the board based on the current word
     * @param {string} word - The word to display (optional)
     */
    updateTiles(word = this.currentWord) {
        if (!this.isActive) return;

        // Clear previous preview tiles
        this.clearPreviewTiles();

        // Create tile elements for each letter in the word
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = this.direction === 'across' ? this.startRow : this.startRow + i;
            const col = this.direction === 'across' ? this.startCol + i : this.startCol;

            // Skip if we're off the board
            if (row >= 15 || col >= 15) continue;

            // Check if there's an existing tile at this position
            const existingTile = this.gameState.boardState[row][col];

            if (existingTile) {
                // If the letters match exactly, don't show a real-time tile at all
                // If there's a conflict, show the conflict tile
                if (existingTile.letter === letter) {
                    // Letters match - no real-time tile needed, just track it
                    const tileKey = `${row}-${col}`;
                    this.currentTiles.set(tileKey, {
                        letter,
                        isBlank: existingTile.isBlank,
                        isExisting: true,
                        isConflict: false,
                        originalLetter: existingTile.letter
                    });
                } else {
                    // Letters don't match - show conflict tile
                    this.createOrUpdateTile(row, col, existingTile.letter, existingTile.isBlank, true, true, existingTile.letter);
                }
            } else {
                // Show new tile preview
                const isBlank = this.gameState.blankTileIndices.has(i);
                this.createOrUpdateTile(row, col, letter, isBlank, false, false, letter);
            }
        }
    }

    /**
     * Create or update a tile element on the board
     * @param {number} row - Row position
     * @param {number} col - Column position
     * @param {string} letter - Letter to display
     * @param {boolean} isBlank - Whether this is a blank tile
     * @param {boolean} isExisting - Whether this is an existing tile
     * @param {boolean} isConflict - Whether there's a conflict
     * @param {string} originalLetter - Original letter (for conflict detection)
     */
    createOrUpdateTile(row, col, letter, isBlank, isExisting, isConflict, originalLetter) {
        const cell = this.boardContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return;

        const tileKey = `${row}-${col}`;

        // Remove any existing preview tile at this position
        const existingPreview = this.previewTiles.get(tileKey);
        if (existingPreview) {
            cell.removeChild(existingPreview);
            this.previewTiles.delete(tileKey);
        }

        // Create tile element
        const tileElement = document.createElement('div');
        tileElement.className = 'real-time-tile';

        // Determine tile class based on state
        if (isConflict) {
            tileElement.classList.add('tile-conflict');
            tileElement.title = `Conflict: Existing tile has '${originalLetter}' but you typed '${letter}'`;
        } else if (isExisting) {
            tileElement.classList.add('tile-existing');
        } else {
            tileElement.classList.add('tile-preview');
        }

        // Add blank tile class if needed
        if (isBlank) {
            tileElement.classList.add('tile-blank');
        }

        // Create letter span
        const letterSpan = document.createElement('span');
        letterSpan.className = 'tile-letter';
        letterSpan.textContent = letter;

        // Create score span
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'tile-score';
        scoreSpan.textContent = isBlank ? 0 : (this.gameState.letterScores[letter] || 0);

        tileElement.appendChild(letterSpan);
        tileElement.appendChild(scoreSpan);

        // Add to cell and track it
        cell.appendChild(tileElement);
        this.previewTiles.set(tileKey, tileElement);

        // Store tile info for reference
        this.currentTiles.set(tileKey, {
            letter,
            isBlank,
            isExisting,
            isConflict,
            originalLetter
        });
    }

    /**
     * Clear all preview tiles from the board
     */
    clearPreviewTiles() {
        this.previewTiles.forEach((tileElement, tileKey) => {
            const cell = this.boardContainer.querySelector(`[data-row="${tileKey.split('-')[0]}"][data-col="${tileKey.split('-')[1]}"]`);
            if (cell && tileElement.parentNode === cell) {
                cell.removeChild(tileElement);
            }
        });
        this.previewTiles.clear();
    }

    /**
     * Clear all tiles from the board
     */
    clearTiles() {
        this.clearPreviewTiles();
        this.currentTiles.clear();
    }

    /**
     * Create preview tile elements for all board cells
     * This is called once during initialization
     */
    createPreviewTileElements() {
        // This method prepares the board for preview tiles
        // The actual tile elements are created dynamically in updateTiles
        console.log('Real-Time Tile Placement: Board prepared for preview tiles');
    }

    /**
     * Get the current tiles being displayed
     * @returns {Map} Map of tile positions to tile data
     */
    getCurrentTiles() {
        return new Map(this.currentTiles);
    }

    /**
     * Check if there are any conflicts in the current tile placement
     * @returns {boolean} True if there are conflicts
     */
    hasConflicts() {
        for (const [tileKey, tileData] of this.currentTiles) {
            if (tileData.isConflict) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all conflict information
     * @returns {Array} Array of conflict data
     */
    getConflicts() {
        const conflicts = [];
        for (const [tileKey, tileData] of this.currentTiles) {
            if (tileData.isConflict) {
                conflicts.push({
                    row: parseInt(tileKey.split('-')[0]),
                    col: parseInt(tileKey.split('-')[1]),
                    typedLetter: tileData.letter,
                    existingLetter: tileData.originalLetter
                });
            }
        }
        return conflicts;
    }

    /**
     * Phase 1 Fix: Validate cleanup was successful
     * @returns {boolean} True if cleanup was successful
     */
    validateCleanup() {
        const hasActiveTiles = this.previewTiles.size > 0 || this.currentTiles.size > 0;
        const hasActiveState = this.isActive;

        if (hasActiveTiles || hasActiveState) {
            console.warn('Real-Time Tile Placement: Incomplete cleanup detected', {
                activeTiles: this.previewTiles.size,
                currentTiles: this.currentTiles.size,
                isActive: this.isActive
            });

            // Force cleanup
            this.stopPlacement();
            return false;
        }

        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeTilePlacement;
}
