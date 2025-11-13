// Game Controller Module - Main Application Orchestrator
class GameController {
    constructor() {
        this.currentScreen = 'setup';
        this.currentWord = '';
        this.bingoActive = false;
        this.isSubmitting = false;
        this.interruptInFlight = false;
        this.currentGameLoaded = false;
        this.dictionaryEnabled = false;
        this.dictionaryToggleSyncing = false;
        
        // Initialize sub-controllers
        this.uiManager = new UIManager();
        this.boardRenderer = null; // Will be set after game initialization
        
        // Real-Time Tile Placement system
        this.wordPreview = null;
        this.wordPreviewEnabled = false;
        this.realTimeTilePlacement = null;
        this.realTimeTilePlacementEnabled = false;
    }

    // Main initialization
    async init() {
        console.log('GameController: Initializing...');
        
        // Setup components
        this.setupPlayerAutocomplete();
        this.attachNameInputHandlers();
        this.initializeDictionaryPreference();
        
        // Initialize Real-Time Tile Placement system
        console.log('GameController: Initializing Real-Time Tile Placement system');
        this.realTimeTilePlacement = new RealTimeTilePlacement(
            this.uiManager.elements.boardContainer, 
            window.gameState
        );
        this.realTimeTilePlacementEnabled = this.realTimeTilePlacement.initialize();
        if (!this.realTimeTilePlacementEnabled) {
            console.error('GameController: Failed to initialize Real-Time Tile Placement system');
        }
        
        // Setup board renderer
        this.boardRenderer = new BoardRenderer(
            this.uiManager.elements.boardContainer,
            window.gameState
        );
        
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
        
        console.log('GameController: Initialization complete');
    }

    // Register service worker
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

    // Setup event listeners
    setupEventListeners() {
        // Setup screen
        this.uiManager.elements.startGameBtn?.addEventListener('click', () => this.handleStartGame());
        this.uiManager.elements.loadLatestActiveBtn?.addEventListener('click', () => this.handleResumeLatestGame());
        this.uiManager.elements.dictionaryToggle?.addEventListener('change', () => this.handleDictionaryToggleChange('setup'));
        this.uiManager.elements.runtimeDictionaryToggle?.addEventListener('change', () => this.handleDictionaryToggleChange('runtime'));
        
        // Mobile sheet backdrop
        this.uiManager.elements.mobileSheetBackdrop?.addEventListener('click', (e) => {
            if (e.target === this.uiManager.elements.mobileSheetBackdrop) {
                // Clean up tile placement when closing sheet via backdrop
                console.log('GameController: Cleaning up tile placement on backdrop click');
                if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled) {
                    this.realTimeTilePlacement.stopPlacement();
                }
                
                // Also cancel the current turn since backdrop click should cancel the operation
                this.handleCancelTurn();
            }
        });
        
        this.uiManager.registerMobileMediaListener();
        
        // Board interaction
        this.uiManager.elements.boardContainer.addEventListener('click', (e) => this.handleBoardClick(e));
        
        // Direction selection
        this.uiManager.elements.dirAcrossBtn?.addEventListener('click', () => this.handleDirectionChange('across'));
        this.uiManager.elements.dirDownBtn?.addEventListener('click', () => this.handleDirectionChange('down'));
        
        // Word input
        this.uiManager.elements.wordInput?.addEventListener('input', () => this.handleWordInput());
        
        // Action buttons
        this.uiManager.elements.submitTurnBtn?.addEventListener('click', () => this.handleSubmitTurn());
        this.uiManager.elements.cancelTurnBtn?.addEventListener('click', () => this.handleCancelTurn());
        this.uiManager.elements.topbarUndoBtn?.addEventListener('click', () => this.handleUndo());
        this.uiManager.elements.endGameBtn?.addEventListener('click', () => this.handleEndGame());
        this.uiManager.elements.pauseGameBtn?.addEventListener('click', () => this.handlePauseGame());
        this.uiManager.elements.abandonGameBtn?.addEventListener('click', () => this.handleAbandonGame());
        
        // Modal buttons
        this.uiManager.elements.newGameBtn?.addEventListener('click', () => this.handleNewGame());
        this.uiManager.elements.closeStatsBtn?.addEventListener('click', () => this.closeStatsModal());
        this.uiManager.elements.validationCancelBtn?.addEventListener('click', () => this.closeValidationModal());
        this.uiManager.elements.validationProceedBtn?.addEventListener('click', () => this.proceedWithTurn());

        // Tile countdown and inventory modal
        this.uiManager.elements.tileCountdownBtn?.addEventListener('click', () => this.openTileInventoryModal());
        this.uiManager.elements.closeTileInventoryBtn?.addEventListener('click', () => this.closeTileInventoryModal());
        this.uiManager.elements.tileInventoryModal?.addEventListener('click', (e) => {
            if (e.target === this.uiManager.elements.tileInventoryModal) {
                this.closeTileInventoryModal();
            }
        });
        
        // Player cards (for stats)
        this.uiManager.elements.playersScoresContainer?.addEventListener('click', (e) => {
            if (e.target.closest('.player-card')) {
                this.showStatsModal();
            }
        });
        
        // Modal close on backdrop click
        this.uiManager.elements.statsModal?.addEventListener('click', (e) => {
            if (e.target === this.uiManager.elements.statsModal) {
                this.closeStatsModal();
            }
        });

        // Help modal event listeners
        this.uiManager.elements.helpMenuBtn?.addEventListener('click', () => this.openHelpModal());
        this.uiManager.elements.closeHelpModalBtn?.addEventListener('click', () => this.closeHelpModal());
        this.uiManager.elements.helpModal?.addEventListener('click', (e) => {
            if (e.target === this.uiManager.elements.helpModal) {
                this.closeHelpModal();
            }
        });

