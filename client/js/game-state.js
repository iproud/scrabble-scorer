// Game state management module
class GameState {
    constructor() {
        this.reset();
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
    }

    // Replay turns to rebuild board state
    replayTurns() {
        // Reset board
        this.boardState = Array(15).fill(null).map(() => Array(15).fill(null));
        
        // Apply each turn
        this.turnHistory.forEach(turn => {
            if (turn.board_state_after) {
                this.boardState = JSON.parse(JSON.stringify(turn.board_state_after));
            }
        });
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
                breakdown.newPlacements.push({ row, col, letter, isBlank });
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
        const { row, col, letter, isBlank } = placement;
        const perpDirection = mainDirection === 'across' ? 'down' : 'across';
        let wordParts = [{ ...placement }];

        // Trace backwards
        let r = perpDirection === 'down' ? row - 1 : row;
        let c = perpDirection === 'across' ? col - 1 : col;
        while (r >= 0 && c >= 0 && this.boardState[r][c]) {
            wordParts.unshift({ ...this.boardState[r][c], row: r, col: c });
            r = perpDirection === 'down' ? r - 1 : r;
            c = perpDirection === 'across' ? c - 1 : c;
        }

        // Trace forwards
        r = perpDirection === 'down' ? row + 1 : row;
        c = perpDirection === 'across' ? col + 1 : col;
        while (r < 15 && c < 15 && this.boardState[r][c]) {
            wordParts.push({ ...this.boardState[r][c], row: r, col: c });
            r = perpDirection === 'down' ? r + 1 : r;
            c = perpDirection === 'across' ? c + 1 : c;
        }
        return wordParts;
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
        
        const isFirstTurn = this.turnHistory.length === 0;
        if (isFirstTurn) {
            // First word must cover center star
            let wordPath = [];
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
            let usesExistingTile = word.length > newPlacements.length;
            let isAdjacentToExisting = newPlacements.some(p => 
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
            boardStateBefore: JSON.parse(JSON.stringify(this.boardState))
        };

        // Apply tiles to board
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;
            const isBlank = blankTiles.includes(i);
            
            if (!this.boardState[row][col]) {
                this.boardState[row][col] = { letter, isBlank };
            }
        }

        // Update player score
        this.players[this.currentPlayerIndex].score += score;
        
        // Add to history
        this.turnHistory.push(turn);
        
        // Move to next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        return turn;
    }

    // Undo last turn
    undoLastTurn() {
        if (this.turnHistory.length === 0) return false;
        
        const lastTurn = this.turnHistory.pop();
        
        // Restore board state
        this.boardState = lastTurn.boardStateBefore;
        
        // Restore player state
        this.players[lastTurn.playerIndex] = lastTurn.playerStateBefore;
        
        // Restore current player
        this.currentPlayerIndex = lastTurn.playerIndex;
        
        return true;
    }

    // Find existing word fragment at position
    findWordFragment(startRow, startCol, direction) {
        let word = '';
        let newStartRow = startRow;
        let newStartCol = startCol;

        const tappedTile = this.boardState[startRow][startCol];
        if (tappedTile) {
            word = tappedTile.letter;
        }

        // Trace backwards
        let r = direction === 'across' ? startRow : startRow - 1;
        let c = direction === 'across' ? startCol - 1 : startCol;
        while (r >= 0 && c >= 0 && this.boardState[r] && this.boardState[r][c]) {
            word = this.boardState[r][c].letter + word;
            newStartRow = r;
            newStartCol = c;
            r = direction === 'across' ? r : r - 1;
            c = direction === 'across' ? c - 1 : c;
        }

        // Trace forwards
        r = direction === 'across' ? startRow : startRow + 1;
        c = direction === 'across' ? startCol + 1 : startCol;
        while (r < 15 && c < 15 && this.boardState[r] && this.boardState[r][c]) {
            word = word + this.boardState[r][c].letter;
            r = direction === 'across' ? r : r + 1;
            c = direction === 'across' ? c + 1 : c;
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
}

// Create global game state instance
window.gameState = new GameState();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
