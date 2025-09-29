// Main application controller
class ScrabbleApp {
    constructor() {
        this.currentScreen = 'setup';
        this.currentWord = '';
        this.bingoActive = false;
        this.isSubmitting = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('Scrabble App: Initializing...');
        
        // Get DOM elements
        this.setupElements();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check for existing game in URL or localStorage
        await this.checkForExistingGame();
        
        console.log('Scrabble App: Initialization complete');
    }

    setupElements() {
        // Screens
        this.setupScreen = document.getElementById('setup-screen');
        this.gameScreen = document.getElementById('game-screen');
        
        // Setup screen elements
        this.playerNameInputs = document.querySelectorAll('.player-name-input');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.dictionaryToggle = document.getElementById('dictionary-toggle');
        
        // Game screen elements
        this.playersScoresContainer = document.getElementById('players-scores');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.boardContainer = document.getElementById('scrabble-board');
        
        // Turn flow elements
        this.startPrompt = document.getElementById('start-prompt');
        this.directionContainer = document.getElementById('direction-container');
        this.wordEntryContainer = document.getElementById('word-entry-container');
        this.dirAcrossBtn = document.getElementById('dir-across');
        this.dirDownBtn = document.getElementById('dir-down');
        
        // Word input elements
        this.wordInput = document.getElementById('word-input');
        this.tileDisplayContainer = document.getElementById('tile-display-container');
        this.bingoBtn = document.getElementById('bingo-btn');
        
        // Score elements
        this.turnScoreDisplay = document.getElementById('turn-score');
        this.scoreBreakdownContainer = document.getElementById('score-breakdown');
        
        // Action buttons
        this.submitTurnBtn = document.getElementById('submit-turn-btn');
        this.undoBtn = document.getElementById('undo-btn');
        this.endGameBtn = document.getElementById('end-game-btn');
        
        // Modals
        this.endGameModal = document.getElementById('end-game-modal');
        this.finalScoresContainer = document.getElementById('final-scores');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.statsModal = document.getElementById('stats-modal');
        this.closeStatsBtn = document.getElementById('close-stats-btn');
        this.generalStatsContainer = document.getElementById('general-stats');
        this.playerHistoryContainer = document.getElementById('player-history-container');
        
        // Word validation modal
        this.wordValidationModal = document.getElementById('word-validation-modal');
        this.validationMessage = document.getElementById('validation-message');
        this.validationCancelBtn = document.getElementById('validation-cancel-btn');
        this.validationProceedBtn = document.getElementById('validation-proceed-btn');
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    setupEventListeners() {
        // Setup screen
        this.startGameBtn.addEventListener('click', () => this.handleStartGame());
        
        // Board interaction
        this.boardContainer.addEventListener('click', (e) => this.handleBoardClick(e));
        
        // Direction selection
        this.dirAcrossBtn.addEventListener('click', () => this.handleDirectionChange('across'));
        this.dirDownBtn.addEventListener('click', () => this.handleDirectionChange('down'));
        
        // Word input
        this.wordInput.addEventListener('input', () => this.handleWordInput());
        
        // Bingo button
        this.bingoBtn.addEventListener('click', () => this.toggleBingo());
        
        // Action buttons
        this.submitTurnBtn.addEventListener('click', () => this.handleSubmitTurn());
        this.undoBtn.addEventListener('click', () => this.handleUndo());
        this.endGameBtn.addEventListener('click', () => this.handleEndGame());
        
        // Modal buttons
        this.newGameBtn.addEventListener('click', () => this.handleNewGame());
        this.closeStatsBtn.addEventListener('click', () => this.closeStatsModal());
        this.validationCancelBtn.addEventListener('click', () => this.closeValidationModal());
        this.validationProceedBtn.addEventListener('click', () => this.proceedWithTurn());
        
        // Player cards (for stats)
        this.playersScoresContainer.addEventListener('click', (e) => {
            if (e.target.closest('.player-card')) {
                this.showStatsModal();
            }
        });
        
        // Modal close on backdrop click
        this.statsModal.addEventListener('click', (e) => {
            if (e.target === this.statsModal) {
                this.closeStatsModal();
            }
        });
    }

    async checkForExistingGame() {
        // Check URL for game ID and view mode
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('game');
        const viewMode = urlParams.get('view'); // 'history' or 'pause'
        
        if (gameId) {
            try {
                const gameData = await window.scrabbleAPI.getGame(gameId);
                
                // Set read-only mode for historical games or when explicitly viewing
                const isReadOnly = gameData.status === 'finished' || viewMode === 'history';
                
                await this.loadGame(gameData, isReadOnly);
                return;
            } catch (error) {
                console.error('Failed to load game from URL:', error);
                this.showError('Failed to load game. Please try again.');
            }
        }
        
        // Check localStorage for active game (only if no URL game specified)
        if (!gameId) {
            const savedGameId = localStorage.getItem('scrabble_current_game');
            if (savedGameId) {
                try {
                    const gameData = await window.scrabbleAPI.getGame(savedGameId);
                    if (gameData.status === 'active') {
                        await this.loadGame(gameData, false);
                        return;
                    }
                } catch (error) {
                    console.error('Failed to load saved game:', error);
                    localStorage.removeItem('scrabble_current_game');
                }
            }
        }
    }

    async handleStartGame() {
        const names = Array.from(this.playerNameInputs)
            .map(input => input.value.trim())
            .filter(name => name !== '');
        
        if (names.length < 2 || names.length > 4) {
            this.showError('Please enter between 2 and 4 player names.');
            return;
        }
        
        try {
            this.setLoading(this.startGameBtn, true);
            const gameData = await window.scrabbleAPI.createGame(names);
            await this.loadGame(gameData);
            
            // Save game ID
            localStorage.setItem('scrabble_current_game', gameData.id.toString());
            
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('game', gameData.id);
            window.history.pushState({}, '', url);
            
        } catch (error) {
            console.error('Failed to create game:', error);
            this.showError('Failed to create game. Please try again.');
        } finally {
            this.setLoading(this.startGameBtn, false);
        }
    }

    async loadGame(gameData, isReadOnly = false) {
        window.gameState.initializeGame(gameData);
        this.isReadOnly = isReadOnly;
        this.switchToGameScreen();
        this.renderBoard();
        this.updatePlayerCards();
        this.updateTurnIndicator(isReadOnly);
        this.setupReadOnlyMode(isReadOnly);
        if (!isReadOnly) {
            this.resetTurn();
        }
    }

    setupReadOnlyMode(isReadOnly) {
        if (isReadOnly) {
            // Hide interactive elements
            this.startPrompt.classList.add('hidden');
            this.directionContainer.classList.add('hidden');
            this.wordEntryContainer.classList.add('hidden');
            this.submitTurnBtn.classList.add('hidden');
            this.undoBtn.classList.add('hidden');
            this.endGameBtn.classList.add('hidden');
            
            // Show read-only message
            const readOnlyMessage = document.createElement('div');
            readOnlyMessage.id = 'read-only-message';
            readOnlyMessage.className = 'text-center p-4 border-2 border-dashed rounded-lg text-gray-500 bg-gray-50';
            readOnlyMessage.innerHTML = `
                <div class="text-lg font-semibold mb-2">📖 Viewing Game History</div>
                <p>This is a completed game. You can view the final board and scores.</p>
                <div class="mt-4 flex gap-2 justify-center">
                    <a href="/" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">New Game</a>
                    <a href="/history.html" class="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition">Back to History</a>
                </div>
            `;
            
            // Insert the message where the turn controls would be
            const scoringControls = document.getElementById('scoring-controls');
            const turnFlowContainer = document.getElementById('turn-flow-container');
            turnFlowContainer.innerHTML = '';
            turnFlowContainer.appendChild(readOnlyMessage);
            
            // Disable board interactions
            this.boardContainer.style.pointerEvents = 'none';
            
        } else {
            // Remove read-only message if it exists
            const existingMessage = document.getElementById('read-only-message');
            if (existingMessage) {
                existingMessage.remove();
            }
            
            // Re-enable board interactions
            this.boardContainer.style.pointerEvents = 'auto';
            
            // Show interactive elements
            this.submitTurnBtn.classList.remove('hidden');
            this.undoBtn.classList.remove('hidden');
            this.endGameBtn.classList.remove('hidden');
        }
    }

    switchToGameScreen() {
        this.setupScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.currentScreen = 'game';
    }

    renderBoard() {
        this.boardContainer.innerHTML = '';
        
        window.gameState.boardLayout.forEach((row, r_idx) => {
            row.forEach((bonus, c_idx) => {
                const cell = document.createElement('div');
                cell.dataset.row = r_idx;
                cell.dataset.col = c_idx;
                cell.classList.add('board-cell');
                
                const placedTile = window.gameState.boardState[r_idx][c_idx];

                if (placedTile) {
                    cell.classList.add('tile-placed');
                    const score = placedTile.isBlank ? 0 : (window.gameState.letterScores[placedTile.letter] || 0);
                    cell.innerHTML = `<span>${placedTile.letter}</span><span class="tile-score">${score}</span>`;
                } else {
                    if (bonus) cell.classList.add(bonus);
                    if (r_idx === 7 && c_idx === 7) cell.classList.add('center-star');
                    cell.innerHTML = '';
                }
                this.boardContainer.appendChild(cell);
            });
        });
    }

    handleBoardClick(e) {
        const cell = e.target.closest('.board-cell');
        if (!cell) return;
        
        // Clear previous selection
        document.querySelectorAll('.board-cell.selected').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        
        window.gameState.selectedCell.row = parseInt(cell.dataset.row, 10);
        window.gameState.selectedCell.col = parseInt(cell.dataset.col, 10);
        
        // Update UI flow
        window.gameState.wordDirection = null;
        this.startPrompt.classList.add('hidden');
        this.wordEntryContainer.classList.add('hidden');
        this.directionContainer.classList.remove('hidden');
        
        // Reset direction buttons
        this.resetDirectionButtons();
        
        this.wordInput.value = '';
        this.currentWord = '';
        window.gameState.blankTileIndices.clear();
        this.updateTurnState();
    }

    resetDirectionButtons() {
        this.dirAcrossBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
        this.dirDownBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
    }

    handleDirectionChange(newDirection) {
        const isReselecting = window.gameState.wordDirection === newDirection;
        window.gameState.wordDirection = newDirection;

        if (newDirection === 'across') {
            this.dirAcrossBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-indigo-500 text-white';
            this.dirDownBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
        } else {
            this.dirDownBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-indigo-500 text-white';
            this.dirAcrossBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
        }
        
        if (!isReselecting) {
            // Find existing word fragment
            const originalSelected = { ...window.gameState.selectedCell };
            const fragment = window.gameState.findWordFragment(
                originalSelected.row, 
                originalSelected.col, 
                window.gameState.wordDirection
            );
            window.gameState.selectedCell.row = fragment.startRow;
            window.gameState.selectedCell.col = fragment.startCol;
            this.wordInput.value = fragment.word;
            this.currentWord = fragment.word;
        }
        
        this.wordEntryContainer.classList.remove('hidden');
        this.wordInput.focus();
        this.updateTurnState();
    }

    handleWordInput() {
        this.wordInput.value = this.wordInput.value.toUpperCase().replace(/[^A-Z]/g, '');
        this.currentWord = this.wordInput.value;
        this.updateTurnState();
    }

    toggleBingo() {
        this.bingoActive = !this.bingoActive;
        this.bingoBtn.classList.toggle('active');
        this.bingoBtn.classList.toggle('bg-yellow-400');
        this.bingoBtn.classList.toggle('bg-yellow-600');
        this.updateTurnState();
    }

    updateTurnState() {
        const { score, breakdown } = window.gameState.calculateTurnScore(
            this.currentWord,
            window.gameState.selectedCell.row,
            window.gameState.selectedCell.col,
            window.gameState.wordDirection,
            window.gameState.blankTileIndices
        );
        
        // Add bingo bonus if active
        let finalScore = score;
        if (this.bingoActive) {
            finalScore += 50;
            breakdown.bingoBonus = 50;
        }
        
        this.turnScoreDisplay.textContent = finalScore;
        this.renderScoreBreakdown(breakdown);
        this.updateTileDisplay();

        // Show/hide submit button
        if (window.gameState.wordDirection && this.currentWord && 
            breakdown.newPlacements.length > 0 && !breakdown.error) {
            this.submitTurnBtn.classList.remove('hidden');
        } else {
            this.submitTurnBtn.classList.add('hidden');
        }
    }

    updateTileDisplay() {
        this.tileDisplayContainer.innerHTML = '';
        const word = this.currentWord;
        if (!window.gameState.selectedCell.row === null || !word) return;

        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = window.gameState.wordDirection === 'across' ? 
                window.gameState.selectedCell.row : window.gameState.selectedCell.row + i;
            const col = window.gameState.wordDirection === 'across' ? 
                window.gameState.selectedCell.col + i : window.gameState.selectedCell.col;

            const tile = document.createElement('div');
            tile.classList.add('display-tile');
            tile.dataset.index = i;

            let score = window.gameState.letterScores[letter] || 0;
            let isExisting = false;
            
            if (row < 15 && col < 15) {
                const existingTile = window.gameState.boardState[row][col];
                if (existingTile) {
                    isExisting = true;
                    if (existingTile.letter === letter) {
                        tile.classList.add('display-tile-existing');
                        tile.textContent = existingTile.letter;
                        score = existingTile.isBlank ? 0 : window.gameState.letterScores[existingTile.letter] || 0;
                    } else {
                        tile.classList.add('display-tile-conflict');
                        tile.textContent = letter;
                    }
                } else {
                    tile.classList.add('display-tile-new');
                    tile.textContent = letter;
                    tile.addEventListener('click', () => {
                        if (window.gameState.blankTileIndices.has(i)) {
                            window.gameState.blankTileIndices.delete(i);
                        } else {
                            window.gameState.blankTileIndices.add(i);
                        }
                        this.updateTurnState();
                    });
                }
            } else {
                tile.classList.add('display-tile-conflict');
                tile.textContent = letter;
            }

            if (!isExisting && window.gameState.blankTileIndices.has(i)) {
                tile.classList.add('blank-active');
                score = 0;
            }

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'display-tile-score';
            scoreSpan.textContent = score;
            tile.appendChild(scoreSpan);
            
            this.tileDisplayContainer.appendChild(tile);
        }
    }

