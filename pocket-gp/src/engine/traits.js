import { AI_GRID_VALUE, PART_PERF_TIERS, TRAIT_FULL_WEIGHT, TRAIT_SCALE_MAX, TRAIT_SLOTS } from "./constants.js";
import { PART_IDS } from "./parts.js";

// ---------------------------------------------------------------------------------------------
// Trait roster
//
// A part unlocks its three traits at the performance ratings in PART_PERF_TIERS (tier 1, 2, 3). A team runs up to
// TRAIT_SLOTS traits per race, at most one per part, and may pick any trait it has unlocked. Higher tiers are
// stronger but come with a catch: a drawback that is always there, or a weather condition they depend on.
//
// A trait's benefits scale with how much its part matters at the circuit (the part's weight, see trackProfile): a front wing
// trait is worth more where the circuit is hungry for downforce and little where it is not. Drawbacks do not scale.
//
// To add or change a trait, edit the TRAITS list:
//   id        unique key (kept in saved team choices, so do not rename it)
//   part      id of the part that owns it (see PARTS)
//   tier      1-3: unlocks at PART_PERF_TIERS[tier - 1] performance
//   name, desc   what the player reads
//   effects   the benefits, values for the keys of EFFECTS below (scaled by the part's weight at the circuit)
//   drawbacks optional, the same keys: the price of the trait, always in full wherever it is run
// To add a new kind of effect, add it to EFFECTS (how a bot values it, how it reads) and use it where the race needs it.
// ---------------------------------------------------------------------------------------------

// Every value is "more of the good thing" unless `bad` says otherwise; a negative value is the opposite.
// No effect is a flat change of the lap time: pace comes from conditions (clean air, worn tyres, rain) or is traded against a drawback.
//   clean:        seconds per lap gained while running in clean air (nobody close ahead)
//   grip:         share of the pace lost to tyre wear that is kept (0.1 = 10% less lost, so it pays more the more worn the tyres are)
//   wear:         share of tyre wear saved (0.1 = 10% less)
//   wet:          seconds per lap gained at 100% track wetness (scales linearly with the wetness)
//   attack:       more passes made (0.2 = 20% higher pass rate), anywhere on the lap
//   attackZone:   the same, but only on the straights and in the braking zones (where most passes happen)
//   attackCorner: the same, but only in the corners between them
//   defend:       fewer passes suffered
//   launch:       more passes made on a chaotic lap (the first lap and the first after a standing restart)
//   tough:        share of contact damage avoided
//   quali:        seconds gained on the qualifying lap
//   errors:       more driver errors (bad)
//   fragile:      more part failures (bad)
// `value` is what a bot thinks one unit is worth in race seconds, given the context { laps, wet (expected %), tight (0-1) }
export const EFFECTS = {
    clean: { value: (v, c) => 0.6 * v * c.laps, text: (v) => (v >= 0 ? `${fmt(v)} s/lap quicker in clean air` : `${fmt(-v)} s/lap slower in clean air`) },
    grip: { value: (v, c) => 1.2 * v * c.laps, text: (v) => (v >= 0 ? `${pct(v)} less pace lost as the tyres wear` : `${pct(-v)} more pace lost as the tyres wear`) },
    wear: { value: (v, c) => 1.2 * v * c.laps, text: (v) => (v >= 0 ? `${pct(v)} less tyre wear` : `${pct(-v)} more tyre wear`) },
    wet: { value: (v, c) => v * (c.wet / 100) * c.laps, text: (v) => (v >= 0 ? `up to ${fmt(v)} s/lap quicker in the wet` : `up to ${fmt(-v)} s/lap slower in the wet`) },
    attack: { value: (v, c) => 0.25 * v * c.laps, text: (v) => more(v, "passes made") },
    attackZone: { value: (v, c) => 0.175 * v * c.laps, text: (v) => more(v, "passes on the straights") },
    attackCorner: { value: (v, c) => 0.075 * v * c.laps, text: (v) => more(v, "passes in the corners") },
    defend: { value: (v, c) => 0.15 * v * c.laps, text: (v) => (v >= 0 ? `${pct(v)} fewer passes suffered` : `${pct(-v)} more passes suffered`) },
    launch: { value: (v) => 3 * v, text: (v) => more(v, "passes on a chaotic lap") },
    tough: { value: (v) => 4 * v, text: (v) => (v >= 0 ? `${pct(v)} less contact damage` : `${pct(-v)} more contact damage`) },
    quali: { value: (v, c) => AI_GRID_VALUE * v * (0.5 + 1.5 * c.tight), text: (v) => (v >= 0 ? `${fmt(v)} s quicker in qualifying` : `${fmt(-v)} s slower in qualifying`) },
    errors: { bad: true, value: (v) => -10 * v, text: (v) => (v >= 0 ? `${pct(v)} more driver errors` : `${pct(-v)} fewer driver errors`) },
    fragile: { bad: true, value: (v) => -10 * v, text: (v) => (v >= 0 ? `${pct(v)} more part failures` : `${pct(-v)} fewer part failures`) },
};

