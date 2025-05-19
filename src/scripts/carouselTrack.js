// JavaScript source code
// Arrange images and move them around a track of arbitrary shape specified by a collection of cubic bezier curve pts.
// allow user to spin the carousel by touch or mouse click and drag
// allow user to spin the carousel by use of buttons

// simplify to only tiles being created programatically
// simplify to require a set div for the carousel to occupy
// simplify so that progress is uniformaly [0-1) for horizontal circle or any other track

// simplify calculations to use radians instead of degrees

// do all postioning and motion with css. set initial postion of tiles to center of carousel with top and left then transform to desired location
// do all style manipulation through variables

// need to properly scale.. or not and do all with percentages
// Ensure the main element has proper dims


const Utils = {
    /**
     * Scale a normalized value to actual pixels
     */
    scaleToCanvas(value, config, dimension = 'width') {
        return value * config.canvas[dimension];
    },

    /**
    * Calculate distance between two points. objects with x and y feilds
    */
    distance(point1, point2) {
        return Math.hypot(point2.x - point1.x, point2.y - point1.y);
    },

    /**
     * Interpolate between points
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    // Cubic Bézier curve function
    cubicBezier(t, P0, P1, P2, P3) {
        const x = (1 - t) ** 3 * P0[0] + 3 * (1 - t) ** 2 * t * P1[0] + 3 * (1 - t) * t ** 2 * P2[0] + t ** 3 * P3[0];
        const y = (1 - t) ** 3 * P0[1] + 3 * (1 - t) ** 2 * t * P1[1] + 3 * (1 - t) * t ** 2 * P2[1] + t ** 3 * P3[1];
        return { x, y };
    },

    // get x and y position given progress along the collection of curves in the track chosen {x,y}
    trackPosition(t, relLens, track) {
        let segInd, sum = 0;
        relLens.some((element, i) => {
            segInd = i;
            if (sum > t) {
                return true; // Stop further iteration
            }
            sum += element;
        });
        let segT = (t - sum) / this.relLens[segInd - 1];
        return track[ind].getPointAt(segT);
    }
};


// a carouselSegment class to help deal with pieces of the carousel's track marked out in
/**
 * Base Stroke class representing a single drawing movement
 * Provides common functionality for all stroke types
 */
class CarouselSegment {
    /**
     * Create a new bezier curve segment for carousel
     * @param {Array<Object>} strokePoints - Nested array of array of point coordinates x and y [[,],]
     */
    constructor(strokePoints) {      
        this.points = strokePoints; // expected to be normed

        // Calculate path length for progress calculations
        this._pathLength = -1;
    }

    get pathLength() {
        if (this._pathLength == -1) {
            this._pathLength = this.calculatePathLength();
        }
        return this._pathLength
    }

    /**
    * Calculate an approximation of the curve length
    * @param {number} [numSegments=100] - Number of segments for approximation
    * @returns {number} Approximate curve length in pixels
    */
    calculatePathLength(numSegments = 100) {
        let length = 0;
        let prevPoint = this.getPointAt(0);

        for (let i = 1; i <= numSegments; i++) {
            const t = i / numSegments;
            const point = this.getPointAt(t);
            length += Utils.distance(prevPoint, point);
            prevPoint = point;
        }

        return length;
    }

    /**
     * Get a point along the curve at the specified progress
     * @param {number} t - Position along the curve (0-1)
     * @returns {Point} Point at the specified position
     */
    getPointAt(t) {        
        const [p0, p1, p2, p3] = this.points;        
        return Utils.cubicBezier(t, p0, p1, p2, p3); //{ x, y }
    }

    /**
     * Get control points for a partial Bezier curve
     * @param {number} t - Progress along the curve (0-1)
     * @returns {Object} Object with cp1, cp2 and end points
     */
    getPartialBezierControlPoints(t) {
        const result = Utils.calculatePartialBezier(t, this);
        return {
            cp1: { x: result.newCx1, y: result.newCy1 },
            cp2: { x: result.newCx2, y: result.newCy2 },
            end: { x: result.newX2, y: result.newY2 }
        };
    }

    /**
     * Get the tangent vector at a specific point on the curve
     * @param {number} t - Position along the curve (0-1)
     * @returns {Object} Normalized tangent vector {x, y}
     */
    getTangentAt(t) {
        const [p0, p1, p2, p3] = this.points;
        const mt = 1 - t;

        // Derivative of cubic Bezier
        const dx = 3 * mt * mt * (p1.x - p0.x) +
            6 * mt * t * (p2.x - p1.x) +
            3 * t * t * (p3.x - p2.x);

        const dy = 3 * mt * mt * (p1.y - p0.y) +
            6 * mt * t * (p2.y - p1.y) +
            3 * t * t * (p3.y - p2.y);

        // Normalize
        const length = Math.sqrt(dx * dx + dy * dy);

        return {
            x: dx / length,
            y: dy / length
        };
    }
}



// carouselTrack.js - refactored version
export class CarouselTrack {
    // Static properties remain the same
    static instanceCount = 0;
    static existingCarousels = [];
    static closestCarousel = {};

    static #defaultOptions = {
        autoplay: true,
        autoplaySpeed: 3000,
        friction: 0.25,
        minVelocity: 1/500,
        maxVelocity: 2,
        snapThreshold: 0.005,
        arrowSpinSpeed: .5,
        activeScale: 1.1,

        tileWidth: '150px',
        tileHeight: '150px',
        tileWidthMobile: '80px',
        tileHeightMobile: '80px',
        
        track: "carousel", // name of track either bezier segments or default horizontal circle
        zRadius: 1000, // range of z values to permit where max is front active 0 and reduced symetrically up to .5 and down to .5
        // carousel specific
        rise: true,
        riseHeight: 0, // how much height difference to add in carousel formation spin

        tileSettings: { // literals are getting evaled to early
            aspectRatio: null,
            title: `Image`, // `Image ${this.eles.tiles.length}`,
            target: '',
            alt: `img_` // `img_${this.eles.tiles.length}`
        }
    };

    static getDefaultSettings() {
        return CarouselTrack.#defaultOptions;
    };

    // tracks for images to follow made from connecting bezier curves
    static #tracks = {
        cat1: [
            [[15 / 44, 17 / 53], [15 / 44, 17 / 53], [3 / 22, 0], [1 / 22, 2 / 53]],  // x min 120 max 340 y min 90 max 355. 
            [[0, 3 / 53], [3 / 44, 25 / 53], [3 / 44, 24 / 53]],
            [[1 / 44, 12 / 53], [4 / 11, 46 / 53], [17 / 44, 50 / 53]], // back 2 []
            [[9 / 22, 13 / 53], [13 / 22, 1], [27 / 44, 50 / 53]],
            [[7 / 11, 46 / 53], [41 / 22, 52 / 53], [39 / 44, 24 / 53]],
            [[39 / 44, 25 / 53], [1, 3 / 53], [21 / 22, 2 / 53]],
            [[9 / 22, 0], [27 / 44, 16 / 53], [13 / 22, 17 / 53]],
            [[25 / 44, 16 / 53], [4 / 11, 16 / 53]]
        ],
        // to normalize coordinates used in cat2 divide x and y by 420
        cat2: [
            [[210, 103.33], [226.377, 103.33], [258.458, 111.436], [258.458, 111.436]],
            [[258.458, 111.436], [278.773, 86.251], [288.777, 73.541]],
            [[300.539, 58.599], [310.405, 42.069], [323.7, 28.442]],
            [[331.08, 20.878], [338.547, 12.556], [348.305, 8.389]],
            [[354.008, 5.953], [361.131, 3.549], [366.793, 6.075]],
            [[372.936, 8.815], [376.091, 16.263], [378.164, 22.603,]],
            [[381.636, 33.218], [379.117, 56.058], [379.117, 56.058,]],            [[379.117, 56.058], [378.902, 88.777], [376.506, 104.912,]],
            [[374.952, 115.375], [369.885, 125.205], [368.914, 135.739]],
            [[367.926, 146.472], [373.131, 157.493], [370.781, 168.017]],
            [[369.27, 174.785], [361.502, 179.443], [360.852, 186.344]],
            [[360.06, 194.76], [367.848, 202.102], [368.583, 210.524]],
            [[371.277, 241.36], [365.192, 273.004], [356.114, 302.663]],
            [[352.265, 315.237], [345.693, 326.955], [338.609, 338.068]],
            [[332.164, 348.181], [326.079, 359.445], [316.087, 366.175]],
            [[300.964, 376.36], [283.221, 374.344], [266.531, 381.762]],
            [[258.078, 385.518], [250.842, 391.528], [242.824, 396.122]],
            [[236.396, 399.805], [232.728, 406.206], [226.54, 409.611]],
            [[221.468, 412.402], [215.799, 415], [210, 415]],
            [[204.201, 415], [198.532, 412.402], [193.46, 409.611]],
            [[187.272, 406.206], [183.604, 399.805], [177.176, 396.122]],
            [[169.158, 391.528], [161.922, 385.518], [153.469, 381.762]],
            [[136.779, 374.344], [119.036, 376.36], [103.913, 366.175]],
            [[93.921, 359.445], [87.836, 348.181], [81.391, 338.068]],
            [[74.307, 326.955], [67.735, 315.237], [63.886, 302.663]],
            [[54.808, 273.004], [48.723, 241.36], [51.417, 210.524]],
            [[52.152, 202.102], [59.94, 194.76], [59.148, 186.344]],
            [[58.498, 179.443], [50.73, 174.785], [49.219, 168.017]],
            [[46.869, 157.493], [52.074, 146.472], [51.086, 135.739]],
            [[50.115, 125.205], [45.048, 115.375], [43.494, 104.912]],
            [[41.098, 88.777], [40.883, 56.058], [40.883, 56.058]],
            [[40.883, 56.058], [38.364, 33.218], [41.836, 22.603]],
            [[43.909, 16.263], [47.064, 8.815], [53.207, 6.075]],
            [[58.869, 3.549], [65.992, 5.953], [71.695, 8.389]],
            [[81.453, 12.556], [88.92, 20.878], [96.3, 28.442]],
            [[109.595, 42.069], [119.461, 58.599], [131.223, 73.541]],
            [[141.227, 86.251], [161.542, 111.436], [161.542, 111.436]],
            [[161.542, 111.436], [193.623, 103.33]]
        ],
        cat2new: [
            [[0.5, 0.246], [0.539, 0.246], [0.615, 0.265], [0.615, 0.265]],
            [[0.615, 0.265], [0.664, 0.205], [0.688, 0.175]],
            [[0.716, 0.14], [0.739, 0.1], [0.771, 0.068]],
            [[0.788, 0.05], [0.806, 0.03], [0.829, 0.02]],            [[0.843, 0.014], [0.86, 0.008], [0.873, 0.014]],            [[0.888, 0.021], [0.895, 0.039], [0.9, 0.054]],            [[0.909, 0.079], [0.903, 0.133], [0.903, 0.133]],            [[0.903, 0.133], [0.902, 0.211], [0.896, 0.25]],            [[0.893, 0.275], [0.881, 0.298], [0.878, 0.323]],            [[0.876, 0.349], [0.888, 0.375], [0.883, 0.4]],            [[0.879, 0.416], [0.861, 0.427], [0.859, 0.444]],            [[0.857, 0.464], [0.876, 0.481], [0.878, 0.501]],            [[0.884, 0.575], [0.87, 0.65], [0.848, 0.721]],            [[0.839, 0.751], [0.823, 0.778], [0.806, 0.805]],            [[0.791, 0.829], [0.776, 0.856], [0.753, 0.872]],            [[0.717, 0.896], [0.674, 0.891], [0.635, 0.909]],            [[0.614, 0.918], [0.597, 0.932], [0.578, 0.943]],            [[0.563, 0.952], [0.554, 0.967], [0.539, 0.975]],            [[0.527, 0.982], [0.514, 0.988], [0.5, 0.988]],            [[0.486, 0.988], [0.473, 0.982], [0.461, 0.975]],            [[0.446, 0.967], [0.437, 0.952], [0.422, 0.943]],            [[0.403, 0.932], [0.386, 0.918], [0.365, 0.909]],            [[0.326, 0.891], [0.283, 0.896], [0.247, 0.872]],            [[0.224, 0.856], [0.209, 0.829], [0.194, 0.805]],            [[0.177, 0.778], [0.161, 0.751], [0.152, 0.721]],            [[0.13, 0.65], [0.116, 0.575], [0.122, 0.501]],            [[0.124, 0.481], [0.143, 0.464], [0.141, 0.444]],            [[0.139, 0.427], [0.121, 0.416], [0.117, 0.4]],            [[0.112, 0.375], [0.124, 0.349], [0.122, 0.323]],            [[0.119, 0.298], [0.107, 0.275], [0.104, 0.25]],            [[0.098, 0.211], [0.097, 0.133], [0.097, 0.133]],            [[0.097, 0.133], [0.091, 0.079], [0.1, 0.054]],            [[0.105, 0.039], [0.112, 0.021], [0.127, 0.014]],            [[0.14, 0.008], [0.157, 0.014], [0.171, 0.02]],            [[0.194, 0.03], [0.212, 0.05], [0.229, 0.068]],            [[0.261, 0.1], [0.284, 0.14], [0.312, 0.175]],            [[0.336, 0.205], [0.385, 0.265], [0.385, 0.265]],            [[0.385, 0.265], [0.461, 0.246]]
        ],
        // Example usage - lev
        heartSegs: [
            [[0, 0], [1, 2], [2, 2], [3, 0]],
            [[4, -2], [5, -2], [6, 0]],
            [[7, 2], [8, 2], [9, 0]],
            [[10, -2], [11, -2], [12, 0]]
        ]
    };

    static getClosestCarousel(cursorX, cursorY) {
        // if more than one carousel need to choose which to be affected by listeners
        // if only one return that one
        // else if cursor is on any carousel element return it
        // else choose the closest element to the center of the view port
        let closest = null;
        let closestDistance = Infinity;
        // when only one return that one
        if (CarouselTrack.instanceCount == 1) return CarouselTrack.existingCarousels[0];

        CarouselTrack.existingCarousels.forEach(crsl => {
            const rect = crsl.eles.carousel.getBoundingClientRect();
            const carouselX = rect.left + rect.width / 2, carouselY = rect.top + rect.height / 2;
            const distance = Math.hypot(cursorX - carouselX, cursorY - carouselY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closest = crsl;
            }

            // else if cursor is on any carousel element return it
            if ((cursorX > rect.left) && (cursorX < rect.right) && (cursorY > rect.top) && (cursorX < rect.bottom)) {
                return crsl;
            }
        });

        return closest;
    };

    /**
     * Initializes instance-specific properties and updates static tracking.
     * @private
     */
    #initializeInstance() {
        this.instanceInd = CarouselTrack.instanceCount++;
        CarouselTrack.existingCarousels.push(this);
        //this.renderCalled = false;
        this.resizeTimeout = null;
    };

    /**
    * Replace state with a Proxy that will handle validation and limit value.
    * @private
    */
    #stateProxyValidation() {
        function isNumberInRange(number, x, y) {
            const min = Math.min(x, y);
            const max = Math.max(x, y);
            return number >= min && number <= max;
        }

        const stateHandler = {
            get: (target, property, receiver) => {
                return Reflect.get(target, property, receiver); // standard behaviour for getting 
            },
            set: (target, property, value, receiver) => {
                if (property === 'currentProgress') {

                    if (!isNumberInRange(value, 0, 1)) {
                        value = ((value % 1) + 1) % 1;
                        if (isNaN(value)) throw new Error(`currentProgress value: ${value}`);
                    }

                }
                if (property === 'currentProgress') {

                    if (!isNumberInRange(value, 0, 1)) {
                        value = ((value % 1) + 1) % 1; // handle negs as well
                        if (isNaN(value)) throw new Error(`currentProgress value: ${value}`);
                    }

                }
                if (property === 'trackVelocity') {

                    if (!isNumberInRange(value, -this.options.maxVelocity, this.options.maxVelocity)) {
                        console.log(`trackVelocity changed to ${value}`);
                        value = Math.min(Math.max(value, -this.options.maxVelocity), this.options.maxVelocity);
                        console.log(`trackVelocity actually set to ${value}`);
                        // throw new Error(`current Angle value: ${value}`); // could fix by setting to zero or last value
                        if (isNaN(value)) throw new Error(`trackVelocity value: ${value}`);

                    }

                }
                return Reflect.set(target, property, value, receiver);
            }
        };
        this.state = new Proxy(this.state, stateHandler);
    };

    /**
     * Sets up event listeners for animation control. Must remain public for event listener binding.
     */
    #setupCustomListeners() {
        document.addEventListener(`stopAnimation${CarouselTrack.instanceCount}`, this.stopAnimation.bind(this));
        document.addEventListener(`startAnimation${CarouselTrack.instanceCount}`, this.startAnimation.bind(this));
    };

    // Refactored button creation with classes
    #makeArwButtons() {
        if (this.eles.container.querySelector('div.controls>button')) return; // dont dupl buttons

        const controls = document.createElement('div');
        controls.className = 'controls';

        const lb = document.createElement('button');
        const rb = document.createElement('button');

        lb.textContent = '← Spin Left';
        rb.textContent = 'Spin Right →';
        lb.className = 'button';
        rb.className = 'button';

        lb.addEventListener('click', () => this.startSpin(1));
        rb.addEventListener('click', () => this.startSpin(-1));

        controls.appendChild(lb);
        controls.appendChild(rb);
        this.eles.container.appendChild(controls);
    }

    /**
     * Create a new carousel
     * @param {HTMLElement} carouselContainer - Container element reference
     * @param {String/Object} track - name of track or new track
     * @param {Object} options - options to overwrite defaults
     * @param {Array<Object>} tiles - array holding information on the tiles subfields img href options
     */
    constructor(carouselContainer, track ='carousel', options = {}, tiles = []) {
        if (typeof track == 'string') {
            if (track == 'carousel') {
            } // default
            else {
                this.track = CarouselTrack.#tracks[track];

                // this.track = CarouselTrack.getTrack(track);
                this.trackName = track;
                this.track = this.processTrack(this.track);
            }
        } else {
            this.trackName = 'unspecified';
            this.track = track;
            this.track = this.processTrack(this.track);
        }
        
        this.options = {
            ...CarouselTrack.#defaultOptions,
            ...options
        };

        this.makeTiles = tiles; // raw input processed
        this.eles = {
            carousel: null,
            container: carouselContainer,
            tiles: []
        };
        this.createCarouselElements(carouselContainer, tiles); // tiles buttons affect this.eles

        this.state = {
            // Spin calculation values 
            currentProgress: 0,
            progIncrement: 1 / this.eles.tiles.length,
            trackVelocity: 0, // in revolutions/sec. replacing angular velocity
            // pixels/sec => progress/sec 

            isSpinning: false,
            // Touch and mouse drag functionality
            isDragging: false,
            lastTimestamp: 0,
            dragStart: { x: 0, y: 0 },
            dragLast: { x: 0, y: 0 },
            lastDragTimestamp: 0            
        };
        this.#stateProxyValidation();

        this.#initializeInstance();
        
        this.#setupCustomListeners();
    };



    processTrack(track) {
        let firstPt;
        let prevPt;
        let seg;
        this.relLens = [];
        this.track = track.map((curve, i) => {
            if (i == 0) {
                firstPt = curve[0];
                prevPt = curve[curve.length - 1];
                seg = new CarouselSegment(curve);
                this.relLens.push(seg.pathLength);
                return seg;
            }
            else if (i == (track.length - 1)) {
                seg = new CarouselSegment([prevPt, ...curve, firstPt]);
                this.relLens.push(seg.pathLength);
                let sum = this.relLens.reduce((accumulator,currVal)=>accumulator+currVal,0)
                this.relLens = this.relLens.map((len) => len / sum);
                return seg;
            }
            else {
                seg = new CarouselSegment([prevPt, ...curve]);
                this.relLens.push(seg.pathLength);
                return seg;
            }
        }
        );
    };



    getTile(index) {
        return this.tiles(index);
    };

    // Refactored method to create carousel elements with CSS classes
    createCarouselElements(carouselContainer, makeTiles = []) {
        carouselContainer.classList.add('carouselContainer'); // Using class instead of inline

        let carousel = document.createElement('div');
        carousel.classList.add('carousel');

        carouselContainer.appendChild(carousel);

        this.eles = { carousel: carousel, tiles: [], container: carouselContainer };
        this.eles.tiles = makeTiles.map((tile) => {
            let tileA = this.makeTile(tile.img, tile.href, tile.options);
            this.eles.carousel.appendChild(tileA);
            return tileA
        });

        this.#makeArwButtons();     
    }

    // Refactored method to add tiles with proper classes
    makeTile(imSrc, href, options = {}) {
        if (!imSrc || typeof imSrc !== 'string') {
            console.warn('Image URL string should be provided');
        }

        options = {
            ...CarouselTrack.getDefaultSettings().tileSettings,
            ...options
        };

        const { aspectRatio, title, target, alt } = options;

        const tileA = document.createElement('a');
        tileA.className = 'tile';
        tileA.href = href;
        tileA.title = title;
        tileA.target = target;
        tileA.options = options;

        const image = document.createElement('img');
        image.src = imSrc;
        image.alt = alt;

        tileA.appendChild(image);

        if (aspectRatio) {
            this.resizeImage(tileA, image, aspectRatio);
        }

        return tileA;
    }

    resizeImage(anchor, img, aspectRatio = 1) { // w/h
        //throw new Error('gfdf');
        // Object.assign(anchor.style, { width: this.options.tileWidth, height: this.options.tileHeight}); // css take over
        // let { width: aW, height: aH } = anchor.getBoundingClientRect();
        let parseSize = (input, parentWidth) => {
            if (typeof input === 'string') {
                // Check if the input ends with 'px' 
                if (input.endsWith('px')) {
                    return parseFloat(input);
                }
                // Check if the input ends with '%' 
                else if (input.endsWith('%')) {
                    const percentage = parseFloat(input);
                    return (percentage / 100) * parentWidth;
                }
            } throw new Error('Invalid input format');
        }
        // mobile or desktop
        const mobile = window.innerWidth <= 768;
        const tWidth = mobile ? this.options.tileWidthMobile : this.options.tileWidth;
        const tHeight = mobile ? this.options.tileHeightMobile : this.options.tileHeight;
        const parentWidth = this.eles.container.getBoundingClientRect().width;
        const aW = parseSize(tWidth, parentWidth); // px
        const aH = parseSize(tHeight, parentWidth);
        let imgW, imgH; // Calculate the width and height based on the aspect ratio
        if ((aW / aspectRatio) <= aH) {
            imgW = aW;
            imgH = aW / aspectRatio;
        } else {
            imgW = aH * aspectRatio;
            imgH = aH;
        }
        
        // Object.assign(anchor.style, { width: `${imgW}px`, height: `${imgH}px` });
        anchor.style.setProperty('--tileWidth', `${imgW}px`);
        anchor.style.setProperty('--tileHeight', `${imgH}px`);
        return { width: imgW, height: imgH };
    }

    // Other initialization methods remain largely the same
    init() {
        this.setupEventListeners();
        this.reset();
        /*this.setupAccessibility();*/
        this.render();
        if (this.options.autoplay) {
            this.startAutoplay();
        }
    }

    // set initial positioning of tiles in the center of the carousel. further positioning is done with the transform
    centerTiles() {
        const containerRect = this.eles.container.getBoundingClientRect();
        const tileRect = this.eles.tiles[0].getBoundingClientRect();
        let computedStyle = window.getComputedStyle(this.eles.tiles[0]);
        let borderTopWidth = parseFloat(computedStyle.getPropertyValue('border-top-width'));
        let borderLeftWidth = parseFloat(computedStyle.getPropertyValue('border-left-width'));
        // console.log(borderLeftWidth);
        this.eles.tiles.forEach(tile => {
            tile.style.setProperty('--tileCenterTop', `${(this.eles.container.offsetHeight / 2) - (tile.offsetHeight / 2) - borderTopWidth}px`);
            tile.style.setProperty('--tileCenterLeft', `${(this.eles.container.offsetWidth / 2) - (tile.offsetWidth / 2) - borderLeftWidth}px`);
        });
    }

    startAnimation() { this.render(); }

    stopAnimation() { this.state.isSpinning = false; }

    reset() {
        document.dispatchEvent(new Event(`stopAnimation${CarouselTrack.instanceCount}`));
        // reset carousel
        this.eles.tiles.forEach((tile) => {
            let aspect;
            try { aspect = tile.options.aspectRatio; }
            catch { aspect = false; }
            if (aspect) {
                const a = tile.options.aspectRatio;
                this.resizeImage(tile, tile.querySelector('img'), tile.options.aspectRatio);
            } else {
                Object.assign(tile.style, { width: this.options.tileWidth, height: this.options.tileHeight }); // css take over
                // console.log(tile);
                // Object.assign(tile.querySelector('img').style, { width: this.options.tileWidth, height: this.options.tileHeight }); // css take over
            }
        });
        //this.centerTiles();
        // this.options.angleIncrement = 360 / this.eles.tiles.length;
        this.state.progIncrement = 1 / this.eles.tiles.length;
        this.options.x_rad = .95 * this.eles.carousel.getBoundingClientRect().width / 2;


        // this.options.arrowSpinSpeed = 300; // 300 for 2,3,... x,x,x, 300
        // arrow values for speed. maybe make lookup table for n imgs in carousel
        document.dispatchEvent(new Event(`startAnimation${CarouselTrack.instanceCount}`));
    }

    setupEventListeners() {
        if (this.listeners) return;
        // only created once on first 
        if (CarouselTrack.instanceCount <= 1) {
            // Arrow key controls
            // console.log('arr key');
            document.addEventListener('keydown', (e) => {
                const pointerX = this.pageX;
                const pointerY = this.pageY;
                const cc = CarouselTrack.getClosestCarousel(pointerX, pointerY); //closestCarousel
                if (e.key === 'ArrowLeft') cc.startSpin(1);
                if (e.key === 'ArrowRight') cc.startSpin(-1);
            });
            document.addEventListener('mousemove', this.drag.bind(this));
            this.pageX = 0, this.pageY = 0;
            document.addEventListener('mousemove', (e) => {
                this.pageX = e.clientX || 0;
                this.pageY = e.clientY || 0;
            });
            document.addEventListener('touchmove', this.drag.bind(this));
            document.addEventListener('mouseup', this.endDrag.bind(this));
            document.addEventListener('touchend', this.endDrag.bind(this));
        }

        this.eles.carousel.addEventListener('mousedown', this.startDrag);
        this.eles.carousel.addEventListener('touchstart', this.startDrag);
        window.addEventListener('resize', () => {
            // debounced // console.log('resize'); 
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                // console.log(this.eles.carousel.getBoundingClientRect());
                this.reset();
                this.moveTiles();
            }, 250);
        });
        this.listeners = true;
    }

    render(ex_call = true) {
        //console.log(`render call ${++this.renderNcalls}`);
        requestAnimationFrame((timestamp) => {
            this.updateCarousel(timestamp);
            this.moveTiles();
            // use isSpinning to decide to recall. reduces number of calls 
            if (this.state.isSpinning) this.render();
        });
    }

    /**
    * Main update function for the carousel animation
    * determine new currentProgress, timestamp, if to snap
    * @param {number} timestamp - The current timestamp provided by requestAnimationFrame
    */
    updateCarousel(timestamp) {
        if (this.state.isDragging) return;
        if (!this.state.lastTimestamp) this.state.lastTimestamp = timestamp;
        const deltaTime = (timestamp - this.state.lastTimestamp) / 1000; // Convert to seconds
        this.state.lastTimestamp = timestamp;

        // Update current progress based on velocity
        this.state.currentProgress += this.state.trackVelocity * deltaTime; // could become negative/ / Normalize in set to within 0-1
        // Apply friction to gradually slow down the rotation
        this.state.currentProgress *= Math.pow(this.options.friction, deltaTime);

        // Check if we need to snap to the nearest tile
        if (Math.abs(this.state.trackVelocity) < this.options.minVelocity) {

            const nearestTilePosition = (Math.round(this.state.currentProgress / this.state.progIncrement) * this.state.progIncrement) % 1; // won't be whole number
            const progDifference = (nearestTilePosition - this.state.currentProgress); // ca [0-360)
            

            if (progDifference > this.state.progIncrement) throw new Error('somewhere logic must have failed');

            if (Math.abs(progDifference) < this.options.snapThreshold) {
                this.state.currentProgress = nearestTilePosition;
                this.state.trackVelocity = 0;
                this.state.isSpinning = false;
                this.state.lastTimestamp = 0; // need to reset?
            } else {
                // Gently push towards the nearest angle
                this.state.trackVelocity += progDifference * this.options.arrowSpinSpeed/50 * deltaTime;
                this.state.isSpinning = true;
            }
        } else {
            this.state.isSpinning = true;
        }
    }

    // permit track or circle. handle z separately from x and y. use CSS variables instead of inline styles
    moveTiles() {
        this.eles.tiles.forEach((tile, index) => {

            let x, y, z, rotAngle = 0;
            let t = this.state.currentProgress;
            if (!this.track) { // will be a processed track or not in which case it is horizontal circle carousel
                // For a horizontal circle
                let ca = t * 360;
                const angle = (index * this.options.angleIncrement - ca + 540) % 360 - 180;
                rotAngle = Math.abs(angle) < 90 ? angle : angle / Math.abs(angle) * (180 - Math.abs(angle));
                const radian = angle * Math.PI / 180;
                z = Math.cos(radian) * this.options.zRadius + this.options.zRadius + 2;
                // const z = func()
                x = Math.sin(radian) * this.options.x_rad;

                y = 0;
                if (this.options.rise) {
                    const riseHeight = this.options.riseHeight || this.options.x_rad / 20;
                    y = Math.sin(radian - (Math.PI / 2)) * riseHeight;
                }
            } else if(this.trackName == 'specificTrack') {
                x = Utile.parametricX(t);
                y = Utile.parametricY(t);
                z = Utile.parametricZ(t);
                rotAngle = Utile.parametricZ(t);
            } else {
                ({ x, y } = this.trackPosition(t));
                z = Utils.yzLine(y, this.options.yzMaxLine);
                // linear interpolation from max of z radius values to 1 from the line to max border in y top or bottom
                let yzRange = Math.max(this.options.yzMaxLine, 1 - this.options.yzMaxLine)
                let alpha = Math.abs((y - this.yzMaxLine) / yzRange);
                z = Utils.lerp(1, this.options.zRadius, alpha);
                let zInd = Math.round(z);
            }

            // Set CSS variables instead of direct inline styles to update the transform
            tile.style.setProperty('--x', `${x}px`);
            tile.style.setProperty('--y', `${y}px`);
            tile.style.setProperty('--z', `${z}px`);
            tile.style.setProperty('--rotate-y', `${-rotAngle}deg`);

            // Set z-index (difficult to do in pure CSS) Why not just use variable
            tile.style.setProperty('--zInd', `${parseFloat(z.toFixed(2))}`);
            // Calculate opacity and use predefined classes
            const opacity = (z + (1.1 * this.options.zRadius)) / (2.1 * this.options.zRadius);
            tile.style.setProperty('--tile-opacity', `${parseFloat(opacity.toFixed(2))}`);

            // Add active/inactive classes based on position         
            if (t < 0.001 && !this.state.isSpinning) {
                tile.style.setProperty('--active-scale', this.options.activeScale);
                tile.classList.add('tileActive');
                tile.classList.remove('tileInactive');
            } else {
                tile.classList.remove('tileActive');
                tile.classList.add('tileInactive');
            }
        });
    }

    // get x and y position given progress along the collection of curves in the track chosen {x,y}
    trackPosition(t) {
        let ind, sum = 0;
        this.relLens.some((element, i) => {
            ind = i;
            if (sum>t) {
                return true; // Stop further iteration
            }
            sum += element;
        });
        let segT = (t - sum) / this.relLens[ind - 1];
        return this.track[ind].getPointAt(segT);
    }

    /**
   * Initializes the drag interaction
   * @param {Event} e - The mouse or touch event
   */
    startDrag(e) {
        e.preventDefault();
        const pointerX = e.pageX || e.touches[0].pageX;
        const pointerY = e.pageY || e.touches[0].pageY;
        const cc = CarouselTrack.getClosestCarousel(pointerX, pointerY); //closestCarousel
        console.log('start drag');
        console.log(cc);
        cc.state.isDragging = true;
        cc.state.dragStart.x = pointerX;
        cc.state.dragStart.y = pointerY;
        cc.state.lastDragTimestamp = Date.now();

        cc.state.trackVelocity = 0; // Reset velocity when starting a new drag
    }

    /**
     * Handles the drag interaction.
     * @param {Event} e - The mouse or touch event
     */
    drag(e) {
        const draggingCarousel = CarouselTrack.existingCarousels.filter(crsl => crsl.state.isDragging)[0];
        if (!draggingCarousel) return;
        let currentX, currentY;
        try {
            currentX = e.pageX || (e.touches[0].pageX ?? 0);
            currentY = e.pageY || (e.touches[0].pageY ?? 0);
        } catch {
            currentX = 0; currentY = 0;
            console.log("drag: errored");
            return;
        }

        const currentTimestamp = Date.now();
        console.log('drag'); console.log(JSON.stringify(draggingCarousel.state));

        // Calculate the change in position and time
        const deltaX = currentX - draggingCarousel.state.dragLast.x;
        const deltaTime = (currentTimestamp - draggingCarousel.state.lastDragTimestamp) / 1000; // Convert to seconds

        // Update the carousel angle based on the drag distance (reversed direction)
        // const dragAngle = deltaX * 0.5; // Adjust this multiplier to change drag sensitivity
        const dragAngle = ((deltaX / this.options.x_rad) * 180 / Math.PI) % 5; // from arc length to angle in radians then to deg

        draggingCarousel.state.currentProgress -= dragAngle/360; // Note the '+=' here instead of '-='


        // Calculate instantaneous velocity (reversed direction)
        if (deltaTime > 0) {
            // console.log(dragAngle);
            // impart velocity only at the end
            // draggingCarousel.state.trackVelocity = -dragDist / deltaTime; // Note the negative sign here
        }

        // Update last positions and timestamp
        draggingCarousel.state.dragLast.x = currentX;
        draggingCarousel.state.dragLast.y = currentY;
        draggingCarousel.state.lastDragTimestamp = currentTimestamp;
        draggingCarousel.render();
    }

    /**
     * Ends the drag interaction
     */
    endDrag() {
        console.log('end drag'); //
        const draggingCarousel = CarouselTrack.existingCarousels.filter(crsl => crsl.state.isDragging)[0];
        if (!draggingCarousel) return;
        const currentTimestamp = Date.now();
        const dragDist = Math.hypot(draggingCarousel.state.dragLast.x - draggingCarousel.state.dragStart.x,
            draggingCarousel.state.dragLast.y - draggingCarousel.state.dragStart.y);
        const deltaTime = (currentTimestamp - draggingCarousel.state.lastDragTimestamp); //ms
        // use average speed of drag to spin the carousel
        // draggingCarousel.state.angularVelocity = -(((180 / Math.PI) * dragDist) / this.options.x_rad) / deltaTime; // Note the negative sign here
        draggingCarousel.state.isDragging = false;
        this.state.lastTimestamp = 0; // need to reset?
        draggingCarousel.render();
    }

    startAutoplay() {
        this.startSpin(2);
        setTimeout(() => this.startSpin(1), 500);
    }

    /**
     * Starts spinning the carousel in the specified direction
     * @param {number} direction - The direction of spin (1 for right, -1 for left)
     */
    startSpin(direction) {
        // console.log('startSpin'); console.log(this); console.log(this.options);
        this.state.trackVelocity += direction * this.options.arrowSpinSpeed; // Set initial track velocity
        debugger
        this.render();
    }
}