    renderScoreBreakdown(breakdown) {
        if (!breakdown || !this.currentWord) {
            this.scoreBreakdownContainer.innerHTML = '';
            return;
        }

        let html = `<div class="font-semibold text-gray-700">Score Breakdown:</div>`;

        if (breakdown.mainWord.word) {
            html += `<div class="flex justify-between items-center"><span>Main Word: ${breakdown.mainWord.word}</span><span class="font-medium">${breakdown.mainWord.score}</span></div>`;
        }

        if (breakdown.secondaryWords.length > 0) {
            html += `<div>Cross Words:</div>`;
            breakdown.secondaryWords.forEach(sw => {
                html += `<div class="flex justify-between items-center pl-4"><span>${sw.word}</span><span class="font-medium">${sw.score}</span></div>`;
            });
        }

        if (breakdown.bingoBonus > 0) {
            html += `<div class="flex justify-between items-center border-t pt-1 mt-1"><span>Bingo Bonus</span><span class="font-medium">${breakdown.bingoBonus}</span></div>`;
        }

        this.scoreBreakdownContainer.innerHTML = html;
    }

    async handleSubmitTurn() {
        if (this.isSubmitting) return;
        
        try {
            this.isSubmitting = true;
            this.setLoading(this.submitTurnBtn, true);
            
            // Validate turn placement
            const validation = window.gameState.validateTurnPlacement(
                this.currentWord,
                window.gameState.selectedCell.row,
                window.gameState.selectedCell.col,
                window.gameState.wordDirection,
                window.gameState.blankTileIndices
            );
            
            if (!validation.valid) {
                this.showError(validation.error);
                return;
            }
            
            // Check if dictionary validation is enabled
            const dictionaryEnabled = this.dictionaryToggle && this.dictionaryToggle.checked;
            
            if (dictionaryEnabled) {
                // Validate words with dictionary
                const { score, breakdown } = window.gameState.calculateTurnScore(
                    this.currentWord,
                    window.gameState.selectedCell.row,
                    window.gameState.selectedCell.col,
                    window.gameState.wordDirection,
                    window.gameState.blankTileIndices
                );
                
                const crossWords = breakdown.secondaryWords.map(sw => sw.word);
                const wordValidation = await window.scrabbleAPI.validateTurn(this.currentWord, crossWords);
                
                if (!wordValidation.allValid) {
                    // Show validation warning modal
                    this.showValidationWarning(wordValidation);
                    return;
                }
            }
            
            // Proceed with turn submission
            await this.submitTurnToServer();
            
        } catch (error) {
            console.error('Failed to submit turn:', error);
            this.showError('Failed to submit turn. Please try again.');
        } finally {
            this.isSubmitting = false;
            this.setLoading(this.submitTurnBtn, false);
        }
    }

