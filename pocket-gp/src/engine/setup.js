import { DEFAULT_NEW_CAR_RATING, DEFAULT_RELIABILITY, TRAIT_SLOTS } from "./constants.js";
import { PART_IDS, carRating, failureOdds, makePart, ratingLoss, trackProfile, weightedRating } from "./parts.js";
import { suggestTraits, traitBreakdown, traitContext, traitEffects, validTraits } from "./traits.js";
import { predictWater } from "./weather.js";

// A team's car as it goes into a race: the parts and the chosen traits resolved against one circuit.
// Everything the race needs is computed here once, so the simulation only reads numbers.

export const flatCar = (perf = DEFAULT_NEW_CAR_RATING, rel = DEFAULT_RELIABILITY) => Object.fromEntries(PART_IDS.map((id) => [id, makePart(perf, rel)]));

// Average track wetness (%) the teams expect over the race, from the forecast available before the start
export function expectedWetness(weather, fraction, lapsTotal) {
    const n = Math.max(1, Math.min(lapsTotal, 24));
    let sum = 0;
    for (let k = 0; k < n; k++) sum += predictWater(weather, fraction, 0, (((k + 0.5) * lapsTotal) / n) * weather.lapS);
    return sum / n;
}

// setup fields the race reads:
//   carLoss  s/lap the car costs compared with the par rating at this circuit
//   wetGain  s/lap gained at 100% wetness     wear  tyre wear multiplier     attack/defend  pass rate multipliers (+/-)
//   clean    s/lap gained in clean air        grip  share of the tyre wear pace loss that is kept
//   attackZone/attackCorner  the same for passes on the straights / in the corners only
//   launch   extra pass rate on chaotic laps  tough  share of contact damage avoided     quali  s gained on the qualifying lap
//   errors   driver error rate modifier (+0.5 = 50% more)
//   failRate chance per race of a mechanical failure (traits that make the car fragile already included), failParts its split over the parts
export function buildSetup({ team, car, track, lapsTotal, traitIds = [], wet = 0, slots = TRAIT_SLOTS }) {
    const profile = trackProfile(track);
    const { metrics, weights } = profile;
    const ctx = traitContext(profile, lapsTotal, wet);
    const traits = validTraits(car, traitIds, slots);
    const fx = traitEffects(traits, ctx);
    const rating = weightedRating(car, weights);
    const odds = failureOdds(car);
    const fragile = 1 + Math.max(-0.5, fx.fragile);
    return {
        team,
        car,
        traits,
        slots,
        metrics,
        weights,
        rating, // the car's rating at this circuit (parts weighted by what the circuit asks for)
        avgRating: carRating(car),
        effects: fx,
        traitFx: traitBreakdown(traits, ctx), // [{ id, fx }] what each trait does at this circuit (for the post-race trait analysis)
        carLoss: ratingLoss(rating),
        wetGain: fx.wet,
        clean: fx.clean,
        grip: Math.min(0.8, fx.grip),
        wear: Math.max(0.5, 1 - fx.wear),
        attack: fx.attack,
        attackZone: fx.attackZone,
        attackCorner: fx.attackCorner,
        defend: Math.min(0.8, fx.defend),
        launch: fx.launch,
        tough: Math.min(0.9, fx.tough),
        quali: fx.quali,
        errors: Math.max(-0.5, fx.errors),
        failRate: odds.total * fragile,
        failParts: odds.parts.map((f) => ({ ...f, p: f.p * fragile })),
    };
}

// Setups for every team of the grid. The player's team runs the traits it picked (or the suggested ones when none were
// picked); the bots choose theirs for the circuit and the weather they expect.
export function buildSetups({ drivers, cars, track, weather, fraction, lapsTotal, playerTeam, playerTraits, rng, slots = TRAIT_SLOTS }) {
    const wet = expectedWetness(weather, fraction, lapsTotal);
    const setups = new Map();
    for (const d of drivers) {
        if (setups.has(d.team)) continue;
        const car = cars[d.team] ?? flatCar();
        const ctx = traitContext(trackProfile(track), lapsTotal, wet);
        const picks = d.team === playerTeam && playerTraits ? playerTraits : suggestTraits(car, ctx, { slots, rng: d.team === playerTeam ? null : rng });
        setups.set(d.team, buildSetup({ team: d.team, car, track, lapsTotal, traitIds: picks, wet, slots }));
    }
    return setups;
}
