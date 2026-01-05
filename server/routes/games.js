const express = require('express');
const { getDatabase } = require('../database/init');

const router = express.Router();

function canonicalizePlayerName(name) {
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

// GET /api/games - Get all games (completed and interrupted games for history)
router.get('/', (req, res) => {
    try {
        const db = getDatabase();

        const games = db.prepare(`
            SELECT 
                g.id,
                g.created_at,
                g.status,
                g.winner_id,
                w.name as winner_name,
                (SELECT COUNT(*) FROM turns WHERE game_id = g.id) as total_turns,
                (SELECT MAX(score) FROM turns WHERE game_id = g.id) as highest_score,
                (SELECT GROUP_CONCAT(p2.name) 
                 FROM game_players gp2 
                 JOIN players p2 ON gp2.player_id = p2.id 
                 WHERE gp2.game_id = g.id
                 ORDER BY gp2.turn_order) as player_names
            FROM games g
            LEFT JOIN players w ON g.winner_id = w.id
            ORDER BY g.created_at DESC
        `).all();

        db.close();
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// GET /api/games/:id - Get specific game details
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const gameId = parseInt(req.params.id);

        // Get game info
        const game = db.prepare(`
            SELECT g.*, w.name as winner_name
            FROM games g
            LEFT JOIN players w ON g.winner_id = w.id
            WHERE g.id = ?
        `).get(gameId);

        if (!game) {
            db.close();
            return res.status(404).json({ error: 'Game not found' });
        }

        // Get players
        const players = db.prepare(`
            SELECT p.id, p.name, gp.score, gp.turn_order
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = ?
            ORDER BY gp.turn_order
        `).all(gameId);

        // Get turns with enhanced ordering for robust turn sequence
        const turns = db.prepare(`
            SELECT t.*, p.name as player_name
            FROM turns t
            JOIN players p ON t.player_id = p.id
            WHERE t.game_id = ?
            ORDER BY t.round_number ASC, t.id ASC
        `).all(gameId);

        // Parse JSON fields
        game.board_state = JSON.parse(game.board_state || '[]');
        turns.forEach(turn => {
            turn.secondary_words = JSON.parse(turn.secondary_words || '[]');
            turn.blank_tiles = JSON.parse(turn.blank_tiles || '[]');
            turn.board_state_after = JSON.parse(turn.board_state_after || '[]');
        });

        db.close();
        res.json({
            ...game,
            players,
            turns
        });
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({ error: 'Failed to fetch game' });
    }
});

// POST /api/games - Create new game
router.post('/', (req, res) => {
    try {
        const { playerNames } = req.body;

        if (!playerNames || !Array.isArray(playerNames) || playerNames.length < 2 || playerNames.length > 4) {
            return res.status(400).json({ error: 'Must provide 2-4 player names' });
        }

        const db = getDatabase();

        const normalizedNames = playerNames.map(name => canonicalizePlayerName(name));
        const seenNames = new Set();
        for (const normalized of normalizedNames) {
            const key = normalized.toLowerCase();
            if (seenNames.has(key)) {
                db.close();
                return res.status(400).json({ error: 'Player names must be unique (case-insensitive).' });
            }
            seenNames.add(key);
        }

        db.transaction(() => {
            // Create or get players
            const playerIds = [];
            const insertPlayer = db.prepare('INSERT INTO players (name) VALUES (?)');
            const getPlayerByLower = db.prepare('SELECT id, name FROM players WHERE LOWER(name) = LOWER(?)');

            normalizedNames.forEach(name => {
                let player = getPlayerByLower.get(name);

                if (!player) {
                    try {
                        insertPlayer.run(name);
                    } catch (error) {
                        if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
                            throw error;
                        }
                    }
                    player = getPlayerByLower.get(name);
                }

                playerIds.push(player.id);
            });

            // Create game
            const insertGame = db.prepare('INSERT INTO games (status) VALUES (?)');
            const gameResult = insertGame.run('active');
            const gameId = gameResult.lastInsertRowid;

            // Add players to game
            const insertGamePlayer = db.prepare('INSERT INTO game_players (game_id, player_id, turn_order) VALUES (?, ?, ?)');
            playerIds.forEach((playerId, index) => {
                insertGamePlayer.run(gameId, playerId, index);
            });

            // Get complete game data
            const game = db.prepare(`
                SELECT g.*, 
                       GROUP_CONCAT(p.name) as player_names
                FROM games g
                JOIN game_players gp ON g.id = gp.game_id
                JOIN players p ON gp.player_id = p.id
                WHERE g.id = ?
                GROUP BY g.id
            `).get(gameId);

            const players = db.prepare(`
                SELECT p.id, p.name, gp.score, gp.turn_order
                FROM game_players gp
                JOIN players p ON gp.player_id = p.id
                WHERE gp.game_id = ?
                ORDER BY gp.turn_order
            `).all(gameId);

            res.status(201).json({
                ...game,
                players,
                turns: []
            });
        })();
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    } finally {
        try {
            if (db) db.close();
        } catch (e) {
            console.error('Error closing database:', e);
        }
    }
});

