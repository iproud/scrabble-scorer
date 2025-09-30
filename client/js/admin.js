// Dictionary Admin Page Controller
class DictionaryAdminApp {
    constructor() {
        this.installed = [];
        this.catalog = [];
        this.activeLocale = null;
        this.validationEnabled = false;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.refreshAll();
    }

    cacheElements() {
        this.loadingState = document.getElementById('admin-loading-state');
        this.errorState = document.getElementById('admin-error-state');
        this.retryBtn = document.getElementById('retry-admin-load-btn');
        this.content = document.getElementById('admin-content');

        this.validationPill = document.getElementById('validation-pill');
        this.activeLanguageLabel = document.getElementById('active-language-label');
        this.activeLocaleLabel = document.getElementById('active-locale-label');

        this.installedContainer = document.getElementById('installed-dictionaries-container');
        this.installedCountLabel = document.getElementById('installed-count-label');
        this.emptyInstalledState = document.getElementById('empty-installed-state');

        this.installInput = document.getElementById('install-locale-input');
        this.installBtn = document.getElementById('install-dictionary-btn');
        this.catalogDatalist = document.getElementById('dictionary-catalog-options');

        this.refreshOverviewBtn = document.getElementById('refresh-overview-btn');
    }

    bindEvents() {
        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.refreshAll());
        }
        if (this.refreshOverviewBtn) {
            this.refreshOverviewBtn.addEventListener('click', () => this.refreshAll());
        }
        if (this.installBtn) {
            this.installBtn.addEventListener('click', () => this.handleInstall());
        }
        if (this.installInput) {
            this.installInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.handleInstall();
                }
            });
        }
    }

    async refreshAll() {
        this.showSection('loading');
        try {
            const [status, catalog] = await Promise.all([
                window.scrabbleAPI.getDictionaries(),
                window.scrabbleAPI.getDictionaryCatalog()
            ]);
            this.installed = Array.isArray(status?.installed) ? status.installed : [];
            this.catalog = this.filterRomanCatalog(catalog);
            this.activeLocale = status?.activeLocale || null;
            this.validationEnabled = !!status?.validationEnabled;

            this.renderCatalog();
            this.renderInstalled();
            this.renderActiveStatus();
            this.showSection('content');
        } catch (error) {
            console.error('Dictionary admin load failed:', error);
            this.showSection('error');
        }
    }

    filterRomanCatalog(catalog) {
        if (!Array.isArray(catalog)) return [];
        const romanRegex = /^[A-Za-zÀ-ž0-9 ,.\-()'/]+$/;
        return catalog
            .filter(entry => romanRegex.test(entry.language))
            .sort((a, b) => a.language.localeCompare(b.language));
    }

    renderCatalog() {
        if (!this.catalogDatalist) return;
        this.catalogDatalist.innerHTML = this.catalog
            .map(entry => `<option value="${entry.language} (${entry.locale})">${entry.locale}</option>`)
            .join('');
    }

    renderActiveStatus() {
        const active = this.installed.find(item => item.active) || null;
        if (!active) {
            this.activeLanguageLabel.textContent = 'No active dictionary';
            this.activeLocaleLabel.textContent = 'Locale: —';
            this.setValidationPill(false, 'Validation disabled');
            return;
        }
        this.activeLanguageLabel.textContent = active.language;
        this.activeLocaleLabel.textContent = `Locale: ${active.locale}`;
        this.setValidationPill(this.validationEnabled, this.validationEnabled ? 'Validation active' : 'Validation disabled');
    }

    setValidationPill(isEnabled, label) {
        if (!this.validationPill) return;
        this.validationPill.className = `inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
            isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`;
        const dotColor = isEnabled ? 'bg-emerald-500' : 'bg-gray-400';
        this.validationPill.innerHTML = `<span class="inline-block w-2 h-2 rounded-full ${dotColor}"></span>${label}`;
    }

    renderInstalled() {
        if (!this.installedContainer) return;

        if (this.installed.length === 0) {
            this.installedContainer.innerHTML = '';
            this.installedCountLabel.textContent = '0 installed';
            this.emptyInstalledState.classList.remove('hidden');
            return;
        }

        this.installedCountLabel.textContent = `${this.installed.length} installed`;
        this.emptyInstalledState.classList.add('hidden');

        this.installedContainer.innerHTML = this.installed
            .map(dict => this.renderInstalledCard(dict))
            .join('');

        // bind card buttons
        this.installed.forEach(dict => {
            const card = document.querySelector(`[data-locale="${dict.locale}"]`);
            if (!card) return;
            card.querySelector('.activate-btn')?.addEventListener('click', () => this.handleActivate(dict.locale));
            card.querySelector('.refresh-btn')?.addEventListener('click', () => this.handleRefresh(dict.locale));
            card.querySelector('.delete-btn')?.addEventListener('click', () => this.handleDelete(dict.locale));
        });
    }

    renderInstalledCard(dict) {
        const isActive = dict.locale === this.activeLocale;
        const activeBadge = isActive
            ? `<span class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-600">
                   <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Active
               </span>`
            : '';
        const sizeLabel = dict.size ? `${(dict.size / 1024).toFixed(1)} KB` : 'Unknown size';
        const installedAt = dict.installedAt
            ? new Date(dict.installedAt).toLocaleString()
            : 'Unknown date';

        return `
            <article class="px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-6" data-locale="${dict.locale}">
                <div class="flex-1 space-y-2">
                    <div class="flex items-center gap-3 flex-wrap">
                        <h3 class="text-lg font-semibold text-gray-900">${dict.language}</h3>
                        ${activeBadge}
                        <span class="text-xs uppercase tracking-wide text-gray-400">Locale: ${dict.locale}</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-500">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 font-semibold">⬇</span>
                            <span>Installed: ${installedAt}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 font-semibold">💾</span>
                            <span>${sizeLabel}</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-2">
                    ${isActive ? '' : `
                        <button class="activate-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow-sm hover:bg-emerald-700 transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                      d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Set active
                        </button>
                    `}
                    <button class="refresh-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:border-gray-300 hover:bg-gray-50 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                  d="M4.5 4.5v6h6m9-3a9 9 0 11-3-6.708" />
                        </svg>
                        Refresh
                    </button>
                    <button class="delete-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-red-200 text-red-600 font-semibold rounded-lg hover:border-red-300 hover:bg-red-50 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                  d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Remove
                    </button>
                </div>
            </article>
        `;
    }

    async handleInstall() {
        const value = (this.installInput.value || '').trim();
        if (!value) {
            alert('Enter a language name or locale code to install.');
            return;
        }

        const match = this.catalog.find(entry =>
            entry.locale.toLowerCase() === value.toLowerCase() ||
            entry.language.toLowerCase() === value.toLowerCase() ||
            value.toLowerCase().includes(entry.locale.toLowerCase())
        );

        if (!match) {
            alert('Dictionary not found in catalog. Try selecting from the suggestions.');
            return;
        }

        if (this.installed.some(dict => dict.locale === match.locale)) {
            alert(`${match.language} (${match.locale}) is already installed.`);
            return;
        }

        this.setButtonLoading(this.installBtn, true);
        try {
            await window.scrabbleAPI.installDictionary(match.locale);
            this.installInput.value = '';
            await this.refreshAll();
            alert(`${match.language} installed successfully.`);
        } catch (error) {
            console.error('Failed to install dictionary:', error);
            alert(error.message || 'Failed to install dictionary. Please try again.');
        } finally {
            this.setButtonLoading(this.installBtn, false);
        }
    }

    async handleActivate(locale) {
        if (!locale) return;
        const confirmActivate = confirm(`Set ${locale} as the active dictionary?`);
        if (!confirmActivate) return;

        const button = document.querySelector(`[data-locale="${locale}"] .activate-btn`);
        this.setButtonLoading(button, true);

        try {
            await window.scrabbleAPI.activateDictionary(locale);
            await this.refreshAll();
            alert(`Dictionary ${locale} is now active.`);
        } catch (error) {
            console.error('Failed to activate dictionary:', error);
            alert(error.message || 'Failed to activate dictionary. Please try again.');
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    async handleRefresh(locale) {
        if (!locale) return;
        const button = document.querySelector(`[data-locale="${locale}"] .refresh-btn`);
        this.setButtonLoading(button, true);

        try {
            await window.scrabbleAPI.refreshDictionary(locale);
            await this.refreshAll();
            alert(`Dictionary ${locale} refreshed successfully.`);
        } catch (error) {
            console.error('Failed to refresh dictionary:', error);
            alert(error.message || 'Failed to refresh dictionary. Please try again.');
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    async handleDelete(locale) {
        if (!locale) return;
        const isActive = locale === this.activeLocale;
        const confirmDelete = confirm(`Remove dictionary ${locale}?${isActive ? '\n\nIt is currently active and will fallback to a different dictionary if available.' : ''}`);
        if (!confirmDelete) return;

        const button = document.querySelector(`[data-locale="${locale}"] .delete-btn`);
        this.setButtonLoading(button, true);

        try {
            await window.scrabbleAPI.deleteDictionary(locale);
            await this.refreshAll();
            alert(`Dictionary ${locale} removed.`);
        } catch (error) {
            console.error('Failed to delete dictionary:', error);
            alert(error.message || 'Failed to delete dictionary. Please try again.');
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    showSection(state) {
        if (this.loadingState) this.loadingState.classList.toggle('hidden', state !== 'loading');
        if (this.errorState) this.errorState.classList.toggle('hidden', state !== 'error');
        if (this.content) this.content.classList.toggle('hidden', state !== 'content');
    }

    setButtonLoading(button, loading) {
        if (!button) return;
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>`;
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }
}

window.dictionaryAdminApp = new DictionaryAdminApp();