        // Escape key handling
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // If there's an active tile placement, cancel it
                if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled && 
                    this.realTimeTilePlacement.isActive) {
                    console.log('GameController: Escape key pressed - canceling tile placement');
                    this.handleCancelTurn();
                }
                
                // Close any open modals
                this.closeAllModals();
            }
        });
    }

    // Setup player autocomplete
    setupPlayerAutocomplete() {
        if (window.PlayerNameAutocomplete) {
            this.playerAutocomplete = new window.PlayerNameAutocomplete(
                this.uiManager.elements.playerNameInputs, 
                { maxSuggestions: 20 }
            );
        }
    }

    // Attach name input handlers
    attachNameInputHandlers() {
        if (!this.uiManager.elements.playerNameInputs) return;
        this.uiManager.elements.playerNameInputs.forEach((input) => {
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

    // Initialize dictionary preference
    initializeDictionaryPreference() {
        const stored = localStorage.getItem(DICTIONARY_PREF_STORAGE_KEY);
        this.dictionaryEnabled = stored === null ? false : stored === 'true';
        this.syncDictionaryToggles();
    }

    // Synchronize dictionary toggles
    syncDictionaryToggles() {
        this.dictionaryToggleSyncing = true;
        this.uiManager.syncDictionaryToggles(this.dictionaryEnabled);
        this.dictionaryToggleSyncing = false;
    }

    // Handle dictionary toggle change
    handleDictionaryToggleChange(source) {
        if (this.dictionaryToggleSyncing) return;
        const newValue = source === 'runtime'
            ? !!(this.uiManager.elements.runtimeDictionaryToggle && this.uiManager.elements.runtimeDictionaryToggle.checked)
            : !!(this.uiManager.elements.dictionaryToggle && this.uiManager.elements.dictionaryToggle.checked);
        this.dictionaryEnabled = newValue;

        this.syncDictionaryToggles();
        this.persistDictionaryPreference();
    }

    // Persist dictionary preference
    persistDictionaryPreference() {
        localStorage.setItem(DICTIONARY_PREF_STORAGE_KEY, String(this.dictionaryEnabled));
        if (window.gameState && window.gameState.gameId) {
            localStorage.setItem(`${DICTIONARY_GAME_STORAGE_PREFIX}${window.gameState.gameId}`, String(this.dictionaryEnabled));
        }
    }

    // Apply game dictionary preference
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

    // Check for existing game
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
                this.uiManager.showError('Failed to load game. Please try again.');
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

    // Load game
    async loadGame(gameData, isReadOnly = false) {
        window.gameState.initializeGame(gameData);
        this.currentGameLoaded = !isReadOnly;
        this.applyGameDictionaryPreference(gameData.id);
        
        if (!isReadOnly) {
            localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, gameData.id.toString());
            localStorage.removeItem(LAST_INTERRUPTED_STORAGE_KEY);
        } else {
            this.clearStoredGameRefs();
        }

        this.switchToGameScreen();
        this.boardRenderer.renderBoard();
        this.updatePlayerCards();
        this.updateTurnIndicator(isReadOnly);
        this.setupReadOnlyMode(isReadOnly);
        if (!isReadOnly) {
            this.resetTurn();
        } else {
            this.closeMobileSheet();
        }
        this.updateResumeButtonVisibility();
    }

    // Switch to game screen
    switchToGameScreen() {
        this.uiManager.switchToGameScreen();
        this.currentScreen = 'game';
    }

    // Handle board click
    handleBoardClick(e) {
        const cell = e.target.closest('.board-cell');
        if (!cell) return;
        
        // Clean up existing tile placement before starting new one
        if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled) {
            this.realTimeTilePlacement.stopPlacement();
        }
        
        // In mobile view, if sheet is already open, close it and don't process the click
        if (!this.isReadOnly && this.uiManager.isMobileLayout()) {
            if (this.uiManager.isMobileSheetOpen()) {
                this.uiManager.closeMobileSheet();
                return; // Don't process cell selection when closing the sheet
            }
            this.uiManager.openMobileSheet();
        }
        
        // Clear previous selection
        this.boardRenderer.clearSelection();
        this.boardRenderer.selectCell(
            parseInt(cell.dataset.row, 10),
            parseInt(cell.dataset.col, 10)
        );
        
        // Step 1: Set Start Position
        window.gameState.selectedCell = {
            row: parseInt(cell.dataset.row, 10),
            col: parseInt(cell.dataset.col, 10)
        };
        window.gameState.wordDirection = null;
        
        // Clear word input and current word
        this.uiManager.elements.wordInput.value = '';
        this.currentWord = '';
        window.gameState.blankTileIndices.clear();
        
        // Stop any existing Real-Time Tile Placement when selecting new cell
        console.log('GameController: Clearing previous tile placement state');
        
        // Update UI flow - Show Step 2: Choose Direction
        this.uiManager.resetTurnFlow();
        this.uiManager.showDirectionSelection();
        this.uiManager.resetDirectionButtons();
        
        // Clear tile display
        this.updateTurnState();
    }

    // Handle direction change
    handleDirectionChange(newDirection) {
        // Clean up existing tile placement when changing direction
        if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled) {
            this.realTimeTilePlacement.stopPlacement();
        }
        
        const isReselecting = window.gameState.wordDirection === newDirection;
        window.gameState.wordDirection = newDirection;

        this.uiManager.updateDirectionButton(newDirection);
        
        if (!isReselecting) {
            // Step 2: Set Direction - Now proceed to Step 3: Enter Word
            this.uiManager.showWordEntry();
            
            // Clear word input and current word
            this.uiManager.elements.wordInput.value = '';
            this.currentWord = '';
            
            // Clear blank tile indices
            window.gameState.blankTileIndices.clear();
            
            // Start Real-Time Tile Placement when direction is selected
            console.log('GameController: Starting Real-Time Tile Placement with direction:', newDirection);
            if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled) {
                this.realTimeTilePlacement.startPlacement(
                    window.gameState.selectedCell.row,
                    window.gameState.selectedCell.col,
                    newDirection
                );
            }
            
            // Check if start position has an existing tile and pre-fill it
            const existingTile = window.gameState.boardState[window.gameState.selectedCell.row][window.gameState.selectedCell.col];
            if (existingTile) {
                // Pre-fill with existing tile letter
                this.uiManager.elements.wordInput.value = existingTile.letter;
                this.currentWord = existingTile.letter;
                
                // Place cursor at the end for continued typing
                setTimeout(() => {
                    this.uiManager.elements.wordInput.focus();
                    this.uiManager.elements.wordInput.setSelectionRange(
                        this.uiManager.elements.wordInput.value.length,
                        this.uiManager.elements.wordInput.value.length
                    );
                }, 10);
            }
            
            // Update turn state to show the pre-filled tile
            this.updateTurnState();
        }
    }

    // Handle word input
    handleWordInput() {
        // Don't auto-populate - let the user type naturally
        const rawInput = this.uiManager.elements.wordInput.value.toUpperCase().replace(/[^A-Z]/g, '');
        this.uiManager.elements.wordInput.value = rawInput;
        this.currentWord = rawInput;
        
        // Update Real-Time Tile Placement in real-time as user types
        console.log('GameController: Updating Real-Time Tile Placement with word:', this.currentWord);
        if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled) {
            this.realTimeTilePlacement.handleWordInput(this.currentWord);
        }
        
        // Update turn state with the user's input
        this.updateTurnState();
    }

    // Update turn state
    updateTurnState() {
        // Clear any existing validation error states first
        this.uiManager.clearValidationStates();
        
        // Calculate turn score with comprehensive error handling
        let score, breakdown;
        try {
            const result = window.gameState.calculateTurnScore(
                this.currentWord,
                window.gameState.selectedCell.row,
                window.gameState.selectedCell.col,
                window.gameState.wordDirection,
                window.gameState.blankTileIndices
            );
            score = result.score;
            breakdown = result.breakdown;
        } catch (error) {
            console.error('Error calculating turn score:', error);
            score = 0;
            breakdown = { error: 'Error calculating score', newPlacements: [], secondaryWords: [] };
        }
        
        // Automatically activate bingo if eligible
        this.bingoActive = breakdown.eligibleForBingo;

        // Use the score as calculated by calculateTurnScore (bingo bonus already included if eligible)
        const finalScore = score;
        
        // Check tile availability for UI feedback
        if (breakdown.newPlacements && breakdown.newPlacements.length > 0) {
            try {
                const tileValidation = window.gameState.validateTileAvailability(
                    breakdown.newPlacements, 
                    window.gameState.blankTileIndices
                );
                breakdown.tileConflicts = tileValidation.tileConflicts;
                breakdown.tileError = tileValidation.valid ? null : tileValidation.error;
            } catch (error) {
                console.error('Error validating tile availability:', error);
                breakdown.tileError = 'Error validating tiles';
            }
        }
        
        // Apply word formation validation with proper error handling
        try {
            const wordFormationValidation = this.validateWordFormation();
            if (!wordFormationValidation.valid) {
                breakdown.error = wordFormationValidation.error;
            }
        } catch (error) {
            console.error('Error in word formation validation:', error);
            breakdown.error = 'Error validating word formation';
        }
        
        // Update UI components in a deterministic order
        this.uiManager.updateScoreDisplay(finalScore);
        this.renderScoreBreakdown(breakdown);
        this.updateTileDisplay(breakdown);

        // Deterministic submit button visibility logic
        this.updateSubmitButtonVisibility(breakdown);
        this.updateCancelAndUndoButtonVisibility();
    }

    // Update submit button visibility
    updateSubmitButtonVisibility(breakdown) {
        const hasValidWord = this.currentWord && this.currentWord.length > 0;
        const hasValidDirection = window.gameState && window.gameState.wordDirection;
        const hasValidPosition = window.gameState && window.gameState.selectedCell && 
                               window.gameState.selectedCell.row !== null && 
                               window.gameState.selectedCell.col !== null;
        
        // Only allow submit if NEW tiles are being placed
        let hasNewPlacements = false;
        if (breakdown && breakdown.newPlacements) {
            hasNewPlacements = breakdown.newPlacements.some(p => p.isNew);
        }
        
        const hasErrors = breakdown && (breakdown.error || breakdown.tileError);
        const canSubmit = hasValidWord && hasValidDirection && hasValidPosition && 
                         hasNewPlacements && !hasErrors;
        
        this.uiManager.updateSubmitButtonVisibility(canSubmit);
    }

    // Update cancel and undo button visibility
    updateCancelAndUndoButtonVisibility() {
        this.uiManager.updateCancelAndUndoButtonVisibility(
            this.currentWord || (window.gameState.selectedCell.row !== null),
            window.gameState.selectedCell.row !== null,
            window.gameState.turnHistory.length > 0,
            this.isReadOnly
        );
    }

    // Handle submit turn
    async handleSubmitTurn() {
        if (this.isSubmitting) return;
        
        try {
            this.isSubmitting = true;
            this.uiManager.setLoading(this.uiManager.elements.submitTurnBtn, true);
            
            // Validate turn placement
            const validation = window.gameState.validateTurnPlacement(
                this.currentWord,
                window.gameState.selectedCell.row,
                window.gameState.selectedCell.col,
                window.gameState.wordDirection,
                window.gameState.blankTileIndices
            );
            
            if (!validation.valid) {
                this.uiManager.showError(validation.error);
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
            this.uiManager.showError('Failed to submit turn. Please try again.');
        } finally {
            this.isSubmitting = false;
            this.uiManager.setLoading(this.uiManager.elements.submitTurnBtn, false);
        }
    }

    // Submit turn to server
    async submitTurnToServer() {
        const { score, breakdown } = window.gameState.calculateTurnScore(
            this.currentWord,
            window.gameState.selectedCell.row,
            window.gameState.selectedCell.col,
            window.gameState.wordDirection,
            window.gameState.blankTileIndices
        );
        
        const turnData = {
            playerId: window.gameState.getCurrentPlayer().id,
            word: breakdown.mainWord.word,  // Use complete word from breakdown
            score: score,
            secondaryWords: breakdown.secondaryWords,
            boardState: JSON.parse(JSON.stringify(window.gameState.boardState)),
            startRow: window.gameState.selectedCell.row,
            startCol: window.gameState.selectedCell.col,
            direction: window.gameState.wordDirection,
            blankTiles: Array.from(window.gameState.blankTileIndices)
        };
        
        // Apply turn locally first
        const newTurn = window.gameState.applyTurn(turnData);

        // Prepare turn data for the server
        const turnDataForServer = {
            playerId: newTurn.playerId,
            word: newTurn.word,
            score: newTurn.score,
            secondaryWords: newTurn.secondaryWords,
            boardState: JSON.parse(JSON.stringify(newTurn.boardStateAfter)),
            startRow: newTurn.startRow,
            startCol: newTurn.startCol,
            direction: newTurn.direction,
            blankTiles: newTurn.blankTiles
        };
        
        // Submit to server
        await window.scrabbleAPI.submitTurn(window.gameState.gameId, turnDataForServer);
        
        // Update UI
        this.boardRenderer.renderBoard();
        this.updatePlayerCards();
        this.updateTurnIndicator();
        this.resetTurn();
        this.updateTileCountdown();
    }

    // Handle cancel turn
    handleCancelTurn() {
        // Stop Real-Time Tile Placement before clearing UI
        console.log('GameController: Cleaning up tile placement on cancel');
        if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled) {
            this.realTimeTilePlacement.stopPlacement();
        }
        
        this.clearWordInputAndResetUI();
        
        // Close mobile sheet if open
        if (this.uiManager.isMobileLayout() && this.uiManager.isMobileSheetOpen()) {
            this.uiManager.closeMobileSheet();
        }

        // Call updateTurnState to ensure UI is consistent with reset state
        this.updateTurnState();
    }

    // Clear word input and reset UI
    clearWordInputAndResetUI() {
        this.uiManager.elements.wordInput.value = '';
        this.currentWord = '';
        window.gameState.selectedCell = { row: null, col: null };
        window.gameState.wordDirection = null;
        
        // Reset UI flow to initial state
        this.uiManager.resetTurnFlow();
        // This should not call updateTurnState directly to avoid recalculating score with empty word
    }

    // Handle undo
    async handleUndo() {
        try {
            await window.gameState.undoLastTurn();
            this.boardRenderer.renderBoard();
            this.updatePlayerCards();
            this.updateTurnIndicator();
            this.resetTurn();
        } catch (error) {
            console.error('Error in handleUndo:', error);
            this.uiManager.showError('Failed to undo last turn. Please try again.');
        }
    }

    // Handle end game
    async handleEndGame() {
        // Use the global finish game system
        startFinishGameFlow();
    }

    // Handle pause game
    async handlePauseGame() {
        if (!window.gameState.gameId || this.isReadOnly) return;
        try {
            this.uiManager.setLoading(this.uiManager.elements.pauseGameBtn, true);
            await window.scrabbleAPI.updateGameStatus(window.gameState.gameId, 'interrupted');
            window.gameState.isGameActive = false;
            localStorage.setItem(LAST_INTERRUPTED_STORAGE_KEY, window.gameState.gameId.toString());
            localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
            alert('Game paused. You can resume it later from the setup screen.');
            this.handleNewGame();
        } catch (error) {
            console.error('Failed to pause game:', error);
            this.uiManager.showError('Failed to pause the game. Please try again.');
        } finally {
            this.uiManager.setLoading(this.uiManager.elements.pauseGameBtn, false);
            this.updateResumeButtonVisibility();
        }
    }

    // Handle abandon game
    async handleAbandonGame() {
        if (!window.gameState.gameId || this.isReadOnly) return;
        const confirmed = confirm('Are you sure you want to abandon this game? This will permanently delete all progress.');
        if (!confirmed) return;

        try {
            this.uiManager.setLoading(this.uiManager.elements.abandonGameBtn, true);
            await window.scrabbleAPI.deleteGame(window.gameState.gameId);
            window.gameState.isGameActive = false;
            this.clearStoredGameRefs();
            alert('Game abandoned and removed from history.');
            this.handleNewGame();
        } catch (error) {
            console.error('Failed to abandon game:', error);
            this.uiManager.showError('Failed to abandon the game. Please try again.');
        } finally {
            this.uiManager.setLoading(this.uiManager.elements.abandonGameBtn, false);
            this.updateResumeButtonVisibility();
        }
    }

    // Handle new game
    handleNewGame() {
        this.uiManager.hideModal(this.uiManager.elements.endGameModal);
        this.uiManager.switchToSetupScreen();
        this.currentScreen = 'setup';
        
        // Reset form
        this.uiManager.elements.playerNameInputs.forEach(input => input.value = '');
        
        // Reset game state
        window.gameState.reset();
        this.updateTileCountdown();

        // Clear URL
        const url = new URL(window.location);
        url.searchParams.delete('game');
        window.history.pushState({}, '', url);

        this.currentGameLoaded = false;
        this.refreshNameValidation();
        this.updateResumeButtonVisibility();
        this.applyGameDictionaryPreference(null);
        this.uiManager.toggleGameActionsVisibility(false);
        this.uiManager.closeMobileSheet();
    }

    // Handle start game
    async handleStartGame() {
        const { names, hasDuplicate } = this.refreshNameValidation();
        
        if (hasDuplicate || names.length < 2 || names.length > 4) {
            return;
        }
        
        try {
            this.uiManager.setLoading(this.uiManager.elements.startGameBtn, true);
            const gameData = await window.scrabbleAPI.createGame(names);
            await this.loadGame(gameData, false);
            
            // Save game ID
            localStorage.setItem('scrabble_current_game', gameData.id.toString());
            
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('game', gameData.id);
            window.history.pushState({}, '', url);
            
        } catch (error) {
            console.error('Failed to create game:', error);
            this.uiManager.showError('Failed to create game. Please try again.');
        } finally {
            this.uiManager.setLoading(this.uiManager.elements.startGameBtn, false);
        }
    }

    // Handle resume latest game
    async handleResumeLatestGame() {
        const gameId = this.getResumableGameId();
        if (!gameId) {
            this.updateResumeButtonVisibility();
            return;
        }
        try {
            this.uiManager.setLoading(this.uiManager.elements.loadLatestActiveBtn, true);
            const gameData = await window.scrabbleAPI.getGame(gameId);
            if (gameData.status === 'interrupted') {
                await window.scrabbleAPI.updateGameStatus(gameData.id, 'active');
                gameData.status = 'active';
            }
            await this.loadGame(gameData, false);
        } catch (error) {
            console.error('Failed to resume game:', error);
            this.uiManager.showError('Unable to resume the saved game. It may have been deleted.');
            this.clearStoredGameRefs();
        } finally {
            this.uiManager.setLoading(this.uiManager.elements.loadLatestActiveBtn, false);
            this.updateResumeButtonVisibility();
        }
    }

    // Reset turn
    resetTurn() {
        this.uiManager.elements.wordInput.value = '';
        this.currentWord = '';
        window.gameState.selectedCell = { row: null, col: null };
        window.gameState.wordDirection = null;
        this.boardRenderer.clearSelection();
        
        this.bingoActive = false;
        
        window.gameState.blankTileIndices.clear();
        
        // Stop Real-Time Tile Placement when turn is reset
        console.log('GameController: Clearing tile placement state on turn reset');
        if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled) {
            this.realTimeTilePlacement.stopPlacement();
        }
        
        // Reset UI flow
        this.uiManager.resetTurnFlow();

        if (this.uiManager.isMobileLayout()) {
            this.uiManager.closeMobileSheet();
        }
        this.updateCancelAndUndoButtonVisibility();
        this.updateTileCountdown();
    }

    // Setup read-only mode
    setupReadOnlyMode(isReadOnly) {
        this.isReadOnly = isReadOnly;
        this.uiManager.setupReadOnlyMode(isReadOnly);
    }

    // Mark game as interrupted
    async markGameAsInterrupted() {
        if (this.interruptInFlight || this.isReadOnly || !window.gameState.gameId) {
            return;
        }
        this.interruptInFlight = true;
        this.uiManager.closeMobileSheet();
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
                method: 'PUT',
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

    // Update player cards
    updatePlayerCards() {
        this.uiManager.elements.playersScoresContainer.innerHTML = window.gameState.players.map((player, index) => {
            const isActive = index === window.gameState.currentPlayerIndex;
            return `<div class="player-card p-3 rounded-lg shadow-md transition-all duration-300 cursor-pointer ${isActive ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white'}">
                    <div class="flex justify-between items-center">
                        <h3 class="text-base md:text-lg font-bold truncate pr-2">${player.name}</h3>
                        <span class="text-xl md:text-2xl font-bold">${player.score}</span>
                    </div>
                </div>`;
        }).join('');
    }

    // Update turn indicator
    updateTurnIndicator(isReadOnly = false) {
        if (isReadOnly) {
            // Show game completion status for read-only mode
            const sortedPlayers = [...window.gameState.players].sort((a, b) => b.score - a.score);
            const winner = sortedPlayers[0];
            this.uiManager.elements.turnIndicator.innerHTML = `<h2 class="text-2xl font-bold">Game Complete - <span class="text-green-600">${winner.name}</span> Won!</h2>`;
        } else {
            const currentPlayer = window.gameState.getCurrentPlayer();
            if (currentPlayer) {
                this.uiManager.elements.turnIndicator.innerHTML = `<h2 class="text-2xl font-bold">It's <span class="text-indigo-600">${currentPlayer.name}'s</span> Turn</h2>`;
            }
        }
    }

    // Update resume button visibility
    updateResumeButtonVisibility() {
        if (!this.uiManager.elements.loadLatestActiveBtn) return;
        const resumableGameId = this.getResumableGameId();
        if (!this.currentGameLoaded && resumableGameId) {
            this.uiManager.elements.loadLatestActiveBtn.classList.remove('hidden');
        } else {
            this.uiManager.elements.loadLatestActiveBtn.classList.add('hidden');
        }
    }

    // Get resumable game ID
    getResumableGameId() {
        return localStorage.getItem(ACTIVE_GAME_STORAGE_KEY) || localStorage.getItem(LAST_INTERRUPTED_STORAGE_KEY);
    }

    // Clear stored game references
    clearStoredGameRefs() {
        localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
        localStorage.removeItem(LAST_INTERRUPTED_STORAGE_KEY);
    }

    // Update tile countdown
    updateTileCountdown() {
        const { totalRemaining } = window.gameState.getTileSupply();
        this.uiManager.updateTileCountdown(totalRemaining);
        this.uiManager.elements.tileCountdownBtn.classList.toggle('hidden', this.isReadOnly || !window.gameState.gameId);
    }

    // Canonicalize name
    canonicalizeName(name = '') {
        return name
            .trim()
            .replace(/\s+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
    }

    // Refresh name validation
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
        if (this.uiManager.elements.playerNameHelper) {
            this.uiManager.elements.playerNameHelper.textContent = message;
            this.uiManager.elements.playerNameHelper.classList.toggle('hidden', message.length === 0);
        }
        const canStart = !hasDuplicate && names.length >= 2 && names.length <= 4;
        if (this.uiManager.elements.startGameBtn) {
            this.uiManager.elements.startGameBtn.disabled = !canStart;
            this.uiManager.elements.startGameBtn.classList.toggle('opacity-50', !canStart);
            this.uiManager.elements.startGameBtn.classList.toggle('cursor-not-allowed', !canStart);
        }
        return { names, hasDuplicate };
    }

    // Collect player names
    collectPlayerNames() {
        const names = [];
        this.uiManager.elements.playerNameInputs.forEach((input) => {
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

    // Close mobile sheet
    closeMobileSheet() {
        this.uiManager.closeMobileSheet();
    }

    // Validate word formation
    validateWordFormation() {
        if (!this.currentWord || window.gameState.selectedCell.row === null || !window.gameState.wordDirection) {
            return { valid: true }; // No validation needed for empty input
        }

        const existingWord = this.getExistingWordAtPosition();
        
        if (existingWord) {
            const startIndex = this.currentWord.indexOf(existingWord);

            // Check if new letters were added to both sides
            const hasLettersBefore = startIndex > 0;
            const hasLettersAfter = (startIndex + existingWord.length) < this.currentWord.length;

            if (hasLettersBefore && hasLettersAfter) {
                this.showValidationError("Cannot add letters to both sides of an existing word.");
                this.uiManager.hideScoreButton();
                return { valid: false, error: "Cannot add letters to both sides of an existing word." };
            }
        }

        // Clear any previous validation errors when validation passes
        this.clearValidationErrors();
        return { valid: true };
    }

    // Get existing word at position
    getExistingWordAtPosition() {
        if (window.gameState.selectedCell.row === null || !window.gameState.wordDirection) {
            return null;
        }

        const { row, col } = window.gameState.selectedCell;
        const direction = window.gameState.wordDirection;

        // Find existing word fragment at this position
        const wordFragment = window.gameState.findWordFragment(row, col, direction);
        return wordFragment ? wordFragment.word : null;
    }

    // Show validation error
    showValidationError(message) {
        this.uiManager.showValidationError(message);
        this.lastValidationError = message;
    }

    // Clear validation errors
    clearValidationErrors() {
        this.uiManager.clearValidationErrors();
        this.lastValidationError = null;
    }

    // Hide score button
    hideScoreButton() {
        this.uiManager.elements.submitTurnBtn.classList.add('hidden');
    }

    // Show validation warning modal
    showValidationWarning(validation) {
        let message = `The following words were not found in dictionary:\n\n`;
        message += `• ${validation.invalidWords.join('\n• ')}\n\n`;
        message += `Would you like to proceed anyway?`;
        
        this.uiManager.elements.validationMessage.textContent = message;
        this.uiManager.showModal(this.uiManager.elements.wordValidationModal);
        
        // Show backdrop
        const backdrop = this.uiManager.elements.wordValidationModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.classList.add('show');
        }
    }

    // Close validation modal
    closeValidationModal() {
        this.uiManager.hideModal(this.uiManager.elements.wordValidationModal);
        
        // Hide backdrop
        const backdrop = this.uiManager.elements.wordValidationModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
        
        this.isSubmitting = false;
        this.uiManager.setLoading(this.uiManager.elements.submitTurnBtn, false);
    }

    // Proceed with turn
    async proceedWithTurn() {
        this.uiManager.hideModal(this.uiManager.elements.wordValidationModal);
        
        // Hide backdrop
        const backdrop = this.uiManager.elements.wordValidationModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
        
        try {
            await this.submitTurnToServer();
        } catch (error) {
            console.error('Failed to submit turn:', error);
            this.uiManager.showError('Failed to submit turn. Please try again.');
        } finally {
            this.isSubmitting = false;
            this.uiManager.setLoading(this.uiManager.elements.submitTurnBtn, false);
        }
    }

    // Close all modals
    closeAllModals() {
        // Clean up tile placement when closing any modal
        if (this.realTimeTilePlacement && this.realTimeTilePlacementEnabled && 
            this.realTimeTilePlacement.isActive) {
            console.log('GameController: Cleaning up tile placement on modal close');
            this.realTimeTilePlacement.stopPlacement();
            
            // Validate cleanup was successful
            setTimeout(() => {
                if (this.realTimeTilePlacement && !this.realTimeTilePlacement.validateCleanup()) {
                    console.warn('GameController: Tile placement cleanup validation failed');
                }
            }, 100);
        }
        
        this.uiManager.closeAllModals();
        
        // Cancel current turn
        this.handleCancelTurn();
    }

    // Show stats modal
    async showStatsModal() {
        try {
            // Try to get statistics from server first (more reliable)
            let stats;
            if (window.gameState.gameId) {
                try {
                    stats = await window.scrabbleAPI.getGameStatistics(window.gameState.gameId);
                    console.log('Using server-side statistics:', stats);
                } catch (error) {
                    console.warn('Failed to get server statistics, falling back to client-side:', error);
                    stats = window.gameState.getGameStats();
                }
            } else {
                stats = window.gameState.getGameStats();
            }
            
            // General stats
            let generalHtml = `<div><div class="text-sm text-gray-500">Current Round</div><div class="text-xl font-bold">${stats.currentRound}</div></div>`;
            
            if (stats.highestScoringTurn) {
                // Handle both server and client data formats
                let playerName;
                if (stats.highestScoringTurn.player_name) {
                    // Server format
                    playerName = stats.highestScoringTurn.player_name;
                } else if (stats.highestScoringTurn.playerIndex !== undefined && window.gameState.players) {
                    // Client format
                    playerName = window.gameState.players[stats.highestScoringTurn.playerIndex]?.name;
                } else if (stats.players && stats.players.length > 0) {
                    // Find player by ID
                    const player = stats.players.find(p => p.id === stats.highestScoringTurn.playerId);
                    playerName = player?.name;
                }
                
                if (playerName) {
                    generalHtml += `<div><div class="text-sm text-gray-500">Highest Scoring Word</div><div class="text-xl font-bold">${stats.highestScoringTurn.word} (${stats.highestScoringTurn.score})</div><div class="text-xs text-gray-500">by ${playerName}</div></div>`;
                } else {
                    generalHtml += `<div><div class="text-sm text-gray-500">Highest Scoring Word</div><div class="text-xl font-bold">-</div></div>`;
                }
            } else {
                generalHtml += `<div><div class="text-sm text-gray-500">Highest Scoring Word</div><div class="text-xl font-bold">-</div></div>`;
            }
            
            this.uiManager.elements.generalStatsContainer.innerHTML = generalHtml;

            // Player history table
            this.renderPlayerHistory(stats);

            this.uiManager.showModal(this.uiManager.elements.statsModal);
        } catch (error) {
            console.error('Error showing statistics modal:', error);
            this.uiManager.showError('Failed to load statistics. Please try again.');
        }
    }

    // Close stats modal
    closeStatsModal() {
        this.uiManager.hideModal(this.uiManager.elements.statsModal);
    }

    // Open help modal
    openHelpModal() {
        this.uiManager.showModal(this.uiManager.elements.helpModal);
    }

    // Close help modal
    closeHelpModal() {
        this.uiManager.hideModal(this.uiManager.elements.helpModal);
    }

    // Open tile inventory modal
    openTileInventoryModal() {
        if (!this.uiManager.elements.tileInventoryModal || !this.uiManager.elements.tileInventoryGrid) return;
        
        const { supply } = window.gameState.getTileSupply();
        this.uiManager.elements.tileInventoryGrid.innerHTML = ''; // Clear previous tiles

        const tileOrder = [
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
            'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            'BLANK' // Blank tile explicitly at the end
        ];

        tileOrder.forEach(letter => {
            const count = supply[letter];
            if (count === undefined) return; // Skip if tile not in supply

            const tileElement = this.createInventoryTileElement(letter, count);
            this.uiManager.elements.tileInventoryGrid.appendChild(tileElement);
        });

        this.uiManager.showModal(this.uiManager.elements.tileInventoryModal);
    }

    // Create inventory tile element
    createInventoryTileElement(letter, count) {
        const tileButton = document.createElement('button');
        tileButton.className = `finish-game-tile ${count === 0 ? 'opacity-30 grayscale' : ''}`;
        
        // Create letter span
        const letterSpan = document.createElement('span');
        letterSpan.className = 'tile-letter';
        
        // Create score span
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'tile-score';
        
        // Create count span (always shown in tile inventory)
        const countSpan = document.createElement('span');
        countSpan.className = 'tile-count';
        countSpan.textContent = count;
        
        // Handle blank tiles
        if (letter === 'BLANK') {
            tileButton.classList.add('tile-blank');
            letterSpan.textContent = 'BLANK';
            scoreSpan.textContent = '0';
        } else {
            letterSpan.textContent = letter;
            scoreSpan.textContent = window.gameState.letterScores[letter] || 0;
        }
        
        // Assemble tile
        tileButton.appendChild(letterSpan);
        tileButton.appendChild(scoreSpan);
        tileButton.appendChild(countSpan);
        
        return tileButton;
    }

    // Close tile inventory modal
    closeTileInventoryModal() {
        this.uiManager.hideModal(this.uiManager.elements.tileInventoryModal);
    }

    // Render player history
    renderPlayerHistory(stats) {
        this.uiManager.elements.playerHistoryContainer.innerHTML = ''; // Clear previous content

        const turns = Array.isArray(stats.turns) ? stats.turns : [];
        const players = Array.isArray(stats.players) ? stats.players : [];

        if (turns.length === 0 || players.length === 0) {
            this.uiManager.elements.playerHistoryContainer.innerHTML = `<p class="text-center text-gray-500 p-4">No turns have been played yet.</p>`;
            return;
        }

        // Compute current winner for highlight
        const winningScore = Math.max(...players.map(p => p.score || 0));

        // Use server-provided turn map if available, otherwise create from turns
        const turnMap = stats.turnMap ? new Map(stats.turnMap) : this.createTurnMapFromTurns(turns);

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
        for (let round = 1; round <= stats.currentRound; round++) {
            tableHtml += `<tr class="border-b last:border-b-0">`;
            tableHtml += `<td class="p-3 font-bold text-center text-gray-500 bg-gray-50">${round}</td>`;

            players.forEach((player) => {
                const isWinning = player.score === winningScore && winningScore > 0;
                const cellClass = isWinning ? 'bg-yellow-50' : '';

                const key = `${round}-${player.id}`;
                const turnEntries = turnMap.get(key);

                if (turnEntries && turnEntries.length > 0) {
                    turnEntries.forEach((turn, index) => {
                        const word = turn.word;
                        let secondary = turn.secondaryWords || turn.secondary_words || [];
                        if (typeof secondary === 'string') {
                            try { secondary = JSON.parse(secondary); } catch { secondary = []; }
                        }
                        const crossWords = Array.isArray(secondary) && secondary.length > 0
                            ? secondary.map(sw => sw.word || sw).filter(Boolean).join(', ')
                            : '';

                        let wordDisplay = word;
                        if (turn.direction === 'adjustment') {
                            // Special display for adjustment turns
                            if (turn.score > 0) {
                                wordDisplay = `<div class="font-medium text-green-600">Game End Bonus</div>`;
                            } else if (turn.score < 0) {
                                wordDisplay = `<div class="font-medium text-red-600">${word}</div>`;
                            } else {
                                wordDisplay = `<div class="font-medium text-gray-500"><em>Empty</em></div>`;
                            }
                        } else {
                            // Regular turn display
                            wordDisplay = `${index > 0 ? '<div class="text-xs text-gray-500 mt-1">Turn ' + (index + 1) + ':</div>' : ''}<div class="font-medium">${word}</div>`;
                            if (crossWords) {
                                wordDisplay += `<div class="text-xs text-gray-400 mt-1">Cross: ${crossWords}</div>`;
                            }
                        }

                        const score = turn.score ?? 0;
                        const scoreClass = turn.direction === 'adjustment' 
                            ? (score > 0 ? 'text-green-600' : 'text-red-600')
                            : '';

                        tableHtml += `<td class="p-3 ${cellClass}">
                                            <div class="flex justify-between items-start">
                                                <div class="flex-1">${wordDisplay}</div>
                                                <span class="font-bold bg-white px-2 py-1 rounded ml-2 text-sm ${scoreClass}">${score > 0 ? '+' : ''}${score}</span>
                                            </div>
                                          </td>`;
                    });
                } else {
                    // Show empty cells consistently instead of missing data
                    tableHtml += `<td class="p-3 ${cellClass} text-center text-gray-400">—</td>`;
                }
            });

            tableHtml += `</tr>`;
        }
        tableHtml += `</tbody></table>`;

        this.uiManager.elements.playerHistoryContainer.innerHTML = tableHtml;
    }

    // Create turn map from turns array
    createTurnMapFromTurns(turns) {
        const turnMap = new Map();
        turns.forEach((turn, index) => {
            const round = turn.round_number || Math.floor(index / window.gameState.players.length) + 1;
            const playerId = turn.playerId || turn.player_id;
            const key = `${round}-${playerId}`;
            
            // Only keep the first turn found for each round-player combination
            if (!turnMap.has(key)) {
                turnMap.set(key, [{ ...turn, computedRound: round }]);
            }
        });
        return turnMap;
    }

    // Render score breakdown
    renderScoreBreakdown(breakdown) {
        if (!breakdown || !this.currentWord) {
            this.uiManager.elements.scoreBreakdownContainer.innerHTML = '';
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

        this.uiManager.elements.scoreBreakdownContainer.innerHTML = html;
    }

    // Update tile display
    updateTileDisplay(breakdown = null) {
        this.uiManager.elements.tileDisplayContainer.innerHTML = '';
        
        // Get the complete word from breakdown, fallback to user input
        let word = this.currentWord;
        if (breakdown && breakdown.mainWord && breakdown.mainWord.word) {
            word = breakdown.mainWord.word;
            console.log('updateTileDisplay: Using complete word from breakdown:', word, 'instead of user input:', this.currentWord);
        }
        
        if (window.gameState.selectedCell.row === null || !word) return;

        // Create a map of conflicting tiles for quick lookup
        const conflictMap = new Map();
        const tileConflicts = breakdown?.tileConflicts;
        if (tileConflicts) {
            tileConflicts.forEach(conflict => {
                conflictMap.set(conflict.letter, conflict);
            });
        }

        // Display tiles based on the complete word (including existing tiles)
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = window.gameState.wordDirection === 'across' ? 
                window.gameState.selectedCell.row : window.gameState.selectedCell.row + i;
            const col = window.gameState.wordDirection === 'across' ? 
                window.gameState.selectedCell.col + i : window.gameState.selectedCell.col;

            // Skip if we're off the board
            if (!window.gameState.isValidBoardPosition(row, col)) continue;

            const tile = document.createElement('div');
            tile.classList.add('tile', 'tile-lg');
            tile.dataset.index = i;

            let score = window.gameState.letterScores[letter] || 0;
            let isBlank = window.gameState.blankTileIndices.has(i);
            
            // Create letter span
            const letterSpan = document.createElement('span');
            letterSpan.className = 'tile-letter';
            
            // Check if there's an existing tile at this position
            const existingTile = window.gameState.boardState[row][col];
            
            if (existingTile) {
                // There's an existing tile at this position
                if (existingTile.letter === letter) {
                    // This is an existing tile that matches the typed letter
                    tile.classList.add('tile-existing'); // Green for existing tiles
                    letterSpan.textContent = existingTile.letter;
                    score = existingTile.isBlank ? 0 : (window.gameState.letterScores[existingTile.letter] || 0);
                    isBlank = existingTile.isBlank;
                } else {
                    // CONFLICT: Existing tile has different letter
                    tile.classList.add('tile-conflict');
                    letterSpan.textContent = letter;
                    tile.title = `Conflict: Existing tile has '${existingTile.letter}' but you typed '${letter}'`;
                    score = 0;
                }
            } else {
                // No existing tile at this position - this is a new tile placement
                const hasTileConflict = conflictMap.has(letter);
                
                if (hasTileConflict) {
                    tile.classList.add('tile-conflict');
                    tile.title = `Not enough ${letter} tiles in bag (need ${conflictMap.get(letter).needed}, have ${conflictMap.get(letter).available})`;
                    score = 0;
                } else {
                    tile.classList.add('tile-new');
                }
                
                letterSpan.textContent = letter;
                
                // Add click handler for blank tiles
                if (isBlank) {
                    tile.classList.add('tile-blank');
                    score = 0;
                }
                
                tile.addEventListener('click', () => {
                    if (window.gameState.blankTileIndices.has(i)) {
                        window.gameState.blankTileIndices.delete(i);
                    } else {
                        window.gameState.blankTileIndices.add(i);
                    }
                    this.updateTurnState();
                });
            }

            // Create score span
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'tile-score';
            scoreSpan.textContent = score;
            
            // Assemble tile
            tile.appendChild(letterSpan);
            tile.appendChild(scoreSpan);
            
            this.uiManager.elements.tileDisplayContainer.appendChild(tile);
        }
    }
}

// Storage keys
const ACTIVE_GAME_STORAGE_KEY = 'scrabble_current_game';
const LAST_INTERRUPTED_STORAGE_KEY = 'scrabble_last_interrupted_game';
const DICTIONARY_PREF_STORAGE_KEY = 'scrabble_dictionary_pref';
const DICTIONARY_GAME_STORAGE_PREFIX = 'scrabble_dictionary_game_';

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameController;
}
