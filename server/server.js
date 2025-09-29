const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDatabase, initializeDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Initialize database on startup
try {
    initializeDatabase();
} catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
}

// Import routes
const gamesRoutes = require('./routes/games');
const validationRoutes = require('./routes/validation');

// API Routes
app.use('/api/games', gamesRoutes);
app.use('/api/validation', validationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve client app for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎯 Scrabble Scorer server running on port ${PORT}`);
    console.log(`📱 Client available at: http://localhost:${PORT}`);
    console.log(`🔗 API available at: http://localhost:${PORT}/api`);
});

module.exports = app;