function fmt(v) {
    return v.toFixed(2);
}

function pct(v) {
    return `${Math.round(v * 100)}%`;
}

const more = (v, what) => (v >= 0 ? `${pct(v)} more ${what}` : `${pct(-v)} fewer ${what}`);

export const TRAITS = [
    // Front wing
    {
        id: "fw-turn-in",
        part: "frontWing",
        tier: 1,
        name: "Clean Air Aero",
        desc: "A front wing that works best with nothing in front of it: quicker whenever the car is running in clean air.",
        effects: { clean: 0.12 },
    },
    {
        id: "fw-wake",
        part: "frontWing",
        tier: 2,
        name: "Wake Tolerant",
        desc: "Stays planted in dirty air, so it can follow closely through the corners and pass there far more often.",
        effects: { attackCorner: 0.3 },
    },
    {
        id: "fw-precision",
        part: "frontWing",
        tier: 3,
        name: "Precision Aero",
        desc: "A big gain in clean air at circuits hungry for downforce. The big wing drags everywhere, so passing on the straights gets much harder.",
        effects: { clean: 0.3 },
        drawbacks: { attackZone: -0.5 },
    },
    // Rear wing
    {
        id: "rw-low-drag",
        part: "rearWing",
        tier: 1,
        name: "Low-Drag Package",
        desc: "Less drag: a good run down the straights and more passes there. With so little wing the car is short of grip in the wet.",
        effects: { attackZone: 0.25 },
        drawbacks: { wet: -0.2 },
    },
    {
        id: "rw-wet",
        part: "rearWing",
        tier: 2,
        name: "Wet-Weather Wing",
        desc: "A wing set up for spray and standing water: the wetter the track, the more it gains. The extra downforce is hard on the tyres in every condition.",
        effects: { wet: 0.7 },
        drawbacks: { wear: -0.15 },
    },
    {
        id: "rw-drs",
        part: "rearWing",
        tier: 3,
        name: "DRS Hunter",
        desc: "Gets a big run out of the tow and the open flap on long straights, so it passes far more often there. Set up for the straights, it has little bite in the corners.",
        effects: { attackZone: 0.6 },
        drawbacks: { attackCorner: -0.25 },
    },
    // Brakes
    {
        id: "br-cooling",
        part: "brakes",
        tier: 1,
        name: "Cool Brakes",
        desc: "Consistent stopping power: the driver locks up and runs wide far less often.",
        effects: { errors: -0.4 },
    },
    {
        id: "br-late",
        part: "brakes",
        tier: 2,
        name: "Late Braker",
        desc: "Dives down the inside: passes much more often in the braking zones of heavy-braking circuits, but gets caught out more often.",
        effects: { attackZone: 0.5 },
        drawbacks: { errors: 0.5 },
    },
    {
        id: "br-wall",
        part: "brakes",
        tier: 3,
        name: "Brick Wall",
        desc: "Brakes later than anyone can follow: very hard to pass at circuits built around heavy stops. The brakes cook the tyres.",
        effects: { defend: 0.6 },
        drawbacks: { wear: -0.15 },
    },
    // Suspension
    {
        id: "su-kerb",
        part: "suspension",
        tier: 1,
        name: "Supple Setup",
        desc: "The car stays balanced as the tyres age: it loses much less pace on worn tyres, which pays off most on long stints.",
        effects: { grip: 0.15 },
    },
    {
        id: "su-glass",
        part: "suspension",
        tier: 2,
        name: "Glass Cannon",
        desc: "A knife-edge setup that is aggressive everywhere and forgives nothing: far more passes, but the driver errs more often and the car breaks more often.",
        effects: { attack: 0.4 },
        drawbacks: { errors: 0.8, fragile: 0.8 },
    },
    {
        id: "su-smooth",
        part: "suspension",
        tier: 3,
        name: "Smooth Operation",
        desc: "Superbly kind to the tyres, so stints run much longer. The soft setup has little bite for passing and is slow over one lap.",
        effects: { wear: 0.25 },
        drawbacks: { attack: -0.5, quali: -0.3 },
    },
    // Powertrain
    {
        id: "pt-quali",
        part: "powertrain",
        tier: 1,
        name: "Qualifying Mode",
        desc: "An engine mode that is only good for one lap: a gain in qualifying, nothing in the race. Worth most where passing is hard.",
        effects: { quali: 0.4 },
    },
    {
        id: "pt-top-end",
        part: "powertrain",
        tier: 2,
        name: "Top-End Power",
        desc: "Extra power at the top of the rev range: more passes on the straights, at the cost of an engine that is run hard.",
        effects: { attackZone: 0.3 },
        drawbacks: { fragile: 0.3 },
    },
    {
        id: "pt-launch",
        part: "powertrain",
        tier: 3,
        name: "Launch Control",
        desc: "A perfect getaway: many more places gained on the first lap and after a standing restart. The clutch and gearbox take a beating.",
        effects: { launch: 1.5 },
        drawbacks: { fragile: 0.5 },
    },
    // Chassis
    {
        id: "ch-wet",
        part: "chassis",
        tier: 1,
        name: "Wet Balance",
        desc: "A forgiving balance in low grip: quicker the wetter the track is.",
        effects: { wet: 0.4 },
    },
    {
        id: "ch-robust",
        part: "chassis",
        tier: 2,
        name: "Robust Monocoque",
        desc: "Takes a knock: contact leaves much less lasting damage. The extra material is heavy and sluggish through the corners.",
        effects: { tough: 0.9 },
        drawbacks: { attackCorner: -0.2 },
    },
    {
        id: "ch-balance",
        part: "chassis",
        tier: 3,
        name: "Perfect Balance",
        desc: "A car that does everything well at circuits with fast, loaded corners: easy on the tyres and sharp in the corners. The stiff chassis is a handful in the wet.",
        effects: { grip: 0.12, attackCorner: 0.4 },
        drawbacks: { wet: -0.8 },
    },
];

const BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

export const getTrait = (id) => BY_ID.get(id);

export const traitsOfPart = (partId) => TRAITS.filter((t) => t.part === partId).sort((a, b) => a.tier - b.tier);

export const traitUnlockAt = (trait) => PART_PERF_TIERS[trait.tier - 1];

export const isUnlocked = (car, trait) => car[trait.part].perf >= traitUnlockAt(trait);

export const unlockedTraits = (car) => TRAITS.filter((t) => isUnlocked(car, t));

// What a trait does, for the UI: its benefits and its drawbacks (`bad` marks what works against the team)
export function effectLines(trait) {
    const line = (k, v) => ({ text: EFFECTS[k].text(v), bad: (v < 0) !== !!EFFECTS[k].bad });
    return [...Object.entries(trait.effects).map(([k, v]) => line(k, v)), ...Object.entries(trait.drawbacks ?? {}).map(([k, v]) => line(k, v))];
}

// ---------------------------------------------------------------------------------------------
// Circuit context and effect totals
// ---------------------------------------------------------------------------------------------

// What a trait is judged against: the circuit (a trackProfile, or a setup, which carries the same metrics and part weights),
// the race length in laps and the wetness expected over the race (%)
export const traitContext = ({ metrics, weights }, laps, wet = 0) => ({ metrics, weights, laps, wet, tight: metrics.tight });

