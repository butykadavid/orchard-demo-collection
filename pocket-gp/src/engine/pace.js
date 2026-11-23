import { CLIFF_STATE, CLIFF_SECONDS_PER_PCT, OVERTAKE_ZONE_SHARE, OVTK_EASY_LEVEL, OVTK_HARDNESS_EXP, PUNCTURE_MAX_PER_LAP, PUNCTURE_PER_LAP, RATING_PAR, SECONDS_PER_POINT, TYRE_IDS, TYRES } from "./constants.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Extra seconds per lap once the tyre is past its cliff (below CLIFF_STATE % remaining).
export function cliffPenalty(tyreState) {
    return Math.max(0, CLIFF_STATE - clamp(tyreState, -100, 100)) * CLIFF_SECONDS_PER_PCT;
}

// Seconds per lap a tyre at this state has lost: the gradual wear plus the extra past the cliff
export const tyreLoss = (tyreState) => (100 - clamp(tyreState, -100, 100)) / 25 + cliffPenalty(tyreState);

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

// Lap time: the circuit's reference lap plus what the driver rating, the car at this circuit (setup.carLoss, traits included)
// and the conditions cost. Ratings are 0-1000 and every point is SECONDS_PER_POINT; RATING_PAR costs nothing.
// The random `noise` term is what the original intended (ember / 1000) but accidentally lost to integer division.
export function lapTimeFor(driver, setup, track, tyreId, tyreState, wet, noise = 0, qualifying = false) {
    return (
        track.optLapTime +
        (RATING_PAR - driver.skill) * SECONDS_PER_POINT +
        setup.carLoss -
        setup.pace -
        (qualifying ? setup.quali : 0) +
        noise +
        tyreLoss(tyreState) * (1 - setup.grip) +
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
// `factor` scales the rate (see passFactor)
export function overtakeRate(delta, multiplier, chaseLaps = 0, factor = 1) {
    const needed = 0.15 + 0.12 * multiplier; // pace advantage (s per lap) that makes a pass about as likely as not
    const r = delta / needed;
    const rate = 0.083 + 0.7 * r + (r > 0 ? 0.5 * r * r : 0);
    if (rate <= 0) return 0;
    // Beyond an easy-to-normal track, passing gets exponentially harder (Monaco is far harder than Imola)
    return (rate + 0.25 * Math.min(chaseLaps, 2)) * overtakeEase(multiplier) * factor;
}

// How the traits of the two cars change a pass: the attacker's attack against the defender's defend (setups, or what the race
// makes of them, see car.live: the conditions of the traits are already taken into account).
// `zone` says where it happens: true on the straights and in the braking zones, false in the corners, null when it does not matter
// (the zone-specific bonuses are then blended by how many passes happen where).
const byZone = (fx, name, zone) => {
    const inZone = fx[`${name}Zone`];
    const inCorner = fx[`${name}Corner`];
    return fx[name] + (zone === null ? OVERTAKE_ZONE_SHARE * inZone + (1 - OVERTAKE_ZONE_SHARE) * inCorner : zone ? inZone : inCorner);
};

export function passFactor(attacker, defender, zone = null) {
    return Math.max(0, 1 + byZone(attacker, "attack", zone)) * (1 - clamp(byZone(defender, "defend", zone), -1, 0.8));
}

// What one trait's effects (see traitNow) add to the attacker's pass rate where it happens: the attacker side of passFactor
export function attackBonus(fx, zone) {
    return fx.attack + (zone ? fx.attackZone : fx.attackCorner);
}

// The defender side: what one trait's effects take off the passes suffered where it happens
export function defendBonus(fx, zone) {
    return fx.defend + (zone ? fx.defendZone : fx.defendCorner);
}

// Tyre wear in % per lap. Scales with race length so a shortened race wears tyres faster per lap; `mult` is the car's wear multiplier.
export function wearPerLap(tyreId, lapsTotal, mult = 1) {
    return ((TYRES[tyreId].wear * 72) / lapsTotal) * mult;
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
