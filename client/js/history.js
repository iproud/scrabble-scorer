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
        // Format date/time for GMT+10 (Melbourne/Sydney)
        const gameDate = new Date(game.created_at);
        const date = gameDate.toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' });
        const time = gameDate.toLocaleTimeString('en-AU', { 
            timeZone: 'Australia/Melbourne',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
        
        // Fix duplicated player names - split and deduplicate
        const playerNames = game.player_names ? 
            [...new Set(game.player_names.split(',').map(name => name.trim()))] : 
            ['Unknown Players'];
        const winnerName = game.winner_name || (game.status === 'interrupted' ? 'Game interrupted' : 'No winner');
        
        // Determine status styling
        const isInterrupted = game.status === 'interrupted';
        const statusClass = isInterrupted ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
        const statusText = isInterrupted ? 'Interrupted' : 'Completed';
        
        return `
            <div class="game-card bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow" data-game-id="${game.id}">
                <div class="flex items-center justify-between">
                    <div class="flex-1 cursor-pointer" onclick="window.gameHistoryApp.showGameDetail(${game.id})">
                        <div class="flex items-center gap-4 mb-2">
                            <h3 class="text-xl font-bold text-gray-800">Game #${game.id}</h3>
                            <span class="px-3 py-1 ${statusClass} rounded-full text-sm font-medium">
                                ${statusText}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div>
                                <span class="font-medium">Players:</span>
                                <div class="text-gray-800">${playerNames.join(', ')}</div>
                            </div>
                            
                            <div>
                                <span class="font-medium">${isInterrupted ? 'Status:' : 'Winner:'}</span>
                                <div class="${isInterrupted ? 'text-orange-600' : 'text-green-600'} font-semibold">${winnerName}</div>
                            </div>
                            
                            <div>
                                <span class="font-medium">Played:</span>
                                <div class="text-gray-800">${date} at ${time}</div>
                            </div>
                        </div>
                        
                        <div class="mt-3 flex items-center gap-4 text-sm text-gray-500">
                            <span>🎯 ${game.total_turns || 0} turns</span>
                            <span>🏆 Highest: ${game.highest_score || 0} points</span>
                        </div>
                    </div>
                    
                    <div class="ml-4 flex flex-col items-end gap-2">
                        <div class="text-right">
                            <div class="text-2xl font-bold text-indigo-600">${game.highest_score || 0}</div>
                            <div class="text-sm text-gray-500">High Score</div>
                        </div>
                        
                        <div class="flex gap-2">
                            ${isInterrupted ? `
                                <button onclick="window.gameHistoryApp.reinstateGame(${game.id}, event)" 
                                        class="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition" 
                                        title="Resume Game">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V4a2 2 0 00-2-2H5a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V4z"></path>
                                    </svg>
                                </button>
                            ` : ''}
                            <button onclick="window.gameHistoryApp.deleteGame(${game.id}, event)" 
                                    class="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition" 
                                    title="Delete Game">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async showGameDetail(gameId) {
        // Navigate to the main game interface in read-only mode
        window.location.href = `/?game=${gameId}&view=history`;
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

    async reinstateGame(gameId, event) {
        event.stopPropagation(); // Prevent card click
        
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
