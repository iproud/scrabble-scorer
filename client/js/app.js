// Storage keys
const ACTIVE_GAME_STORAGE_KEY = 'scrabble_current_game';
const LAST_INTERRUPTED_STORAGE_KEY = 'scrabble_last_interrupted_game';
const DICTIONARY_PREF_STORAGE_KEY = 'scrabble_dictionary_pref';
const DICTIONARY_GAME_STORAGE_PREFIX = 'scrabble_dictionary_game_';

// Main application controller
class ScrabbleApp {
    constructor() {
        this.currentScreen = 'setup';
        this.currentWord = '';
        this.bingoActive = false;
        this.isSubmitting = false;
        this.interruptInFlight = false;
        this.currentGameLoaded = false;
        this.dictionaryEnabled = false;
        this.dictionaryToggleSyncing = false;
        
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
        this.setupPlayerAutocomplete();
        this.attachNameInputHandlers();
        this.initializeDictionaryPreference();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Lifecycle listeners to preserve game state
        window.addEventListener('beforeunload', () => this.markGameAsInterrupted());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.markGameAsInterrupted();
            }
        });
        
        // Check for existing game in URL or localStorage
        await this.checkForExistingGame();
        this.updateResumeButtonVisibility();
        
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
        this.loadLatestActiveBtn = document.getElementById('load-latest-active-btn');
        this.playerNameHelper = document.getElementById('player-name-helper');
        
        // Game screen elements
        this.playersScoresContainer = document.getElementById('players-scores');
        this.runtimeDictionaryToggle = document.getElementById('dictionary-runtime-toggle');
        this.dictionaryStatusLabel = document.getElementById('dictionary-status-label');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.boardContainer = document.getElementById('scrabble-board');
        this.scoringControls = document.getElementById('scoring-controls');
        this.mobileSheetBackdrop = document.getElementById('mobile-sheet-backdrop');
        this.gameActionsContainer = document.getElementById('game-actions-container');
        this.gameActionsButton = document.getElementById('game-actions-button');
        this.gameActionsMenu = document.getElementById('game-actions-menu');
        
        // Tile countdown and modal elements
        this.tileCountdownBtn = document.getElementById('tile-countdown-btn');
        this.tileCountdownValue = document.getElementById('tile-countdown-value');
        this.tileInventoryModal = document.getElementById('tile-inventory-modal');
        this.closeTileInventoryBtn = document.getElementById('close-tile-inventory-btn');
        this.tileInventoryGrid = document.getElementById('tile-inventory-grid');

        // Turn flow elements
        this.startPrompt = document.getElementById('start-prompt');
        this.directionContainer = document.getElementById('direction-container');
        this.wordEntryContainer = document.getElementById('word-entry-container');
        this.dirAcrossBtn = document.getElementById('dir-across');
        this.dirDownBtn = document.getElementById('dir-down');
        
        // Word input elements
        this.wordInput = document.getElementById('word-input');
        this.tileDisplayContainer = document.getElementById('tile-display-container');
        
        // Score elements
        this.turnScoreDisplay = document.getElementById('turn-score');
        this.scoreBreakdownContainer = document.getElementById('score-breakdown');
        
        // Action buttons
        this.submitTurnBtn = document.getElementById('submit-turn-btn');
        this.cancelTurnBtn = document.getElementById('cancel-turn-btn'); // New cancel button
        this.topbarUndoBtn = document.getElementById('topbar-undo-btn'); // New topbar undo button
        this.endGameBtn = document.getElementById('end-game-btn');
        this.pauseGameBtn = document.getElementById('pause-game-btn');
        this.abandonGameBtn = document.getElementById('abandon-game-btn');
        
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
        
        // Help modal
        this.helpModal = document.getElementById('help-modal');
        this.helpMenuBtn = document.getElementById('help-menu-btn');
        this.closeHelpModalBtn = document.getElementById('close-help-modal-btn');

        this.toggleGameActionsVisibility(false);
        this.updateTileCountdown(); // Initialize tile countdown display
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
        if (this.loadLatestActiveBtn) {
            this.loadLatestActiveBtn.addEventListener('click', () => this.handleResumeLatestGame());
        }
        if (this.dictionaryToggle) {
            this.dictionaryToggle.addEventListener('change', () => this.handleDictionaryToggleChange('setup'));
        }
        if (this.runtimeDictionaryToggle) {
            this.runtimeDictionaryToggle.addEventListener('change', () => this.handleDictionaryToggleChange('runtime'));
        }
        if (this.mobileSheetBackdrop) {
            this.mobileSheetBackdrop.addEventListener('click', () => this.closeMobileSheet());
        }
        this.registerMobileMediaListener();
        
        // Board interaction
        this.boardContainer.addEventListener('click', (e) => this.handleBoardClick(e));
        
        // Direction selection
        this.dirAcrossBtn.addEventListener('click', () => this.handleDirectionChange('across'));
        this.dirDownBtn.addEventListener('click', () => this.handleDirectionChange('down'));
        
        // Word input
        this.wordInput.addEventListener('input', () => this.handleWordInput());
        
        // Action buttons
        this.submitTurnBtn.addEventListener('click', () => this.handleSubmitTurn());
        this.cancelTurnBtn.addEventListener('click', () => this.handleCancelTurn()); // New cancel button listener
        this.topbarUndoBtn.addEventListener('click', () => this.handleUndo()); // New undo button listener
        this.endGameBtn.addEventListener('click', () => this.handleEndGame());
        if (this.pauseGameBtn) {
            this.pauseGameBtn.addEventListener('click', () => this.handlePauseGame());
        }
        if (this.abandonGameBtn) {
            this.abandonGameBtn.addEventListener('click', () => this.handleAbandonGame());
        }
        
        // Modal buttons
        this.newGameBtn.addEventListener('click', () => this.handleNewGame());
        this.closeStatsBtn.addEventListener('click', () => this.closeStatsModal());
        this.validationCancelBtn.addEventListener('click', () => this.closeValidationModal());
        this.validationProceedBtn.addEventListener('click', () => this.proceedWithTurn());

        // Tile countdown and inventory modal
        if (this.tileCountdownBtn) {
            this.tileCountdownBtn.addEventListener('click', () => this.openTileInventoryModal());
        }
        if (this.closeTileInventoryBtn) {
            this.closeTileInventoryBtn.addEventListener('click', () => this.closeTileInventoryModal());
        }
        if (this.tileInventoryModal) {
            this.tileInventoryModal.addEventListener('click', (e) => {
                if (e.target === this.tileInventoryModal) {
                    this.closeTileInventoryModal();
                }
            });
        }
        
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

        // Help modal event listeners
        if (this.helpMenuBtn) {
            this.helpMenuBtn.addEventListener('click', () => this.openHelpModal());
        }
        if (this.closeHelpModalBtn) {
            this.closeHelpModalBtn.addEventListener('click', () => this.closeHelpModal());
        }
        if (this.helpModal) {
            this.helpModal.addEventListener('click', (e) => {
                if (e.target === this.helpModal) {
                    this.closeHelpModal();
                }
            });
        }
    }

    setupPlayerAutocomplete() {
        if (window.PlayerNameAutocomplete) {
            this.playerAutocomplete = new window.PlayerNameAutocomplete(this.playerNameInputs, {
                maxSuggestions: 20
            });
        }
    }

    attachNameInputHandlers() {
        if (!this.playerNameInputs) return;
        this.playerNameInputs.forEach((input) => {
            input.addEventListener('blur', () => {
                const canonical = this.canonicalizeName(input.value);
                if (input.value !== canonical) {
                    input.value = canonical;
                }
                this.refreshNameValidation();
            });
            input.addEventListener('input', () => {
                this.refreshNameValidation();
            });
        });
        this.refreshNameValidation();
    }

    initializeDictionaryPreference() {
        const stored = localStorage.getItem(DICTIONARY_PREF_STORAGE_KEY);
        this.dictionaryEnabled = stored === null ? false : stored === 'true';
        this.syncDictionaryToggles();
    }

    syncDictionaryToggles() {
        this.dictionaryToggleSyncing = true;
        if (this.dictionaryToggle) {
            this.dictionaryToggle.checked = this.dictionaryEnabled;
        }
        if (this.runtimeDictionaryToggle) {
            this.runtimeDictionaryToggle.checked = this.dictionaryEnabled;
        }
        this.updateDictionaryStatusLabel();
        this.dictionaryToggleSyncing = false;
    }

    updateDictionaryStatusLabel() {
        if (!this.dictionaryStatusLabel) return;
        if (this.dictionaryEnabled) {
            this.dictionaryStatusLabel.textContent = 'On';
            this.dictionaryStatusLabel.className = 'text-xs font-semibold uppercase tracking-wide text-emerald-500';
        } else {
            this.dictionaryStatusLabel.textContent = 'Off';
            this.dictionaryStatusLabel.className = 'text-xs font-semibold uppercase tracking-wide text-gray-400';
        }
    }

    handleDictionaryToggleChange(source) {
        if (this.dictionaryToggleSyncing) return;
        const newValue = source === 'runtime'
            ? !!(this.runtimeDictionaryToggle && this.runtimeDictionaryToggle.checked)
            : !!(this.dictionaryToggle && this.dictionaryToggle.checked);
        this.dictionaryEnabled = newValue;

        this.dictionaryToggleSyncing = true;
        if (source === 'runtime' && this.dictionaryToggle) {
            this.dictionaryToggle.checked = newValue;
        }
        if (source === 'setup' && this.runtimeDictionaryToggle) {
            this.runtimeDictionaryToggle.checked = newValue;
        }
        this.dictionaryToggleSyncing = false;

        this.updateDictionaryStatusLabel();
        this.persistDictionaryPreference();
    }

    persistDictionaryPreference() {
        localStorage.setItem(DICTIONARY_PREF_STORAGE_KEY, String(this.dictionaryEnabled));
        if (window.gameState && window.gameState.gameId) {
            localStorage.setItem(`${DICTIONARY_GAME_STORAGE_PREFIX}${window.gameState.gameId}`, String(this.dictionaryEnabled));
        }
    }

    applyGameDictionaryPreference(gameId) {
        let stored = null;
        if (gameId) {
            stored = localStorage.getItem(`${DICTIONARY_GAME_STORAGE_PREFIX}${gameId}`);
        }
        if (stored === null) {
            stored = localStorage.getItem(DICTIONARY_PREF_STORAGE_KEY);
        }
        this.dictionaryEnabled = stored === null ? false : stored === 'true';
        this.syncDictionaryToggles();
        if (gameId) {
            localStorage.setItem(`${DICTIONARY_GAME_STORAGE_PREFIX}${gameId}`, String(this.dictionaryEnabled));
        }
    }

    toggleGameActionsVisibility(show) {
        if (!this.gameActionsContainer) return;

        if (!show && window.topbarMenus && window.topbarMenus.gameActions) {
            window.topbarMenus.gameActions.close();
        }

        this.gameActionsContainer.classList.toggle('hidden', !show);

        if (this.gameActionsButton) {
            this.gameActionsButton.setAttribute('aria-hidden', String(!show));
            this.gameActionsButton.tabIndex = show ? 0 : -1;
        }

        [this.pauseGameBtn, this.endGameBtn, this.abandonGameBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = !show;
            btn.classList.toggle('opacity-50', !show);
            btn.classList.toggle('cursor-not-allowed', !show);
        });
    }

    updateRuntimeDictionaryInteractivity(isReadOnly) {
        if (!this.runtimeDictionaryToggle) return;
        this.runtimeDictionaryToggle.disabled = isReadOnly;
        this.runtimeDictionaryToggle.classList.toggle('opacity-50', isReadOnly);
        this.runtimeDictionaryToggle.classList.toggle('cursor-not-allowed', isReadOnly);
    }

    canonicalizeName(name = '') {
        return name
            .trim()
            .replace(/\s+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
    }

    collectPlayerNames() {
        const names = [];
        this.playerNameInputs.forEach((input) => {
            const canonical = this.canonicalizeName(input.value);
            if (input.value !== canonical) {
                input.value = canonical;
            }
            if (canonical.length > 0) {
                names.push(canonical);
            }
        });
        const lowerNames = names.map((name) => name.toLowerCase());
        const hasDuplicate = new Set(lowerNames).size !== lowerNames.length;
        return { names, hasDuplicate };
    }

    refreshNameValidation() {
        const { names, hasDuplicate } = this.collectPlayerNames();
        let message = '';
        if (hasDuplicate) {
            message = 'Player names must be unique (case-insensitive).';
        } else if (names.length > 4) {
            message = 'Enter no more than four player names.';
        } else if (names.length > 0 && names.length < 2) {
            message = 'Enter at least two player names to begin.';
        }
        if (this.playerNameHelper) {
            this.playerNameHelper.textContent = message;
            this.playerNameHelper.classList.toggle('hidden', message.length === 0);
        }
        const canStart = !hasDuplicate && names.length >= 2 && names.length <= 4;
        if (this.startGameBtn) {
            this.startGameBtn.disabled = !canStart;
            this.startGameBtn.classList.toggle('opacity-50', !canStart);
            this.startGameBtn.classList.toggle('cursor-not-allowed', !canStart);
        }
        return { names, hasDuplicate };
    }

    updateResumeButtonVisibility() {
        if (!this.loadLatestActiveBtn) return;
        const resumableGameId = this.getResumableGameId();
        if (!this.currentGameLoaded && resumableGameId) {
            this.loadLatestActiveBtn.classList.remove('hidden');
        } else {
            this.loadLatestActiveBtn.classList.add('hidden');
        }
    }

    getResumableGameId() {
        return localStorage.getItem(ACTIVE_GAME_STORAGE_KEY) || localStorage.getItem(LAST_INTERRUPTED_STORAGE_KEY);
    }

    clearStoredGameRefs() {
        localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
        localStorage.removeItem(LAST_INTERRUPTED_STORAGE_KEY);
    }

    async handleResumeLatestGame() {
        const gameId = this.getResumableGameId();
        if (!gameId) {
            this.updateResumeButtonVisibility();
            return;
        }
        try {
            if (this.loadLatestActiveBtn) {
                this.setLoading(this.loadLatestActiveBtn, true);
            }
            const gameData = await window.scrabbleAPI.getGame(gameId);
            if (gameData.status === 'interrupted') {
                await window.scrabbleAPI.updateGameStatus(gameData.id, 'active');
                gameData.status = 'active';
            }
            await this.loadGame(gameData, false);
        } catch (error) {
            console.error('Failed to resume game:', error);
            this.showError('Unable to resume the saved game. It may have been deleted.');
            this.clearStoredGameRefs();
        } finally {
            if (this.loadLatestActiveBtn) {
                this.setLoading(this.loadLatestActiveBtn, false);
            }
            this.updateResumeButtonVisibility();
        }
    }

    async handlePauseGame() {
        if (!window.gameState.gameId || this.isReadOnly) return;
        try {
            this.setLoading(this.pauseGameBtn, true);
            await window.scrabbleAPI.updateGameStatus(window.gameState.gameId, 'interrupted');
            window.gameState.isGameActive = false;
            localStorage.setItem(LAST_INTERRUPTED_STORAGE_KEY, window.gameState.gameId.toString());
            localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
            alert('Game paused. You can resume it later from the setup screen.');
            this.handleNewGame();
        } catch (error) {
            console.error('Failed to pause game:', error);
            this.showError('Failed to pause the game. Please try again.');
        } finally {
            this.setLoading(this.pauseGameBtn, false);
            this.updateResumeButtonVisibility();
        }
    }

    async handleAbandonGame() {
        if (!window.gameState.gameId || this.isReadOnly) return;
        const confirmed = confirm('Are you sure you want to abandon this game? This will permanently delete all progress.');
        if (!confirmed) return;

        try {
            this.setLoading(this.abandonGameBtn, true);
            await window.scrabbleAPI.deleteGame(window.gameState.gameId);
            window.gameState.isGameActive = false;
            this.clearStoredGameRefs();
            alert('Game abandoned and removed from history.');
            this.handleNewGame();
        } catch (error) {
            console.error('Failed to abandon game:', error);
            this.showError('Failed to abandon the game. Please try again.');
        } finally {
            this.setLoading(this.abandonGameBtn, false);
            this.updateResumeButtonVisibility();
        }
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
        const { names, hasDuplicate } = this.refreshNameValidation();
        
        if (hasDuplicate || names.length < 2 || names.length > 4) {
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
        this.currentGameLoaded = !isReadOnly;
        this.applyGameDictionaryPreference(gameData.id);
        
        if (!isReadOnly) {
            localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, gameData.id.toString());
            localStorage.removeItem(LAST_INTERRUPTED_STORAGE_KEY);
        } else {
            this.clearStoredGameRefs();
        }

        this.switchToGameScreen();
        this.renderBoard();
        this.updatePlayerCards();
        this.updateTurnIndicator(isReadOnly);
        this.setupReadOnlyMode(isReadOnly);
        if (!isReadOnly) {
            this.resetTurn();
            this.updateCancelAndUndoButtonVisibility(); // Update button visibility
        } else {
            this.closeMobileSheet();
        }
        this.updateResumeButtonVisibility();
        this.updateCancelAndUndoButtonVisibility(); // Update button visibility
    }

    setupReadOnlyMode(isReadOnly) {
        this.updateRuntimeDictionaryInteractivity(isReadOnly);
        this.toggleGameActionsVisibility(!isReadOnly);

        if (isReadOnly) {
            // Hide interactive elements
            this.startPrompt.classList.add('hidden');
            this.directionContainer.classList.add('hidden');
            this.wordEntryContainer.classList.add('hidden');
            this.submitTurnBtn.classList.add('hidden');
            if (this.cancelTurnBtn) this.cancelTurnBtn.classList.add('hidden'); // Ensure cancel button is hidden in read-only
            if (this.topbarUndoBtn) this.topbarUndoBtn.classList.add('hidden'); // Ensure topbar undo button is hidden in read-only
            if (this.endGameBtn) this.endGameBtn.classList.add('hidden');
            if (this.pauseGameBtn) this.pauseGameBtn.classList.add('hidden');
            if (this.abandonGameBtn) this.abandonGameBtn.classList.add('hidden');
            
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
            // Old undoBtn logic removed, new topbarUndoBtn visibility handled by updateCancelAndUndoButtonVisibility
            if (this.endGameBtn) this.endGameBtn.classList.remove('hidden');
            if (this.pauseGameBtn) {
                this.pauseGameBtn.classList.remove('hidden', 'loading');
                this.pauseGameBtn.disabled = false;
            }
            if (this.abandonGameBtn) {
                this.abandonGameBtn.classList.remove('hidden', 'loading');
                this.abandonGameBtn.disabled = false;
            }
            this.updateCancelAndUndoButtonVisibility(); // Ensure correct visibility for interactive mode
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
        
        // In mobile view, if sheet is already open, close it and don't process the click
        if (!this.isReadOnly && this.isMobileLayout()) {
            if (this.isMobileSheetOpen()) {
                this.closeMobileSheet();
                return; // Don't process cell selection when closing the sheet
            }
            this.openMobileSheet();
        }
        
        // Clear previous selection
        document.querySelectorAll('.board-cell.selected').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        
        window.gameState.selectedCell.row = parseInt(cell.dataset.row, 10);
        window.gameState.selectedCell.col = parseInt(cell.dataset.col, 10);
        
        // Update UI flow
        window.gameState.wordDirection = null;
        this.startPrompt.classList.add('hidden');
        this.directionContainer.classList.remove('hidden'); // Show direction buttons
        this.wordEntryContainer.classList.add('hidden'); // Keep word entry hidden initially
        
        // Reset direction buttons visuals
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
        
        // Ensure word entry container is visible after a direction is chosen
        this.wordEntryContainer.classList.remove('hidden'); 
        this.wordInput.focus();
        this.updateTurnState();
    }

    handleWordInput() {
        this.wordInput.value = this.wordInput.value.toUpperCase().replace(/[^A-Z]/g, '');
        this.currentWord = this.wordInput.value;
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
        
        // Automatically activate bingo if eligible
        this.bingoActive = breakdown.eligibleForBingo;

        // Add bingo bonus if active
        let finalScore = score;
        if (this.bingoActive) {
            finalScore += 50;
            breakdown.bingoBonus = 50; // Set bingoBonus in breakdown for display
        }
        
        // Check tile availability for UI feedback
        if (breakdown.newPlacements.length > 0) {
            const tileValidation = window.gameState.validateTileAvailability(
                breakdown.newPlacements, 
                window.gameState.blankTileIndices
            );
            breakdown.tileConflicts = tileValidation.tileConflicts;
            breakdown.tileError = tileValidation.valid ? null : tileValidation.error;
        }
        
        this.turnScoreDisplay.textContent = finalScore;
        this.renderScoreBreakdown(breakdown);
        this.updateTileDisplay(breakdown.tileConflicts);

        // Show/hide submit button
        const canSubmit = window.gameState.wordDirection && this.currentWord && 
            breakdown.newPlacements.length > 0 && !breakdown.error && !breakdown.tileError;
            
        if (canSubmit) {
            this.submitTurnBtn.classList.remove('hidden');
        } else {
            this.submitTurnBtn.classList.add('hidden');
        }
        this.updateCancelAndUndoButtonVisibility(); // Update button visibility
    }

    updateTileDisplay(tileConflicts = null) {
        this.tileDisplayContainer.innerHTML = '';
        const word = this.currentWord;
        if (window.gameState.selectedCell.row === null || !word) return; // Corrected condition

        // Create a map of conflicting tiles for quick lookup
        const conflictMap = new Map();
        if (tileConflicts) {
            tileConflicts.forEach(conflict => {
                conflictMap.set(conflict.letter, conflict);
            });
        }

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
            let isBlank = window.gameState.blankTileIndices.has(i);
            
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
                    // Check if this new tile has a tile availability conflict
                    const tileLetter = isBlank ? 'BLANK' : letter;
                    const hasTileConflict = conflictMap.has(tileLetter);
                    
                    if (hasTileConflict) {
                        tile.classList.add('display-tile-conflict');
                        tile.title = `Not enough ${tileLetter} tiles in bag (need ${conflictMap.get(tileLetter).needed}, have ${conflictMap.get(tileLetter).available})`;
                    } else {
                        tile.classList.add('display-tile-new');
                    }
                    
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

            if (!isExisting && isBlank) {
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
            const dictionaryEnabled = this.dictionaryEnabled;
            
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
            boardState: JSON.parse(JSON.stringify(window.gameState.boardState)), // This is the board state *before* the new turn is applied
            startRow: window.gameState.selectedCell.row,
            startCol: window.gameState.selectedCell.col,
            direction: window.gameState.wordDirection,
            blankTiles: Array.from(window.gameState.blankTileIndices)
        };
        
        // Apply turn locally first (this will modify window.gameState.boardState and populate `boardStateAfter` in the last turn history entry)
        const newTurn = window.gameState.applyTurn(turnData);

        // Prepare turn data for the server, using the actual boardState after the turn was applied
        const turnDataForServer = {
            playerId: newTurn.playerId,
            word: newTurn.word,
            score: newTurn.score,
            secondaryWords: newTurn.secondaryWords,
            boardState: JSON.parse(JSON.stringify(newTurn.boardStateAfter)), // Send the state AFTER this turn
            startRow: newTurn.startRow,
            startCol: newTurn.startCol,
            direction: newTurn.direction,
            blankTiles: newTurn.blankTiles
        };
        
        console.log('Sending turnDataForServer:', turnDataForServer); // DEBUG LOG

        // Submit to server
        await window.scrabbleAPI.submitTurn(window.gameState.gameId, turnDataForServer);
        
        // Update UI
        this.renderBoard();
        this.updatePlayerCards();
        this.updateTurnIndicator();
        this.resetTurn();
        this.updateTileCountdown(); // Update tile countdown after each turn
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

    async handleUndo() {
        try {
            await window.gameState.undoLastTurn();
            this.renderBoard();
            this.updatePlayerCards();
            this.updateTurnIndicator();
            this.resetTurn();
        } catch (error) {
            console.error('Error in handleUndo:', error);
            this.showError('Failed to undo last turn. Please try again.');
        }
    }

    async handleEndGame() {
        const sortedPlayers = [...window.gameState.players].sort((a, b) => b.score - a.score);
        const winner = sortedPlayers[0];
        
        try {
            // Mark game as properly finished with winner
            await window.scrabbleAPI.finishGame(window.gameState.gameId, winner.id);
            window.gameState.isGameActive = false;
            this.clearStoredGameRefs();
            this.updateResumeButtonVisibility();
            
            this.finalScoresContainer.innerHTML = `
                <p class="text-xl mb-4">The winner is <span class="font-bold text-indigo-600">${winner.name}</span> with ${winner.score} points!</p>
                ${sortedPlayers.map(p => `<div class="flex justify-between items-center bg-gray-100 p-3 rounded-lg mb-2"><span class="font-semibold text-lg">${p.name}</span><span class="text-lg">${p.score}</span></div>`).join('')}
            `;
            this.endGameModal.classList.remove('hidden');
            this.updateTileCountdown(); // Update tile countdown to show all tiles for new game
            
            // Clear saved game
            localStorage.removeItem('scrabble_current_game');
            
        } catch (error) {
            console.error('Failed to end game:', error);
            this.showError('Failed to end game. Please try again.');
        }
    }

    // Mark game as interrupted when user leaves without properly ending
    async markGameAsInterrupted() {
        if (this.interruptInFlight || this.isReadOnly || !window.gameState.gameId) {
            return;
        }
        if (window.gameState.isGameActive === false) {
            return;
        }
        this.interruptInFlight = true;
        this.closeMobileSheet();
        const gameId = window.gameState.gameId;
        const payload = JSON.stringify({ status: 'interrupted' });
        const url = `${window.location.origin}/api/games/${gameId}/status`;

        try {
            let delivered = false;
            if (navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                delivered = navigator.sendBeacon(url, blob);
            }
            // Always use PUT method based on server route definition
            await fetch(url, {
                method: 'PUT', // Corrected to PUT
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            });
            window.gameState.isGameActive = false;
            localStorage.setItem(LAST_INTERRUPTED_STORAGE_KEY, gameId.toString());
            localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
        } catch (error) {
            console.error('Failed to mark game as interrupted:', error);
        } finally {
            this.interruptInFlight = false;
            this.updateResumeButtonVisibility();
        }
    }

    registerMobileMediaListener() {
        if (this.mobileMediaQueryListenerRegistered) return;
        const query = window.matchMedia('(max-width: 640px)');
        query.addEventListener('change', () => {
            if (!query.matches) {
                this.closeMobileSheet();
            }
        });
        this.mobileMediaQueryListenerRegistered = true;
    }

    isMobileLayout() {
        return window.matchMedia('(max-width: 640px)').matches;
    }

    isMobileSheetOpen() {
        return document.body.classList.contains('mobile-game-sheet-open');
    }

    openMobileSheet() {
        document.body.classList.add('mobile-game-sheet-open');
        if (this.mobileSheetBackdrop) {
            this.mobileSheetBackdrop.classList.remove('hidden');
        }
    }

    closeMobileSheet() {
        document.body.classList.remove('mobile-game-sheet-open');
        if (this.mobileSheetBackdrop) {
            this.mobileSheetBackdrop.classList.add('hidden');
        }
    }

    handleGameScreenClick(event) {
        if (!this.isMobileLayout() || !this.isMobileSheetOpen()) return;
        if (this.scoringControls && this.scoringControls.contains(event.target)) return;
        this.closeMobileSheet();
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
        this.updateTileCountdown(); // Reset tile countdown display

        // Clear URL
        const url = new URL(window.location);
        url.searchParams.delete('game');
        window.history.pushState({}, '', url);

        this.currentGameLoaded = false;
        this.refreshNameValidation();
        this.updateResumeButtonVisibility();
        this.applyGameDictionaryPreference(null);
        this.toggleGameActionsVisibility(false);
        this.closeMobileSheet();
    }

    resetTurn() {
        this.wordInput.value = '';
        this.currentWord = '';
        window.gameState.selectedCell = { row: null, col: null };
        window.gameState.wordDirection = null;
        document.querySelectorAll('.board-cell.selected').forEach(c => c.classList.remove('selected'));
        
        this.bingoActive = false;
        
        window.gameState.blankTileIndices.clear();
        
        // Reset UI flow
        this.wordEntryContainer.classList.add('hidden');
        this.directionContainer.classList.add('hidden');
        this.startPrompt.classList.remove('hidden');
        
        this.updateTurnState();
        // this.undoBtn.disabled = window.gameState.turnHistory.length === 0; // Removed, handled by updateCancelAndUndoButtonVisibility

        if (this.isMobileLayout()) {
            this.closeMobileSheet();
        }
        this.updateCancelAndUndoButtonVisibility(); // Update visibility after clear
        this.updateTileCountdown(); // Update tile countdown after resetting the turn
    }
    // New helper method to clear word input and reset UI flow without immediately calling updateTurnState
    clearWordInputAndResetUI() {
        this.wordInput.value = '';
        this.currentWord = '';
        window.gameState.selectedCell = { row: null, col: null };
        window.gameState.wordDirection = null;
        document.querySelectorAll('.board-cell.selected').forEach(c => c.classList.remove('selected'));
        
        // Reset UI flow to initial state
        this.wordEntryContainer.classList.add('hidden');
        this.directionContainer.classList.add('hidden');
        this.startPrompt.classList.remove('hidden');

        // This should not call updateTurnState directly to avoid recalculating score with empty word and triggering unnecessary updates
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

    openHelpModal() {
        if (!this.helpModal) return;
        this.helpModal.classList.remove('hidden');
    }

    closeHelpModal() {
        if (!this.helpModal) return;
        this.helpModal.classList.add('hidden');
    } 

    // New methods for tile countdown and inventory modal
    updateTileCountdown() {
        if (!this.tileCountdownValue) return;
        const { totalRemaining } = window.gameState.getTileSupply();
        this.tileCountdownValue.textContent = totalRemaining;
        this.tileCountdownBtn.classList.toggle('hidden', this.isReadOnly || !window.gameState.gameId); // Hide if in read-only mode or no game active
    }

    openTileInventoryModal() {
        if (!this.tileInventoryModal || !this.tileInventoryGrid) return;
        
        const { supply } = window.gameState.getTileSupply();
        this.tileInventoryGrid.innerHTML = ''; // Clear previous tiles

        const tileOrder = [
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
            'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            'BLANK' // Blank tile explicitly at the end
        ];

        tileOrder.forEach(letter => {
            const count = supply[letter];
            if (count === undefined) return; // Skip if tile not in supply

            const tileElement = document.createElement('div');
            tileElement.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'p-1', 'border', 'rounded-lg', 'bg-gray-50');
            
            // Apply special styling for BLANK tiles
            const letterClass = letter === 'BLANK' ? 'tile-inventory-blank' : 'text-xl font-bold';
            tileElement.innerHTML = `
                <span class="${letterClass}">${letter}</span>
                <span class="text-xs text-gray-500">${count}</span>
            `;
            if (count === 0) {
                // Apply 'faded out' style when no more tiles are available
                tileElement.classList.add('opacity-30', 'grayscale');
            }
            this.tileInventoryGrid.appendChild(tileElement);
        });

        this.tileInventoryModal.classList.remove('hidden');
    }

    closeTileInventoryModal() {
        if (!this.tileInventoryModal) return;
        this.tileInventoryModal.classList.add('hidden');
    }

    // Utility methods
    setLoading(element, loading) {
        if (!element) return;
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

    // New helper method to manage visibility of cancel and undo buttons
    updateCancelAndUndoButtonVisibility() {
        // Cancel button visible only if a word is being entered or a cell is selected
        if (this.cancelTurnBtn) {
            this.cancelTurnBtn.classList.toggle('hidden', !(this.currentWord || window.gameState.selectedCell.row !== null));
        }

        if (this.topbarUndoBtn) {
            // Undo button visible only if there's turn history and not in read-only mode
            this.topbarUndoBtn.classList.toggle('hidden', this.isReadOnly || window.gameState.turnHistory.length === 0);
            this.topbarUndoBtn.disabled = this.isReadOnly || window.gameState.turnHistory.length === 0;
        }
    }

    handleCancelTurn() {
        this.clearWordInputAndResetUI(); // Use the helper method to clear and reset UI
        
        // Close mobile sheet if open
        if (this.isMobileLayout() && this.isMobileSheetOpen()) {
            this.closeMobileSheet();
        }

        // Call updateTurnState to ensure UI is consistent with reset state
        // This will in turn call updateCancelAndUndoButtonVisibility and updateTileCountdown
        this.updateTurnState(); 
    }
}

// Initialize the app
window.scrabbleApp = new ScrabbleApp();