// How strongly a trait's benefits apply at this circuit: its part's weight against TRAIT_FULL_WEIGHT (1 = full, capped at TRAIT_SCALE_MAX)
export const traitFit = (trait, ctx) => Math.min(TRAIT_SCALE_MAX, ctx.weights[trait.part] / TRAIT_FULL_WEIGHT);

// A usable pick: known traits the car has unlocked, one per part, no more than `slots`
export function validTraits(car, ids, slots = TRAIT_SLOTS) {
    const used = new Set();
    const out = [];
    for (const id of ids ?? []) {
        const t = BY_ID.get(id);
        if (!t || used.has(t.part) || !isUnlocked(car, t)) continue;
        used.add(t.part);
        out.push(id);
        if (out.length >= slots) break;
    }
    return out;
}

// The effects of each chosen trait at this circuit, as [{ id, fx }] with every effect key present: benefits scaled by how much
// their part matters here, drawbacks in full
export function traitBreakdown(ids, ctx) {
    const out = [];
    for (const id of ids) {
        const t = BY_ID.get(id);
        if (!t) continue;
        const f = traitFit(t, ctx);
        const fx = Object.fromEntries(Object.keys(EFFECTS).map((k) => [k, 0]));
        for (const [k, v] of Object.entries(t.effects)) fx[k] += v * f;
        for (const [k, v] of Object.entries(t.drawbacks ?? {})) fx[k] += v;
        out.push({ id, fx });
    }
    return out;
}

// Summed effects of the chosen traits at this circuit
export function traitEffects(ids, ctx) {
    const total = Object.fromEntries(Object.keys(EFFECTS).map((k) => [k, 0]));
    for (const { fx } of traitBreakdown(ids, ctx)) for (const k of Object.keys(total)) total[k] += fx[k];
    return total;
}

// The effects of one trait as read at a circuit (see traitBreakdown), for the UI
export function fxLines(fx) {
    return Object.entries(fx)
        .filter(([, v]) => Math.abs(v) >= 0.0005)
        .map(([k, v]) => ({ text: EFFECTS[k].text(v), bad: (v < 0) !== !!EFFECTS[k].bad }));
}

// What a trait is worth in race seconds at this circuit (drawbacks counted), as a bot reckons it
export function traitValue(trait, ctx) {
    const f = traitFit(trait, ctx);
    const gain = Object.entries(trait.effects).reduce((s, [k, v]) => s + EFFECTS[k].value(v * f, ctx), 0);
    return Object.entries(trait.drawbacks ?? {}).reduce((s, [k, v]) => s + EFFECTS[k].value(v, ctx), gain);
}

// The traits a bot (or the player's "suggest" button) would run: the best unlocked trait of each part, the best parts first.
// `rng` adds a little taste so teams with the same parts do not all choose alike.
export function suggestTraits(car, ctx, { slots = TRAIT_SLOTS, rng = null } = {}) {
    const picks = [];
    for (const partId of PART_IDS) {
        let best = null;
        for (const t of traitsOfPart(partId)) {
            if (!isUnlocked(car, t)) continue;
            const value = traitValue(t, ctx) * (rng ? 1 + rng.range(-0.15, 0.15) : 1);
            if (!best || value > best.value) best = { id: t.id, value };
        }
        if (best && best.value > 0.05) picks.push(best);
    }
    return picks
        .sort((a, b) => b.value - a.value)
        .slice(0, slots)
        .map((p) => p.id);
}
