// JavaScript source code
export class Pixel {
    // potential future extension: multiple channels when value is iterable
    // potential future extension: validate value
    constructor(value = 128, ind = 0) {
        this.val = value;
        this.ind = ind;
        // single value indexing will be a property of the grid bc depends on the grid size

        const pixel = document.createElement('div');
        pixel.className = 'pixel';

        pixel.textContent = `${value}`; // mid-gray
        this.ele = pixel;
        function createGrid() {
            pixelGrid.innerHTML = '';
            pixelGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
            pixels = [];

            for (let y = 0; y < gridSize; y++) {
                pixels[y] = [];
                for (let x = 0; x < gridSize; x++) {
                    const pixel = document.createElement('div');
                    pixel.className = 'pixel';
                    pixel.dataset.x = x;
                    pixel.dataset.y = y;




                    pixelGrid.appendChild(pixel);
                }
            }

            contrastResult.textContent = 'Select a center pixel to calculate local contrast (Ctrl+click)';
            clearHighlights();
        }

        function clearHighlights() {
            document.querySelectorAll('.pixel').forEach(p => {
                p.classList.remove('highlight');
                p.classList.remove('result');
            });
        }
    }
    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // single click increemnt value
        // allow click allow input
        // ctrl click select neighborhood center - should bubble up to the parent grid object to then select the others in neighborhood
        this.ele.addEventListener('click', function (e) {
            if (e.ctrlKey) {
                // bubble up to grid with command to select a neighborhood with this pixel ind as the center
            } else {
                // determine if dbl click or single
                const dbl = dblorsingle();
                if (dbl) {
                    // allow typed input for value
                } else { 
                    // Change pixel value on single regular click
                    let value = parseInt(this.textContent);
                    const incVal = 25; // Increment by 
                    value = (value + incVal) % 256; // Wrap at 255
                    this.value = value;
                    this.textContent = value;
                }
            }
        });

    }

    clearHighlights() {

    }

    highlightCenter() {

    }

    highlightNeighborhood() {

    }

}

export class PixelGrid {
    constructor(size) {
        // when size is iterable make n*m otherwise square n*n of pixels
        this.pixels = [];

    }

} 