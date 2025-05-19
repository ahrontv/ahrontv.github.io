// PixelGridModule.js
// A reusable module for image processing demonstrations

/**
 * Represents a single pixel with value, visual representation, and interaction capabilities
 */
export class Pixel {
    /**
     * Create a new pixel
     * @param {number} value - Initial pixel value (0-255)
     * @param {number} x - X coordinate in the grid
     * @param {number} y - Y coordinate in the grid
     */
    constructor(value = 128, x = 0, y = 0) {
        this.value = value;
        this.x = x;
        this.y = y;
        this.isCenter = false;
        this.isHighlighted = false;
        
        // Create DOM element
        this.element = document.createElement('div');
        this.element.className = 'pixel';
        this.element.dataset.x = x;
        this.element.dataset.y = y;
        this.element.textContent = `${value}`;
    }

    /**
     * Update the pixel's value and display
     * @param {number} newValue - New pixel value
     */
    setValue(newValue) {
        this.value = newValue;
        this.element.textContent = `${newValue}`;
    }

    /**
     * Increment the pixel value by a specified amount (with wrapping)
     * @param {number} increment - Amount to increment
     * @param {number} max - Maximum value (for wrapping)
     */
    incrementValue(increment = 25, max = 256) {
        const newValue = (this.value + increment) % max;
        this.setValue(newValue);
    }

    /**
     * Set direct input mode for the pixel
     */
    enableDirectInput() {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 255;
        input.value = this.value;
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.boxSizing = 'border-box';

        // Save original content
        const originalContent = this.element.textContent;
        
        // Clear content and add input
        this.element.textContent = '';
        this.element.appendChild(input);
        input.focus();
        
        // Handle input completion
        const finishInput = () => {
            let newValue = parseInt(input.value);
            if (isNaN(newValue)) {
                newValue = this.value;
            } else {
                newValue = Math.max(0, Math.min(255, newValue));
            }
            
            this.setValue(newValue);
            input.remove();
        };
        
        input.addEventListener('blur', finishInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishInput();
            } else if (e.key === 'Escape') {
                this.element.textContent = originalContent;
                input.remove();
            }
        });
    }

    /**
     * Set this pixel as a center pixel for neighborhood operations
     * @param {boolean} isCenter - Whether this is the center pixel
     */
    setAsCenter(isCenter = true) {
        this.isCenter = isCenter;
        if (isCenter) {
            this.element.classList.remove('highlight');
            this.element.classList.add('result');
        } else {
            this.element.classList.remove('result');
        }
    }

    /**
     * Highlight this pixel (for neighborhood visualization)
     * @param {boolean} highlight - Whether to highlight the pixel
     */
    highlight(highlight = true) {
        this.isHighlighted = highlight;
        if (highlight && !this.isCenter) {
            this.element.classList.add('highlight');
        } else {
            this.element.classList.remove('highlight');
        }
    }

    /**
     * Clear any highlighting on this pixel
     */
    clearHighlight() {
        this.isHighlighted = false;
        this.isCenter = false;
        this.element.classList.remove('highlight');
        this.element.classList.remove('result');
    }
}

/**
 * Represents a grid of pixels with operations for demonstrating image processing
 */
export class PixelGrid {
    /**
     * Create a new pixel grid
     * @param {number|Array} size - Grid size (single number for square grid, [width, height] for rectangular)
     * @param {HTMLElement} container - DOM element to contain the grid
     * @param {Object} options - Additional options
     */
    constructor(size, container, options = {}) {
        // Determine grid dimensions
        if (Array.isArray(size)) {
            this.width = size[0];
            this.height = size[1];
        } else {
            this.width = size;
            this.height = size;
        }

        // Options with defaults
        this.options = {
            initialValue: 128,
            incrementValue: 25,
            maxValue: 256,
            neighborhoodSize: 3,
            ...options
        };

        this.container = container;
        this.pixels = [];
        this.selectedCenter = null;
        this.dblClickTimeout = null;
        this.dblClickDelay = 300; // ms
        this.callbacks = {
            onCenterSelected: null,
            onValueChanged: null
        };

        // Initialize the grid
        this.createGrid();
    }

    /**
     * Create the pixel grid
     */
    createGrid() {
        // Clear container
        this.container.innerHTML = '';
        
        // Set grid layout
        this.container.style.display = 'grid';
        this.container.style.gridTemplateColumns = `repeat(${this.width}, 1fr)`;
        this.container.style.gap = '2px';
        
        // Create pixels
        for (let y = 0; y < this.height; y++) {
            this.pixels[y] = [];
            for (let x = 0; x < this.width; x++) {
                const pixel = new Pixel(this.options.initialValue, x, y);
                this.pixels[y][x] = pixel;
                
                // Set up event handling
                this.setupPixelEvents(pixel);
                
                // Add to DOM
                this.container.appendChild(pixel.element);
            }
        }
    }

