class PlayerNameAutocomplete {
    constructor(inputs, options = {}) {
        this.inputs = Array.from(inputs || []);
        this.delay = options.delay ?? 200;
        this.maxSuggestions = options.maxSuggestions ?? 10;
        this.activeRequests = new Map();
        this.state = new Map(); // input -> {container, items, highlightedIndex}

        if (this.inputs.length > 0) {
            this.init();
        }
    }

    init() {
        this.inputs.forEach((input) => {
            const wrapper = this.ensureWrapper(input);
            const container = document.createElement('div');
            container.className = 'player-autocomplete-dropdown hidden';
            wrapper.appendChild(container);

            this.state.set(input, {
                container,
                items: [],
                highlightedIndex: -1,
                debounceHandle: null,
                lastQuery: ''
            });

            input.setAttribute('autocomplete', 'off');

            input.addEventListener('input', () => this.handleInput(input));
            input.addEventListener('focus', () => this.handleFocus(input));
            input.addEventListener('blur', () => this.handleBlur(input));
            input.addEventListener('keydown', (event) => this.handleKeyDown(event, input));
        });
    }

    ensureWrapper(input) {
        const parent = input.parentElement;
        if (!parent.classList.contains('player-input-wrapper')) {
            parent.classList.add('player-input-wrapper');
        }
        return parent;
    }

    handleInput(input) {
        const query = input.value.trim();
        const state = this.state.get(input);
        if (!state) return;

        state.lastQuery = query;
        this.scheduleFetch(input, query);
    }

    handleFocus(input) {
        const state = this.state.get(input);
        if (!state) return;

        // Re-fetch suggestions on focus if there is a value
        if (input.value.trim().length > 0) {
            this.scheduleFetch(input, input.value.trim());
        }
    }

    handleBlur(input) {
        const state = this.state.get(input);
        if (!state) return;

        // Delay hiding to allow click events on suggestions
        setTimeout(() => this.hideSuggestions(input), 150);
    }

    handleKeyDown(event, input) {
        const state = this.state.get(input);
        if (!state || state.container.classList.contains('hidden')) {
            return;
        }

        const items = state.items;
        if (items.length === 0) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.moveHighlight(input, 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.moveHighlight(input, -1);
                break;
            case 'Enter':
                if (state.highlightedIndex >= 0) {
                    event.preventDefault();
                    this.selectSuggestion(input, items[state.highlightedIndex]);
                }
                break;
            case 'Escape':
                this.hideSuggestions(input);
                break;
            default:
                break;
        }
    }

    moveHighlight(input, delta) {
        const state = this.state.get(input);
        if (!state) return;

        const items = state.items;
        if (items.length === 0) return;

        state.highlightedIndex = (state.highlightedIndex + delta + items.length) % items.length;
        this.renderSuggestions(input);
    }

    scheduleFetch(input, query) {
        const state = this.state.get(input);
        if (!state) return;

        if (state.debounceHandle) {
            clearTimeout(state.debounceHandle);
        }

        state.debounceHandle = setTimeout(() => {
            this.fetchSuggestions(input, query ?? '');
        }, this.delay);
    }

    async fetchSuggestions(input, query = '') {
        const state = this.state.get(input);
        if (!state) return;

        const trimmedQuery = query.trim();
        state.lastQuery = trimmedQuery;

        const currentValue = this.canonicalizeName(input.value);
        const existingValues = new Set(
            this.inputs
                .filter((other) => other !== input)
                .map((other) => this.canonicalizeName(other.value))
                .filter((value) => value.length > 0)
        );
        if (currentValue) {
            existingValues.add(currentValue.toLowerCase());
        }

        try {
            const suggestions = await window.scrabbleAPI.searchPlayers(trimmedQuery ? trimmedQuery : undefined, this.maxSuggestions);
            const filtered = (suggestions || [])
                .map((player) => this.canonicalizeName(player.name))
                .filter(Boolean)
                .filter((name) => !existingValues.has(name.toLowerCase()));

            state.items = filtered;
            state.highlightedIndex = filtered.length > 0 ? 0 : -1;

            if (filtered.length === 0) {
                this.hideSuggestions(input);
            } else {
                this.renderSuggestions(input);
            }
        } catch (error) {
            console.error('Failed to load player suggestions:', error);
            this.hideSuggestions(input);
        }
    }

    canonicalizeName(name = '') {
        return name
            .trim()
            .replace(/\s+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
    }

    renderSuggestions(input) {
        const state = this.state.get(input);
        if (!state) return;

        const { container, items, highlightedIndex } = state;

        if (!items || items.length === 0) {
            this.hideSuggestions(input);
            return;
        }

        container.innerHTML = items
            .map((name, index) => {
                const isHighlighted = index === highlightedIndex;
                return `<button type="button" class="player-autocomplete-item ${isHighlighted ? 'highlighted' : ''}" data-index="${index}">
                            ${this.highlightMatch(name, state.lastQuery)}
                        </button>`;
            })
            .join('');

        container.classList.remove('hidden');

        container.querySelectorAll('.player-autocomplete-item').forEach((btn) => {
            btn.addEventListener('mousedown', (event) => {
                event.preventDefault(); // Prevent input blur
                const idx = parseInt(btn.dataset.index, 10);
                const suggestion = state.items[idx];
                if (suggestion) {
                    this.selectSuggestion(input, suggestion);
                }
            });
        });
    }

    highlightMatch(name, query) {
        if (!query) {
            return name;
        }
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
        return name.replace(regex, '<span class="highlight">$1</span>');
    }

    selectSuggestion(input, suggestion) {
        input.value = suggestion;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        this.hideSuggestions(input);
        input.focus();
    }

    hideSuggestions(input) {
        const state = this.state.get(input);
        if (!state) return;

        state.container.classList.add('hidden');
        state.container.innerHTML = '';
        state.items = [];
        state.highlightedIndex = -1;
    }
}

window.PlayerNameAutocomplete = PlayerNameAutocomplete;
