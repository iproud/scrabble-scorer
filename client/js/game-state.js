// Game state management module
class GameState {
    constructor() {
        this.letterScores = { 
            'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8, 
            'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1, 
            'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10 
        };
        this.boardLayout = [
            ['TWS', '', '', 'DLS', '', '', '', 'TWS', '', '', '', 'DLS', '', '', 'TWS'],
            ['', 'DWS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'DWS', ''],
            ['', '', 'DWS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DWS', '', ''],
            ['DLS', '', '', 'DWS', '', '', '', 'DLS', '', '', '', 'DWS', '', '', 'DLS'],
            ['', '', '', '', 'DWS', '', '', '', '', '', 'DWS', '', '', '', ''],
            ['', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', ''],
            ['', '', 'DLS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DLS', '', ''],
            ['TWS', '', '', 'DLS', '', '', '', 'DWS', '', '', '', 'DLS', '', '', 'TWS'],
            ['', '', 'DLS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DLS', '', ''],
            ['', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', ''],
            ['', '', '', '', 'DWS', '', '', '', '', '', 'DWS', '', '', '', ''],
            ['DLS', '', '', 'DWS', '', '', '', 'DLS', '', '', '', 'DWS', '', '', 'DLS'],
            ['', '', 'DWS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DWS', '', ''],
            ['', 'DWS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'DWS', ''],
            ['TWS', '', '', 'DLS', '', '', '', 'TWS', '', '', '', 'DLS', '', '', 'TWS']
        ];
        this.reset();
    }

    reset() {
        this.gameId = null;
        this.players = [];
        this.currentPlayerIndex = 0;
        this.turnHistory = [];
        this.selectedCell = { row: null, col: null };
        this.wordDirection = null;
        this.boardState = Array(15).fill(null).map(() => Array(15).fill(null));
        this.blankTileIndices = new Set();
        this.isGameActive = false;
        this.tileSupply = {
            'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9, 'J': 1,
            'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 4, 'T': 6,
            'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1, 'BLANK': 2 // Using 'BLANK' for blank tiles
        };
    }

    // Initialize new game
    initializeGame(gameData) {
        this.gameId = gameData.id;
        this.players = gameData.players || [];
        this.currentPlayerIndex = 0;
        this.turnHistory = gameData.turns || [];
        this.isGameActive = gameData.status === 'active';
        
        // Restore board state from game data
        if (gameData.board_state && Array.isArray(gameData.board_state)) {
            this.boardState = gameData.board_state;
        } else {
            this.boardState = Array(15).fill(null).map(() => Array(15).fill(null));
        }
        
        // Replay turns to rebuild board state
        this.replayTurns();
        this.restoreTileSupply(); // Restore tile supply after replaying turns
    }

    // Replay turns to rebuild board state
    // This will reconstruct the boardState based on turnHistory
    replayTurns() {
        // Reset board
        this.boardState = Array(15).fill(null).map(() => Array(15).fill(null));
        
        // Apply each turn
        this.turnHistory.forEach(turn => {
            if (turn.board_state_after) {
                this.boardState = JSON.parse(JSON.stringify(turn.board_state_after));
            } else {
                // Backward compatibility for older turns if board_state_after wasn't explicitly saved
                // This logic mirrors how applyTurn places tiles onto the board
                const { word, startRow, startCol, direction, blankTiles } = turn;

                for (let i = 0; i < word.length; i++) {
                    const letter = word[i];
                    const row = direction === 'across' ? startRow : startRow + i;
                    const col = direction === 'across' ? startCol + i : col;
                    const isBlank = blankTiles.includes(i);
                    // Only place if it's a new tile placement (not already on board for the next turn)
                    if (this.boardState[row] && this.boardState[row][col] === null) {
                         this.boardState[row][col] = { letter, isBlank };
                    }
                }
            }
        });
    }

    // Restore tile supply based on current board state after replaying turns
    restoreTileSupply() {
         this.tileSupply = {
            'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9, 'J': 1,
            'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 4, 'T': 6,
            'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1, 'BLANK': 2
        };

        // Iterate through the board and subtract tiles found
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const tile = this.boardState[r][c];
                if (tile) {
                    if (tile.isBlank) {
                        this.tileSupply['BLANK']--;
                    } else {
                        this.tileSupply[tile.letter]--;
                    }
                }
            }
        }
    }

    // Get current player
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex] || null;
    }

