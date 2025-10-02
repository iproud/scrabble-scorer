class DropdownMenu {
    constructor(options) {
        this.buttonId = options.buttonId;
        this.menuId = options.menuId;
        this.instanceKey = options.instanceKey;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.button = document.getElementById(this.buttonId);
        this.menu = document.getElementById(this.menuId);

        if (!this.button || !this.menu) {
            return;
        }

        this.isOpen = false;
        this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleMenuClick = this.handleMenuClick.bind(this);

        this.button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggle();
        });

        this.menu.addEventListener('click', this.boundHandleMenuClick);

        if (this.instanceKey) {
            window.topbarMenus = window.topbarMenus || {};
            window.topbarMenus[this.instanceKey] = this;
        }
    }

    open() {
        if (this.isOpen) return;

        if (window.topbarMenus) {
            Object.values(window.topbarMenus).forEach((menuInstance) => {
                if (menuInstance !== this) {
                    menuInstance.close();
                }
            });
        }

        this.isOpen = true;
        this.menu.classList.remove('hidden');
        this.button.setAttribute('aria-expanded', 'true');

        document.addEventListener('click', this.boundHandleDocumentClick);
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.menu.classList.add('hidden');
        this.button.setAttribute('aria-expanded', 'false');

        document.removeEventListener('click', this.boundHandleDocumentClick);
        document.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    handleDocumentClick(event) {
        if (this.menu.contains(event.target) || this.button.contains(event.target)) {
            return;
        }
        this.close();
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.close();
        }
    }

    handleMenuClick() {
        this.close();
    }
}

new DropdownMenu({
    buttonId: 'topbar-menu-button',
    menuId: 'topbar-menu',
    instanceKey: 'primary'
});

new DropdownMenu({
    buttonId: 'game-actions-button',
    menuId: 'game-actions-menu',
    instanceKey: 'gameActions'
});

// Help Modal functionality
class HelpModal {
    constructor() {
        this.modal = document.getElementById('help-modal');
        this.helpMenuBtn = document.getElementById('help-menu-btn');
        this.closeBtn = document.getElementById('close-help-modal-btn');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        if (!this.modal || !this.helpMenuBtn || !this.closeBtn) {
            return;
        }

        this.helpMenuBtn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        
        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.close();
            }
        });
    }

    open() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
}

// Initialize help modal
new HelpModal();