    async submitTurnToServer() {
        // Calculate final score
        const { score, breakdown } = window.gameState.calculateTurnScore(
            this.currentWord,
            window.gameState.selectedCell.row,
            window.gameState.selectedCell.col,
            window.gameState.wordDirection,
            window.gameState.blankTileIndices
        );
        
        let finalScore = score;
        if (this.bingoActive) {
            finalScore += 50;
        }
        
        // Prepare turn data
        const turnData = {
            playerId: window.gameState.getCurrentPlayer().id,
            word: this.currentWord,
            score: finalScore,
            secondaryWords: breakdown.secondaryWords,
            boardState: JSON.parse(JSON.stringify(window.gameState.boardState)),
            startRow: window.gameState.selectedCell.row,
            startCol: window.gameState.selectedCell.col,
            direction: window.gameState.wordDirection,
            blankTiles: Array.from(window.gameState.blankTileIndices)
        };
        
        // Apply turn locally first
        window.gameState.applyTurn(turnData);
        
        // Submit to server
        await window.scrabbleAPI.submitTurn(window.gameState.gameId, turnData);
        
        // Update UI
        this.renderBoard();
        this.updatePlayerCards();
        this.updateTurnIndicator();
        this.resetTurn();
    }

    showValidationWarning(validation) {
        let message = `The following words were not found in the dictionary:\n\n`;
        message += `• ${validation.invalidWords.join('\n• ')}\n\n`;
        message += `Would you like to proceed anyway?`;
        
        this.validationMessage.textContent = message;
        this.wordValidationModal.classList.remove('hidden');
    }

