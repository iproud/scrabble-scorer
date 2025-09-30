const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const dictionaryDir = path.join(__dirname, '../dictionary');
const configPath = path.join(dictionaryDir, 'config.json');

const DEFAULT_LOCALE = 'en_AU';

const SUPPORTED_DICTIONARIES = [
    { locale: 'en_AU', language: 'English (Australia)', folder: 'en' },
    { locale: 'en_GB', language: 'English (United Kingdom)', folder: 'en' },
    { locale: 'en_US', language: 'English (United States)', folder: 'en' },
    { locale: 'en_CA', language: 'English (Canada)', folder: 'en' },
    { locale: 'en_ZA', language: 'English (South Africa)', folder: 'en' },
    { locale: 'fr_FR', language: 'French (France)', folder: 'fr' },
    { locale: 'fr_CA', language: 'French (Canada)', folder: 'fr' },
    { locale: 'it_IT', language: 'Italian', folder: 'it' },
    { locale: 'es_ES', language: 'Spanish (Spain)', folder: 'es' },
    { locale: 'es_MX', language: 'Spanish (Mexico)', folder: 'es' },
    { locale: 'de_DE', language: 'German (Germany)', folder: 'de' },
    { locale: 'pt_PT', language: 'Portuguese (Portugal)', folder: 'pt' },
    { locale: 'pt_BR', language: 'Portuguese (Brazil)', folder: 'pt' },
    { locale: 'nl_NL', language: 'Dutch', folder: 'nl' },
    { locale: 'sv_SE', language: 'Swedish', folder: 'sv' },
    { locale: 'da_DK', language: 'Danish', folder: 'da' },
    { locale: 'no_NO', language: 'Norwegian', folder: 'no' },
    { locale: 'fi_FI', language: 'Finnish', folder: 'fi' },
    { locale: 'pl_PL', language: 'Polish', folder: 'pl' },
    { locale: 'cs_CZ', language: 'Czech', folder: 'cs' },
    { locale: 'sk_SK', language: 'Slovak', folder: 'sk' },
    { locale: 'hu_HU', language: 'Hungarian', folder: 'hu' },
    { locale: 'ro_RO', language: 'Romanian', folder: 'ro' },
    { locale: 'ga_IE', language: 'Irish', folder: 'ga' },
    { locale: 'gl_ES', language: 'Galician', folder: 'gl' },
    { locale: 'ca_ES', language: 'Catalan', folder: 'ca' }
];

function ensureDirectory() {
    if (!fs.existsSync(dictionaryDir)) {
        fs.mkdirSync(dictionaryDir, { recursive: true });
    }
}

function readConfig() {
    ensureDirectory();

    if (!fs.existsSync(configPath)) {
        const config = { activeLocale: DEFAULT_LOCALE };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return config;
    }

    try {
        const data = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);
        if (!config.activeLocale) {
            config.activeLocale = DEFAULT_LOCALE;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
        return config;
    } catch (error) {
        console.error('Failed to read dictionary config, recreating:', error.message);
        const config = { activeLocale: DEFAULT_LOCALE };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return config;
    }
}

