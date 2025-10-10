// Premium Square Tracker - Manages usage of premium squares to prevent double-counting
class PremiumSquareTracker {
    constructor() {
        this.usedPremiumSquares = new Set(); // Tracks premium squares that have been used
        this.centerStarUsed = false; // Special tracking for center star (DWS at 7,7)
    }

    // Create a unique key for a premium square position
    createSquareKey(row, col) {
        return `${row}-${col}`;
    }

    // Check if a premium square has been used
    isPremiumSquareUsed(row, col) {
        const key = this.createSquareKey(row, col);
        return this.usedPremiumSquares.has(key);
    }

    // Mark a premium square as used
    markPremiumSquareUsed(row, col) {
        const key = this.createSquareKey(row, col);
        this.usedPremiumSquares.add(key);
        
        // Special handling for center star
        if (row === 7 && col === 7) {
            this.centerStarUsed = true;
        }
    }

    // Check if center star has been used
    isCenterStarUsed() {
        return this.centerStarUsed;
    }

    // Get the bonus type for a square position
    getBonusType(boardLayout, row, col) {
        return boardLayout[row] && boardLayout[row][col] ? boardLayout[row][col] : null;
    }

    // Check if a square has a premium bonus
    hasPremiumBonus(boardLayout, row, col) {
        const bonus = this.getBonusType(boardLayout, row, col);
        return bonus && ['DLS', 'TLS', 'DWS', 'TWS'].includes(bonus);
    }

    // Check if a premium square can be used for a new tile placement
    canUsePremiumSquare(boardLayout, row, col, isNewTile) {
        // Only check premium squares for new tiles
        if (!isNewTile) {
            return { canUse: false, reason: 'Not a new tile placement' };
        }

        // Check if it's a premium square
        if (!this.hasPremiumBonus(boardLayout, row, col)) {
            return { canUse: false, reason: 'Not a premium square' };
        }

        // Check if it was already used
        if (this.isPremiumSquareUsed(row, col)) {
            return { canUse: false, reason: 'Premium square already used' };
        }

        return { canUse: true };
    }

    // Mark premium squares used in a turn
    markPremiumSquaresForTurn(boardLayout, newPlacements) {
        const usedSquares = [];
        
        for (const placement of newPlacements) {
            if (placement.isNew && this.hasPremiumBonus(boardLayout, placement.row, placement.col)) {
                this.markPremiumSquareUsed(placement.row, placement.col);
                usedSquares.push({
                    row: placement.row,
                    col: placement.col,
                    bonus: this.getBonusType(boardLayout, placement.row, placement.col)
                });
            }
        }
        
        return usedSquares;
    }

    // Restore premium squares when undoing a turn
    restorePremiumSquares(usedSquares) {
        for (const square of usedSquares) {
            const key = this.createSquareKey(square.row, square.col);
            this.usedPremiumSquares.delete(key);
            
            // Special handling for center star
            if (square.row === 7 && square.col === 7) {
                this.centerStarUsed = false;
            }
        }
    }

    // Get all used premium squares for serialization
    getUsedPremiumSquares() {
        return Array.from(this.usedPremiumSquares).map(key => {
            const [row, col] = key.split('-').map(Number);
            return { row, col };
        });
    }

    // Restore premium squares from serialized data
    restoreFromData(usedSquares) {
        this.usedPremiumSquares.clear();
        this.centerStarUsed = false;
        
        for (const square of usedSquares) {
            this.markPremiumSquareUsed(square.row, square.col);
        }
    }

    // Clear all tracking (for new games)
    clear() {
        this.usedPremiumSquares.clear();
        this.centerStarUsed = false;
    }

    // Save current state to localStorage
    saveState() {
        try {
            const state = {
                usedPremiumSquares: Array.from(this.usedPremiumSquares),
                centerStarUsed: this.centerStarUsed,
                timestamp: Date.now()
            };
            localStorage.setItem('scrabble_premium_square_state', JSON.stringify(state));
            console.log('Premium Square Tracker: State saved to localStorage');
        } catch (error) {
            console.warn('Premium Square Tracker: Failed to save state to localStorage', error);
        }
    }

    // Load state from localStorage
    loadState() {
        try {
            const savedState = localStorage.getItem('scrabble_premium_square_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.usedPremiumSquares = new Set(state.usedPremiumSquares);
                this.centerStarUsed = state.centerStarUsed;
                console.log('Premium Square Tracker: State loaded from localStorage');
                console.log('Premium Square Tracker: Loaded', this.getDebugInfo());
                return true;
            }
        } catch (error) {
            console.warn('Premium Square Tracker: Failed to load state from localStorage', error);
        }
        console.log('Premium Square Tracker: No saved state found, using empty state');
        return false;
    }

