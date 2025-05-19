// carousel.js - handlebars folders
/**
 * Represents a rotating carousel of image tiles that can also be links.
 * Provides touch/mouse interaction, automatic rotation, and customizable options.
 */
export class Carousel {
    // Static properties to track and manage multiple carousel instances
    static instanceCount = 0;
    static existingCarousels = [];
    static closestCarousel = {};

    /**
     * Default configuration options for the carousel
     * @private
     */
    static #defaultOptions = {
        autoplay: true,
        autoplaySpeed: 3000,
        friction: 0.25,         // Controls how quickly the carousel slows down. Lower values slow quicker
        minVelocity: 10,        // Minimum velocity before snapping to the nearest tile
        maxVelocity: 1000,
        snapThreshold: 0.1,     // Threshold for snapping to the nearest tile
        zRadius: 1000,
        activeScale: 1.1,       // Scale factor for the active tile
        rise: true,             // Whether front tiles should be raised
        arrowSpinSpeed: 70,
        tileWidth: '150px',
        tileHeight: '150px',
        tileWidthMobile: '80px',
        tileHeightMobile: '80px',
        riseHeight: 0, // default calculates is 5% of x_rad. when set nPx
    };

    // A rotating arrangment of image tiles that can also be links
    // This presuumes the existance of a container element, carousel element, tile elements

    // TW := total Width
    // Nimg := number of images
    // angle interval
    // 1 + 2*(angle intervals to 90 degrees -1)
    // tilewidth
    // tilewidth + 2*(tilewidth*cos(angle))

    /**
    * Creates a new Carousel instance. Carousel HTML may optionaly preexist
    * @param {HTMLElement} [carousel={}] - The carousel element. If not provided, carousel will be created dynamically.
    * @param {Object} [options={}] - Configuration options for the carousel.
    * @param {Array} [makeTiles=[]] - Array of tile configurations when creating carousel dynamically.
    * @returns {Proxy} - A proxied carousel instance for intercepting property access.
    */
    constructor(carousel = {}, options = {}, makeTiles = []) {
        // this.renderNcalls = 0; // for trblsht
        this.#initializeInstance();
        this.#setupOptions(options);
        this.#initializeState();
        this.#setupCustomListeners();
        this.#setupInstance(carousel, makeTiles);
        return new Proxy(this, this.#createInstanceProxy());
    }

    /**
     * Initializes instance-specific properties and updates static tracking.
     * @private
     */
    #initializeInstance() {
        this.instanceInd = Carousel.instanceCount++;
        Carousel.existingCarousels.push(this);
        //this.renderCalled = false;
        this.resizeTimeout = null;
    }

    /**
     * Sets up carousel options by merging defaults with provided options.
     * @private
     * @param {Object} options - User-provided options to override defaults.
     */
    #setupOptions(options) {
        this.options = {
            ...Carousel.#defaultOptions,
            ...options
        };
    }

    /**
   * Initializes the carousel's state object with default values.
   * @private
   */
    #initializeState() {
        this.state = {
            // Spin calculation values 
            currentAngle: 0,
            angularVelocity: 0,

            isSpinning: false,
            // Touch and mouse drag functionality
            isDragging: false,
            lastTimestamp: 0,
            dragStart: { x: 0, y: 0 },
            dragLast: { x: 0, y: 0 },
            lastDragTimestamp: 0
        };
        function isNumberInRange(number, x, y) { const min = Math.min(x, y); const max = Math.max(x, y); return number >= min && number <= max; }
        const stateHandler = {
            get: (target, property, receiver) => {
                return Reflect.get(target, property, receiver);
            },
            set: (target, property, value, receiver) => {
                if (property === 'currentAngle') {
                    
                    if (!isNumberInRange(value, 0, 360)) {
                        // console.log(`currentAngle changed to ${value}`);
                        value = ((value % 360) + 360) % 360;
                        // console.log(`currentAngle actually set to ${value}`);
                        // throw new Error(`current Angle value: ${value}`); // could fix by setting to zero or last value of currentangle
                        if(isNaN(value)) throw new Error(`currentAngle value: ${value}`); 
                        
                    } 
                    
                }
                if (property === 'angularVelocity') {
                    
                    if (!isNumberInRange(value, -this.options.maxVelocity, this.options.maxVelocity)) {
                        console.log(`angularVelocity changed to ${value}`);
                        value = Math.min(Math.max(value, -this.options.maxVelocity), this.options.maxVelocity);
                        console.log(`angularVelocity actually set to ${value}`);
                        // throw new Error(`current Angle value: ${value}`); // could fix by setting to zero or last value
                        if (isNaN(value)) throw new Error(`angularVelocity value: ${value}`); 
                        
                    } 
                    
                }
                return Reflect.set(target, property, value, receiver);
            }
        };
        this.state = new Proxy(this.state, stateHandler);
    }

    /**
     * Sets up event listeners for animation control. Must remain public for event listener binding.
     */
    #setupCustomListeners() {
        document.addEventListener(`stopAnimation${Carousel.instanceCount}`, this.stopAnimation.bind(this));
        document.addEventListener(`startAnimation${Carousel.instanceCount}`, this.startAnimation.bind(this));
    }

    /**
     * Sets up the carousel instance based on provided element or tile configurations.
     * @private
     * @param {HTMLElement} carousel - Existing carousel element or empty object.
     * @param {Array} makeTiles - Tile configurations for dynamic creation.
     */
    #setupInstance(carousel, makeTiles) {
        if (carousel instanceof Element) {
            this.eles = {
                carousel,
                container: carousel.parentElement,
                tiles: Array.from(carousel.querySelectorAll('.tile'))
            };
            this.init();
        } else {
            this.makeTiles = makeTiles;
            console.log('Be sure to set scriptContext. This will trigger to dynamically make elements.');
        }
    }

    /**
     * Creates a proxy for intercepting get qnd set of properties.
     * @private
     * @returns {Object} Proxy handler object.
     */
    #createInstanceProxy() {
        // intercept calls to get and set
        return {
            get: (target, prop) => {
                const index = Number(prop);
                //console.log(`index: typeof ${typeof prop}; index ${index}`);
                if (!isNaN(prop)) {
                    if (index < 0 || index >= target.eles.tiles.length || !Number.isInteger(index)) {
                        throw new Error("Index out of range");
                    }
                    return target.eles.tiles[prop];
                }
                return target[prop];
            },
            set: (target, prop, value) => {
                if (prop === 'scriptContext') {
                    // if (carousel=={}) create the carousel HTML too and append after/ to where the script context is set
                    // set script context right after creating new Carousel. Carousel appended to parent of script
                    target[prop] = value;
                    const carousel = target.createCarouselElements(value, target.makeTiles);//this may cause issue  in proxy
                    delete target.makeTiles;

                    target.init();
                    // console.log('setting scriptContext'); console.log(value);console.log(carousel);
                } else {
                    target[prop] = value;
                }
                
                return true;
            }
        };
    }

    createCarouselElements(currentScr, makeTiles = []) {
        let container = document.createElement('div');
        container.classList.add('carousel-container');
        let carousel = document.createElement('div');
        carousel.classList.add('carousel');
        currentScr.parentElement.appendChild(container);
        container.appendChild(carousel);
        this.eles = {carousel, tiles : [], container};
        makeTiles.forEach((tile, i) => { this.addTile(tile.img, tile.href, tile.options) });
        // console.log(tiles); console.log(this.eles.tiles);
        return carousel;
    }

    init() {
        this.makeButtons();
        this.setupEventListeners();
        this.reset();
        /*this.setupAccessibility();*/
        this.render();
        if (this.options.autoplay) {
            this.startAutoplay();
        }
    }

    makeButtons() {
        if (this.eles.container.querySelector('*>button')) return; // dont dupl buttons
        const controls = document.createElement('div');
        controls.className = 'controls';
        const lb = document.createElement('button'), rb = document.createElement('button');
        lb.textContent = '← Spin Left', rb.textContent = 'Spin Right →';
        lb.addEventListener('click', () => this.startSpin(1));
        rb.addEventListener('click', () => this.startSpin(-1));

        controls.appendChild(lb);
        controls.appendChild(rb);
        this.eles.container.appendChild(controls);
    }

    centerTiles() {        
        const containerRect = this.eles.container.getBoundingClientRect();
        // console.log(this.eles.tiles);
        const tileRect = this.eles.tiles[0].getBoundingClientRect();
        let computedStyle = window.getComputedStyle(this.eles.tiles[0]);
        let borderTopWidth = parseFloat(computedStyle.getPropertyValue('border-top-width'));
        let borderLeftWidth = parseFloat(computedStyle.getPropertyValue('border-left-width'));
        // console.log(borderLeftWidth);
        this.eles.tiles.forEach(tile => {
            tile.style.top = `${(this.eles.container.offsetHeight / 2) - (tile.offsetHeight / 2) - borderTopWidth}px`;
            tile.style.left = `${(this.eles.container.offsetWidth / 2) - (tile.offsetWidth / 2) - borderLeftWidth}px`;
        });
    }
    // tile top 128px left 228.3 w 80 h 80 
    // element width 498.24 height 347.6   249.12-40 209
    startAnimation() { this.render(); }

    stopAnimation() { this.state.isSpinning = false; }

    /**
     * Adds a new tile to the carousel
     * @param {string} imSrc
     * @param {string} href - Link URL for the tile
     * @param {Object} options - Configuration options for the tile
     * @param {number} [options.aspectRatio] - Desired aspect ratio for image resizing
     * @param {string} [options.title] - Custom title for the tile
     * @param {string} [options.target] - Link target attribute (e.g., '_blank')
     * @returns {HTMLElement} The created tile element
     */
    addTile(imSrc, href, options = {}) {
        if (!imSrc || typeof imSrc !== 'string') {
            console.warn('Image URL string should be provided');
        }
        options = { //merge
            aspectRatio: null, // let css determine
            title: `Image ${this.eles.tiles.length}`,
            target: '', //'_blank',
            alt: `img_${this.eles.tiles.length}`,
            ...options
        }
        const { aspectRatio, title, target, alt } = options;

        const tileA = document.createElement('a');
        Object.assign(tileA, {options, href, title, target, className: 'tile'});

        const image = document.createElement('img');
        Object.assign(image, { src: imSrc, alt });
        
        tileA.appendChild(image);
        this.eles.carousel.appendChild(tileA);
        this.eles.tiles.push(tileA);

        if (aspectRatio) {
            this.resizeImage(tileA, image, aspectRatio);
        }

        // Reinitialize the carousel to account for the new tile
        this.init();

        return tileA;
    }

    resizeImage(anchor, img, aspectRatio = 1) { // w/h
        //throw new Error('gfdf');
        // Object.assign(anchor.style, { width: this.options.tileWidth, height: this.options.tileHeight}); // css take over
        // let { width: aW, height: aH } = anchor.getBoundingClientRect();
        function parseSize(input, parentWidth) {
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
        //Object.assign(img.style, { width: `${imgW}px`, height: `${imgH}px` });
        Object.assign(anchor.style, { width: `${imgW}px`, height: `${imgH}px` });
        return { width: imgW, height: imgH };
    }

    reset() {
        document.dispatchEvent(new Event(`stopAnimation${Carousel.instanceCount}`));
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
        this.centerTiles();
        this.options.angleIncrement = 360 / this.eles.tiles.length;
        this.options.x_rad = .95 * this.eles.carousel.getBoundingClientRect().width / 2;


        // this.options.arrowSpinSpeed = 300; // 300 for 2,3,... x,x,x, 300
        // arrow values for speed. maybe make lookup table for n imgs in carousel
        document.dispatchEvent(new Event(`startAnimation${Carousel.instanceCount}`));
    }

    setupEventListeners() {
        if (this.listeners) return;
        // only created once on first 
        if (Carousel.instanceCount <= 1) { 
            // Arrow key controls
            // console.log('arr key');
            document.addEventListener('keydown', (e) => {
                const pointerX = this.pageX;
                const pointerY = this.pageY;
                const cc = Carousel.getClosestCarousel(pointerX, pointerY); //closestCarousel
                if (e.key === 'ArrowLeft') cc.startSpin(1);
                if (e.key === 'ArrowRight') cc.startSpin(-1);
            });
            document.addEventListener('mousemove', this.drag.bind(this));
            this.pageX = 0,  this.pageY = 0;
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

    /*
    setupAccessibility() {
        this.eles.carousel.setAttribute('role', 'region');
        this.eles.carousel.setAttribute('aria-label', 'Image Carousel');
        this.tiles.forEach((tile, index) => {
            tile.setAttribute('role', 'img');
            tile.setAttribute('aria-label', `Image ${index + 1}`);
        });
    }
    */

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
    * @param {number} timestamp - The current timestamp provided by requestAnimationFrame
    */
    updateCarousel(timestamp) {
        if (this.state.isDragging) return;
        if (!this.state.lastTimestamp) this.state.lastTimestamp = timestamp;
        const deltaTime = (timestamp - this.state.lastTimestamp) / 1000; // Convert to seconds
        this.state.lastTimestamp = timestamp;

        // Update current angle based on angular velocity
        this.state.currentAngle += this.state.angularVelocity * deltaTime; // could become negative/ / Normalize in set to within 0-360 degrees
        // Apply friction to gradually slow down the rotation
        this.state.angularVelocity *= Math.pow(this.options.friction, deltaTime); // * 60);

        // Check if we need to snap to the nearest tile
        if (Math.abs(this.state.angularVelocity) < this.options.minVelocity) {
            const nearestAngle = (Math.round(this.state.currentAngle / this.options.angleIncrement) * this.options.angleIncrement); // na [0-360] inclusive
            const angleDifference = (nearestAngle - this.state.currentAngle); // ca [0-360)
            
            if (angleDifference > this.options.angleIncrement) throw new Error('somewhere logic must have failed');
            if (Math.abs(angleDifference) < this.options.snapThreshold) {
                this.state.currentAngle = nearestAngle;
                this.state.angularVelocity = 0;
                this.state.isSpinning = false;
                this.state.lastTimestamp = 0; // need to reset?
            } else {
                // Gently push towards the nearest angle
                this.state.angularVelocity += angleDifference * 5 * deltaTime;
                this.state.isSpinning = true;
            }
        } else {
            this.state.isSpinning = true;
        }
    }

    moveTiles() {
        this.eles.tiles.forEach((tile, index) => {
            // index * angleIncrement  is in range 0 - 360
            // currentAngle is in range 0 - 360
            // index * angleIncrement - currentAngle range is -360 - 720
            // angle keep within range of -180 to 180. initialy 0

            const angle = (index * this.options.angleIncrement - this.state.currentAngle + 540) % 360 - 180;
            const acuteAngle = Math.abs(angle) < 90 ? angle : angle / Math.abs(angle) * (180 - Math.abs(angle));
            const radian = angle * Math.PI / 180; // -pi to pi
            const z = Math.cos(radian) * this.options.zRadius + this.options.zRadius + 2;
            const x = Math.sin(radian) * this.options.x_rad; // 50% 0f parent width or 200
            if (this.options.rise) {
                const riseHeight = this.options.riseHeight || this.options.x_rad / 20;
                const y = Math.sin(radian - (Math.PI / 2)) * riseHeight; // * Math.abs(x / this.options.x_rad);
                tile.style.transform = `translateX(${x}px) translateY(${y}px) translateZ(${z}px) rotateY(${-acuteAngle}deg)`;
            } else {
                tile.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${-acuteAngle}deg)`;
            }
            tile.style.opacity = (z + (1.1 * this.options.zRadius)) / (2.1 * this.options.zRadius); // 2 and 3 b4
            //tile.style.opacity = (z + 150) / 300;
            tile.style.zIndex = Math.round(z);

            // Activate/deactivate tiles based on position and motion
            //console.log(this.state.isSpinning);
            if (Math.abs(angle) < 1 && !this.state.isSpinning) {
                tile.classList.add('active');
                tile.classList.remove('inactive');
                tile.style.transform += ` scale(${this.options.activeScale})`;
            } else {
                tile.classList.remove('active');
                tile.classList.add('inactive');
            }
        });
    }

    /**
     * Initializes the drag interaction
     * @param {Event} e - The mouse or touch event
     */
    startDrag(e) {
        e.preventDefault();
        console.log('start drag');
        const pointerX = e.pageX || e.touches[0].pageX;
        const pointerY = e.pageY || e.touches[0].pageY;
        const cc = Carousel.getClosestCarousel(pointerX, pointerY); //closestCarousel
        console.log(cc.eles.carousel.id);
        console.log(e);

        cc.state.isDragging = true;
        cc.state.dragStart.x = pointerX;
        cc.state.dragStart.y = pointerY;
        cc.state.lastDragTimestamp = Date.now();

        cc.state.angularVelocity = 0; // Reset velocity when starting a new drag
    }

    /**
     * Handles the drag interaction
     * @param {Event} e - The mouse or touch event
     */
    drag(e) {
        const draggingCarousel = Carousel.existingCarousels.filter(crsl => crsl.state.isDragging)[0];
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
        draggingCarousel.state.currentAngle -= dragAngle; // Note the '+=' here instead of '-='
        

        // Calculate instantaneous velocity (reversed direction)
        if (deltaTime > 0) {
            // console.log(dragAngle);
            // impart velocity only at the end
            // draggingCarousel.state.angularVelocity = -dragAngle / deltaTime; // Note the negative sign here
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
        const draggingCarousel = Carousel.existingCarousels.filter(crsl => crsl.state.isDragging)[0];
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

    static getClosestCarousel(cursorX, cursorY) {
        // if more than one carousel need to choose which to be affected by listeners
        // if only one return that one
        // else if cursor is on any carousel element return it
        // else choose the closest element to the center of the view port
        let closest = null;
        let closestDistance = Infinity;
        // when only one return that one
        if (Carousel.instanceCount == 1)  return Carousel.existingCarousels[0];

        Carousel.existingCarousels.forEach(crsl => {
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
    }

    startAutoplay() {
        // console.log('startAutoplay');
        this.startSpin(2);
        setTimeout(() => this.startSpin(1), 500);
    }

    /**
     * Starts spinning the carousel in the specified direction
     * @param {number} direction - The direction of spin (1 for right, -1 for left)
     */
    startSpin(direction) {
        // console.log('startSpin'); console.log(this); console.log(this.options);
        this.state.angularVelocity += direction * this.options.arrowSpinSpeed; // Set initial angular velocity
        this.render();
    }

}

export const carouselStyles = `
        :root {
            --carousel-primary: #00A86B; /* Jade green */
            --carousel-secondary: #008B5A; /* button hover;  tile border;*/
            --carousel-background: #f0f0f0;
            --tile-shadow: rgba(0, 0, 0, 0.3);
        }


        /*body, html {
            height: 100%;
            width: 100%;
            margin: 0;
            /* Jade green 
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: var(--carousel-background);
            font-family: Arial, sans-serif;
        } */

        .carousel-container {
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative; /*was relative */
            width: 80%;
            height: 50%;
            min-height: 300px;
            margin: auto;
            margin-bottom: 100px;
            background-color: var(--carousel-background);
            font-family: Arial, sans-serif;
            /*background-color: lightcoral;
            z-index: 0;*/
        }

        .carousel {
            position: relative;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
            /*perspective: 10000px;*/
            /*transition: transform 0.1s ease-out;*/
            /*background-color: lightblue;
            z-index: 1;*/
        }

        .tile {
            position: absolute;
            /*width: 150px;  150px;*/
            /*height: 200px;  200px;*/
            background-color: var(--carousel-primary);
            border: 2px solid var(--carousel-secondary);
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 20px;
            color: white;
            box-shadow: 0 0 10px var(--tile-shadow);
            text-decoration: none;
            user-select: none;
            transition: scale 1s ease, opacity 0.3s ease-out; /* transform 0.3s ease-out, opacity 0.3s ease-out;*/
            will-change: transform, opacity;
            overflow: hidden;
        }

            .tile.active {
                cursor: pointer;
                /*transform: scale(5); gets over ridden by dynamic inline*/
            }

            .tile.inactive {
                pointer-events: none;
                opacity: 0.7;
            }

            .tile img {
                width: 100%;
                height: 100%;
            }

        .controls {
            position: absolute;
            bottom: -60px;
            left: 0;
            right: 0;
            text-align: center;
            display: flex; /*new*/
            justify-content: center; /*new*/
            gap: 1rem; /*new*/
        }

        button {
            font-size: 18px;
            margin: 0 10px;
            padding: 5px 10px;
            cursor: pointer;
            background-color: #00A86B;
            color: white;
            border: none;
            border-radius: 5px;
            transition: background-color 0.2s ease;
            background-color: var(--carousel-secondary);
        }

            button:hover {
                background-color: var(--carousel-secondary);
            }

        @media (max-width: 768px) {
            .carousel-container {
                width: 90%;
            }

            .tile {
                width: 80px;
                height: 80px;
            }
        }
    `

// Issue the sizes of the tiles is not changing with the carousel
// Soln. resize the images when the carousel is resized