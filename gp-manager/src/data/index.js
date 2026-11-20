import gridCsv from "./grid.csv?raw";
import tracksCsv from "./tracks.csv?raw";

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

export const DRIVERS = parseCsv(gridCsv).map((c) => ({
    code: driverCode(c[0]),
    name: c[0],
    skill: Number(c[1]),
    team: c[2],
    color: c[3],
    carPerf: Number(c[4]),
    defaultGridPos: Number(c[5]),
}));

export const TRACKS = parseCsv(tracksCsv).map((c) => ({
    id: Number(c[0]),
    location: c[1],
    laps: Number(c[2]),
    optLapTime: Number(c[3]),
    ovtkMultiplier: Number(c[4]),
    // Setup optima, unused until the car-setup phase
    optDownForce: Number(c[5]),
    optCarBalance: Number(c[6]),
    optTraction: Number(c[7]),
    optBreakBalance: Number(c[8]),
    optTopSpeed: Number(c[9]),
}));
