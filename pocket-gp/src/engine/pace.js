import { CLIFF_STATE, CLIFF_SECONDS_PER_PCT, OVTK_EASY_LEVEL, OVTK_HARDNESS_EXP, PUNCTURE_MAX_PER_LAP, PUNCTURE_PER_LAP, TYRE_IDS, TYRES } from "./constants.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Extra seconds per lap once the tyre is past its cliff (below CLIFF_STATE % remaining).
export function cliffPenalty(tyreState) {
    return Math.max(0, CLIFF_STATE - clamp(tyreState, -100, 100)) * CLIFF_SECONDS_PER_PCT;
}

// Chance of a puncture per lap at the given tyre state (zero above the cliff, rising as it wears out).
export function punctureHazard(tyreState) {
    if (tyreState >= CLIFF_STATE) return 0;
    return Math.min(PUNCTURE_MAX_PER_LAP, (PUNCTURE_PER_LAP * (CLIFF_STATE - tyreState)) / CLIFF_STATE);
}

// Seconds per lap lost/gained by the tyre compound for the given track wetness (0-100).
export function tyrePace(tyreId, wet) {
    const t = TYRES[tyreId];
    if (t.kind === "slick") return t.pace + wet * t.wetK;
    if (t.kind === "inter") return 7.5 + Math.abs(30 - wet) * 0.1;
    return 9 + Math.abs(75 - wet) * 0.1;
}

// Legacy lap time formula. The random `noise` term is what the original intended
// (ember / 1000) but accidentally lost to integer division.
export function lapTimeFor(driver, track, tyreId, tyreState, wet, noise = 0) {
    return (
        track.optLapTime +
        (100 - driver.skill) / 50 +
        (100 - driver.carPerf) / 100 +
        noise +
        (100 - clamp(tyreState, -100, 100)) / 25 +
        cliffPenalty(tyreState) +
        tyrePace(tyreId, wet)
    );
}

export function lapNoise(rng) {
    return rng.range(-0.2, 0.5);
}

// Passing difficulty factor of a track: 1 up to OVTK_EASY_LEVEL, then falling exponentially.
export function overtakeEase(multiplier) {
    return Math.exp(-OVTK_HARDNESS_EXP * Math.max(0, multiplier - OVTK_EASY_LEVEL));
}

// Passes per lap of following (as a rate: chance within a distance d is 1 - exp(-rate * d)).
// It grows with the pace advantage relative to what the track demands, so a car that is far quicker than
// the one ahead gets by almost immediately, while an equal car rarely does. Staying close for a long time
// wears the defender down a little.
export function overtakeRate(delta, multiplier, chaseLaps = 0) {
    const needed = 0.15 + 0.12 * multiplier; // pace advantage (s per lap) that makes a pass about as likely as not
    const r = delta / needed;
    const rate = 0.083 + 0.7 * r + (r > 0 ? 0.5 * r * r : 0);
    if (rate <= 0) return 0;
    // Beyond an easy-to-normal track, passing gets exponentially harder (Monaco is far harder than Imola)
    return (rate + 0.25 * Math.min(chaseLaps, 2)) * overtakeEase(multiplier);
}

// Tyre wear in % per lap. Scales with race length so a shortened race wears tyres faster per lap.
export function wearPerLap(tyreId, lapsTotal) {
    return (TYRES[tyreId].wear * 72) / lapsTotal;
}

export function lapsTotalFor(track, fraction) {
    return Math.max(3, Math.round(track.laps * fraction));
}

// Compounds a sensible driver would consider for the given track wetness (dry compounds include any custom ones).
export function allowedTyres(wet) {
    const slicks = TYRE_IDS.filter((id) => TYRES[id].kind === "slick");
    if (wet < 18) return slicks;
    if (wet < 23) return [...slicks, "i"];
    if (wet < 57) return ["i"];
    if (wet < 65) return ["i", "w"];
    return ["w"];
}
