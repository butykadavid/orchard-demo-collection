import { createRng } from "./rng.js";

// Procedural track outlines for the map (cosmetic only: the simulation still works in lap fractions).
//
// A track is a closed random polygon (random points joined into a simple loop, so it is full of concave
// sections) whose corners are rounded with fillets of varying radius:
//  - easy-to-pass tracks have few corners: long straights ending in sharp corners
//  - hard-to-pass tracks have many corners: short straights, hairpins, S-bends and clusters of slow
//    corners that follow each other
// The outline is resampled evenly and each point gets a speed from its curvature. Mapping the shared lap
// fraction through that profile makes the dots slow down in tight corners and run quicker on the straights,
// while every lap still takes the same time.

const VIEW = 400; // map coordinate system (square)
const MARGIN = 44; // keeps the outline clear of the edges so labels fit
const SAMPLES = 480; // points around the lap
const SMOOTH = 2; // curvature smoothing half-window (samples)
const REF_RADIUS = 40; // corner radius (map units) at which a car is already noticeably slower
const CORNER_SLOWDOWN = 0.35; // how strongly curvature slows the dots
const MIN_SPEED = 0.3; // slowest dot speed relative to a straight
const CORNER_LEVEL = 0.25; // curvature (relative to REF_RADIUS) above which a point counts as a corner
const MIN_CLEARANCE = 18; // distance between separate parts of the track, so the road never overlaps itself
const CLEARANCE_SKIP = 50; // samples along the track that are ignored when measuring clearance
const ATTEMPTS = 80; // layouts tried per track before settling for the roomiest one

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Corner vertices of a random simple polygon, fitted into the view box
function layout(track, rng) {
    const twist = clamp((track.ovtkMultiplier - 1) / 9, 0, 1); // 0 = straights and sharp corners, 1 = Monaco-like
    const n = Math.max(5, Math.round(5 + 14 * twist + rng.range(-1, 1)));

    // Easy tracks are stretched so their straights get long; twisty ones fill a squarer area
    const aspect = clamp(rng.range(0.5, 0.7) + 0.3 * twist, 0.4, 1);

    // Spread the corner points out so neither corners nor road pile up on each other
    const minDist = 0.6 * Math.sqrt(aspect / n);
    const points = [];
    for (let i = 0; i < n; i++) {
        let p;
        for (let tries = 0; tries < 200; tries++) {
            p = { x: rng.next(), y: rng.next() * aspect };
            if (points.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= minDist)) break;
        }
        points.push(p);
    }
    untangle(points);

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const k = (VIEW - 2 * MARGIN) / Math.max(maxX - minX, maxY - minY);
    const fitted = points.map((p) => ({
        x: VIEW / 2 + (p.x - (minX + maxX) / 2) * k,
        y: VIEW / 2 + (p.y - (minY + maxY) / 2) * k,
    }));
    return withKinks(assignRadii(fitted, twist, rng), twist, rng);
}

// Pick a corner radius per vertex: tight corners (hairpins, sharp turns) mixed with flowing, wide ones.
// Easy tracks end their long straights in sharp corners; the harder a track is to pass, the more those
// corners turn into flowing curves, so it has fewer straights with a sharp turn at the end.
function assignRadii(vertices, twist, rng) {
    const n = vertices.length;
    return vertices.map((v, i) => {
        const prev = vertices[(i - 1 + n) % n];
        const next = vertices[(i + 1) % n];
        const longest = Math.max(Math.hypot(v.x - prev.x, v.y - prev.y), Math.hypot(next.x - v.x, next.y - v.y));
        const straightness = clamp((longest - 50) / 100, 0, 1); // 0 = short edges, 1 = long straight
        const flowChance = clamp(0.3 + 0.25 * twist + (0.55 * twist - 0.2 * (1 - twist)) * straightness, 0.05, 0.95);
        const flowing = rng.next() < flowChance;
        return { ...v, radius: flowing ? rng.range(32, 80) : rng.range(10, 15 + 5 * twist) };
    });
}

// Remove crossings by reversing the stretch of the tour between two crossing edges (2-opt), which
// turns random points into a simple closed polygon with plenty of concave sections. The result is
// ordered clockwise on screen.
function untangle(points) {
    const n = points.length;
    const side = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    const crosses = (a, b, c, d) => side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);

    for (let pass = 0, changed = true; changed && pass < 1000; pass++) {
        changed = false;
        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 2; j < n; j++) {
                if (i === 0 && j === n - 1) continue;
                if (crosses(points[i], points[i + 1], points[j], points[(j + 1) % n])) {
                    for (let a = i + 1, b = j; a < b; a++, b--) [points[a], points[b]] = [points[b], points[a]];
                    changed = true;
                }
            }
        }
    }

    let area = 0;
    for (let i = 0; i < n; i++) area += points[i].x * points[(i + 1) % n].y - points[(i + 1) % n].x * points[i].y;
    if (area < 0) points.reverse();
}

