import { DEFAULT_NEW_CAR_RATING, DEFAULT_RELIABILITY, TRAIT_SLOTS } from "./constants.js";
import { PART_IDS, carRating, failureOdds, makePart, ratingLoss, trackProfile, weightedRating } from "./parts.js";
import { resolveFx, suggestTraits, sumFx, traitBreakdown, traitContext, traitNow, validTraits, zeroFx } from "./traits.js";
import { predictWater } from "./weather.js";

// A team's car as it goes into a race: the parts and the chosen traits resolved against one circuit.
// Everything the race needs is computed here once, so the simulation only reads numbers.

export const flatCar = (perf = DEFAULT_NEW_CAR_RATING, rel = DEFAULT_RELIABILITY) => Object.fromEntries(PART_IDS.map((id) => [id, makePart(perf, rel)]));

// The track wetness (%) the teams expect at evenly spaced points of the race, from the forecast available before the start
export function wetnessProfile(weather, fraction, lapsTotal) {
    const n = Math.max(1, Math.min(lapsTotal, 24));
    return Array.from({ length: n }, (_, k) => predictWater(weather, fraction, 0, (((k + 0.5) * lapsTotal) / n) * weather.lapS));
}

// Average track wetness (%) the teams expect over the race
export function expectedWetness(weather, fraction, lapsTotal) {
    const samples = wetnessProfile(weather, fraction, lapsTotal);
    return samples.reduce((s, w) => s + w, 0) / samples.length;
}

// setup fields the race reads (the effects of the traits that do not depend on the state of the race; the race works out the
// rest as it goes, see traitNow, and keeps the result in car.live, which has the same fields):
//   carLoss  s/lap the car costs compared with the par rating at this circuit
//   pace     s/lap gained by traits                   wear   tyre wear multiplier
//   attack/defend  pass rate multipliers (+/-) anywhere, attackZone/attackCorner/defendZone/defendCorner on the straights / in the corners only
//   grip     share of the tyre wear pace loss that is kept
//   tough    share of contact damage avoided          quali  s gained on the qualifying lap
//   errors/fragile  driver error / part failure rate modifier (+0.5 = 50% more)
//   failRate chance per race of a mechanical failure (always-on traits that make the car fragile already included), failParts its split
//            over the parts; baseFail the chance without any trait
//   fixed    the summed effects that never change; traitFx  [{ id, fx, live, lines }] what each trait does at this circuit
//   dynamic  some trait has effects that depend on the state of the race
export function buildSetup({ team, car, track, lapsTotal, traitIds = [], wet = 0, wets = null, slots = TRAIT_SLOTS }) {
    const profile = trackProfile(track);
    const { metrics, weights } = profile;
    const ctx = traitContext(profile, lapsTotal, wet, wets);
    const traits = validTraits(car, traitIds, slots);
    const traitFx = traitBreakdown(traits, ctx);
    const fixed = sumFx(traitFx.map((t) => t.fx));
    const rating = weightedRating(car, weights);
    const odds = failureOdds(car);
    const fragile = 1 + resolveFx(fixed).fragile;
    return {
        team,
        car,
        traits,
        slots,
        metrics,
        weights,
        rating, // the car's rating at this circuit (parts weighted by what the circuit asks for)
        avgRating: carRating(car),
        fixed,
        traitFx,
        dynamic: traitFx.some((t) => t.live.length > 0),
        carLoss: ratingLoss(rating),
        ...resolveFx(fixed),
        baseFail: odds.total,
        failRate: odds.total * fragile,
        failParts: odds.parts.map((f) => ({ ...f, p: f.p * fragile })),
    };
}

// The setup as it is on a qualifying lap: one flying lap on new tyres of the given kind, in clean air at the start of the weekend
export function qualifyingSetup(setup, wet, kind) {
    if (!setup.dynamic) return setup;
    const state = { wet, tyreState: 100, following: false, phase: 0, position: null, chaotic: false, kind };
    const total = { ...setup.fixed };
    const now = zeroFx();
    for (const t of setup.traitFx) {
        traitNow(t, state, now);
        for (const k in total) total[k] += now[k] - t.fx[k];
    }
    return { ...setup, ...resolveFx(total) };
}

// Setups for every team of the grid. The player's team runs the traits it picked (or the suggested ones when none were
// picked); the bots choose theirs for the circuit and the weather they expect.
export function buildSetups({ drivers, cars, track, weather, fraction, lapsTotal, playerTeam, playerTraits, rng, slots = TRAIT_SLOTS }) {
    const wets = wetnessProfile(weather, fraction, lapsTotal);
    const wet = wets.reduce((s, w) => s + w, 0) / wets.length;
    const setups = new Map();
    for (const d of drivers) {
        if (setups.has(d.team)) continue;
        const car = cars[d.team] ?? flatCar();
        const ctx = traitContext(trackProfile(track), lapsTotal, wet, wets);
        const picks = d.team === playerTeam && playerTraits ? playerTraits : suggestTraits(car, ctx, { slots, rng: d.team === playerTeam ? null : rng });
        setups.set(d.team, buildSetup({ team: d.team, car, track, lapsTotal, traitIds: picks, wet, wets, slots }));
    }
    return setups;
}
