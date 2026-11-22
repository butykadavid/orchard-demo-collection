import { DEFAULT_NEW_CAR_RATING, DEFAULT_RELIABILITY, LEGACY_CAR_BASE } from "../engine/constants.js";
import { PART_IDS, makePart } from "../engine/parts.js";

// How the built-in teams' cars are put together. A team's overall car rating comes from the grid file (grid.csv, CarPerf),
// so the spread of the field is unchanged; the character below only decides which parts carry it (it adds up to zero,
// so the average of the six parts stays on the team's rating). Reliability follows the rating loosely and trades
// against performance: the parts a team pushes hardest are the ones it trusts least.
//                      frontWing rearWing brakes suspension powertrain chassis
const CHARACTER = {
    "Argent Dynamics": [60, 40, -30, -20, -20, -30], // aero
    "Stormfront Racing": [-20, 20, -10, -30, 70, -30], // power
    "Verdant GP": [-10, -20, -20, 60, -50, 40], // mechanical grip
    "Fiamma Corse": [-30, -20, 40, -20, 50, -20], // engine and brakes
    "Bleu Horizon": [50, -10, -30, -20, -30, 40], // front-end aero
    "Ember Works": [-20, -20, 30, 30, 10, -30], // all-rounder
    "Falcon Tempest": [-20, 60, -30, -20, 30, -20], // straight-line speed
    "Ironclad Racing": [-40, -30, 50, 20, -30, 30], // stable and heavy
    "Garnet Racing": [30, -20, -10, 40, -30, -10], // front-end and grip
    "Skyline Autosport": [20, 10, -30, -20, -30, 50], // chassis
};

const RELIABILITY_FOLLOWS_RATING = 0.5; // reliability points per rating point above or below the default car
const RELIABILITY_TRADE_OFF = -0.5; // reliability points per performance point a part is pushed beyond the team's average

// A car from its overall rating and average reliability; `dev` holds the per-part offsets from those averages
export function makeCar(rating, reliability = DEFAULT_RELIABILITY, dev = {}) {
    return Object.fromEntries(PART_IDS.map((id) => [id, makePart(rating + (dev[id] ?? 0), reliability + RELIABILITY_TRADE_OFF * (dev[id] ?? 0))]));
}

// Cars of the built-in grid, keyed by team name
export function defaultCars(drivers) {
    const cars = {};
    for (const d of drivers) {
        if (cars[d.team]) continue;
        const rating = LEGACY_CAR_BASE + d.carPerf;
        const dev = Object.fromEntries(PART_IDS.map((id, i) => [id, CHARACTER[d.team]?.[i] ?? 0]));
        cars[d.team] = makeCar(rating, DEFAULT_RELIABILITY + RELIABILITY_FOLLOWS_RATING * (rating - DEFAULT_NEW_CAR_RATING), dev);
    }
    return cars;
}
