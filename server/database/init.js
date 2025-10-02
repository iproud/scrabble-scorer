const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'scrabble.db');

function tableExists(db, tableName) {
    const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(tableName);
    return !!result;
}

function canonicalizePlayerName(name) {
    if (!name || typeof name !== 'string') {
        return '';
    }

    return name
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function canonicalizeExistingPlayers(db) {
    const selectPlayers = db.prepare('SELECT id, name FROM players');
    const updatePlayer = db.prepare('UPDATE players SET name = ? WHERE id = ?');

    for (const player of selectPlayers.all()) {
        let canonical = canonicalizePlayerName(player.name);
        if (!canonical) {
            canonical = `Player ${player.id}`;
        }

        if (canonical !== player.name) {
            updatePlayer.run(canonical, player.id);
        }
    }
}

function mergeDuplicatePlayers(db, { hasGamePlayers, hasTurns, hasGames }) {
    const duplicates = db.prepare(`
        SELECT LOWER(name) AS lower_name, GROUP_CONCAT(id) AS ids
        FROM players
        GROUP BY LOWER(name)
        HAVING COUNT(*) > 1
    `).all();

    if (duplicates.length === 0) {
        return;
    }

    const updateGamePlayers = hasGamePlayers
        ? db.prepare('UPDATE game_players SET player_id = ? WHERE player_id = ?')
        : null;
    const updateTurns = hasTurns
        ? db.prepare('UPDATE turns SET player_id = ? WHERE player_id = ?')
        : null;
    const updateGames = hasGames
        ? db.prepare('UPDATE games SET winner_id = ? WHERE winner_id = ?')
        : null;
    const deletePlayer = db.prepare('DELETE FROM players WHERE id = ?');

    duplicates.forEach(dup => {
        const ids = dup.ids.split(',').map(id => parseInt(id, 10)).filter(Number.isInteger);
        if (ids.length === 0) {
            return;
        }
        const primaryId = ids.shift();

        ids.forEach(duplicateId => {
            if (hasGamePlayers) {
                updateGamePlayers.run(primaryId, duplicateId);
            }
            if (hasTurns) {
                updateTurns.run(primaryId, duplicateId);
            }
            if (hasGames) {
                updateGames.run(primaryId, duplicateId);
            }
            deletePlayer.run(duplicateId);
        });
    });
}

function migrateGamesStatusConstraint(db) {
    const tableInfo = db.prepare(`
        SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'games'
    `).get();

    if (!tableInfo || !tableInfo.sql || tableInfo.sql.includes("'interrupted'")) {
        return;
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS games_migration (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished', 'interrupted')),
            winner_id INTEGER,
            board_state TEXT DEFAULT '[]',
            FOREIGN KEY (winner_id) REFERENCES players(id)
        );
        
        INSERT INTO games_migration (id, created_at, status, winner_id, board_state)
        SELECT id, created_at, status, winner_id, board_state FROM games;
        
        DROP TABLE games;
        ALTER TABLE games_migration RENAME TO games;
    `);
}

function ensureLowercaseIndex(db) {
    try {
        db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_lower ON players(LOWER(name))').run();
    } catch (error) {
        console.error('Failed to ensure idx_players_name_lower index:', error.message);
    }
}

function recalculateRoundNumbers(db) {
    console.log('Recalculating round numbers for existing turns...');

    const games = db.prepare('SELECT id FROM games').all();
    const getNumPlayers = db.prepare('SELECT COUNT(*) as count FROM game_players WHERE game_id = ?');
    const getTurns = db.prepare('SELECT id, player_id, round_number FROM turns WHERE game_id = ? ORDER BY id');
    const updateTurnRoundNumber = db.prepare('UPDATE turns SET round_number = ? WHERE id = ?');

    db.transaction(() => {
        games.forEach(game => {
            const numPlayersResult = getNumPlayers.get(game.id);
            const numPlayers = numPlayersResult ? numPlayersResult.count : 0;

            if (numPlayers === 0) {
                console.warn(`Game ${game.id} has no players, skipping round number recalculation.`);
                return;
            }

            const turns = getTurns.all(game.id);
            turns.forEach((turn, index) => {
                const newRoundNumber = Math.floor(index / numPlayers) + 1;
                if (turn.round_number !== newRoundNumber) {
                    updateTurnRoundNumber.run(newRoundNumber, turn.id);
                }
            });
        });
    })();
    console.log('Round number recalculation complete.');
}

function performMigrations(db) {
    const hasPlayers = tableExists(db, 'players');
    const hasGamePlayers = tableExists(db, 'game_players');
    const hasTurns = tableExists(db, 'turns');
    const hasGames = tableExists(db, 'games');

    if (hasPlayers) {
        const playerMaintenance = db.transaction(() => {
            canonicalizeExistingPlayers(db);
            mergeDuplicatePlayers(db, { hasGamePlayers, hasTurns, hasGames });
        });
        playerMaintenance();
        ensureLowercaseIndex(db);
    }

    if (hasGames) {
        const migrateGames = db.transaction(() => {
            migrateGamesStatusConstraint(db);
        });
        migrateGames();
    }

    // New migration step for recalculating round numbers
    if (hasTurns && hasGamePlayers && hasGames) { // Ensure all relevant tables exist
        recalculateRoundNumbers(db);
    }
}

// Initialize database
function initializeDatabase() {
    console.log('Initializing database...');
    
    // Create database connection
    const db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Run migrations before applying schema
    performMigrations(db);
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    db.transaction(() => {
        statements.forEach(statement => {
            if (statement.trim()) {
                db.exec(statement);
            }
        });
    })();
    
    console.log('Database initialized successfully!');
    console.log(`Database location: ${dbPath}`);
    
    // Close connection
    db.close();
}

// Get database connection
function getDatabase() {
    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    return db;
}

// Run initialization if called directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = {
    initializeDatabase,
    getDatabase,
    dbPath
};