// Easy tracks get a gentle, wide bend in the middle of their longest straights
function withKinks(vertices, twist, rng) {
    const count = Math.round((1 - twist) * 2 * rng.range(0.5, 1.2));
    if (count === 0) return vertices;
    const n = vertices.length;
    const edges = vertices
        .map((v, i) => ({ i, len: Math.hypot(vertices[(i + 1) % n].x - v.x, vertices[(i + 1) % n].y - v.y) }))
        .sort((a, b) => b.len - a.len)
        .slice(0, count);
    const kinkAfter = new Map(edges.map((e) => [e.i, e.len]));

    const out = [];
    vertices.forEach((v, i) => {
        out.push(v);
        const len = kinkAfter.get(i);
        if (!len) return;
        const next = vertices[(i + 1) % n];
        const t = rng.range(0.4, 0.6);
        const side = (rng.next() < 0.5 ? -1 : 1) * rng.range(0.06, 0.12) * len;
        const nx = -(next.y - v.y) / len;
        const ny = (next.x - v.x) / len;
        out.push({
            x: v.x + (next.x - v.x) * t + nx * side,
            y: v.y + (next.y - v.y) * t + ny * side,
            radius: rng.range(110, 160),
        });
    });
    return out;
}

// Round every corner of the polygon with a circular arc (tangent points joined by straight edges)
function fillet(vertices) {
    const n = vertices.length;
    const out = [];
    for (let i = 0; i < n; i++) {
        const prev = vertices[(i - 1 + n) % n];
        const v = vertices[i];
        const next = vertices[(i + 1) % n];

        const ux = prev.x - v.x;
        const uy = prev.y - v.y;
        const wx = next.x - v.x;
        const wy = next.y - v.y;
        const lu = Math.hypot(ux, uy);
        const lw = Math.hypot(wx, wy);
        const u = [ux / lu, uy / lu];
        const w = [wx / lw, wy / lw];

        const alpha = Math.acos(clamp(u[0] * w[0] + u[1] * w[1], -1, 1)); // interior angle
        const turn = Math.PI - alpha;
        if (turn < 0.02) {
            out.push([v.x, v.y]);
            continue;
        }

        // Gentle bends get a wide radius, sharp turns keep a tight one
        const radiusWanted = v.radius * (1 + 3 * clamp(1 - turn / 0.7, 0, 1));

        // Tangent length for the wanted radius, limited so neighbouring corners never overrun an edge
        const t = Math.min(radiusWanted / Math.tan(alpha / 2), 0.45 * Math.min(lu, lw));
        const radius = t * Math.tan(alpha / 2);
        const bx = u[0] + w[0];
        const by = u[1] + w[1];
        const bl = Math.hypot(bx, by);
        const d = radius / Math.sin(alpha / 2);
        const cx = v.x + (bx / bl) * d;
        const cy = v.y + (by / bl) * d;

        const a1 = Math.atan2(v.y + u[1] * t - cy, v.x + u[0] * t - cx);
        const cross = u[0] * w[1] - u[1] * w[0];
        const sweep = cross > 0 ? -turn : turn; // direction of travel around the arc centre
        const steps = Math.max(2, Math.ceil(turn / 0.1));
        for (let s = 0; s <= steps; s++) {
            const a = a1 + (sweep * s) / steps;
            out.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
        }
    }
    return out;
}

// Even arc-length resampling of a closed polyline
function resample(pts) {
    const cum = [0];
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = cum[cum.length - 1];
    const out = [];
    let j = 0;
    for (let n = 0; n < SAMPLES; n++) {
        const s = (n / SAMPLES) * total;
        while (cum[j + 1] < s) j++;
        const span = cum[j + 1] - cum[j];
        const w = span > 0 ? (s - cum[j]) / span : 0;
        const a = pts[j];
        const b = pts[(j + 1) % pts.length];
        out.push([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]);
    }
    return out;
}

// Smallest distance between parts of the track that are far apart along it
function clearance(pts) {
    const n = pts.length;
    let min = Infinity;
    for (let i = 0; i < n; i++) {
        for (let j = i + CLEARANCE_SKIP; j <= i + n - CLEARANCE_SKIP && j < n; j++) {
            const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
            if (d < min) min = d;
        }
    }
    return min;
}

