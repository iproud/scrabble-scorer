// UI Management Module
class UIManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }

    // Cache all DOM elements for performance
    cacheElements() {
        // Screens
        this.elements.setupScreen = document.getElementById('setup-screen');
        this.elements.gameScreen = document.getElementById('game-screen');
        
        // Setup screen elements
        this.elements.playerNameInputs = document.querySelectorAll('.player-name-input');
        this.elements.startGameBtn = document.getElementById('start-game-btn');
        this.elements.dictionaryToggle = document.getElementById('dictionary-toggle');
        this.elements.loadLatestActiveBtn = document.getElementById('load-latest-active-btn');
        this.elements.playerNameHelper = document.getElementById('player-name-helper');
        
        // Game screen elements
        this.elements.playersScoresContainer = document.getElementById('players-scores');
        this.elements.runtimeDictionaryToggle = document.getElementById('dictionary-runtime-toggle');
        this.elements.dictionaryStatusLabel = document.getElementById('dictionary-status-label');
        this.elements.turnIndicator = document.getElementById('turn-indicator');
        this.elements.boardContainer = document.getElementById('scrabble-board');
        this.elements.scoringControls = document.getElementById('scoring-controls');
        this.elements.mobileSheetBackdrop = document.getElementById('mobile-sheet-backdrop');
        this.elements.gameActionsContainer = document.getElementById('game-actions-container');
        this.elements.gameActionsButton = document.getElementById('game-actions-button');
        this.elements.gameActionsMenu = document.getElementById('game-actions-menu');
        
        // Tile countdown and modal elements
        this.elements.tileCountdownBtn = document.getElementById('tile-countdown-btn');
        this.elements.tileCountdownValue = document.getElementById('tile-countdown-value');
        this.elements.tileInventoryModal = document.getElementById('tile-inventory-modal');
        this.elements.closeTileInventoryBtn = document.getElementById('close-tile-inventory-btn');
        this.elements.tileInventoryGrid = document.getElementById('tile-inventory-grid');

        // Turn flow elements
        this.elements.startPrompt = document.getElementById('start-prompt');
        this.elements.directionContainer = document.getElementById('direction-container');
        this.elements.wordEntryContainer = document.getElementById('word-entry-container');
        this.elements.dirAcrossBtn = document.getElementById('dir-across');
        this.elements.dirDownBtn = document.getElementById('dir-down');
        
        // Word input elements
        this.elements.wordInput = document.getElementById('word-input');
        this.elements.tileDisplayContainer = document.getElementById('tile-display-container');
        
        // Score elements
        this.elements.turnScoreDisplay = document.getElementById('turn-score');
        this.elements.scoreBreakdownContainer = document.getElementById('score-breakdown');
        
        // Action buttons
        this.elements.submitTurnBtn = document.getElementById('submit-turn-btn');
        this.elements.cancelTurnBtn = document.getElementById('cancel-turn-btn');
        this.elements.topbarUndoBtn = document.getElementById('topbar-undo-btn');
        this.elements.endGameBtn = document.getElementById('end-game-btn');
        this.elements.pauseGameBtn = document.getElementById('pause-game-btn');
        this.elements.abandonGameBtn = document.getElementById('abandon-game-btn');
        
        // Modals
        this.elements.endGameModal = document.getElementById('end-game-modal');
        this.elements.finalScoresContainer = document.getElementById('final-scores');
        this.elements.newGameBtn = document.getElementById('new-game-btn');
        
        // Finish game modal
        this.elements.finishGameModal = document.getElementById('finish-game-modal');
        this.elements.closeFinishGameBtn = document.getElementById('close-finish-game-btn');
        this.elements.finishStep1 = document.getElementById('finish-game-modal-1');
        this.elements.finishStep2 = document.getElementById('finish-game-modal-2');
        this.elements.endingPlayerSelection = document.getElementById('game-ender-list');
        this.elements.tileAssignmentTable = document.getElementById('tile-recipient-list');
        this.elements.remainingTilesPool = document.getElementById('leftover-tiles-grid');
        this.elements.finishStep1Next = document.getElementById('finish-and-calculate-btn');
        this.elements.finishStep2Back = document.getElementById('finish-step-2-back');
        this.elements.finishStep2Finish = document.getElementById('finish-and-calculate-btn');
        
        this.elements.statsModal = document.getElementById('stats-modal');
        this.elements.closeStatsBtn = document.getElementById('close-stats-btn');
        this.elements.generalStatsContainer = document.getElementById('general-stats');
        this.elements.playerHistoryContainer = document.getElementById('player-history-container');
        
        // Word validation modal
        this.elements.wordValidationModal = document.getElementById('word-validation-modal');
        this.elements.validationMessage = document.getElementById('validation-message');
        this.elements.validationCancelBtn = document.getElementById('validation-cancel-btn');
        this.elements.validationProceedBtn = document.getElementById('validation-proceed-btn');
        
        // Help modal
        this.elements.helpModal = document.getElementById('help-modal');
        this.elements.helpMenuBtn = document.getElementById('help-menu-btn');
        this.elements.closeHelpModalBtn = document.getElementById('close-help-modal-btn');

        // Hidden by default
        this.toggleGameActionsVisibility(false);
    }

    // Mobile layout detection
    isMobileLayout() {
        return window.matchMedia('(max-width: 640px)').matches;
    }

    // Mobile sheet management
    isMobileSheetOpen() {
        return document.body.classList.contains('mobile-game-sheet-open');
    }

    openMobileSheet() {
        document.body.classList.add('mobile-game-sheet-open');
        if (this.elements.mobileSheetBackdrop) {
            this.elements.mobileSheetBackdrop.classList.remove('hidden');
        }
    }

    closeMobileSheet() {
        document.body.classList.remove('mobile-game-sheet-open');
        if (this.elements.mobileSheetBackdrop) {
            this.elements.mobileSheetBackdrop.classList.add('hidden');
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

    // Game actions visibility management
    toggleGameActionsVisibility(show) {
        if (!this.elements.gameActionsContainer) return;

        if (!show && window.topbarMenus && window.topbarMenus.gameActions) {
            window.topbarMenus.gameActions.close();
        }

        this.elements.gameActionsContainer.classList.toggle('hidden', !show);

        if (this.elements.gameActionsButton) {
            this.elements.gameActionsButton.setAttribute('aria-hidden', String(!show));
            this.elements.gameActionsButton.tabIndex = show ? 0 : -1;
        }

        [this.elements.pauseGameBtn, this.elements.endGameBtn, this.elements.abandonGameBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = !show;
            btn.classList.toggle('opacity-50', !show);
            btn.classList.toggle('cursor-not-allowed', !show);
        });
    }

    // Loading state management
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

    // Error display
    showError(message) {
        // Simple alert for now - could be enhanced with a toast system
        alert(message);
    }

    // Screen transitions
    switchToGameScreen() {
        this.elements.setupScreen.classList.add('hidden');
        this.elements.gameScreen.classList.remove('hidden');
    }

    switchToSetupScreen() {
        this.elements.gameScreen.classList.add('hidden');
        this.elements.setupScreen.classList.remove('hidden');
    }

    // Turn flow UI management
    resetTurnFlow() {
        this.elements.wordInput.value = '';
        this.elements.wordEntryContainer.classList.add('hidden');
        this.elements.directionContainer.classList.add('hidden');
        this.elements.startPrompt.classList.remove('hidden');
    }

    showDirectionSelection() {
        this.elements.startPrompt.classList.add('hidden');
        this.elements.directionContainer.classList.remove('hidden');
        this.elements.wordEntryContainer.classList.add('hidden');
    }

    showWordEntry() {
        this.elements.directionContainer.classList.add('hidden');
        this.elements.wordEntryContainer.classList.remove('hidden');
    }

    // Direction button styling
    resetDirectionButtons() {
        this.elements.dirAcrossBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
        this.elements.dirDownBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
    }

    updateDirectionButton(direction) {
        if (direction === 'across') {
            this.elements.dirAcrossBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-indigo-500 text-white';
            this.elements.dirDownBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
        } else {
            this.elements.dirDownBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-indigo-500 text-white';
            this.elements.dirAcrossBtn.className = 'w-1/2 rounded-md py-2 text-sm font-semibold bg-gray-200 text-gray-600';
        }
    }

    // Score display updates
    updateScoreDisplay(score) {
        if (this.elements.turnScoreDisplay) {
            this.elements.turnScoreDisplay.textContent = score || 0;
        }
    }

    // Tile countdown display
    updateTileCountdown(count) {
        if (this.elements.tileCountdownValue) {
            this.elements.tileCountdownValue.textContent = count;
        }
        this.elements.tileCountdownBtn.classList.toggle('hidden', !count || count === 0);
    }

    // Dictionary status display
    updateDictionaryStatusLabel(enabled) {
        if (!this.elements.dictionaryStatusLabel) return;
        if (enabled) {
            this.elements.dictionaryStatusLabel.textContent = 'On';
            this.elements.dictionaryStatusLabel.className = 'text-xs font-semibold uppercase tracking-wide text-emerald-500';
        } else {
            this.elements.dictionaryStatusLabel.textContent = 'Off';
            this.elements.dictionaryStatusLabel.className = 'text-xs font-semibold uppercase tracking-wide text-gray-400';
        }
    }

    // Dictionary toggle synchronization
    syncDictionaryToggles(enabled) {
        if (this.elements.dictionaryToggle) {
            this.elements.dictionaryToggle.checked = enabled;
        }
        if (this.elements.runtimeDictionaryToggle) {
            this.elements.runtimeDictionaryToggle.checked = enabled;
        }
        this.updateDictionaryStatusLabel(enabled);
    }

    // Update dictionary interactivity
    updateRuntimeDictionaryInteractivity(isReadOnly) {
        if (!this.elements.runtimeDictionaryToggle) return;
        this.elements.runtimeDictionaryToggle.disabled = isReadOnly;
        this.elements.runtimeDictionaryToggle.classList.toggle('opacity-50', isReadOnly);
        this.elements.runtimeDictionaryToggle.classList.toggle('cursor-not-allowed', isReadOnly);
    }

    // Submit button visibility
    updateSubmitButtonVisibility(canSubmit) {
        if (!this.elements.submitTurnBtn) return;
        
        if (canSubmit) {
            this.elements.submitTurnBtn.classList.remove('hidden');
            this.elements.submitTurnBtn.disabled = false;
        } else {
            this.elements.submitTurnBtn.classList.add('hidden');
            this.elements.submitTurnBtn.disabled = true;
        }
    }

    // Cancel and undo button visibility
    updateCancelAndUndoButtonVisibility(hasWord, hasSelection, hasTurnHistory, isReadOnly) {
        // Cancel button visible only if a word is being entered or a cell is selected
        if (this.elements.cancelTurnBtn) {
            this.elements.cancelTurnBtn.classList.toggle('hidden', !(hasWord || hasSelection));
        }

        if (this.elements.topbarUndoBtn) {
            // Undo button visible only if there's turn history and not in read-only mode
            this.elements.topbarUndoBtn.classList.toggle('hidden', isReadOnly || !hasTurnHistory);
            this.elements.topbarUndoBtn.disabled = isReadOnly || !hasTurnHistory;
        }
    }

    // Modal management
    showModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('hidden');
            // Show backdrop
            const backdrop = modalElement.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.classList.add('show');
            }
        }
    }

    hideModal(modalElement) {
        if (modalElement) {
            modalElement.classList.add('hidden');
            // Hide backdrop
            const backdrop = modalElement.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.classList.remove('show');
            }
        }
    }

    closeAllModals() {
        this.hideModal(this.elements.wordValidationModal);
        this.hideModal(this.elements.statsModal);
        this.hideModal(this.elements.helpModal);
        this.hideModal(this.elements.tileInventoryModal);
    }

    // Read-only mode setup
    setupReadOnlyMode(isReadOnly) {
        this.updateRuntimeDictionaryInteractivity(isReadOnly);
        this.toggleGameActionsVisibility(!isReadOnly);

        if (isReadOnly) {
            // Hide interactive elements
            this.elements.startPrompt.classList.add('hidden');
            this.elements.directionContainer.classList.add('hidden');
            this.elements.wordEntryContainer.classList.add('hidden');
            this.elements.submitTurnBtn.classList.add('hidden');
            if (this.elements.cancelTurnBtn) this.elements.cancelTurnBtn.classList.add('hidden');
            if (this.elements.topbarUndoBtn) this.elements.topbarUndoBtn.classList.add('hidden');
            if (this.elements.endGameBtn) this.elements.endGameBtn.classList.add('hidden');
            if (this.elements.pauseGameBtn) this.elements.pauseGameBtn.classList.add('hidden');
            if (this.elements.abandonGameBtn) this.elements.abandonGameBtn.classList.add('hidden');
            
            // Disable board interactions
            this.elements.boardContainer.style.pointerEvents = 'none';
        } else {
            // Remove read-only message if it exists
            const existingMessage = document.getElementById('read-only-message');
            if (existingMessage) {
                existingMessage.remove();
            }
            
            // Re-enable board interactions
            this.elements.boardContainer.style.pointerEvents = 'auto';
            
            // Show interactive elements
            this.elements.submitTurnBtn.classList.remove('hidden');
            if (this.elements.endGameBtn) this.elements.endGameBtn.classList.remove('hidden');
            if (this.elements.pauseGameBtn) {
                this.elements.pauseGameBtn.classList.remove('hidden', 'loading');
                this.elements.pauseGameBtn.disabled = false;
            }
            if (this.elements.abandonGameBtn) {
                this.elements.abandonGameBtn.classList.remove('hidden', 'loading');
                this.elements.abandonGameBtn.disabled = false;
            }
        }
    }

    // Clear validation states
    clearValidationStates() {
        // Clear any existing validation error messages
        const validationResult = document.getElementById('validation-result');
        if (validationResult) {
            validationResult.innerHTML = '';
            validationResult.classList.add('hidden');
        }
    }

    // Show validation error
    showValidationError(message) {
        const validationResult = document.getElementById('validation-result');
        if (validationResult) {
            validationResult.innerHTML = `<span class="text-red-500">${message}</span>`;
            validationResult.classList.remove('hidden');
        }
    }

    // Clear validation errors
    clearValidationErrors() {
        const validationResult = document.getElementById('validation-result');
        if (validationResult) {
            validationResult.innerHTML = '';
            validationResult.classList.add('hidden');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}