    // Remove saved state from localStorage
    clearSavedState() {
        try {
            localStorage.removeItem('scrabble_premium_square_state');
            console.log('Premium Square Tracker: Saved state cleared from localStorage');
        } catch (error) {
            console.warn('Premium Square Tracker: Failed to clear saved state', error);
        }
    }

    // Reconstruct state from turn history
    reconstructFromTurnHistory(turnHistory) {
        try {
            console.log('Premium Square Tracker: Reconstructing state from turn history');
            this.clear();
            
            // Process each turn to rebuild premium square usage
            for (const turn of turnHistory) {
                if (turn.boardStateAfter && Array.isArray(turn.boardStateAfter)) {
                    // Find premium squares used in this turn
                    for (let row = 0; row < 15; row++) {
                        for (let col = 0; col < 15; col++) {
                            const tile = turn.boardStateAfter[row][col];
                            if (tile) {
                                const bonus = this.getBonusType(null, row, col); // We'll need to pass boardLayout
                                if (bonus && ['DLS', 'TLS', 'DWS', 'TWS'].includes(bonus)) {
                                    // This tile was placed on a premium square in this turn
                                    this.usedPremiumSquares.add(this.createSquareKey(row, col));
                                    
                                    if (row === 7 && col === 7) {
                                        this.centerStarUsed = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            console.log('Premium Square Tracker: State reconstructed from turn history');
            console.log('Premium Square Tracker: Reconstructed', this.getDebugInfo());
            return true;
        } catch (error) {
            console.error('Premium Square Tracker: Failed to reconstruct state from turn history', error);
            return false;
        }
    }

    // Reconstruct state from current board state (fallback method)
    reconstructFromBoardState(boardState, boardLayout) {
        try {
            console.log('Premium Square Tracker: Reconstructing state from board state');
            this.clear();
            
            if (!boardState || !boardLayout) {
                console.log('Premium Square Tracker: No board state available for reconstruction');
                return false;
            }
            
            // Scan the board for tiles on premium squares
            for (let row = 0; row < 15; row++) {
                for (let col = 0; col < 15; col++) {
                    const tile = boardState[row][col];
                    if (tile) {
                        const bonus = boardLayout[row] && boardLayout[row][col];
                        if (bonus && ['DLS', 'TLS', 'DWS', 'TWS'].includes(bonus)) {
                            // There's a tile on a premium square
                            this.usedPremiumSquares.add(this.createSquareKey(row, col));
                            
                            if (row === 7 && col === 7) {
                                this.centerStarUsed = true;
                            }
                        }
                    }
                }
            }
            
            console.log('Premium Square Tracker: State reconstructed from board state');
            console.log('Premium Square Tracker: Reconstructed', this.getDebugInfo());
            return true;
        } catch (error) {
            console.error('Premium Square Tracker: Failed to reconstruct state from board state', error);
            return false;
        }
    }

    // Validate state consistency with board state
    validateStateConsistency(boardState, boardLayout) {
        const issues = [];
        
        if (!boardState || !boardLayout) {
            return { valid: false, issues: ['No board state available for validation'] };
        }
        
        // Check if tracked premium squares have tiles on the board
        for (const squareKey of this.usedPremiumSquares) {
            const [row, col] = squareKey.split('-').map(Number);
            const tile = boardState[row] && boardState[row][col];
            
            if (!tile) {
                // Premium square is marked as used but no tile on board
                issues.push({
                    type: 'missing_tile',
                    position: { row, col },
                    message: `Premium square at (${row}, ${col}) is marked as used but no tile found on board`
                });
            }
        }
        
        // Check if there are tiles on premium squares that aren't tracked
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                const tile = boardState[row][col];
                if (tile) {
                    const bonus = boardLayout[row] && boardLayout[row][col];
                    if (bonus && ['DLS', 'TLS', 'DWS', 'TWS'].includes(bonus)) {
                        const squareKey = this.createSquareKey(row, col);
                        if (!this.usedPremiumSquares.has(squareKey)) {
                            issues.push({
                                type: 'untracked_premium',
                                position: { row, col },
                                tile: tile.letter,
                                bonus,
                                message: `Tile "${tile.letter}" on premium square (${row}, ${col}) is not tracked`
                            });
                        }
                    }
                }
            }
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }

    // Get debug information
    getDebugInfo() {
        return {
            usedPremiumSquares: this.getUsedPremiumSquares(),
            centerStarUsed: this.centerStarUsed,
            totalUsed: this.usedPremiumSquares.size
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PremiumSquareTracker;
}

window.PremiumSquareTracker = PremiumSquareTracker;
