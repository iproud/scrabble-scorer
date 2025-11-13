// Main Application Entry Point - Modular Scrabble App
class ScrabbleApp {
    constructor() {
        this.gameController = new GameController();
    }

    // Initialize the application
    async init() {
        console.log('Scrabble App: Initializing modular application...');
        await this.gameController.init();
        console.log('Scrabble App: Modular initialization complete');
    }
}

// Create global game state instance
window.gameState = new GameState();

// Initialize and start the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Starting Scrabble App');
    const scrabbleApp = new ScrabbleApp();
    await scrabbleApp.init();
    
    // Expose the game controller globally for backward compatibility
    window.scrabbleApp = scrabbleApp;
    window.scrabbleGameController = scrabbleApp.gameController;
});

// Fallback for immediate execution
if (document.readyState === 'loading') {
    console.log('Document still loading - waiting for DOMContentLoaded');
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
    console.log('Document already interactive - initializing immediately');
    // Immediate initialization for already loaded documents
    (async () => {
        const scrabbleApp = new ScrabbleApp();
        window.scrabbleApp = scrabbleApp;
        window.scrabbleGameController = scrabbleApp.gameController;
        await scrabbleApp.init();
    })();
}
