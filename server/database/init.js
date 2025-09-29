const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'scrabble.db');

// Initialize database
function initializeDatabase() {
    console.log('Initializing database...');
    
    // Create database connection
    const db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
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