    /**
     * Set up event handlers for a pixel
     * @param {Pixel} pixel - The pixel to set up events for
     */
    setupPixelEvents(pixel) {
        pixel.element.addEventListener('click', (e) => {
            if (e.ctrlKey) {
                // Set as center pixel
                this.selectCenterPixel(pixel.x, pixel.y);
            } else {
                // Handle single or double click
                clearTimeout(this.dblClickTimeout);
                
                if (this.lastClickedPixel === pixel && Date.now() - this.lastClickTime < this.dblClickDelay) {
                    // Double click - enable direct input
                    pixel.enableDirectInput();
                } else {
                    // Single click - increment value
                    this.dblClickTimeout = setTimeout(() => {
                        pixel.incrementValue(this.options.incrementValue, this.options.maxValue);
                        if (this.callbacks.onValueChanged) {
                            this.callbacks.onValueChanged(pixel, this);
                        }
                    }, this.dblClickDelay);
                }
                
                this.lastClickedPixel = pixel;
                this.lastClickTime = Date.now();
            }
        });
    }

    /**
     * Select a pixel as the center for neighborhood operations
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    selectCenterPixel(x, y) {
        this.clearHighlights();
        
        // Set new center
        this.selectedCenter = { x, y };
        this.pixels[y][x].setAsCenter(true);
        
        // Highlight neighborhood
        this.highlightNeighborhood();
        
        // Trigger callback
        if (this.callbacks.onCenterSelected) {
            this.callbacks.onCenterSelected(this.pixels[y][x], this);
        }
    }

    /**
     * Highlight the current neighborhood based on selected center
     */
    highlightNeighborhood() {
        if (!this.selectedCenter) return;
        
        const halfKernel = Math.floor(this.options.neighborhoodSize / 2);
        const { x: centerX, y: centerY } = this.selectedCenter;
        
        for (let y = centerY - halfKernel; y <= centerY + halfKernel; y++) {
            for (let x = centerX - halfKernel; x <= centerX + halfKernel; x++) {
                if (this.isValidCoordinate(x, y)) {
                    this.pixels[y][x].highlight(true);
                }
            }
        }
        
        // Ensure center pixel is marked correctly
        this.pixels[centerY][centerX].setAsCenter(true);
    }

    /**
     * Clear all highlights in the grid
     */
    clearHighlights() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.pixels[y][x].clearHighlight();
            }
        }
        this.selectedCenter = null;
    }

    /**
     * Check if coordinates are within grid bounds
     * @param {number} x - X coordinate to check
     * @param {number} y - Y coordinate to check
     * @returns {boolean} - Whether coordinates are valid
     */
    isValidCoordinate(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    /**
     * Set callback function for when center pixel is selected
     * @param {Function} callback - Function to call when center is selected
     */
    onCenterSelected(callback) {
        this.callbacks.onCenterSelected = callback;
    }

    /**
     * Set callback function for when pixel value changes
     * @param {Function} callback - Function to call when value changes
     */
    onValueChanged(callback) {
        this.callbacks.onValueChanged = callback;
    }

    /**
     * Set neighborhood size
     * @param {number} size - New neighborhood size (odd number)
     */
    setNeighborhoodSize(size) {
        if (size % 2 === 0) {
            console.warn("Neighborhood size should be odd. Adding 1 to make it odd.");
            size += 1;
        }
        this.options.neighborhoodSize = size;
        
        // Update highlight if center is selected
        if (this.selectedCenter) {
            this.clearHighlights();
            this.pixels[this.selectedCenter.y][this.selectedCenter.x].setAsCenter(true);
            this.highlightNeighborhood();
        }
    }

    /**
     * Get all pixel values in the current neighborhood
     * @returns {Array|null} - Array of pixel values or null if no center selected
     */
    getNeighborhoodValues() {
        if (!this.selectedCenter) return null;
        
        const values = [];
        const halfKernel = Math.floor(this.options.neighborhoodSize / 2);
        const { x: centerX, y: centerY } = this.selectedCenter;
        
        for (let y = centerY - halfKernel; y <= centerY + halfKernel; y++) {
            for (let x = centerX - halfKernel; x <= centerX + halfKernel; x++) {
                if (this.isValidCoordinate(x, y)) {
                    values.push(this.pixels[y][x].value);
                }
            }
        }
        
        return values;
    }

    /**
     * Set random values for all pixels
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     */
    setRandomValues(min = 0, max = 255) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const value = Math.floor(min + Math.random() * (max - min + 1));
                this.pixels[y][x].setValue(value);
            }
        }
        
        // Refresh highlights if needed
        if (this.selectedCenter) {
            this.highlightNeighborhood();
        }
    }

    /**
     * Reset all pixels to initial value
     */
    reset() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.pixels[y][x].setValue(this.options.initialValue);
            }
        }
        this.clearHighlights();
    }

    /**
     * Get a 2D array of all pixel values
     * @returns {Array} - 2D array of pixel values
     */
    getAllValues() {
        return this.pixels.map(row => row.map(pixel => pixel.value));
    }

    /**
     * Set values from a 2D array
     * @param {Array} values - 2D array of values to set
     */
    setValues(values) {
        for (let y = 0; y < Math.min(this.height, values.length); y++) {
            const row = values[y];
            for (let x = 0; x < Math.min(this.width, row.length); x++) {
                this.pixels[y][x].setValue(row[x]);
            }
        }
    }
}
