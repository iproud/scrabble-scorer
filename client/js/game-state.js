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
        
        // Phase 4 Fix: Initialize premium square tracker with state persistence
        this.premiumSquareTracker = new PremiumSquareTracker();
        
        // Try to load saved state from localStorage first
        const stateLoaded = this.premiumSquareTracker.loadState();
        if (!stateLoaded) {
            console.log('GameState: No saved premium square state found, using fresh tracker');
        }
        
        // Phase 3 Fix: Initialize tile validator
        this.tileValidator = new TileValidator(this.premiumSquareTracker);
    }

    // Initialize new game
    initializeGame(gameData) {
        console.log('GameState: Initializing game with ID', gameData.id);
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
        
        // Phase 4 Fix: Restore premium square tracker state after loading game data
        this.restorePremiumSquareTrackerState();
        
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

    // Phase 4 Fix: Restore premium square tracker state with fallback mechanisms
    restorePremiumSquareTrackerState() {
        console.log('GameState: Restoring premium square tracker state');
        
        try {
            // Method 1: Try to load from localStorage (most reliable for same session)
            if (this.premiumSquareTracker.loadState()) {
                console.log('GameState: Premium square tracker state restored from localStorage');
                
                // Validate state consistency with board state
                const validation = this.premiumSquareTracker.validateStateConsistency(this.boardState, this.boardLayout);
                if (validation.valid) {
                    console.log('GameState: Premium square tracker state is consistent with board state');
                    return;
                } else {
                    console.warn('GameState: Premium square tracker state inconsistency detected:', validation.issues);
                    console.log('GameState: Attempting to reconstruct from turn history');
                }
            }
            
            // Method 2: Try to reconstruct from turn history
            if (this.turnHistory && this.turnHistory.length > 0) {
                console.log('GameState: Attempting to reconstruct premium square tracker state from turn history');
                if (this.premiumSquareTracker.reconstructFromTurnHistory(this.turnHistory)) {
                    console.log('GameState: Premium square tracker state reconstructed from turn history');
                    
                    // Save the reconstructed state to localStorage for future use
                    this.premiumSquareTracker.saveState();
                    
                    // Validate reconstructed state
                    const validation = this.premiumSquareTracker.validateStateConsistency(this.boardState, this.boardLayout);
                    if (validation.valid) {
                        console.log('GameState: Reconstructed premium square tracker state is consistent');
                        return;
                    } else {
                        console.warn('GameState: Reconstructed premium square tracker state inconsistency detected:', validation.issues);
                    }
                }
            }
            
            // Method 3: Fallback - reconstruct from current board state (least reliable)
            console.log('GameState: Attempting to reconstruct premium square tracker state from board state (fallback)');
            if (this.premiumSquareTracker.reconstructFromBoardState(this.boardState, this.boardLayout)) {
                console.log('GameState: Premium square tracker state reconstructed from board state');
                
                // Save the reconstructed state to localStorage for future use
                this.premiumSquareTracker.saveState();
                
                // Validate reconstructed state
                const validation = this.premiumSquareTracker.validateStateConsistency(this.boardState, this.boardLayout);
                if (validation.valid) {
                    console.log('GameState: Reconstructed premium square tracker state is consistent');
                    return;
                } else {
                    console.warn('GameState: Reconstructed premium square tracker state inconsistency detected:', validation.issues);
                }
            }
            
            // Method 4: Last resort - use empty state if all else fails
            console.warn('GameState: All premium square tracker restoration methods failed, using empty state');
            this.premiumSquareTracker.clear();
            this.premiumSquareTracker.clearSavedState();
            
        } catch (error) {
            console.error('GameState: Error restoring premium square tracker state:', error);
            console.error('GameState: Using empty premium square tracker state as fallback');
            this.premiumSquareTracker.clear();
        }
    }

    // Get current player
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex] || null;
    }

    // Phase 1 Fix: Board state validation methods
    validateBoardState(boardState) {
        if (!boardState || !Array.isArray(boardState)) {
            return false;
        }
        if (boardState.length !== 15) {
            return false;
        }
        for (let row = 0; row < 15; row++) {
            if (!Array.isArray(boardState[row]) || boardState[row].length !== 15) {
                return false;
            }
        }
        return true;
    }

    // Phase 1 Fix: Safe board copy method
    createSafeBoardCopy() {
        if (!this.validateBoardState(this.boardState)) {
            console.error('Invalid board state detected, creating empty board');
            return Array(15).fill(null).map(() => Array(15).fill(null));
        }
        return this.boardState.map(row => [...row]);
    }

    // Phase 1 Fix: Board position validation
    isValidBoardPosition(row, col) {
        return Number.isInteger(row) && Number.isInteger(col) && 
               row >= 0 && row < 15 && col >= 0 && col < 15;
    }

    // Phase 1 Fix: Board state locking mechanism
    lockBoardState() {
        this.boardStateLocked = true;
    }

    unlockBoardState() {
        this.boardStateLocked = false;
    }

    isBoardStateLocked() {
        return this.boardStateLocked || false;
    }

    // Calculate turn score with comprehensive word detection
    calculateTurnScore(word, startRow, startCol, direction, blankIndices = new Set()) {
        const breakdown = {
            mainWord: { word: '', score: 0 },
            secondaryWords: [],
            bingoBonus: 0,
            newPlacements: [],
            allScoredWords: [],
            error: null
        };

        if (!word || startRow === null || startCol === null || !direction) {
            return { score: 0, breakdown };
        }

        // Step 1: Identify new tile placements
        const newPlacements = this.identifyNewPlacements(word, startRow, startCol, direction, blankIndices);
        breakdown.newPlacements = newPlacements;

        if (newPlacements.length === 0) {
            breakdown.error = "You must place at least one new tile.";
            return { score: 0, breakdown };
        }

        // Step 2: Detect all words formed by this move
        const detectedWords = this.detectAllWords(newPlacements, direction);
        breakdown.allScoredWords = detectedWords;

        // Step 3: Separate primary word from secondary words
        const primaryWord = detectedWords.find(w => w.isPrimary);
        const secondaryWords = detectedWords.filter(w => !w.isPrimary);

        if (!primaryWord) {
            breakdown.error = "No primary word detected.";
            return { score: 0, breakdown };
        }

        // Step 4: Calculate scores for all words
        let totalScore = 0;

        // Score primary word
        const primaryScore = this.calculateWordScore(primaryWord, newPlacements);
        breakdown.mainWord = { word: primaryWord.word, score: primaryScore };
        totalScore += primaryScore;

        // Score secondary words
        for (const secondaryWord of secondaryWords) {
            const secondaryScore = this.calculateWordScore(secondaryWord, newPlacements);
            breakdown.secondaryWords.push({ word: secondaryWord.word, score: secondaryScore });
            totalScore += secondaryScore;
        }

        // Step 5: Check for Bingo Bonus
        const newlyPlacedTiles = newPlacements.filter(p => p.isNew).length;
        if (newlyPlacedTiles === 7) {
            breakdown.bingoBonus = 50;
            breakdown.eligibleForBingo = true;
            totalScore += 50;
        } else {
            breakdown.eligibleForBingo = false;
        }

        return { score: totalScore, breakdown };
    }

    // Phase 3 Fix: Corrected identifyNewPlacements for extending existing words
    identifyNewPlacements(word, startRow, startCol, direction, blankIndices) {
        const placements = [];
        
        // Validate input parameters
        if (!word || typeof word !== 'string' || startRow === null || startCol === null || !direction) {
            console.warn('Invalid parameters in identifyNewPlacements');
            return [];
        }
        
        // Validate blank indices
        if (!blankIndices || !(blankIndices instanceof Set)) {
            console.warn('Invalid blankIndices in identifyNewPlacements, using empty Set');
            blankIndices = new Set();
        }
        
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;

            // Add position validation
            if (!this.isValidBoardPosition(row, col)) {
                console.warn(`Invalid position in identifyNewPlacements: ${row}, ${col}`);
                continue; // Skip invalid positions
            }
            
            const existingTile = this.boardState[row][col];
            const isBlank = blankIndices.has(i);
            
            // Phase 3 Fix: Correct logic for extending existing words
            if (existingTile) {
                // This is an existing tile that's part of the word being extended
                // It should be marked as part of the word but not as a new placement
                placements.push({ 
                    row, 
                    col, 
                    letter: existingTile.letter, 
                    isBlank: existingTile.isBlank, 
                    wordIndex: i,
                    isNew: false, // This is an existing tile, not a new placement
                    actualLetter: existingTile.letter
                });
            } else {
                // No existing tile - this is a new tile placement
                if (isBlank && letter && letter !== 'BLANK') {
                    // This is a blank tile being used as the letter
                    placements.push({ 
                        row, 
                        col, 
                        letter, 
                        isBlank: true, 
                        wordIndex: i,
                        isNew: true, // New blank tile placement
                        actualLetter: letter,
                        displayLetter: letter // For UI purposes
                    });
                } else {
                    // New regular tile placement
                    placements.push({ 
                        row, 
                        col, 
                        letter, 
                        isBlank: false, 
                        wordIndex: i,
                        isNew: true // New tile placement
                    });
                }
            }
        }
        
        // Phase 3 Fix: Enhanced debugging for extending words
        if (placements.length > 0) {
            const newPlacements = placements.filter(p => p.isNew);
            const existingPlacements = placements.filter(p => !p.isNew);
            
            console.log('=== IDENTIFY NEW PLACEMENTS DEBUG ===');
            console.log('Word:', word);
            console.log('Start Position:', {row: startRow, col: startCol});
            console.log('Direction:', direction);
            console.log('Total Placements:', placements.length);
            console.log('New Placements:', newPlacements);
            console.log('Existing Placements:', existingPlacements);
            console.log('=== END DEBUG ===');
        }
        
        return placements;
    }

    // Phase 1 Fix: Improved detectAllWords with comprehensive deduplication
    detectAllWords(newPlacements, primaryDirection) {
        const detectedWords = [];
        const processedWords = new Set(); // Avoid duplicates

        // Step 1: Find the primary word (the complete word along the direction of play)
        const primaryWord = this.findPrimaryWord(newPlacements, primaryDirection);
        if (primaryWord && primaryWord.tiles.length > 1) {
            const wordKey = this.createWordKey(primaryWord);
            if (!processedWords.has(wordKey)) {
                processedWords.add(wordKey);
                detectedWords.push(primaryWord);
            }
        }

        // Step 2: Find secondary words (true perpendicular words formed by new tiles)
        const secondaryWords = [];
        for (const placement of newPlacements.filter(p => p.isNew)) {
            const secondaryWord = this.findSecondaryWord(placement, primaryDirection, newPlacements);
            if (secondaryWord && secondaryWord.tiles.length > 1) {
                // Only count as secondary word if it has at least one existing tile
                // (purely new perpendicular words don't count in Scrabble)
                const hasExistingTile = secondaryWord.tiles.some(tile => !tile.isNew);
                if (hasExistingTile) {
                    secondaryWords.push(secondaryWord);
                }
            }
        }

        // Phase 1 Fix: Enhanced deduplication for secondary words
        for (const secondaryWord of secondaryWords) {
            const wordKey = this.createWordKey(secondaryWord);
            if (!processedWords.has(wordKey)) {
                processedWords.add(wordKey);
                detectedWords.push(secondaryWord);
            }
        }

        // Phase 1 Fix: Validate that we haven't missed any words in complex scenarios
        const validatedWords = this.validateWordDetection(detectedWords, newPlacements, primaryDirection);
        
        return validatedWords;
    }

    // Phase 1 Fix: New method to create consistent word keys for deduplication
    createWordKey(wordData) {
        // Create a unique key based on word content, position, and direction
        // This ensures that the same word found through different paths is deduplicated
        return `${wordData.word}-${wordData.startRow}-${wordData.startCol}-${wordData.direction}`;
    }

    // Phase 1 Fix: New method to validate word detection in complex scenarios
    validateWordDetection(detectedWords, newPlacements, primaryDirection) {
        // Phase 1 Fix: Ensure all new placements are covered by detected words
        const coveredPlacements = new Set();
        
        for (const word of detectedWords) {
            for (const tile of word.tiles) {
                const placementKey = `${tile.row}-${tile.col}`;
                coveredPlacements.add(placementKey);
            }
        }

        // Phase 1 Fix: Check for any uncovered new placements
        for (const placement of newPlacements) {
            const placementKey = `${placement.row}-${placement.col}`;
            if (!coveredPlacements.has(placementKey)) {
                console.warn(`Uncovered placement detected: ${placementKey}`);
                // This might indicate a missing word in complex scenarios
            }
        }

        // Phase 1 Fix: Additional validation for parallel play scenarios
        if (newPlacements.length > 1) {
            const parallelValidation = this.validateParallelPlay(detectedWords, newPlacements, primaryDirection);
            if (parallelValidation.length > detectedWords.length) {
                return parallelValidation;
            }
        }

        return detectedWords;
    }

    // Phase 1 Fix: New method to validate parallel play scenarios
    validateParallelPlay(detectedWords, newPlacements, primaryDirection) {
        // In parallel play, we might have multiple secondary words
        // Ensure we detect all possible perpendicular words
        
        const allSecondaryWords = [];
        
        // Check each new placement for potential secondary words
        for (const placement of newPlacements.filter(p => p.isNew)) {
            const secondaryWord = this.findSecondaryWord(placement, primaryDirection, newPlacements);
            if (secondaryWord && secondaryWord.tiles.length > 1) {
                const hasExistingTile = secondaryWord.tiles.some(tile => !tile.isNew);
                if (hasExistingTile) {
                    allSecondaryWords.push(secondaryWord);
                }
            }
        }

        // Phase 1 Fix: Remove duplicates while preserving all valid words
        const uniqueSecondaryWords = [];
        const seenKeys = new Set();
        
        for (const word of allSecondaryWords) {
            const wordKey = this.createWordKey(word);
            if (!seenKeys.has(wordKey)) {
                seenKeys.add(wordKey);
                uniqueSecondaryWords.push(word);
            }
        }

        // Combine primary word with unique secondary words
        const primaryWord = detectedWords.find(w => w.isPrimary);
        const result = primaryWord ? [primaryWord, ...uniqueSecondaryWords] : uniqueSecondaryWords;
        
        return result;
    }

    // Phase 1 Fix: Improved findPrimaryWord with board state validation
    findPrimaryWord(newPlacements, direction) {
        if (newPlacements.length === 0) return null;

        // Phase 1 Fix: Validate board state before creating temporary board
        if (!this.validateBoardState(this.boardState)) {
            console.error('Invalid board state detected in findPrimaryWord');
            return null;
        }

        // Create a temporary board state that includes the new placements
        const tempBoard = this.createSafeBoardCopy();
        
        // Phase 1 Fix: Add validation for new placements
        for (const placement of newPlacements) {
            if (!this.isValidBoardPosition(placement.row, placement.col)) {
                console.warn(`Invalid placement position: ${placement.row}, ${placement.col}`);
                continue;
            }
            
            tempBoard[placement.row][placement.col] = {
                letter: placement.letter,
                isBlank: placement.isBlank
            };
        }

        // Find the minimum and maximum coordinates along the primary direction
        let minCoord = Infinity, maxCoord = -Infinity;
        let fixedCoord = null;

        for (const placement of newPlacements) {
            const coord = direction === 'across' ? placement.col : placement.row;
            const otherCoord = direction === 'across' ? placement.row : placement.col;
            
            minCoord = Math.min(minCoord, coord);
            maxCoord = Math.max(maxCoord, coord);
            
            if (fixedCoord === null) {
                fixedCoord = otherCoord;
            }
        }

        // Scan outward to find the complete word
        // Scan backward
        let currentCoord = minCoord;
        while (currentCoord >= 0) {
            const row = direction === 'across' ? fixedCoord : currentCoord;
            const col = direction === 'across' ? currentCoord : fixedCoord;
            
            if (tempBoard[row] && tempBoard[row][col]) {
                currentCoord--;
            } else {
                break;
            }
        }
        const startCoord = currentCoord + 1;

        // Scan forward and collect tiles
        const tiles = [];
        currentCoord = startCoord;
        while (currentCoord < 15) {
            const row = direction === 'across' ? fixedCoord : currentCoord;
            const col = direction === 'across' ? currentCoord : fixedCoord;
            
            if (tempBoard[row] && tempBoard[row][col]) {
                tiles.push({
                    row,
                    col,
                    letter: tempBoard[row][col].letter,
                    isBlank: tempBoard[row][col].isBlank,
                    isNew: newPlacements.some(p => p.row === row && p.col === col)
                });
                currentCoord++;
            } else {
                break;
            }
        }

        if (tiles.length === 0) return null;

        const word = tiles.map(t => t.letter).join('');
        const startRow = direction === 'across' ? fixedCoord : startCoord;
        const startCol = direction === 'across' ? startCoord : fixedCoord;

        return {
            word,
            direction,
            startRow,
            startCol,
            tiles,
            isPrimary: true
        };
    }

    // Find secondary word perpendicular to a new tile placement
    findSecondaryWord(placement, primaryDirection, newPlacements = null) {
        const perpDirection = primaryDirection === 'across' ? 'down' : 'across';
        const tiles = [];

        // Create a temporary board state that includes the new placements
        const tempBoard = this.boardState.map(row => [...row]);
        if (newPlacements) {
            for (const newPlacement of newPlacements) {
                if (newPlacement.row >= 0 && newPlacement.row < 15 && newPlacement.col >= 0 && newPlacement.col < 15) {
                    tempBoard[newPlacement.row][newPlacement.col] = {
                        letter: newPlacement.letter,
                        isBlank: newPlacement.isBlank
                    };
                }
            }
        } else {
            // If no newPlacements provided, just add this single placement
            if (placement.row >= 0 && placement.row < 15 && placement.col >= 0 && placement.col < 15) {
                tempBoard[placement.row][placement.col] = {
                    letter: placement.letter,
                    isBlank: placement.isBlank
                };
            }
        }

        // Scan backward from the placement
        let currentRow = placement.row;
        let currentCol = placement.col;

        while (true) {
            const prevRow = perpDirection === 'down' ? currentRow - 1 : currentRow;
            const prevCol = perpDirection === 'across' ? currentCol - 1 : currentCol;

            if (prevRow >= 0 && prevCol >= 0 && 
                tempBoard[prevRow] && tempBoard[prevRow][prevCol]) {
                currentRow = prevRow;
                currentCol = prevCol;
            } else {
                break;
            }
        }

        const startRow = currentRow;
        const startCol = currentCol;

        // Scan forward and collect tiles
        currentRow = startRow;
        currentCol = startCol;

        while (currentRow < 15 && currentCol < 15) {
            if (tempBoard[currentRow] && tempBoard[currentRow][currentCol]) {
                const isNew = newPlacements ? 
                    newPlacements.some(p => p.row === currentRow && p.col === currentCol && p.isNew) :
                    (currentRow === placement.row && currentCol === placement.col);

                tiles.push({
                    row: currentRow,
                    col: currentCol,
                    letter: tempBoard[currentRow][currentCol].letter,
                    isBlank: tempBoard[currentRow][currentCol].isBlank,
                    isNew: isNew
                });

                currentRow = perpDirection === 'down' ? currentRow + 1 : currentRow;
                currentCol = perpDirection === 'across' ? currentCol + 1 : currentCol;
            } else {
                break;
            }
        }

        if (tiles.length <= 1) return null; // Single tile doesn't form a word

        const word = tiles.map(t => t.letter).join('');

        return {
            word,
            direction: perpDirection,
            startRow,
            startCol,
            tiles,
            isPrimary: false
        };
    }

    // Calculate score for a detected word
    calculateWordScore(wordData, newPlacements) {
        let score = 0;
        let wordMultiplier = 1;

        console.log('=== WORD SCORE CALCULATION DEBUG ===');
        console.log('Word:', wordData.word);
        console.log('Word Tiles:', wordData.tiles);
        console.log('New Placements:', newPlacements);

        for (const tile of wordData.tiles) {
            let letterScore = tile.isBlank ? 0 : (this.letterScores[tile.letter] || 0);
            let bonusApplied = false;

            // Apply letter bonuses only for newly placed tiles
            if (tile.isNew) {
                const bonus = this.boardLayout[tile.row][tile.col];
                
                // Phase 3 Fix: Check if premium square can be used (not already used)
                const canUseBonus = this.premiumSquareTracker.canUsePremiumSquare(
                    this.boardLayout, 
                    tile.row, 
                    tile.col, 
                    tile.isNew
                );
                
                console.log(`Checking ${bonus} bonus at (${tile.row}, ${tile.col}) for tile ${tile.letter}. Can use: ${canUseBonus.canUse}, Reason: ${canUseBonus.reason}`);
                
                if (canUseBonus.canUse) {
                    bonusApplied = true;
                    if (bonus === 'DLS') {
                        letterScore *= 2;
                        console.log(`Applied DLS: ${tile.letter} now worth ${letterScore}`);
                    }
                    if (bonus === 'TLS') {
                        letterScore *= 3;
                        console.log(`Applied TLS: ${tile.letter} now worth ${letterScore}`);
                    }
                    if (bonus === 'DWS') {
                        wordMultiplier *= 2;
                        console.log(`Applied DWS: word multiplier now ${wordMultiplier}`);
                    }
                    if (bonus === 'TWS') {
                        wordMultiplier *= 3;
                        console.log(`Applied TWS: word multiplier now ${wordMultiplier}`);
                    }
                }
            }

            score += letterScore;
            console.log(`Tile ${tile.letter} (${tile.isNew ? 'NEW' : 'EXIST'})${bonusApplied ? ' with bonus' : ''} score: ${letterScore}`);
        }

        const finalScore = score * wordMultiplier;
        console.log(`Final word score: ${finalScore} (base: ${score}, multiplier: ${wordMultiplier})`);
        console.log('=== END WORD SCORE DEBUG ===');

        return finalScore;
    }

    // Get perpendicular word for cross-word scoring
    getPerpendicularWord(placement, mainDirection, currentWord, startRow, startCol) {
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
                const letter = this.getLetterAtPlacement(placement, currentWord, startRow, startCol, mainDirection);
                tile = { letter, isBlank: placement.isBlank };
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
    getLetterAtPlacement(placement, currentWord, startRow, startCol, direction) {
        // Calculate the position of this placement within the current word
        let wordIndex = -1;
        
        if (direction === 'across') {
            wordIndex = placement.col - startCol;
        } else {
            wordIndex = placement.row - startRow;
        }
        
        // Return the letter at this position in the current word
        if (wordIndex >= 0 && wordIndex < currentWord.length) {
            return currentWord[wordIndex];
        }
        
        // Fallback to placement letter if available
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

    // Phase 3 Fix: Enhanced validateTurnPlacement with Tile Validator integration
    validateTurnPlacement(word, startRow, startCol, direction, blankIndices = new Set()) {
        // Phase 3 Fix: Use Tile Validator for comprehensive validation
        const tileValidation = this.tileValidator.validateWordPlacement(
            word, 
            startRow, 
            startCol, 
            direction, 
            this.boardState, 
            this.boardLayout, 
            blankIndices
        );

        if (!tileValidation.valid) {
            return {
                valid: false,
                error: tileValidation.errors.join('. '),
                tileValidation
            };
        }

        // Phase 3 Fix: Add tile validator warnings if any
        if (tileValidation.warnings.length > 0) {
            console.log('Tile validator warnings:', tileValidation.warnings);
        }

        const { breakdown } = this.calculateTurnScore(word, startRow, startCol, direction, blankIndices);
        
        if (breakdown.error) {
            return { valid: false, error: breakdown.error };
        }

        const newPlacements = breakdown.newPlacements;
        if (newPlacements.length === 0) {
            return { valid: false, error: "You must place at least one new tile." };
        }

        // Check tile availability
        const tileAvailabilityValidation = this.validateTileAvailability(newPlacements, blankIndices);
        if (!tileAvailabilityValidation.valid) {
            return tileAvailabilityValidation;
        }
        
        // Phase 3 Fix: Enhanced connection validation
        const hasExistingTiles = this.boardState.some(row => row.some(cell => cell !== null));
        if (!hasExistingTiles) {
            // When the board is empty, the word must cover the center star
            const wordPath = [];
            for (let i = 0; i < word.length; i++) {
                const row = direction === 'across' ? startRow : startRow + i;
                const col = direction === 'across' ? startCol + i : startCol;
                
                if (!this.isValidBoardPosition(row, col)) {
                    return { valid: false, error: `Word extends beyond board boundaries at position ${row}, ${col}.` };
                }
                
                wordPath.push({ row, col });
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

        return { valid: true, tileValidation };
    }

    // Phase 1 Fix: New method for comprehensive word boundary validation
    validateWordBoundaries(word, startRow, startCol, direction) {
        // Phase 1 Fix: Check if start position is valid
        if (!this.isValidBoardPosition(startRow, startCol)) {
            return { valid: false, error: `Invalid start position: ${startRow}, ${startCol}. Position must be within board boundaries (0-14).` };
        }
        
        // Phase 1 Fix: Check if word fits within board boundaries
        const endRow = direction === 'across' ? startRow : startRow + word.length - 1;
        const endCol = direction === 'across' ? startCol + word.length - 1 : startCol;
        
        if (!this.isValidBoardPosition(endRow, endCol)) {
            return { valid: false, error: `Word extends beyond board boundaries. End position ${endRow}, ${endCol} is invalid.` };
        }
        
        // Phase 1 Fix: Check all intermediate positions
        for (let i = 0; i < word.length; i++) {
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;
            
            if (!this.isValidBoardPosition(row, col)) {
                return { valid: false, error: `Word position ${i} (${row}, ${col}) is outside board boundaries.` };
            }
        }
        
        // Phase 1 Fix: Special edge case validation for corners and edges
        if (this.isEdgeOrCornerPlacement(startRow, startCol, direction, word.length)) {
            // Additional validation for edge placements
            const edgeValidation = this.validateEdgePlacement(word, startRow, startCol, direction);
            if (!edgeValidation.valid) {
                return edgeValidation;
            }
        }
        
        return { valid: true };
    }

    // Phase 1 Fix: New method to detect edge or corner placements
    isEdgeOrCornerPlacement(startRow, startCol, direction, wordLength) {
        const endRow = direction === 'across' ? startRow : startRow + wordLength - 1;
        const endCol = direction === 'across' ? startCol + wordLength - 1 : startCol;
        
        // Check if any part of the word touches the board edges
        return startRow === 0 || startCol === 0 || endRow === 14 || endCol === 14;
    }

    // Phase 1 Fix: New method for edge-specific validation
    validateEdgePlacement(word, startRow, startCol, direction) {
        // Phase 1 Fix: Ensure edge placements don't have out-of-bounds issues
        const positions = [];
        for (let i = 0; i < word.length; i++) {
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;
            positions.push({ row, col });
        }
        
        // Phase 1 Fix: Check for potential index out-of-bounds in word detection
        for (const pos of positions) {
            // Check adjacent positions for word detection
            const adjacentPositions = [
                { row: pos.row - 1, col: pos.col },
                { row: pos.row + 1, col: pos.col },
                { row: pos.row, col: pos.col - 1 },
                { row: pos.row, col: pos.col + 1 }
            ];
            
            for (const adj of adjacentPositions) {
                if (!this.isValidBoardPosition(adj.row, adj.col)) {
                    // This is expected for edge placements, but ensure word detection handles it
                    continue;
                }
            }
        }
        
        return { valid: true };
    }

    // Phase 3 Fix: Critical fix for tile availability validation when extending existing words
    validateTileAvailability(newPlacements, blankIndices) {
        const requiredTiles = {};
        
        // Phase 3 Fix: Ensure blankIndices is properly handled for word extensions
        if (!blankIndices || !(blankIndices instanceof Set)) {
            console.warn('validateTileAvailability: Invalid blankIndices, using empty Set');
            blankIndices = new Set();
        }
        
        // Phase 3 Fix: Only count tiles that are actually NEW (isNew: true)
        // This prevents counting existing tiles when extending words
        const actuallyNewPlacements = newPlacements.filter(placement => placement.isNew);
        
        console.log('=== TILE AVAILABILITY DEBUG ===');
        console.log('All Placements:', newPlacements);
        console.log('Actually New Placements:', actuallyNewPlacements);
        console.log('Blank Indices:', blankIndices);
        console.log('Blank Indices Type:', typeof blankIndices);
        console.log('Blank Indices Size:', blankIndices.size);
        
        // Phase 3 Fix: Ensure we have at least one new placement (Scrabble rule)
        if (actuallyNewPlacements.length === 0) {
            console.log('❌ No new tiles being placed - this violates Scrabble rules');
            return {
                valid: false,
                error: "No new tiles being placed (Scrabble rule violation)"
            };
        }
        
        // Count required tiles for ACTUALLY NEW placements only
        actuallyNewPlacements.forEach(placement => {
            const letter = placement.letter;
            const isBlank = blankIndices.has(placement.wordIndex);
            
            console.log(`Processing placement: ${letter} at (${placement.row}, ${placement.col}), isNew: ${placement.isNew}, isBlank: ${isBlank}`);
            
            if (isBlank) {
                requiredTiles['BLANK'] = (requiredTiles['BLANK'] || 0) + 1;
                console.log(`Required BLANK tile: ${requiredTiles['BLANK']}`);
            } else {
                requiredTiles[letter] = (requiredTiles[letter] || 0) + 1;
                console.log(`Required ${letter} tile: ${requiredTiles[letter]}`);
            }
        });

        console.log('Required Tiles Summary:', requiredTiles);
        console.log('Available Tiles:', this.tileSupply);

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
                console.log(`Missing ${letter}: need ${needed}, have ${available}, shortage ${needed - available}`);
            }
        }

        if (missingTiles.length > 0) {
            const missingTileMessages = missingTiles.map(tile => 
                `${tile.letter}: ${tile.shortage} needed (${tile.available} available)`
            ).join(', ');
            
            console.log('❌ Tile validation FAILED:', missingTileMessages);
            
            return {
                valid: false,
                error: `Not enough tiles in bag. Missing: ${missingTileMessages}`,
                tileConflicts: missingTiles
            };
        }

        console.log('✅ Tile validation PASSED: All required tiles available');
        console.log('=== END TILE AVAILABILITY DEBUG ===');

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

        // Phase 3 Fix: Mark premium squares used in this turn
        const usedPremiumSquares = this.premiumSquareTracker.markPremiumSquaresForTurn(
            this.boardLayout, 
            breakdown.newPlacements
        );
        
        // Store used premium squares in turn record for undo functionality
        turn.usedPremiumSquares = usedPremiumSquares;

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
        
        // Phase 4 Fix: Save premium square tracker state after each turn
        this.premiumSquareTracker.saveState();
        
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
            
            // Phase 3 Fix: Restore premium squares that were used in the undone turn
            if (lastTurn.usedPremiumSquares) {
                this.premiumSquareTracker.restorePremiumSquares(lastTurn.usedPremiumSquares);
                console.log('Restored premium squares:', lastTurn.usedPremiumSquares);
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

    // Calculate remaining tiles from the bag (tiles that were never played)
    calculateRemainingTiles() {
        const remainingTiles = [];
        
        // Create a copy of the initial tile supply
        const initialSupply = {
            'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9, 'J': 1,
            'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 4, 'T': 6,
            'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1, 'BLANK': 2
        };
        
        // Subtract tiles that are currently on the board
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const tile = this.boardState[r][c];
                if (tile) {
                    if (tile.isBlank) {
                        initialSupply['BLANK']--;
                    } else {
                        initialSupply[tile.letter]--;
                    }
                }
            }
        }
        
        // The remaining tiles in initialSupply are the tiles left in the bag
        for (const [letter, count] of Object.entries(initialSupply)) {
            for (let i = 0; i < count; i++) {
                if (letter !== 'BLANK') {
                    remainingTiles.push(letter);
                } else {
                    remainingTiles.push(''); // Represent blank tiles as empty strings
                }
            }
        }
        
        return remainingTiles;
    }

    // Calculate final scores with end-game tile deductions and bonuses
    calculateFinalScores(endingPlayerId, tileDistribution) {
        const finalScores = {};
        const players = this.players;
        
        // Start with current scores
        players.forEach(player => {
            finalScores[player.id] = player.score;
        });
        
        // Calculate total bonus for ending player (sum of all remaining tiles)
        let totalBonus = 0;
        const remainingTiles = this.calculateRemainingTiles();
        remainingTiles.forEach(tile => {
            if (tile === '') {
                // Blank tile has no points
                return;
            }
            totalBonus += this.letterScores[tile] || 0;
        });
        
        // Apply bonus to ending player
        finalScores[endingPlayerId] += totalBonus;
        
        // Apply deductions to other players based on assigned tiles
        for (const [playerId, tiles] of Object.entries(tileDistribution)) {
            if (playerId === endingPlayerId) continue; // Skip ending player
            
            let deduction = 0;
            tiles.forEach(tile => {
                if (tile === '') {
                    // Blank tile has no points
                    return;
                }
                deduction += this.letterScores[tile] || 0;
            });
            
            finalScores[playerId] -= deduction;
        }
        
        // Special case for 2-player games: ending player gets bonus, other player gets same amount deducted
        if (players.length === 2) {
            const otherPlayerId = players.find(p => p.id !== endingPlayerId).id;
            finalScores[otherPlayerId] -= totalBonus;
        }
        
        return finalScores;
    }
}

// Create global game state instance
window.gameState = new GameState();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
