import gridCsv from "./grid.csv?raw";
import tracksCsv from "./tracks.csv?raw";
import { LEGACY_DRIVER_BASE, LEGACY_DRIVER_SCALE } from "../engine/constants.js";
import { defaultCars } from "./cars.js";

function parseCsv(text) {
    return text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .slice(1)
        .map((line) => line.split(";"));
}

function driverCode(name) {
    const last = name.split(" ").slice(-1)[0];
    return last.slice(0, 3).toUpperCase();
}

// grid.csv still holds the legacy numbers (skill 1-100, car performance): they are converted to the 0-1000 ratings here
const GRID = parseCsv(gridCsv).map((c) => ({
    code: driverCode(c[0]),
    name: c[0],
    skill: LEGACY_DRIVER_BASE + LEGACY_DRIVER_SCALE * Number(c[1]),
    team: c[2],
    color: c[3],
    carPerf: Number(c[4]),
    defaultGridPos: Number(c[5]),
}));

// Cars of the teams, keyed by team name (shared and edited in place, like DRIVERS)
export const CARS = defaultCars(GRID);

export const DRIVERS = GRID.map(({ carPerf, ...d }) => d);

export const TRACKS = parseCsv(tracksCsv).map((c) => ({
    id: Number(c[0]),
    location: c[1],
    laps: Number(c[2]),
    optLapTime: Number(c[3]),
    ovtkMultiplier: Number(c[4]),
    // Setup optima: they define what the circuit asks of the car (see engine/parts.js)
    optDownForce: Number(c[5]),
    optCarBalance: Number(c[6]),
    optTraction: Number(c[7]),
    optBreakBalance: Number(c[8]),
    optTopSpeed: Number(c[9]),
    pitLane: Number(c[10]), // m: pit lane length (kept last so saved customisations from before it existed can be completed in the same key order)
}));
