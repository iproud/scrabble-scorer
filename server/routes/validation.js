const express = require('express');
const fs = require('fs');
const path = require('path');
const nspell = require('nspell');

const router = express.Router();

// Dictionary setup
let dictionary = null;
let dictionaryLoaded = false;

// Load Australian dictionary on startup
function loadDictionary() {
    try {
        const dictionaryPath = path.join(__dirname, '../dictionary');
        const affPath = path.join(dictionaryPath, 'en_AU.aff');
        const dicPath = path.join(dictionaryPath, 'en_AU.dic');
        
        // Check if dictionary files exist
        if (!fs.existsSync(affPath) || !fs.existsSync(dicPath)) {
            console.warn('📚 Australian dictionary files not found, validation disabled');
            return false;
        }
        
        // Read dictionary files
        const aff = fs.readFileSync(affPath, 'utf8');
        const dic = fs.readFileSync(dicPath, 'utf8');
        
        // Create nspell instance
        dictionary = nspell(aff, dic);
        dictionaryLoaded = true;
        
        console.log('📚 Australian dictionary loaded successfully');
        console.log(`📊 Dictionary contains approximately ${dic.split('\n').length - 1} words`);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to load dictionary:', error.message);
        dictionaryLoaded = false;
        return false;
    }
}

// Initialize dictionary on module load
loadDictionary();

// Helper function to check if a word is valid
function isValidWord(word) {
    if (!dictionaryLoaded || !dictionary) {
        // If dictionary not loaded, return true (validation disabled)
        return true;
    }
    
    const cleanWord = word.toUpperCase().trim();
    
    // Check basic word requirements
    if (!cleanWord || cleanWord.length === 0) {
        return false;
    }
    
    // Check if word contains only letters
    if (!/^[A-Z]+$/.test(cleanWord)) {
        return false;
    }
    
    // Use nspell to check the word
    return dictionary.correct(cleanWord);
}

// POST /api/validation/word - Validate a single word
router.post('/word', async (req, res) => {
    try {
        const { word } = req.body;
        
        if (!word || typeof word !== 'string') {
            return res.status(400).json({ error: 'Word is required' });
        }
        
        const upperWord = word.toUpperCase().trim();
        const isValid = isValidWord(upperWord);
        
        res.json({ 
            word: upperWord, 
            valid: isValid,
            dictionaryEnabled: dictionaryLoaded
        });
    } catch (error) {
        console.error('Error validating word:', error);
        res.status(500).json({ error: 'Failed to validate word' });
    }
});

// POST /api/validation/words - Validate multiple words
router.post('/words', async (req, res) => {
    try {
        const { words } = req.body;
        
        if (!words || !Array.isArray(words)) {
            return res.status(400).json({ error: 'Words array is required' });
        }
        
        const results = words.map(word => {
            const upperWord = word.toUpperCase().trim();
            return {
                word: upperWord,
                valid: isValidWord(upperWord)
            };
        });
        
        const invalidWords = results
            .filter(result => !result.valid)
            .map(result => result.word);
        
        const allValid = invalidWords.length === 0;
        
        res.json({ 
            results,
            allValid,
            invalidWords,
            dictionaryEnabled: dictionaryLoaded
        });
    } catch (error) {
        console.error('Error validating words:', error);
        res.status(500).json({ error: 'Failed to validate words' });
    }
});

// POST /api/validation/turn - Validate a complete turn
router.post('/turn', async (req, res) => {
    try {
        const { mainWord, crossWords = [] } = req.body;
        
        if (!mainWord || typeof mainWord !== 'string') {
            return res.status(400).json({ error: 'Main word is required' });
        }
        
        const allWords = [mainWord, ...crossWords];
        const results = allWords.map(word => {
            const upperWord = word.toUpperCase().trim();
            return {
                word: upperWord,
                valid: isValidWord(upperWord)
            };
        });
        
        const mainWordResult = results[0];
        const crossWordResults = results.slice(1);
        
        const invalidWords = results
            .filter(result => !result.valid)
            .map(result => result.word);
        
        const allValid = invalidWords.length === 0;
        
        let message = '';
        if (!dictionaryLoaded) {
            message = 'Dictionary validation disabled - all words accepted';
        } else if (allValid) {
            message = 'All words are valid';
        } else {
            message = `Invalid words found: ${invalidWords.join(', ')}`;
        }
        
        res.json({
            mainWord: mainWordResult,
            crossWords: crossWordResults,
            allValid,
            invalidWords,
            dictionaryEnabled: dictionaryLoaded,
            message
        });
    } catch (error) {
        console.error('Error validating turn:', error);
        res.status(500).json({ error: 'Failed to validate turn' });
    }
});

// GET /api/validation/status - Get dictionary status
router.get('/status', (req, res) => {
    let wordCount = 0;
    
    if (dictionaryLoaded && dictionary) {
        try {
            // Estimate word count from dictionary file
            const dicPath = path.join(__dirname, '../dictionary/en_AU.dic');
            if (fs.existsSync(dicPath)) {
                const dicContent = fs.readFileSync(dicPath, 'utf8');
                const lines = dicContent.split('\n');
                // First line contains the word count
                wordCount = parseInt(lines[0]) || 0;
            }
        } catch (error) {
            console.warn('Could not determine word count:', error.message);
        }
    }
    
    res.json({
        loaded: dictionaryLoaded,
        wordCount,
        language: 'en-AU',
        status: dictionaryLoaded ? 'active' : 'disabled',
        source: 'LibreOffice Australian Dictionary'
    });
});

// GET /api/validation/reload - Reload dictionary (for development)
router.get('/reload', (req, res) => {
    const success = loadDictionary();
    res.json({
        success,
        loaded: dictionaryLoaded,
        message: success ? 'Dictionary reloaded successfully' : 'Failed to reload dictionary'
    });
});

module.exports = router;