    // Calculate turn score
    calculateTurnScore(word, startRow, startCol, direction, blankIndices = new Set()) {
        const breakdown = {
            mainWord: { word: word, score: 0 },
            secondaryWords: [],
            bingoBonus: 0,
            newPlacements: [],
            error: null
        };

        if (!word || startRow === null || startCol === null || !direction) {
            return { score: 0, breakdown };
        }

        let mainWordScore = 0;
        let mainWordMultiplier = 1;

        // Main Word Calculation
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;

            if (row >= 15 || col >= 15) {
                breakdown.error = "Word is off the board.";
                return { score: 0, breakdown };
            }
            
            const existingTile = this.boardState[row][col];
            if (existingTile && existingTile.letter !== letter) {
                breakdown.error = "Word conflicts with existing tiles.";
                return { score: 0, breakdown };
            }
            
            const isBlank = blankIndices.has(i);
            let letterScore = isBlank ? 0 : (this.letterScores[letter] || 0);
            
            if (!existingTile) {
                breakdown.newPlacements.push({ row, col, letter, isBlank, wordIndex: i });
                const bonus = this.boardLayout[row][col];
                if (bonus === 'DLS') letterScore *= 2;
                if (bonus === 'TLS') letterScore *= 3;
                if (bonus === 'DWS') mainWordMultiplier *= 2;
                if (bonus === 'TWS') mainWordMultiplier *= 3;
            }
            mainWordScore += letterScore;
        }
        mainWordScore *= mainWordMultiplier;
        breakdown.mainWord.score = mainWordScore;

        // Check for Bingo Bonus eligibility
        if (breakdown.newPlacements.length === 7) {
            breakdown.eligibleForBingo = true;
        } else {
            breakdown.eligibleForBingo = false;
        }

        // Secondary Word Calculation
        let totalSecondaryScore = 0;
        for (const placement of breakdown.newPlacements) {
            const perpWordParts = this.getPerpendicularWord(placement, direction);
            if (perpWordParts.length > 1) {
                const secondaryScore = this.scoreSecondaryWord(perpWordParts, placement);
                const secondaryWord = perpWordParts.map(p => p.letter).join('');
                breakdown.secondaryWords.push({ word: secondaryWord, score: secondaryScore });
                totalSecondaryScore += secondaryScore;
            }
        }

        let totalScore = mainWordScore + totalSecondaryScore;
        
