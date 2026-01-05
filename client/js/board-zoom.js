/**
 * Board Zoom and Pan Controller for Mobile
 * Provides simplified pinch-to-zoom and pan functionality for the Scrabble board.
 */
class BoardZoomController {
    constructor() {
        this.boardElement = document.getElementById('scrabble-board');
        this.containerElement = this.boardElement?.parentElement;
        this.resetBtn = null;

        if (!this.boardElement || !this.containerElement) {
            console.warn('BoardZoomController: Board or container not found');
            return;
        }

        // State
        this.scale = 1;
        this.panning = false;
        this.pointX = 0;
        this.pointY = 0;
        this.start = { x: 0, y: 0 };
        this.isZoomed = false;

        // Configuration
        this.minScale = 1;
        this.maxScale = 2.5;

        this.init();
    }

    init() {
        // Ensure container clips content
        this.containerElement.style.overflow = 'hidden';
        this.containerElement.style.position = 'relative';
        this.containerElement.style.touchAction = 'none'; // Prevent browser scrolling

        // Create Zoom Controls
        this.createControls();

        // Styles for transformation
        this.boardElement.style.transformOrigin = '0 0';
        this.boardElement.style.transition = 'transform 0.1s ease-out';

        // Add Event Listeners
        this.addEventListeners();
    }

    createControls() {
        // Add a floating zoom toggle button to the container
        const controls = document.createElement('div');
        controls.className = 'absolute bottom-2 right-2 flex gap-2 z-10';

        const zoomBtn = document.createElement('button');
        zoomBtn.className = 'bg-white/90 p-2 rounded-full shadow-md text-gray-700 hover:bg-white border border-gray-200';
        zoomBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" /></svg>';
        zoomBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent board click
            this.toggleZoom();
        };

        const resetBtn = document.createElement('button');
        resetBtn.className = 'bg-white/90 p-2 rounded-full shadow-md text-gray-700 hover:bg-white border border-gray-200 hidden';
        resetBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg>';
        resetBtn.onclick = (e) => {
            e.stopPropagation();
            this.reset();
        };
        this.resetBtn = resetBtn;

        controls.appendChild(zoomBtn);
        controls.appendChild(resetBtn);
        this.containerElement.appendChild(controls);
    }

    addEventListeners() {
        // Touch events for panning
        this.containerElement.addEventListener('touchstart', (e) => this.onStart(e));
        this.containerElement.addEventListener('touchmove', (e) => this.onMove(e));
        this.containerElement.addEventListener('touchend', (e) => this.onEnd(e));

        // Mouse events for development/desktop testing
        this.containerElement.addEventListener('mousedown', (e) => this.onStart(e));
        window.addEventListener('mousemove', (e) => this.onMove(e)); // Window to catch drags outside
        window.addEventListener('mouseup', (e) => this.onEnd(e));
    }

    toggleZoom() {
        if (this.isZoomed) {
            this.reset();
        } else {
            // Zoom to center
            this.scale = 2.0;
            // Center the zoom
            const rect = this.containerElement.getBoundingClientRect();
            this.pointX = -(rect.width * this.scale - rect.width) / 2;
            this.pointY = -(rect.height * this.scale - rect.height) / 2;
            this.isZoomed = true;
            this.updateTransform();
            this.resetBtn.classList.remove('hidden');
        }
    }

    reset() {
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.isZoomed = false;
        this.updateTransform();
        this.resetBtn.classList.add('hidden');
    }

    getPoint(e) {
        if (e.touches) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    onStart(e) {
        if (!this.isZoomed) return;

        // Don't interfere if it looks like a click on a button?
        // Actually, for pan, we should probably check target. 
        // But preventing default on touchstart might block clicks.
        // We only prevent default in touchmove if panning.

        this.start = this.getPoint(e);
        this.panning = true;
    }

    onMove(e) {
        if (!this.panning || !this.isZoomed) return;

        e.preventDefault(); // Stop scroll

        const point = this.getPoint(e);
        const deltaX = point.x - this.start.x;
        const deltaY = point.y - this.start.y;

        this.pointX += deltaX;
        this.pointY += deltaY;

        this.start = point;
        this.constrain();
        this.updateTransform();
    }

    onEnd(e) {
        this.panning = false;
    }

    constrain() {
        const rect = this.containerElement.getBoundingClientRect();
        const maxX = 0;
        const minX = -(rect.width * this.scale - rect.width);
        const maxY = 0;
        const minY = -(rect.height * this.scale - rect.height);

        if (this.pointX > maxX) this.pointX = maxX;
        if (this.pointX < minX) this.pointX = minX;
        if (this.pointY > maxY) this.pointY = maxY;
        if (this.pointY < minY) this.pointY = minY;
    }

    updateTransform() {
        this.boardElement.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on mobile or small screen
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    // Always init for responsiveness, but maybe optional? 
    // Just init it, controls will be visible.
    window.boardZoomController = new BoardZoomController();
});