function writeConfig(config) {
    ensureDirectory();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getConfig() {
    return readConfig();
}

function getAllowedLocales() {
    return SUPPORTED_DICTIONARIES.slice();
}

function getLocaleMetadata(locale) {
    return SUPPORTED_DICTIONARIES.find(item => item.locale === locale) || null;
}

function getDictionaryPaths(locale) {
    const safeLocale = locale.replace(/[^A-Za-z0-9_\-]/g, '');
    return {
        affPath: path.join(dictionaryDir, `${safeLocale}.aff`),
        dicPath: path.join(dictionaryDir, `${safeLocale}.dic`)
    };
}

function isDictionaryInstalled(locale) {
    const { affPath, dicPath } = getDictionaryPaths(locale);
    return fs.existsSync(affPath) && fs.existsSync(dicPath);
}

function listInstalledDictionaries() {
    ensureDirectory();

    const installed = [];
    const files = fs.readdirSync(dictionaryDir);

    const locales = new Set(
        files
            .filter(file => file.endsWith('.dic'))
            .map(file => file.replace(/\.dic$/, ''))
    );

    locales.forEach(locale => {
        const { affPath, dicPath } = getDictionaryPaths(locale);
        if (fs.existsSync(affPath) && fs.existsSync(dicPath)) {
            const stats = fs.statSync(dicPath);
            const meta = getLocaleMetadata(locale);
            installed.push({
                locale,
                language: meta ? meta.language : locale,
                installedAt: stats.mtime.toISOString(),
                size: stats.size
            });
        }
    });

    return installed.sort((a, b) => a.language.localeCompare(b.language));
}

function getAvailableDictionaries() {
    const installedLocales = new Set(listInstalledDictionaries().map(d => d.locale));
    return getAllowedLocales().map(entry => ({
        ...entry,
        installed: installedLocales.has(entry.locale)
    }));
}

async function downloadFile(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'ScrabbleKeeper/1.0',
            'Accept': 'application/vnd.github.v3.raw'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

async function downloadDictionaryFiles(localeMeta) {
    const basePath = `https://raw.githubusercontent.com/LibreOffice/dictionaries/master/${localeMeta.folder}/${localeMeta.locale}`;
    const dicUrl = `${basePath}.dic`;
    const affUrl = `${basePath}.aff`;

    const [dicBuffer, affBuffer] = await Promise.all([
        downloadFile(dicUrl),
        downloadFile(affUrl)
    ]);

    return { dicBuffer, affBuffer };
}

async function installDictionary(locale) {
    const meta = getLocaleMetadata(locale);
    if (!meta) {
        throw new Error(`Locale ${locale} is not supported for installation.`);
    }

    const { dicBuffer, affBuffer } = await downloadDictionaryFiles(meta);
    const { affPath, dicPath } = getDictionaryPaths(locale);

    ensureDirectory();
    fs.writeFileSync(dicPath, dicBuffer);
    fs.writeFileSync(affPath, affBuffer);

    const config = getConfig();
    if (!config.activeLocale) {
        config.activeLocale = locale;
        writeConfig(config);
    }

    return {
        locale,
        language: meta.language,
        installed: true
    };
}

async function refreshDictionary(locale) {
    if (!isDictionaryInstalled(locale)) {
        throw new Error(`Dictionary ${locale} is not installed.`);
    }
    return installDictionary(locale);
}

function deleteDictionary(locale) {
    if (!isDictionaryInstalled(locale)) {
        throw new Error(`Dictionary ${locale} is not installed.`);
    }

    const { affPath, dicPath } = getDictionaryPaths(locale);
    fs.unlinkSync(dicPath);
    fs.unlinkSync(affPath);

    const config = getConfig();
    if (config.activeLocale === locale) {
        const installed = listInstalledDictionaries().map(dict => dict.locale);
        const newActive = installed.find(installedLocale => installedLocale !== locale) || DEFAULT_LOCALE;
        config.activeLocale = newActive;
        writeConfig(config);
    }
}

function getActiveLocale() {
    const config = getConfig();
    return config.activeLocale || DEFAULT_LOCALE;
}

function setActiveLocale(locale) {
    if (!isDictionaryInstalled(locale)) {
        throw new Error(`Cannot set active dictionary to ${locale} because it is not installed.`);
    }
    const config = getConfig();
    config.activeLocale = locale;
    writeConfig(config);
}

function ensureDefaultDictionaryInstalled() {
    if (!isDictionaryInstalled(DEFAULT_LOCALE)) {
        console.warn(`Default dictionary ${DEFAULT_LOCALE} is not installed. Validation will be disabled until one is installed.`);
    }
}

module.exports = {
    getConfig,
    getAllowedLocales,
    getLocaleMetadata,
    getDictionaryPaths,
    getAvailableDictionaries,
    listInstalledDictionaries,
    installDictionary,
    refreshDictionary,
    deleteDictionary,
    getActiveLocale,
    setActiveLocale,
    isDictionaryInstalled,
    ensureDefaultDictionaryInstalled,
    DEFAULT_LOCALE
};