// POST /api/games/:id/turns - Submit a turn
router.post('/:id/turns', (req, res) => {
    let db; // Declare db outside try for finally access
    try {
        const gameId = parseInt(req.params.id);
        const { getDatabase } = require('../database/init');
        const gameLogic = require('../services/gameLogic');

        // Debug: Log received data
        console.log('=== SERVER TURN SUBMISSION DEBUG ===');
        console.log('Received request body:', JSON.stringify(req.body, null, 2));

        const { playerId, word, startRow, startCol, direction, blankTiles } = req.body;

        // Basic validation
        if (!playerId || startRow === undefined || startCol === undefined || !direction) {
            console.error('VALIDATION ERROR: Missing required field');
            return res.status(400).json({ error: 'Missing required turn data' });
        }

        const isAdjustmentTurn = direction === 'adjustment';

        const db = getDatabase();

        // Fetch current game state to get board
        const game = db.prepare('SELECT board_state, status FROM games WHERE id = ?').get(gameId);
        if (!game) {
            db.close();
            return res.status(404).json({ error: 'Game not found' });
        }

        // Parse current board (Source of Truth)
        let currentBoardState = JSON.parse(game.board_state || '[]');
        if (currentBoardState.length === 0) {
            // Initialize empty board if null
            currentBoardState = Array(15).fill(null).map(() => Array(15).fill(null));
        }

        let calculatedResult;
        let finalScore = 0;
        let newBoardState;
        let secondaryWords = [];

        if (isAdjustmentTurn) {
            // Trust client for adjustment turns (admin override), or implement specific adjustment logic
            // For now, we trust the score and boardState from client for adjustments ONLY if we want to support manual fixups
            // But for security, even adjustments should ideally be validated. 
            // However, typical "Adjustment" implies manual override. 
            // For this implementation, we will accept SCORE from client but strict BOARD validation? 
            // Let's assume adjustment turns are purely score adjustments or pass.
            // If boardState is provided in adjustment, we save it. This is the "Escape Hatch".
            if (req.body.boardState) {
                newBoardState = req.body.boardState;
            } else {
                newBoardState = currentBoardState;
            }
            finalScore = req.body.score || 0;
            secondaryWords = req.body.secondaryWords || [];
        } else {
            // Regular Turn: Calculate EVERYTHING server-side
            const result = gameLogic.calculateTurn(
                word,
                startRow,
                startCol,
                direction,
                blankTiles,
                currentBoardState
            );

            if (result.error) {
                console.error('SERVER LOGIC ERROR:', result.error);
                db.close();
                return res.status(400).json({ error: result.error });
            }

            finalScore = result.score;
            newBoardState = result.boardState;
            secondaryWords = result.scoredWords.filter(w => !w.isPrimary).map(w => w.word);

            console.log(`Server Calculated Score: ${finalScore} (Client claimed: ${req.body.score})`);
        }

        db.transaction(() => {
            // Get num players and turns
            const numPlayers = db.prepare('SELECT COUNT(*) as count FROM game_players WHERE game_id = ?').get(gameId).count;
            const totalTurnsSubmitted = db.prepare('SELECT COUNT(*) as count FROM turns WHERE game_id = ?').get(gameId).count;

            let roundNumber;
            if (isAdjustmentTurn) {
                const highestRoundResult = db.prepare('SELECT MAX(round_number) as highest_round FROM turns WHERE game_id = ?').get(gameId);
                roundNumber = (highestRoundResult ? highestRoundResult.highest_round : 0) + 1;
            } else {
                roundNumber = Math.floor(totalTurnsSubmitted / numPlayers) + 1;
            }

            const insertTurn = db.prepare(`
                INSERT INTO turns (
                    game_id, player_id, round_number, word, score, 
                    secondary_words, board_state_after, start_row, start_col, 
                    direction, blank_tiles
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insertTurn.run(
                gameId, playerId, roundNumber, word, finalScore,
                JSON.stringify(secondaryWords), JSON.stringify(newBoardState),
                startRow, startCol, direction, JSON.stringify(blankTiles || [])
            );

            // Update player score
            const updateScore = db.prepare('UPDATE game_players SET score = score + ? WHERE game_id = ? AND player_id = ?');
            updateScore.run(finalScore, gameId, playerId);

            // Update game board state
            const updateGame = db.prepare('UPDATE games SET board_state = ? WHERE id = ?');
            updateGame.run(JSON.stringify(newBoardState), gameId);

            res.json({ success: true, roundNumber, serverScore: finalScore });
        })();

        db.close();
    } catch (error) {
        console.error('Error submitting turn:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to submit turn' });
    }
});

// PUT /api/games/:id/status - Update game status (finish game)
router.put('/:id/status', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const { status, winnerId } = req.body;

        if (!status || !['active', 'finished', 'interrupted'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const db = getDatabase();

        const updateGame = db.prepare('UPDATE games SET status = ?, winner_id = ? WHERE id = ?');
        updateGame.run(status, winnerId || null, gameId);

        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating game status:', error);
        res.status(500).json({ error: 'Failed to update game status' });
    }
});

// DELETE /api/games/:id - Delete a game
router.delete('/:id', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const db = getDatabase();

        db.transaction(() => {
            // Delete turns first (foreign key constraint)
            db.prepare('DELETE FROM turns WHERE game_id = ?').run(gameId);

            // Delete game_players
            db.prepare('DELETE FROM game_players WHERE game_id = ?').run(gameId);

            // Delete the game
            const result = db.prepare('DELETE FROM games WHERE id = ?').run(gameId);

            if (result.changes === 0) {
                throw new Error('Game not found');
            }
        })();

        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting game:', error);
        if (error.message === 'Game not found') {
            res.status(404).json({ error: 'Game not found' });
        } else {
            res.status(500).json({ error: 'Failed to delete game' });
        }
    }
});

// PUT /api/games/:id/reinstate - Reinstate a game for continued play
router.put('/:id/reinstate', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const db = getDatabase();

        // Update game status to active
        const updateGame = db.prepare('UPDATE games SET status = ?, winner_id = NULL WHERE id = ?');
        const result = updateGame.run('active', gameId);

        if (result.changes === 0) {
            db.close();
            return res.status(404).json({ error: 'Game not found' });
        }

        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error reinstating game:', error);
        res.status(500).json({ error: 'Failed to reinstate game' });
    }
});

// DELETE /api/games/:id/turns/last - Undo the last turn for a game
// DELETE /api/games/:id/turns/last - Undo the last turn for a game
// DELETE /api/games/:id/turns/last - Undo the last turn for a game
router.delete('/:id/turns/last', (req, res) => {
    console.log(`[SERVER] Processing Undo request for game ${req.params.id}`);
    let db;
    try {
        const gameId = parseInt(req.params.id);
        db = getDatabase();

        const result = db.transaction(() => {
            // Get the last turn for the game
            const lastTurn = db.prepare(`
                SELECT * FROM turns 
                WHERE game_id = ? 
                ORDER BY id DESC 
                LIMIT 1
            `).get(gameId);

            if (!lastTurn) {
                return null;
            }

            // Update player score
            const updateScore = db.prepare('UPDATE game_players SET score = score - ? WHERE game_id = ? AND player_id = ?');
            updateScore.run(lastTurn.score, gameId, lastTurn.player_id);

            // Get the board state BEFORE the last turn (which is the board_state_after of the second to last turn)
            const secondLastTurn = db.prepare(`
                SELECT board_state_after FROM turns
                WHERE game_id = ? AND id != ?
                ORDER BY id DESC
                LIMIT 1
            `).get(gameId, lastTurn.id);

            let newBoardState = '[]'; // Default to empty board if no other turns exist
            if (secondLastTurn && secondLastTurn.board_state_after) {
                newBoardState = secondLastTurn.board_state_after;
            }

            // Update game's board state
            const updateGameBoard = db.prepare('UPDATE games SET board_state = ? WHERE id = ?');
            updateGameBoard.run(newBoardState, gameId);

            // Delete the last turn
            db.prepare('DELETE FROM turns WHERE id = ?').run(lastTurn.id);

            return lastTurn;
        })();

        if (!result) {
            console.log(`[SERVER] Undo failed: No turns to undo for game ${gameId}`);
            return res.status(404).json({ error: 'No turns to undo for this game.' });
        }

        console.log(`[SERVER] Undo successful for game ${gameId}, sending response`);
        res.json({ success: true });

    } catch (error) {
        console.error('Error undoing last turn:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to undo last turn',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    } finally {
        try {
            if (db) db.close();
        } catch (e) {
            console.error('Error closing database:', e);
        }
    }
});

// GET /api/games/:id/statistics - Get comprehensive game statistics
router.get('/:id/statistics', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const db = getDatabase();

        // Get game info
        const game = db.prepare(`
            SELECT g.*, w.name as winner_name
            FROM games g
            LEFT JOIN players w ON g.winner_id = w.id
            WHERE g.id = ?
        `).get(gameId);

        if (!game) {
            db.close();
            return res.status(404).json({ error: 'Game not found' });
        }

        // Get players
        const players = db.prepare(`
            SELECT p.id, p.name, gp.score, gp.turn_order
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = ?
            ORDER BY gp.turn_order
        `).all(gameId);

        // Get turns with proper field names
        const turns = db.prepare(`
            SELECT t.*, p.name as player_name
            FROM turns t
            JOIN players p ON t.player_id = p.id
            WHERE t.game_id = ?
            ORDER BY t.round_number, t.id
        `).all(gameId);

        // Parse JSON fields and standardize field names
        const processedTurns = turns.map(turn => ({
            ...turn,
            playerId: turn.player_id,
            roundNumber: turn.round_number,
            secondaryWords: JSON.parse(turn.secondary_words || '[]'),
            blankTiles: JSON.parse(turn.blank_tiles || '[]'),
            boardStateAfter: JSON.parse(turn.board_state_after || '[]')
        }));

        // Calculate statistics
        const totalTurns = processedTurns.length;
        const playersCount = players.length;
        const currentRound = Math.floor(totalTurns / playersCount) + 1;

        // Find highest scoring turn
        let highestScoringTurn = null;
        const validTurns = processedTurns.filter(turn =>
            turn &&
            typeof turn.score === 'number' &&
            turn.score > 0 &&
            turn.word &&
            turn.word.trim().length > 0
        );

        if (validTurns.length > 0) {
            highestScoringTurn = validTurns.reduce((max, turn) =>
                turn.score > max.score ? turn : max, validTurns[0]);
        }

        // Calculate player statistics
        const playerStats = players.map(player => {
            const playerTurns = processedTurns.filter(t => t.playerId === player.id);
            const validPlayerTurns = playerTurns.filter(t =>
                typeof t.score === 'number' && t.score > 0
            );
            const averageScore = validPlayerTurns.length > 0
                ? validPlayerTurns.reduce((sum, t) => sum + t.score, 0) / validPlayerTurns.length
                : 0;

            return {
                ...player,
                averageScore: Math.round(averageScore * 100) / 100,
                totalTurns: playerTurns.length,
                validTurns: validPlayerTurns.length
            };
        });

        // Create turn map for reliable round-player lookup
        // FIXED: Support multiple turns per round-player combination
        const turnMap = new Map();
        processedTurns.forEach((turn, index) => {
            const round = turn.roundNumber || Math.floor(index / playersCount) + 1;
            const playerId = turn.playerId;
            const key = `${round}-${playerId}`;

            // Store all turns for each round-player combination in an array
            if (!turnMap.has(key)) {
                turnMap.set(key, []);
            }
            turnMap.get(key).push({ ...turn, computedRound: round });
        });

        const statistics = {
            gameId,
            gameStatus: game.status,
            currentRound,
            highestScoringTurn,
            totalTurns,
            validTurns: validTurns.length,
            players: playerStats,
            turns: processedTurns,
            turnMap: Array.from(turnMap.entries()),
            winningScore: Math.max(...players.map(p => p.score || 0))
        };

        db.close();
        res.json(statistics);
    } catch (error) {
        console.error('Error fetching game statistics:', error);
        res.status(500).json({ error: 'Failed to fetch game statistics' });
    }
});

module.exports = router;