    closeValidationModal() {
        this.wordValidationModal.classList.add('hidden');
        this.isSubmitting = false;
        this.setLoading(this.submitTurnBtn, false);
    }

    async proceedWithTurn() {
        this.wordValidationModal.classList.add('hidden');
        try {
            await this.submitTurnToServer();
        } catch (error) {
            console.error('Failed to submit turn:', error);
            this.showError('Failed to submit turn. Please try again.');
        } finally {
            this.isSubmitting = false;
            this.setLoading(this.submitTurnBtn, false);
        }
    }

    handleUndo() {
        if (window.gameState.undoLastTurn()) {
            this.renderBoard();
            this.updatePlayerCards();
            this.updateTurnIndicator();
            this.resetTurn();
        }
    }

    async handleEndGame() {
        const sortedPlayers = [...window.gameState.players].sort((a, b) => b.score - a.score);
        const winner = sortedPlayers[0];
        
        try {
            // Mark game as properly finished with winner
            await window.scrabbleAPI.finishGame(window.gameState.gameId, winner.id);
            
            this.finalScoresContainer.innerHTML = `
                <p class="text-xl mb-4">The winner is <span class="font-bold text-indigo-600">${winner.name}</span> with ${winner.score} points!</p>
                ${sortedPlayers.map(p => `<div class="flex justify-between items-center bg-gray-100 p-3 rounded-lg mb-2"><span class="font-semibold text-lg">${p.name}</span><span class="text-lg">${p.score}</span></div>`).join('')}
            `;
            this.endGameModal.classList.remove('hidden');
            
            // Clear saved game
            localStorage.removeItem('scrabble_current_game');
            
        } catch (error) {
            console.error('Failed to end game:', error);
            this.showError('Failed to end game. Please try again.');
        }
    }

