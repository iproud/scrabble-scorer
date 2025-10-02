// Game History Page Controller
class GameHistoryApp {
    constructor() {
        this.games = [];
        this.currentGame = null;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('Game History: Initializing...');
        
        // Get DOM elements
        this.setupElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load games
        await this.loadGames();
        
        console.log('Game History: Initialization complete');
    }

    setupElements() {
        // Main containers
        this.loadingState = document.getElementById('loading-state');
        this.emptyState = document.getElementById('empty-state');
        this.gamesList = document.getElementById('games-list');
        
        // Buttons
        this.refreshBtn = document.getElementById('refresh-btn');
        this.resumeLatestBtn = document.getElementById('resume-latest-btn');
        
        // Modal elements
        this.gameDetailModal = document.getElementById('game-detail-modal');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.modalTitle = document.getElementById('modal-title');
        this.modalSubtitle = document.getElementById('modal-subtitle');
        this.modalBoard = document.getElementById('modal-board');
        this.modalScores = document.getElementById('modal-scores');
        this.modalTurnHistory = document.getElementById('modal-turn-history');
    }

    setupEventListeners() {
        // Refresh button
        this.refreshBtn.addEventListener('click', () => this.loadGames());
        if (this.resumeLatestBtn) {
            this.resumeLatestBtn.addEventListener('click', () => this.resumeLatestPausedGame());
        }
        
        // Modal close
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.gameDetailModal.addEventListener('click', (e) => {
            if (e.target === this.gameDetailModal) {
                this.closeModal();
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.gameDetailModal.classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }

    async loadGames() {
        try {
            this.showLoading();
            
            // Fetch completed games from API
            const games = await window.scrabbleAPI.getGames();
            this.games = games;
            
            if (games.length === 0) {
                this.showEmptyState();
            } else {
                this.renderGamesList();
            }
            
            this.updateResumeButtonVisibility();
        } catch (error) {
            console.error('Failed to load games:', error);
            this.showError('Failed to load game history. Please try again.');
        }
    }

    showLoading() {
        this.loadingState.classList.remove('hidden');
        this.emptyState.classList.add('hidden');
        this.gamesList.classList.add('hidden');
    }

    showEmptyState() {
        this.loadingState.classList.add('hidden');
        this.emptyState.classList.remove('hidden');
        this.gamesList.classList.add('hidden');
    }

    renderGamesList() {
        this.loadingState.classList.add('hidden');
        this.emptyState.classList.add('hidden');
        this.gamesList.classList.remove('hidden');
        
        this.gamesList.innerHTML = this.games.map(game => this.createGameCard(game)).join('');
        
        // Add click listeners to game cards
        this.gamesList.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameId = parseInt(card.dataset.gameId);
                this.showGameDetail(gameId);
            });
        });
    }

    createGameCard(game) {
        const gameDate = new Date(game.created_at);
        const date = gameDate.toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' });
        const time = gameDate.toLocaleTimeString('en-AU', {
            timeZone: 'Australia/Melbourne',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const playerNames = game.player_names
            ? [...new Set(game.player_names.split(',').map((name) => name.trim()))]
            : ['Unknown Players'];

        const statusBadge = this.buildStatusBadge(game.status);
        const winnerText = game.winner_name || (game.status === 'interrupted'
            ? 'Game paused'
            : 'No winner yet');

        let primaryActionHtml = '';
        if (game.status === 'active') {
            primaryActionHtml = `
                <button onclick="window.gameHistoryApp.navigateToGame(${game.id}, event)"
                        class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-sm hover:bg-indigo-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M13.5 4.5L21 12l-7.5 7.5M21 12H3" />
                    </svg>
                    Return to Game
                </button>
            `;
        } else if (game.status === 'interrupted') {
            primaryActionHtml = `
                <button onclick="window.gameHistoryApp.reinstateGame(${game.id}, event)"
                        class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-sm hover:bg-green-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M12 5v14m7-7H5" />
                    </svg>
                    Resume Game
                </button>
            `;
        } else {
            primaryActionHtml = `
                <button onclick="window.gameHistoryApp.showGameDetail(${game.id}, event)"
                        class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white font-semibold rounded-lg shadow-sm hover:bg-slate-900 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M12 6v12m6-6H6" />
                    </svg>
                    View Summary
                </button>
            `;
        }

        const abandonLabel = game.status === 'finished' ? 'Remove from History' : 'Abandon Game';

        return `
            <div class="game-card bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow" data-game-id="${game.id}">
                <div class="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
                    <div class="flex-1 space-y-4 cursor-pointer" onclick="window.gameHistoryApp.showGameDetail(${game.id}, event)">
                        <div class="flex flex-wrap items-center gap-3">
                            <h3 class="text-xl font-bold text-gray-900">Game #${game.id}</h3>
                            ${statusBadge}
                        </div>

                        <div class="flex flex-wrap gap-6 text-sm text-gray-600">
                            <div class="space-y-1">
                                <span class="block font-medium text-gray-500">Players</span>
                                <div class="text-base text-gray-800">${playerNames.join(', ')}</div>
                            </div>
                            <div class="space-y-1">
                                <span class="block font-medium text-gray-500">${game.status === 'finished' ? 'Winner' : 'Status'}</span>
                                <div class="${game.status === 'finished' ? 'text-green-600' : game.status === 'interrupted' ? 'text-amber-600' : 'text-slate-600'} font-semibold">
                                    ${winnerText}
                                </div>
                            </div>
                            <div class="space-y-1">
                                <span class="block font-medium text-gray-500">Started</span>
                                <div class="text-base text-gray-800">${date} · ${time}</div>
                            </div>
                        </div>

                        <div class="flex flex-wrap gap-4 text-sm text-gray-500">
                            <div class="inline-flex items-center gap-2">
                                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-semibold">${(game.total_turns || 0).toString().padStart(2, '0')}</span>
                                <span>Total turns</span>
                            </div>
                            <div class="inline-flex items-center gap-2">
                                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 font-semibold">${game.highest_score || 0}</span>
                                <span>High score</span>
                            </div>
                        </div>
                    </div>

                    <div class="md:w-60 flex flex-col gap-2">
                        ${primaryActionHtml}
                        <button onclick="window.gameHistoryApp.deleteGame(${game.id}, event)"
                                class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-red-600 font-semibold rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                      d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            ${abandonLabel}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async showGameDetail(gameId, event) {
        event?.stopPropagation();
        window.location.href = `/?game=${gameId}&view=history`;
    }

    navigateToGame(gameId, event) {
        event?.stopPropagation();
        window.location.href = `/?game=${gameId}`;
    }

    buildStatusBadge(status) {
        switch (status) {
            case 'active':
                return '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"><span class="w-2 h-2 rounded-full bg-blue-500"></span>Active</span>';
            case 'interrupted':
                return '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800"><span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>Paused</span>';
            case 'finished':
            default:
                return '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"><span class="w-2 h-2 rounded-full bg-green-500"></span>Completed</span>';
        }
    }

    renderGameDetail(game) {
        // Update modal header
        const date = new Date(game.created_at).toLocaleDateString();
        const time = new Date(game.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        this.modalTitle.textContent = `Game #${game.id}`;
        this.modalSubtitle.textContent = `Played on ${date} at ${time}`;
        
        // Render final board
        this.renderBoard(game.board_state || []);
        
        // Render final scores
        this.renderScores(game.players || []);
        
        // Render turn history
        this.renderTurnHistory(game.turns || []);
    }

    renderBoard(boardState) {
        const boardLayout = [
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

        const letterScores = { 'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8, 'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1, 'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10 };

        this.modalBoard.innerHTML = '';
        this.modalBoard.className = 'grid grid-cols-15 gap-1 aspect-square w-full bg-gray-800 p-2 rounded-lg';
        this.modalBoard.style.gridTemplateColumns = 'repeat(15, 1fr)';
        
        boardLayout.forEach((row, r_idx) => {
            row.forEach((bonus, c_idx) => {
                const cell = document.createElement('div');
                cell.classList.add('board-cell', 'flex', 'items-center', 'justify-center', 'text-xs', 'font-bold', 'relative');
                
                const placedTile = boardState[r_idx] && boardState[r_idx][c_idx];

                if (placedTile) {
                    cell.classList.add('tile-placed');
                    const score = placedTile.isBlank ? 0 : (letterScores[placedTile.letter] || 0);
                    cell.innerHTML = `<span>${placedTile.letter}</span><span class="tile-score">${score}</span>`;
                } else {
                    if (bonus) cell.classList.add(bonus);
                    if (r_idx === 7 && c_idx === 7) cell.classList.add('center-star');
                    cell.innerHTML = '';
                }
                this.modalBoard.appendChild(cell);
            });
        });
    }

    renderScores(players) {
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        const winnerScore = sortedPlayers[0]?.score || 0;
        
        this.modalScores.innerHTML = sortedPlayers.map((player, index) => {
            const isWinner = player.score === winnerScore && winnerScore > 0;
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
            
            return `
                <div class="flex items-center justify-between p-3 rounded-lg ${isWinner ? 'bg-yellow-100 border-2 border-yellow-300' : 'bg-white border border-gray-200'}">
                    <div class="flex items-center gap-3">
                        <span class="text-lg">${medal}</span>
                        <span class="font-semibold text-gray-800">${player.name}</span>
                        ${isWinner ? '<span class="px-2 py-1 bg-yellow-500 text-white text-xs rounded-full font-bold">WINNER</span>' : ''}
                    </div>
                    <span class="text-xl font-bold ${isWinner ? 'text-yellow-600' : 'text-gray-700'}">${player.score}</span>
                </div>
            `;
        }).join('');
    }

    renderTurnHistory(turns) {
        if (turns.length === 0) {
            this.modalTurnHistory.innerHTML = '<p class="text-gray-500 text-center py-4">No turns recorded</p>';
            return;
        }

        // Group turns by round
        const turnsByRound = {};
        turns.forEach(turn => {
            if (!turnsByRound[turn.round_number]) {
                turnsByRound[turn.round_number] = [];
            }
            turnsByRound[turn.round_number].push(turn);
        });

        const rounds = Object.keys(turnsByRound).sort((a, b) => parseInt(a) - parseInt(b));
        
        this.modalTurnHistory.innerHTML = rounds.map(roundNum => {
            const roundTurns = turnsByRound[roundNum];
            
            return `
                <div class="mb-4">
                    <h4 class="font-bold text-gray-700 mb-2 sticky top-0 bg-gray-50 py-1">Round ${roundNum}</h4>
                    <div class="space-y-2">
                        ${roundTurns.map(turn => {
                            const secondaryWords = turn.secondary_words ? JSON.parse(turn.secondary_words) : [];
                            const crossWordsText = secondaryWords.length > 0 ? 
                                ` <span class="text-xs text-gray-400">(+ ${secondaryWords.map(sw => sw.word).join(', ')})</span>` : '';
                            
                            return `
                                <div class="flex items-center justify-between p-2 bg-white rounded border">
                                    <div>
                                        <span class="font-medium text-gray-800">${turn.player_name}</span>
                                        <span class="ml-2 text-indigo-600 font-semibold">${turn.word}</span>
                                        ${crossWordsText}
                                    </div>
                                    <span class="font-bold text-green-600">${turn.score}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    closeModal() {
        this.gameDetailModal.classList.add('hidden');
        this.currentGame = null;
    }

    async deleteGame(gameId, event) {
        event.stopPropagation(); // Prevent card click
        
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;
        
        const confirmed = confirm(`Are you sure you want to delete Game #${gameId}?\n\nThis action cannot be undone and will permanently remove all game data including:\n• Player scores\n• Turn history\n• Board state\n\nPlayers: ${game.player_names}`);
        
        if (!confirmed) return;
        
        try {
            await window.scrabbleAPI.deleteGame(gameId);
            this.showSuccess('Game deleted successfully');
            await this.loadGames(); // Refresh the list
        } catch (error) {
            console.error('Failed to delete game:', error);
            this.showError('Failed to delete game. Please try again.');
        }
    }

    async resumeLatestPausedGame() {
        const interruptedGame = this.games.find((game) => game.status === 'interrupted');
        if (!interruptedGame) {
            alert('No paused games available to resume.');
            this.updateResumeButtonVisibility();
            return;
        }
        this.reinstateGame(interruptedGame.id);
    }

    async reinstateGame(gameId, event) {
        event?.stopPropagation();
        
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;
        
        const confirmed = confirm(`Resume Game #${gameId}?\n\nThis will reactivate the game so you can continue playing.\n\nPlayers: ${game.player_names}`);
        
        if (!confirmed) return;
        
        try {
            await window.scrabbleAPI.reinstateGame(gameId);
            this.showSuccess('Game reactivated! Redirecting to continue playing...');
            
            // Redirect to the game
            setTimeout(() => {
                window.location.href = `/?game=${gameId}`;
            }, 1500);
            
        } catch (error) {
            console.error('Failed to reinstate game:', error);
            this.showError('Failed to reactivate game. Please try again.');
        }
    }

    updateResumeButtonVisibility() {
        if (!this.resumeLatestBtn) return;
        const hasInterruptedGame = Array.isArray(this.games) && this.games.some(game => game.status === 'interrupted');
        this.resumeLatestBtn.classList.toggle('hidden', !hasInterruptedGame);
        this.resumeLatestBtn.disabled = !hasInterruptedGame;
        this.resumeLatestBtn.classList.toggle('opacity-40', !hasInterruptedGame);
        this.resumeLatestBtn.classList.toggle('cursor-not-allowed', !hasInterruptedGame);
    }

    showError(message) {
        // Simple alert for now - could be enhanced with a toast system
        alert(message);
    }

    showSuccess(message) {
        // Simple alert for now - could be enhanced with a toast system
        alert(message);
    }
}

// Initialize the app
window.gameHistoryApp = new GameHistoryApp();