function generate(track) {
    const seed = track.id * 7919 + 13;
    let best = null;
    let bestClear = -1;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const rng = createRng(seed + attempt * 104729);
        const pts = resample(fillet(layout(track, rng)));
        const c = clearance(pts);
        if (c > bestClear) {
            best = pts;
            bestClear = c;
        }
        if (c >= MIN_CLEARANCE) break;
    }
    return best;
}

// Curvature per sample in units of 1 / REF_RADIUS (0 = straight, 1 = a corner of REF_RADIUS)
function curvature(pts) {
    const n = pts.length;
    const raw = pts.map((p, i) => {
        const a = pts[(i - 1 + n) % n];
        const b = pts[(i + 1) % n];
        const ux = p[0] - a[0];
        const uy = p[1] - a[1];
        const vx = b[0] - p[0];
        const vy = b[1] - p[1];
        const angle = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
        return (angle / (Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 || 1)) * REF_RADIUS;
    });
    return raw.map((_, i) => {
        let sum = 0;
        for (let d = -SMOOTH; d <= SMOOTH; d++) sum += raw[(i + d + n) % n];
        return sum / (2 * SMOOTH + 1);
    });
}

function rotate(arr, shift) {
    return arr.map((_, i) => arr[(i + shift) % arr.length]);
}

// Index of the point furthest (along the track) from any corner: the middle of the longest straight
function straightestPoint(curv) {
    const n = curv.length;
    const dist = new Array(n).fill(Infinity);
    let last = -Infinity;
    for (let k = 0; k < 2 * n; k++) {
        const i = k % n;
        if (curv[i] > CORNER_LEVEL) last = k;
        dist[i] = Math.min(dist[i], k - last);
    }
    last = Infinity;
    for (let k = 2 * n - 1; k >= 0; k--) {
        const i = k % n;
        if (curv[i] > CORNER_LEVEL) last = k;
        dist[i] = Math.min(dist[i], last - k);
    }
    let best = 0;
    for (let i = 1; i < n; i++) if (dist[i] > dist[best]) best = i;
    return best;
}

export function buildTrackShape(track) {
    let pts = generate(track);
    let curv = curvature(pts);
    const n = pts.length;

    // Start/finish (and pit entry/exit) go in the middle of the longest straight
    const start = straightestPoint(curv);
    pts = rotate(pts, start);
    curv = rotate(curv, start);

    // Outward unit normals (the outline runs clockwise on screen)
    const normals = pts.map((_, i) => {
        const a = pts[(i - 1 + n) % n];
        const b = pts[(i + 1) % n];
        const tx = b[0] - a[0];
        const ty = b[1] - a[1];
        const len = Math.hypot(tx, ty) || 1;
        return [ty / len, -tx / len];
    });

    // Speed profile from curvature, turned into cumulative lap-time fractions
    const speed = curv.map((k) => Math.max(MIN_SPEED, 1 / (1 + CORNER_SLOWDOWN * Math.pow(k, 1.5))));
    const cumT = [0];
    for (let i = 0; i < n; i++) cumT.push(cumT[i] + 2 / (speed[i] + speed[(i + 1) % n]));
    const lapTime = cumT[n];
    for (let i = 0; i <= n; i++) cumT[i] /= lapTime;

    // Point on the outline at a lap fraction, `lateral` units outside (+) or inside (-) the centreline
    function place(frac, lateral = 0) {
        const f = ((frac % 1) + 1) % 1;
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (cumT[mid] <= f) lo = mid;
            else hi = mid - 1;
        }
        const span = cumT[lo + 1] - cumT[lo];
        const w = span > 0 ? (f - cumT[lo]) / span : 0;
        const j = (lo + 1) % n;
        const x = pts[lo][0] + (pts[j][0] - pts[lo][0]) * w;
        const y = pts[lo][1] + (pts[j][1] - pts[lo][1]) * w;
        const nx = normals[lo][0] + (normals[j][0] - normals[lo][0]) * w;
        const ny = normals[lo][1] + (normals[j][1] - normals[lo][1]) * w;
        return [x + nx * lateral, y + ny * lateral];
    }

    // SVG path along the outline between two lap fractions (may exceed 1 to wrap past the line)
    function pathBetween(from, to, lateral = 0, steps = 32) {
        let d = "";
        for (let i = 0; i <= steps; i++) {
            const [x, y] = place(from + ((to - from) * i) / steps, lateral);
            d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        return d;
    }

    const loop = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + "Z";

    return { place, pathBetween, loop };
}