        return { score: totalScore, breakdown };
    }

    // Get perpendicular word for cross-word scoring
    getPerpendicularWord(placement, mainDirection) {
        const { row, col } = placement;
        const perpDirection = mainDirection === 'across' ? 'down' : 'across';
        let wordParts = [];

        // Trace backwards from the placement to find the literal start of the perpendicular word
        let traceBackR = row;
        let traceBackC = col;
        while (true) {
            const prevR = perpDirection === 'down' ? traceBackR - 1 : traceBackR;
            const prevC = perpDirection === 'across' ? traceBackC - 1 : traceBackC;
            if (prevR >= 0 && prevC >= 0 && this.boardState[prevR] && this.boardState[prevR][prevC]) {
                traceBackR = prevR;
                traceBackC = prevC;
            } else {
                break;
            }
        }
        
        // Now trace forward from the determined start to reconstruct the full word
        let currentR = traceBackR;
        let currentC = traceBackC;
        while (currentR < 15 && currentC < 15) {
            // Check if there's a tile at the current position (either existing or the new placement)
            let tile = null;
            if (this.boardState[currentR] && this.boardState[currentR][currentC]) {
                tile = this.boardState[currentR][currentC];
            } else if (currentR === row && currentC === col) {
                // This is the new tile placement - include it in the word
                // We need to find the letter for this placement from the current word being played
                tile = { letter: this.getLetterAtPlacement(placement), isBlank: placement.isBlank };
            }
            
            if (tile) {
                wordParts.push({ ...tile, row: currentR, col: currentC });
                currentR = perpDirection === 'down' ? currentR + 1 : currentR;
                currentC = perpDirection === 'across' ? currentC + 1 : currentC;
            } else {
                break; // No more tiles in this direction
            }
        }
        return wordParts;
    }

    // Helper method to get the letter at a specific placement during scoring calculation
    getLetterAtPlacement(placement) {
        // This method should be called during scoring calculation when we need to know
        // what letter is being placed at a specific position
        // The placement object should contain the letter information
        return placement.letter || '';
    }

    // Score secondary (cross) words
    scoreSecondaryWord(wordParts, newTilePlacement) {
        let score = 0;
        let multiplier = 1;
        
        for (const part of wordParts) {
            const { letter, row, col, isBlank } = part;
            let letterScore = isBlank ? 0 : (this.letterScores[letter] || 0);

            if (row === newTilePlacement.row && col === newTilePlacement.col) {
                const bonus = this.boardLayout[row][col];
                if (bonus === 'DLS') letterScore *= 2;
                if (bonus === 'TLS') letterScore *= 3;
                if (bonus === 'DWS') multiplier *= 2;
                if (bonus === 'TWS') multiplier *= 3;
            }
            score += letterScore;
        }
        return score * multiplier;
    }

    // Validate turn placement
    validateTurnPlacement(word, startRow, startCol, direction, blankIndices = new Set()) {
        const { breakdown } = this.calculateTurnScore(word, startRow, startCol, direction, blankIndices);
        
        if (breakdown.error) {
            return { valid: false, error: breakdown.error };
        }

        const newPlacements = breakdown.newPlacements;
        if (newPlacements.length === 0) {
            return { valid: false, error: "You must place at least one new tile." };
        }

        // Check tile availability
        const tileValidation = this.validateTileAvailability(newPlacements, blankIndices);
        if (!tileValidation.valid) {
            return tileValidation;
        }
        
        const hasExistingTiles = this.boardState.some(row => row.some(cell => cell !== null));
        if (!hasExistingTiles) {
            // When the board is empty, the word must cover the center star
            const wordPath = [];
            for (let i = 0; i < word.length; i++) {
                wordPath.push({
                    row: direction === 'across' ? startRow : startRow + i,
                    col: direction === 'across' ? startCol + i : startCol
                });
            }
            if (!wordPath.some(p => p.row === 7 && p.col === 7)) {
                return { valid: false, error: "The first word must cover the center star." };
            }
        } else {
            // Subsequent words must connect to existing tiles
            const usesExistingTile = word.length > newPlacements.length;
            const isAdjacentToExisting = newPlacements.some(p => 
                (p.row > 0 && this.boardState[p.row - 1][p.col]) || 
                (p.row < 14 && this.boardState[p.row + 1][p.col]) ||
                (p.col > 0 && this.boardState[p.row][p.col - 1]) || 
                (p.col < 14 && this.boardState[p.row][p.col + 1])
            );
            if (!usesExistingTile && !isAdjacentToExisting) {
                return { valid: false, error: "New words must connect to existing words." };
            }
        }

        return { valid: true };
    }

    // Validate tile availability for new placements
    validateTileAvailability(newPlacements, blankIndices) {
        const requiredTiles = {};
        
        // Count required tiles for new placements
        newPlacements.forEach(placement => {
            const letter = placement.letter;
            const isBlank = blankIndices.has(placement.wordIndex);
            
            if (isBlank) {
                requiredTiles['BLANK'] = (requiredTiles['BLANK'] || 0) + 1;
            } else {
                requiredTiles[letter] = (requiredTiles[letter] || 0) + 1;
            }
        });

        // Check if required tiles are available
        const missingTiles = [];
        for (const [letter, needed] of Object.entries(requiredTiles)) {
            const available = this.tileSupply[letter] || 0;
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
                `${tile.letter}: ${tile.shortage} needed (0 available)`
            ).join(', ');
            
            return {
                valid: false,
                error: `Not enough tiles in bag. Missing: ${missingTileMessages}`,
                tileConflicts: missingTiles
            };
        }

        return { valid: true };
    }

    // Apply a turn to the game state
    applyTurn(turnData) {
        const { word, startRow, startCol, direction, score, secondaryWords, blankTiles } = turnData;
        
        // Create turn record
        const turn = {
            playerIndex: this.currentPlayerIndex,
            playerId: this.getCurrentPlayer().id,
            score: score,
            word: word,
            secondaryWords: secondaryWords || [],
            startRow,
            startCol,
            direction,
            blankTiles: blankTiles || [],
            playerStateBefore: JSON.parse(JSON.stringify(this.getCurrentPlayer())),
            boardStateBefore: JSON.parse(JSON.stringify(this.boardState)),
        };

        // Apply tiles to board and update tile supply
        // Ensure blankTiles is a Set for calculateTurnScore and subsequent logic
        const blankIndicesSet = new Set(blankTiles);

        const { breakdown } = this.calculateTurnScore(word, startRow, startCol, direction, blankIndicesSet);

        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;
            const isBlank = blankTiles.includes(i);

            if (!this.boardState[row][col]) { // Only new placements affect tile supply
                this.boardState[row][col] = { letter, isBlank };
                // Decrement tile supply for newly placed tiles
                if (isBlank) {
                    this.tileSupply['BLANK']--;
                } else {
                    this.tileSupply[letter]--;
                }
            }
        }

        // Update player score
        this.players[this.currentPlayerIndex].score += score;

        // Capture board state after the turn
        turn.boardStateAfter = JSON.parse(JSON.stringify(this.boardState));
        
        // Add to history
        this.turnHistory.push(turn);
        
        // Move to next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        return turn;
    }

    // Undo last turn
    async undoLastTurn() {
        if (this.turnHistory.length === 0) return false;
        if (!this.gameId) {
            console.error('Cannot undo: gameId is null.');
            return false;
        }

        try {
            // Call API to delete the last turn from the server
            await window.scrabbleAPI.deleteLastTurn(this.gameId);

            // If successful, proceed with client-side state restoration
            const lastTurn = this.turnHistory.pop();
            
            // Restore board state (using the state *before* the undone turn)
            this.boardState = JSON.parse(JSON.stringify(lastTurn.boardStateBefore));
            
            // Restore player state (score)
            this.players[lastTurn.playerIndex].score = lastTurn.playerStateBefore.score;
            
            // Increment tile supply for tiles that were un-placed
            // Ensure blankTiles is a Set for calculateTurnScore
            const { breakdown } = this.calculateTurnScore(lastTurn.word, lastTurn.startRow, lastTurn.startCol, lastTurn.direction, new Set(lastTurn.blankTiles));
            const newPlacementsInUndoneTurn = breakdown.newPlacements; 
            for (const placement of newPlacementsInUndoneTurn) {
                if (placement.isBlank) {
                    this.tileSupply['BLANK']++;
                } else {
                    this.tileSupply[placement.letter]++;
                }
            }
            
            // Restore current player
            this.currentPlayerIndex = lastTurn.playerIndex;
            
            return true;

        } catch (error) {
            console.error('Failed to undo turn on server:', error);
            throw error; // Re-throw the error for app.js to handle UI updates.
        }
    }

    // Find existing word fragment at position
    findWordFragment(startRow, startCol, direction) {
        let word = '';
        let newStartRow = startRow;
        let newStartCol = startCol;

        // Determine the actual start of the fragment by tracing backward
        let traceBackR = startRow;
        let traceBackC = startCol;
        if (direction === 'across') {
            while (traceBackC > 0 && this.boardState[traceBackR][traceBackC - 1] !== null) {
                traceBackC--;
            }
        } else { // 'down'
            while (traceBackR > 0 && this.boardState[traceBackR - 1][traceBackC] !== null) {
                traceBackR--;
            }
        }
        newStartRow = traceBackR;
        newStartCol = traceBackC;

        // Now trace forward from the determined start to reconstruct the full word fragment
        let traceForwardR = newStartRow;
        let traceForwardC = newStartCol;

        if (direction === 'across') {
            while (traceForwardC < 15 && this.boardState[traceForwardR][traceForwardC] !== null) {
                word += this.boardState[traceForwardR][traceForwardC].letter;
                traceForwardC++;
            }
        } else { // 'down'
            while (traceForwardR < 15 && this.boardState[traceForwardR][traceForwardC] !== null) {
                word += this.boardState[traceForwardR][traceForwardC].letter;
                traceForwardR++;
            }
        }
        
        return { word, startRow: newStartRow, startCol: newStartCol };
    }

    // Get game statistics
    getGameStats() {
        const currentRound = Math.floor(this.turnHistory.length / this.players.length) + 1;
        let highestScoringTurn = null;
        
        if (this.turnHistory.length > 0) {
            highestScoringTurn = this.turnHistory.reduce((max, turn) => 
                turn.score > max.score ? turn : max, this.turnHistory[0]);
        }

        return {
            currentRound,
            highestScoringTurn,
            totalTurns: this.turnHistory.length,
            players: this.players.map(player => ({
                ...player,
                averageScore: player.score / Math.max(1, this.turnHistory.filter(t => t.playerId === player.id).length)
            }))
        };
    }

    // Get current tile supply and total remaining tiles
    getTileSupply() {
        const totalRemaining = Object.values(this.tileSupply).reduce((sum, count) => sum + count, 0);
        return {
            supply: { ...this.tileSupply },
            totalRemaining: totalRemaining
        };
    }
}

// Create global game state instance
window.gameState = new GameState();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
