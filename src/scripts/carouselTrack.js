// JavaScript source code
// Arrange images around a track of arbitrary shape.

// Cubic Bézier curve function
function cubicBezier(t, P0, P1, P2, P3) {
    const x = (1 - t) ** 3 * P0[0] + 3 * (1 - t) ** 2 * t * P1[0] + 3 * (1 - t) * t ** 2 * P2[0] + t ** 3 * P3[0];
    const y = (1 - t) ** 3 * P0[1] + 3 * (1 - t) ** 2 * t * P1[1] + 3 * (1 - t) * t ** 2 * P2[1] + t ** 3 * P3[1];
    return [x, y];
}

// Composite Bézier curve function
function compositeBezier(t, bezierSegments) {
    const numSegments = bezierSegments.length;
    const segmentIndex = Math.floor(t * numSegments);
    const localT = (t * numSegments) - segmentIndex;

    const segment = bezierSegments[segmentIndex % numSegments];
    return cubicBezier(localT, segment[0], segment[1], segment[2], segment[3]);
}

// Example usage - lev
const catSegs = [
    [[15/44, 17/53], [15/44, 17/53], [3/22, 0], [1/22, 2/53]],  // x min 120 max 340 y min 90 max 355. 
    [[1 / 22, 2 / 53], [0, 3 / 53], [3 / 44, 25 / 53], [3 / 44, 24 / 53]],
    [[3 / 44, 4 / 53], [1 / 44, 12 / 53], [4 / 11, 46 / 53], [17 / 44, 50 / 53]], // back 2 []
    [[17 / 44, 50 / 53], [9 / 22, 13 / 53], [13 / 22, 1], [27 / 44, 50 / 53]],
    [[27 / 44, 50 / 53], [7 / 11, 46 / 53], [41 / 22, 52 / 53], [39 / 44, 24 / 53]],
    [[39 / 44, 24 / 53], [39 / 44, 25 / 53], [1, 3 / 53], [21 / 22, 2 / 53]],
    [[1 / 2, 2 / 53], [9 / 22, 0], [27 / 44, 16 / 53], [13 / 22, 17 / 53]],
    [[13 / 22, 17 / 53], [25 / 44, 16 / 53], [4 / 11, 16 / 53], [15 / 44, 17 / 53]],
];

// Example usage - lev
const heartSegs = [
    [[0, 0], [1, 2], [2, 2], [3, 0]],  // First segment
    [[3, 0], [4, -2], [5, -2], [6, 0]], // Second segment
    [[6, 0], [7, 2], [8, 2], [9, 0]],   // Third segment
    [[9, 0], [10, -2], [11, -2], [12, 0]] // Fourth segment
];

// Example usage - lev
const bezierSegments = [
    [[0, 0], [1, 2], [2, 2], [3, 0]],  // First segment
    [[3, 0], [4, -2], [5, -2], [6, 0]], // Second segment
    [[6, 0], [7, 2], [8, 2], [9, 0]],   // Third segment
    [[9, 0], [10, -2], [11, -2], [12, 0]] // Fourth segment
];

const t = 0.75; // Example parameter
const [x, y] = compositeBezier(t, bezierSegments);

console.log(`Coordinates at t=${t}: (${x}, ${y})`);
