import { MIN_PART_WEIGHT, PART_FAIL_SCALE, PART_PERF_TIERS, RATING_MAX, RATING_PAR, SECONDS_PER_POINT, TRACK_FIT_STRENGTH } from "./constants.js";

// A car is six parts, each with a performance and a reliability rating (0-1000):
//   car = { frontWing: { perf, rel }, rearWing: { perf, rel }, ... }
// Performance sets lap time (weighted by what the circuit asks of the car) and unlocks traits (see traits.js);
// reliability sets how likely the part is to break down.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// demand: how much the circuit's character asks of this part (0 = nothing, 0.5 = typical, 1 = everything)
// failWeight: how failure-prone the part is relative to the others; failures: what a breakdown is called
export const PARTS = {
    frontWing: {
        id: "frontWing",
        name: "Front wing",
        short: "FW",
        demand: (m) => m.downforce,
        failWeight: 0.8,
        failures: ["front wing failure", "front wing collapses"],
    },
    rearWing: {
        id: "rearWing",
        name: "Rear wing",
        short: "RW",
        demand: (m) => 0.5 + 0.6 * (m.downforce - 0.5) + 0.6 * (m.power - 0.5),
        failWeight: 0.8,
        failures: ["rear wing failure", "rear wing breaks"],
    },
    brakes: {
        id: "brakes",
        name: "Brakes",
        short: "BR",
        demand: (m) => m.braking,
        failWeight: 1,
        failures: ["brake failure", "brakes overheat"],
    },
    suspension: {
        id: "suspension",
        name: "Suspension",
        short: "SU",
        demand: (m) => (m.traction + m.balance) / 2,
        failWeight: 1,
        failures: ["suspension failure", "broken wishbone"],
    },
    powertrain: {
        id: "powertrain",
        name: "Powertrain",
        short: "PT",
        demand: (m) => m.power,
        failWeight: 1.6,
        failures: ["engine failure", "gearbox failure", "overheating", "electrical problem"],
    },
    chassis: {
        id: "chassis",
        name: "Chassis",
        short: "CH",
        demand: (m) => m.balance,
        failWeight: 0.8,
        failures: ["hydraulics failure", "chassis damage"],
    },
};

export const PART_IDS = Object.keys(PARTS);

export const partTraitsUnlocked = (perf) => PART_PERF_TIERS.filter((t) => perf >= t).length;

export function makePart(perf, rel) {
    return { perf: clamp(Math.round(perf), 0, RATING_MAX), rel: clamp(Math.round(rel), 0, RATING_MAX) };
}

export function isValidCar(car) {
    return (
        !!car &&
        typeof car === "object" &&
        PART_IDS.every((id) => {
            const p = car[id];
            return p && Number.isFinite(p.perf) && Number.isFinite(p.rel) && p.perf >= 0 && p.perf <= RATING_MAX && p.rel >= 0 && p.rel <= RATING_MAX;
        })
    );
}

// Plain average of the six parts: the headline rating of a car
export const carRating = (car, key = "perf") => PART_IDS.reduce((s, id) => s + car[id][key], 0) / PART_IDS.length;

// ---------------------------------------------------------------------------------------------
// Circuit character: the setup columns of the track data (optimal downforce, balance, traction, braking, top speed)
// and the overtaking difficulty, as 0-1 measures. Traits and part weights are both read from these.
// ---------------------------------------------------------------------------------------------

const norm = (v, lo, hi) => (Number.isFinite(v) ? clamp((v - lo) / (hi - lo), 0, 1) : 0.5);

export function trackMetrics(track) {
    return {
        downforce: norm(track.optDownForce, 13, 21), // slow and medium corners: wings
        balance: norm(track.optCarBalance, 8, 16), // technical, high load: chassis and suspension
        traction: norm(track.optTraction, 4, 10), // stop-start: suspension
        braking: norm(track.optBreakBalance, 4, 12), // heavy stops: brakes
        power: norm(track.optTopSpeed, 22, 48), // long straights: powertrain and low drag
        tight: norm(track.ovtkMultiplier, 2, 8), // hard to pass
    };
}

// How much each part counts for a lap at this circuit; the weights add up to 1
export function partWeights(metrics) {
    const raw = PART_IDS.map((id) => Math.max(MIN_PART_WEIGHT, 1 + TRACK_FIT_STRENGTH * (PARTS[id].demand(metrics) - 0.5)));
    const sum = raw.reduce((a, b) => a + b, 0);
    return Object.fromEntries(PART_IDS.map((id, i) => [id, raw[i] / sum]));
}

export function trackProfile(track) {
    const metrics = trackMetrics(track);
    return { metrics, weights: partWeights(metrics) };
}

// The car's rating at this circuit: its part performances weighted by what the circuit asks for
export function weightedRating(car, weights) {
    return PART_IDS.reduce((s, id) => s + weights[id] * car[id].perf, 0);
}

// Seconds per lap a rating costs compared with the par rating (negative = quicker)
export const ratingLoss = (rating) => (RATING_PAR - rating) * SECONDS_PER_POINT;

// ---------------------------------------------------------------------------------------------
// Reliability
// ---------------------------------------------------------------------------------------------

// Chance per race that one part breaks down
export const partFailChance = (id, rel) => PART_FAIL_SCALE * PARTS[id].failWeight * ((RATING_MAX - clamp(rel, 0, RATING_MAX)) / RATING_MAX) ** 2;

// Breakdown chances per part and in total (chance per race that the car retires with a mechanical failure)
export function failureOdds(car) {
    const parts = PART_IDS.map((id) => ({ part: id, p: partFailChance(id, car[id].rel) }));
    return { parts, total: parts.reduce((s, x) => s + x.p, 0) };
}

// ---------------------------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------------------------

// Driver error rate relative to the base rate: a driver at the par rating makes errors at the base rate, a weaker one more often
export const errorFactor = (skill) => Math.max(0.25, 1 + (RATING_PAR - skill) / 50);
