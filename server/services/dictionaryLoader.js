const fs = require('fs');
const nspell = require('nspell');
const dictionaryManager = require('./dictionaryManager');

let currentDictionary = {
    locale: null,
    spell: null,
    loaded: false
};

function loadDictionaryForLocale(locale) {
    try {
        const { affPath, dicPath } = dictionaryManager.getDictionaryPaths(locale);

        if (!fs.existsSync(affPath) || !fs.existsSync(dicPath)) {
            console.warn(`Dictionary files for locale ${locale} not found.`);
            currentDictionary = { locale: null, spell: null, loaded: false };
            return currentDictionary;
        }

        const aff = fs.readFileSync(affPath, 'utf8');
        const dic = fs.readFileSync(dicPath, 'utf8');
        const spell = nspell(aff, dic);

        currentDictionary = { locale, spell, loaded: true };
        console.log(`📚 Dictionary for locale ${locale} loaded successfully`);
        return currentDictionary;
    } catch (error) {
        console.error(`❌ Failed to load dictionary for locale ${locale}:`, error.message);
        currentDictionary = { locale: null, spell: null, loaded: false };
        return currentDictionary;
    }
}

function loadActiveDictionary() {
    const activeLocale = dictionaryManager.getActiveLocale();
    return loadDictionaryForLocale(activeLocale);
}

function getSpellChecker() {
    if (currentDictionary.loaded && currentDictionary.locale === dictionaryManager.getActiveLocale()) {
        return currentDictionary;
    }
    return loadActiveDictionary();
}

function reloadDictionary(locale) {
    if (locale) {
        return loadDictionaryForLocale(locale);
    }
    return loadActiveDictionary();
}

module.exports = {
    loadActiveDictionary,
    getSpellChecker,
    reloadDictionary
};