    // Mark game as interrupted when user leaves without properly ending
    async markGameAsInterrupted() {
        if (window.gameState.gameId && !this.isReadOnly) {
            try {
                await window.scrabbleAPI.request(`/games/${window.gameState.gameId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'interrupted' })
                });
            } catch (error) {
                console.error('Failed to mark game as interrupted:', error);
            }
        }
    }

    handleNewGame() {
        this.endGameModal.classList.add('hidden');
        this.gameScreen.classList.add('hidden');
        this.setupScreen.classList.remove('hidden');
        this.currentScreen = 'setup';
        
        // Reset form
        this.playerNameInputs.forEach(input => input.value = '');
        
        // Reset game state
        window.gameState.reset();
        
        // Clear URL
        const url = new URL(window.location);
        url.searchParams.delete('game');
        window.history.pushState({}, '', url);
    }

    resetTurn() {
        this.wordInput.value = '';
        this.currentWord = '';
        window.gameState.selectedCell = { row: null, col: null };
        window.gameState.wordDirection = null;
        document.querySelectorAll('.board-cell.selected').forEach(c => c.classList.remove('selected'));
        
        this.bingoActive = false;
        this.bingoBtn.classList.remove('active', 'bg-yellow-600');
        this.bingoBtn.classList.add('bg-yellow-400');
        
        window.gameState.blankTileIndices.clear();
        
        // Reset UI flow
        this.wordEntryContainer.classList.add('hidden');
        this.directionContainer.classList.add('hidden');
        this.startPrompt.classList.remove('hidden');
        
        this.updateTurnState();
        this.undoBtn.disabled = window.gameState.turnHistory.length === 0;
    }

    updatePlayerCards() {
        this.playersScoresContainer.innerHTML = window.gameState.players.map((player, index) => {
            const isActive = index === window.gameState.currentPlayerIndex;
            return `<div class="player-card p-3 rounded-lg shadow-md transition-all duration-300 cursor-pointer ${isActive ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white'}">
                    <div class="flex justify-between items-center">
                        <h3 class="text-base md:text-lg font-bold truncate pr-2">${player.name}</h3>
                        <span class="text-xl md:text-2xl font-bold">${player.score}</span>
                    </div>
                </div>`;
        }).join('');
    }

    updateTurnIndicator(isReadOnly = false) {
        if (isReadOnly) {
            // Show game completion status for read-only mode
            const sortedPlayers = [...window.gameState.players].sort((a, b) => b.score - a.score);
            const winner = sortedPlayers[0];
            this.turnIndicator.innerHTML = `<h2 class="text-2xl font-bold">Game Complete - <span class="text-green-600">${winner.name}</span> Won!</h2>`;
        } else {
            const currentPlayer = window.gameState.getCurrentPlayer();
            if (currentPlayer) {
                this.turnIndicator.innerHTML = `<h2 class="text-2xl font-bold">It's <span class="text-indigo-600">${currentPlayer.name}'s</span> Turn</h2>`;
            }
        }
    }

    showStatsModal() {
        const stats = window.gameState.getGameStats();
        
        // General stats
        let generalHtml = `<div><div class="text-sm text-gray-500">Current Round</div><div class="text-xl font-bold">${stats.currentRound}</div></div>`;
        if (stats.highestScoringTurn && window.gameState.players && window.gameState.players[stats.highestScoringTurn.playerIndex]) {
            const playerName = window.gameState.players[stats.highestScoringTurn.playerIndex].name;
            generalHtml += `<div><div class="text-sm text-gray-500">Highest Scoring Word</div><div class="text-xl font-bold">${stats.highestScoringTurn.word} (${stats.highestScoringTurn.score})</div><div class="text-xs text-gray-500">by ${playerName}</div></div>`;
        } else {
            generalHtml += `<div><div class="text-sm text-gray-500">Highest Scoring Word</div><div class="text-xl font-bold">-</div></div>`;
        }
        this.generalStatsContainer.innerHTML = generalHtml;

        // Player history table
        this.renderPlayerHistory();

        this.statsModal.classList.remove('hidden');
    }

    renderPlayerHistory() {
        this.playerHistoryContainer.innerHTML = ''; // Clear previous content

        const turns = Array.isArray(window.gameState.turnHistory) ? window.gameState.turnHistory : [];
        const players = Array.isArray(window.gameState.players) ? window.gameState.players : [];

        if (turns.length === 0 || players.length === 0) {
            this.playerHistoryContainer.innerHTML = `<p class="text-center text-gray-500 p-4">No turns have been played yet.</p>`;
            return;
        }

        // Compute current winner for highlight
        const winningScore = Math.max(...players.map(p => p.score || 0));

        // Derive number of rounds from flat turn list (works for active and loaded games)
        const roundsCount = Math.ceil(turns.length / players.length);

        let tableHtml = `<table class="w-full text-sm text-left border-collapse">`;

        // Header
        tableHtml += `<thead><tr class="border-b">`;
        tableHtml += `<th class="p-3 font-semibold text-gray-600 text-center">Round</th>`;
        players.forEach(player => {
            const isWinning = player.score === winningScore && winningScore > 0;
            const headerClass = isWinning ? 'bg-yellow-100' : 'bg-gray-50';
            tableHtml += `<th class="p-3 font-bold text-indigo-600 text-base text-center ${headerClass}">
                            <div>${player.name}</div>
                            <div class="text-2xl text-gray-700 font-bold">${player.score}</div>
                          </th>`;
        });
        tableHtml += `</tr></thead>`;

        // Body - one row per round, one column per player
        tableHtml += `<tbody>`;
        for (let round = 1; round <= roundsCount; round++) {
            tableHtml += `<tr class="border-b last:border-b-0">`;
            tableHtml += `<td class="p-3 font-bold text-center text-gray-500 bg-gray-50">${round}</td>`;

            players.forEach((player, pIndex) => {
                const isWinning = player.score === winningScore && winningScore > 0;
                const cellClass = isWinning ? 'bg-yellow-50' : '';

                // Try two strategies to find the turn for this player in this round:
                // 1) Flat index assumption (strict rotation during live play)
                const idx = (round - 1) * players.length + pIndex;
                let turn = turns[idx];

                // 2) Fallback for loaded games or any non-rotation anomalies:
                //    find by playerId + derived round number if shapes differ
                if (!turn || (turn.playerId !== player.id && turn.player_id !== player.id)) {
                    turn = turns.find((t, i) => {
                        const tRound = t.round_number || (Math.floor(i / players.length) + 1);
                        const tPid = t.playerId ?? t.player_id;
                        return tRound === round && tPid === player.id;
                    });
                }

                if (turn) {
                    const word = turn.word || '';
                    // Support both camelCase (client) and snake_case (server) secondary words
                    let secondary = turn.secondaryWords ?? turn.secondary_words ?? [];
                    if (typeof secondary === 'string') {
                        try { secondary = JSON.parse(secondary); } catch { secondary = []; }
                    }
                    const crossWords = Array.isArray(secondary) && secondary.length > 0
                        ? secondary.map(sw => sw.word).filter(Boolean).join(', ')
                        : '';

                    let wordDisplay = `<div class="font-medium">${word || '&nbsp;'}</div>`;
                    if (crossWords) {
                        wordDisplay += `<div class="text-xs text-gray-400 mt-1">Cross: ${crossWords}</div>`;
                    }

                    const score = turn.score ?? 0;

                    tableHtml += `<td class="p-3 ${cellClass}">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">${wordDisplay}</div>
                                        <span class="font-bold bg-white px-2 py-1 rounded ml-2 text-sm">${score}</span>
                                    </div>
                                  </td>`;
                } else {
                    tableHtml += `<td class="p-3 ${cellClass}"></td>`;
                }
            });

            tableHtml += `</tr>`;
        }
        tableHtml += `</tbody></table>`;

        this.playerHistoryContainer.innerHTML = tableHtml;
    }

    closeStatsModal() {
        this.statsModal.classList.add('hidden');
    }

    // Utility methods
    setLoading(element, loading) {
        if (loading) {
            element.disabled = true;
            element.classList.add('loading');
        } else {
            element.disabled = false;
            element.classList.remove('loading');
        }
    }

    showError(message) {
        // Simple alert for now - could be enhanced with a toast system
        alert(message);
    }
}

// Initialize the app
window.scrabbleApp = new ScrabbleApp();
