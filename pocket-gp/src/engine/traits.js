import {
    AI_GRID_PUSH,
    AI_GRID_TRAFFIC,
    AI_GRID_VALUE,
    AI_RANK_TRAFFIC,
    AI_RUN_SPREAD,
    AI_STUCK_TRAFFIC,
    AI_TRAFFIC_RISK,
    AI_TRAIT_RISK,
    OVERTAKE_ZONE_SHARE,
    PART_PERF_TIERS,
    TRAIT_FULL_WEIGHT,
    TRAIT_SCALE_MAX,
    TRAIT_SLOTS,
} from "./constants.js";
import { PART_IDS } from "./parts.js";

// ---------------------------------------------------------------------------------------------
// Traits
//
// A part unlocks its traits at the performance ratings in PART_PERF_TIERS (tier 1, 2, 3). Every part has any number of traits
// per tier, edited on the Customize page. A team runs up to TRAIT_SLOTS traits per race, at most one per part, and may pick any
// trait it has unlocked. All traits are the same kind of thing: a list of effects, each of them a change to one stat that may
// be tied to conditions:
//
//   trait = { id, part, tier, name, desc, effects: [effect], drawbacks: [effect] }
//   effect = { stat, amount, when: [condition] }
//
// `effects` are the benefits: they scale with how much the trait's part matters at the circuit (the part's weight, see
// trackProfile), so a front wing trait is worth more where the circuit is hungry for downforce. `drawbacks` are the price of
// the trait, always in full wherever it is run. Either list may hold a negative amount. When there are conditions, the effect only
// works while all of them hold. Conditions that depend on the circuit are settled before the race, the others are looked at
// every step of the race (see traitNow), so the same effect can come and go during a race.
//
// To add a new kind of stat, add it to STATS (how a bot values it, how it reads, which conditions make sense for it), put it among
// the BUCKETS the race reads and use it where the race needs it. A new kind of condition goes to COND, liveFactor and condFreq.
// ---------------------------------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function fmt(v) {
    return v.toFixed(2);
}

function pct(v) {
    return `${Math.round(v * 100)}%`;
}

const more = (v, what) => (v >= 0 ? `${pct(v)} more ${what}` : `${pct(-v)} fewer ${what}`);

// The numbers the race reads. Passing is split by where it happens (see the zone condition): passes anywhere, on the straights
// and in the braking zones only, and in the corners between them only
export const BUCKETS = ["pace", "grip", "wear", "attack", "attackZone", "attackCorner", "defend", "defendZone", "defendCorner", "tough", "quali", "errors", "fragile"];

export const zeroFx = () => Object.fromEntries(BUCKETS.map((k) => [k, 0]));

export const MAX_FIELD = 26; // cars on a grid, bounds the position condition

const EVERYWHERE = ["air", "wet", "tyre", "phase", "position", "chaotic", "compound", "track"];

// What a trait can change. A positive amount is "more of the good thing" unless `bad` says otherwise; a negative one is the opposite.
//   pace     seconds per lap gained (the lap time gets shorter)
//   grip     share of the pace lost to tyre wear that is kept (0.1 = 10% less lost, so it pays more the more worn the tyres are)
//   wear     share of tyre wear saved (0.1 = 10% less)
//   attack   more passes made (0.2 = 20% higher pass rate)           defend   fewer passes suffered
//   tough    share of contact damage avoided                         quali    seconds gained on the qualifying lap
//   errors   more driver errors (bad)                                fragile  more part failures (bad)
// `max` bounds the amount, `pctUnit` says it reads as a percentage, `conditions` lists the conditions that make sense for it,
// `value` is what a bot thinks an amount is worth in race seconds when it applies all the time, given the context
// { laps, wet (expected %), tight (0-1) }, `chaoticMult` how much more a chaotic lap counts than an ordinary one
export const STATS = {
    pace: {
        label: "Lap time",
        unit: "s/lap",
        max: 2,
        step: 0.01,
        conditions: EVERYWHERE,
        value: (v, c) => v * c.laps,
        text: (v) => (v >= 0 ? `${fmt(v)} s/lap quicker` : `${fmt(-v)} s/lap slower`),
    },
    grip: {
        label: "Tyre grip",
        pctUnit: true,
        max: 0.8,
        conditions: EVERYWHERE,
        value: (v, c) => 1.2 * v * c.laps,
        text: (v) => (v >= 0 ? `${pct(v)} less pace lost as the tyres wear` : `${pct(-v)} more pace lost as the tyres wear`),
    },
    wear: {
        label: "Tyre wear",
        pctUnit: true,
        max: 0.5,
        conditions: EVERYWHERE,
        value: (v, c) => 1.2 * v * c.laps,
        text: (v) => (v >= 0 ? `${pct(v)} less tyre wear` : `${pct(-v)} more tyre wear`),
    },
    attack: {
        label: "Passes made",
        pctUnit: true,
        max: 2,
        conditions: [...EVERYWHERE, "zone"],
        chaoticMult: 12,
        value: (v, c) => 0.25 * v * c.laps,
        text: (v) => more(v, "passes made"),
    },
    defend: {
        label: "Passes suffered",
        pctUnit: true,
        max: 0.8,
        conditions: [...EVERYWHERE, "zone"],
        value: (v, c) => 0.15 * v * c.laps,
        text: (v) => (v >= 0 ? `${pct(v)} fewer passes suffered` : `${pct(-v)} more passes suffered`),
    },
    tough: {
        label: "Contact damage",
        pctUnit: true,
        max: 0.9,
        conditions: EVERYWHERE,
        value: (v) => 4 * v,
        text: (v) => (v >= 0 ? `${pct(v)} less contact damage` : `${pct(-v)} more contact damage`),
    },
    quali: {
        label: "Qualifying lap",
        unit: "s",
        max: 1.5,
        step: 0.01,
        conditions: ["wet", "track"],
        value: (v, c) => AI_GRID_VALUE * v * (0.5 + 1.5 * c.tight),
        text: (v) => (v >= 0 ? `${fmt(v)} s quicker in qualifying` : `${fmt(-v)} s slower in qualifying`),
    },
    errors: {
        label: "Driver errors",
        bad: true,
        pctUnit: true,
        max: 3,
        conditions: EVERYWHERE,
        value: (v) => -10 * v,
        text: (v) => (v >= 0 ? `${pct(v)} more driver errors` : `${pct(-v)} fewer driver errors`),
    },
    fragile: {
        label: "Part failures",
        bad: true,
        pctUnit: true,
        max: 3,
        conditions: EVERYWHERE,
        value: (v) => -10 * v,
        text: (v) => (v >= 0 ? `${pct(v)} more part failures` : `${pct(-v)} fewer part failures`),
    },
};

export const STAT_IDS = Object.keys(STATS);

// ---------------------------------------------------------------------------------------------
// Conditions
//
//   air       { value: "clean" | "traffic" }       nobody close ahead / following another car
//   wet       { min, max, mode }                   track wetness in %
//   tyre      { min, max, mode }                   tyre life left in % (100 = new)
//   phase     { min, max, mode }                   race distance covered in %
//   position  { min, max, mode }                   running position (1 = leading)
//   chaotic   {}                                   the first lap and the first lap after a standing restart
//   compound  { kinds: ["slick", "inter", "wet"] } the kind of tyre fitted
//   track     { metric, min, max, mode }           a circuit characteristic in % (see METRICS): settled before the race
//   zone      { value: "straight" | "corner" }     where a pass happens: only for attack and defend
// A range condition has `mode`: "range" holds between min and max, "rising" builds up from nothing at min to full at max,
// "falling" fades from full at min to nothing at max.
// ---------------------------------------------------------------------------------------------

export const RANGE_MODES = ["range", "rising", "falling"];
export const KINDS = ["slick", "inter", "wet"];
export const KIND_NAMES = { slick: "slick", inter: "intermediate", wet: "wet-weather" };
export const METRICS = { downforce: "downforce demand", balance: "corner load", traction: "traction demand", braking: "braking demand", power: "top-speed demand", tight: "passing difficulty" };

// label for pickers; range = the unit and bounds of a range condition, `def` its starting values
export const COND = {
    air: { label: "Air" },
    wet: { label: "Track wetness", range: { lo: 0, hi: 100, unit: "%", noun: "track wetness", def: [20, 100] } },
    tyre: { label: "Tyre life left", range: { lo: 0, hi: 100, unit: "%", noun: "tyre life left", def: [0, 40] } },
    phase: { label: "Race distance", range: { lo: 0, hi: 100, unit: "%", noun: "race distance", def: [0, 25] } },
    position: { label: "Running position", range: { lo: 1, hi: MAX_FIELD, unit: "", noun: "position", def: [1, 3], int: true } },
    chaotic: { label: "First lap and restarts" },
    compound: { label: "Tyre type" },
    track: { label: "Circuit", range: { lo: 0, hi: 100, unit: "%", noun: "this", def: [60, 100] } },
    zone: { label: "Where on the track" },
};

export function newCondition(type) {
    const r = COND[type].range;
    switch (type) {
        case "air":
            return { type, value: "clean" };
        case "compound":
            return { type, kinds: ["slick"] };
        case "zone":
            return { type, value: "straight" };
        case "track":
            return { type, metric: "downforce", min: r.def[0], max: r.def[1], mode: "range" };
        case "chaotic":
            return { type };
        default:
            return { type, min: r.def[0], max: r.def[1], mode: "range" };
    }
}

export function rangeFactor(x, c) {
    if (c.mode === "range") return x >= c.min && x <= c.max ? 1 : 0;
    const f = c.max > c.min ? clamp((x - c.min) / (c.max - c.min), 0, 1) : x >= c.min ? 1 : 0;
    return c.mode === "rising" ? f : 1 - f;
}

function rangeText(c, noun, unit, lo, hi) {
    if (c.mode === "rising") return `building up as ${noun} rises from ${c.min}${unit} to ${c.max}${unit}`;
    if (c.mode === "falling") return `fading as ${noun} rises from ${c.min}${unit} to ${c.max}${unit}`;
    if (c.min <= lo && c.max >= hi) return "always";
    if (c.min <= lo) return `when ${noun} is at most ${c.max}${unit}`;
    if (c.max >= hi) return `when ${noun} is at least ${c.min}${unit}`;
    return `when ${noun} is ${c.min}-${c.max}${unit}`;
}

// A condition in words
export function conditionText(c) {
    switch (c.type) {
        case "air":
            return c.value === "clean" ? "in clean air" : "when following another car";
        case "chaotic":
            return "on the first lap and after a standing restart";
        case "compound":
            return `on ${c.kinds.map((k) => KIND_NAMES[k]).join(" or ")} tyres`;
        case "zone":
            return c.value === "straight" ? "on the straights and in the braking zones" : "in the corners";
        case "position":
            if (c.mode === "range") return c.min === c.max ? `while running P${c.min}` : `while running P${c.min}-P${c.max}`;
            return rangeText(c, "position", "", 1, MAX_FIELD);
        case "track":
            return rangeText(c, METRICS[c.metric], "%", 0, 100).replace(/^when /, "at circuits with ").replace(/^always$/, "everywhere");
        default: {
            const r = COND[c.type].range;
            return rangeText(c, r.noun, r.unit, r.lo, r.hi);
        }
    }
}

// What an effect does, in words, with its conditions. `amount` defaults to the effect's own.
export function effectText(e, amount = e.amount) {
    const conds = (e.when ?? []).map(conditionText).filter((t) => t !== "always" && t !== "everywhere");
    return [STATS[e.stat].text(amount), ...conds].join(", ");
}

const isBad = (e, amount = e.amount) => amount < 0 !== !!STATS[e.stat].bad;

// A trait's effects as lines for the UI: its benefits and its drawbacks (`bad` marks what works against the team)
export function effectLines(trait) {
    return [...trait.effects, ...trait.drawbacks].map((e) => ({ text: effectText(e), bad: isBad(e) }));
}

// ---------------------------------------------------------------------------------------------
// Checking and repairing trait data (saved data, the editor)
// ---------------------------------------------------------------------------------------------

function normalizeRange(c, type) {
    const r = COND[type].range;
    const num = (v, d) => (Number.isFinite(v) ? v : d);
    let min = clamp(num(c.min, r.def[0]), r.lo, r.hi);
    let max = clamp(num(c.max, r.def[1]), r.lo, r.hi);
    if (r.int) {
        min = Math.round(min);
        max = Math.round(max);
    }
    if (min > max) [min, max] = [max, min];
    return { min, max, mode: RANGE_MODES.includes(c.mode) ? c.mode : "range" };
}

export function normalizeCondition(c) {
    if (!c || typeof c !== "object" || !COND[c.type]) return null;
    switch (c.type) {
        case "air":
            return { type: "air", value: c.value === "traffic" ? "traffic" : "clean" };
        case "chaotic":
            return { type: "chaotic" };
        case "zone":
            return { type: "zone", value: c.value === "corner" ? "corner" : "straight" };
        case "compound": {
            const kinds = KINDS.filter((k) => Array.isArray(c.kinds) && c.kinds.includes(k));
            return { type: "compound", kinds: kinds.length ? kinds : ["slick"] };
        }
        case "track":
            return { type: "track", metric: METRICS[c.metric] ? c.metric : "downforce", ...normalizeRange(c, "track") };
        default:
            return { type: c.type, ...normalizeRange(c, c.type) };
    }
}

export function normalizeEffect(e) {
    const stat = STATS[e?.stat];
    if (!stat) return null;
    const amount = Number.isFinite(e.amount) ? clamp(e.amount, -stat.max, stat.max) : 0;
    const seen = new Set();
    const when = [];
    for (const raw of Array.isArray(e.when) ? e.when : []) {
        const c = normalizeCondition(raw);
        if (!c || !stat.conditions.includes(c.type) || seen.has(c.type)) continue;
        seen.add(c.type);
        when.push(c);
    }
    return { stat: e.stat, amount, when };
}

export function normalizeTrait(t) {
    if (!t || typeof t !== "object" || typeof t.id !== "string" || t.id === "" || !PART_IDS.includes(t.part)) return null;
    const list = (l) => (Array.isArray(l) ? l.map(normalizeEffect).filter(Boolean) : []);
    return {
        id: t.id,
        part: t.part,
        tier: clamp(Math.round(Number.isFinite(t.tier) ? t.tier : 1), 1, PART_PERF_TIERS.length),
        name: typeof t.name === "string" ? t.name : "Trait",
        desc: typeof t.desc === "string" ? t.desc : "",
        effects: list(t.effects),
        drawbacks: list(t.drawbacks),
    };
}

// A usable trait list: broken traits and effects are dropped, ids made unique
export function normalizeTraits(list) {
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
        const t = normalizeTrait(raw);
        if (!t || seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// Trait roster (the defaults; the list in use is replaced by the saved one, see replaceTraits)
// ---------------------------------------------------------------------------------------------

const clean = { type: "air", value: "clean" };
const straight = { type: "zone", value: "straight" };
const corner = { type: "zone", value: "corner" };
const wetter = { type: "wet", min: 0, max: 100, mode: "rising" };
const chaotic = { type: "chaotic" };
const fx = (stat, amount, ...when) => ({ stat, amount, when });

const DEFAULT_TRAITS = [
    // Front wing
    {
        id: "fw-turn-in",
        part: "frontWing",
        tier: 1,
        name: "Clean Air Aero",
        desc: "A front wing that works best with nothing in front of it: quicker whenever the car is running in clean air.",
        effects: [fx("pace", 0.12, clean)],
    },
    {
        id: "fw-wake",
        part: "frontWing",
        tier: 2,
        name: "Wake Tolerant",
        desc: "Stays planted in dirty air, so it can follow closely through the corners and pass there far more often.",
        effects: [fx("attack", 0.3, corner)],
    },
    {
        id: "fw-precision",
        part: "frontWing",
        tier: 3,
        name: "Precision Aero",
        desc: "A big gain in clean air at circuits hungry for downforce. The big wing drags everywhere, so passing on the straights gets much harder.",
        effects: [fx("pace", 0.3, clean)],
        drawbacks: [fx("attack", -0.5, straight)],
    },
    // Rear wing
    {
        id: "rw-low-drag",
        part: "rearWing",
        tier: 1,
        name: "Low-Drag Package",
        desc: "Less drag: a good run down the straights and more passes there. With so little wing the car is short of grip in the wet.",
        effects: [fx("attack", 0.25, straight)],
        drawbacks: [fx("pace", -0.2, wetter)],
    },
    {
        id: "rw-wet",
        part: "rearWing",
        tier: 2,
        name: "Wet-Weather Wing",
        desc: "A wing set up for spray and standing water: the wetter the track, the more it gains. The extra downforce is hard on the tyres in every condition.",
        effects: [fx("pace", 0.7, wetter)],
        drawbacks: [fx("wear", -0.15)],
    },
    {
        id: "rw-drs",
        part: "rearWing",
        tier: 3,
        name: "DRS Hunter",
        desc: "Gets a big run out of the tow and the open flap on long straights, so it passes far more often there. Set up for the straights, it has little bite in the corners.",
        effects: [fx("attack", 0.6, straight)],
        drawbacks: [fx("attack", -0.25, corner)],
    },
    // Brakes
    {
        id: "br-cooling",
        part: "brakes",
        tier: 1,
        name: "Cool Brakes",
        desc: "Consistent stopping power: the driver locks up and runs wide far less often.",
        effects: [fx("errors", -0.4)],
    },
    {
        id: "br-late",
        part: "brakes",
        tier: 2,
        name: "Late Braker",
        desc: "Dives down the inside: passes much more often in the braking zones of heavy-braking circuits, but gets caught out more often.",
        effects: [fx("attack", 0.5, straight)],
        drawbacks: [fx("errors", 0.5)],
    },
    {
        id: "br-wall",
        part: "brakes",
        tier: 3,
        name: "Brick Wall",
        desc: "Brakes later than anyone can follow: very hard to pass at circuits built around heavy stops. The brakes cook the tyres.",
        effects: [fx("defend", 0.6)],
        drawbacks: [fx("wear", -0.15)],
    },
    // Suspension
    {
        id: "su-kerb",
        part: "suspension",
        tier: 1,
        name: "Supple Setup",
        desc: "The car stays balanced as the tyres age: it loses much less pace on worn tyres, which pays off most on long stints.",
        effects: [fx("grip", 0.15)],
    },
    {
        id: "su-glass",
        part: "suspension",
        tier: 2,
        name: "Glass Cannon",
        desc: "A knife-edge setup that is aggressive everywhere and forgives nothing: far more passes, but the driver errs more often and the car breaks more often.",
        effects: [fx("attack", 0.4)],
        drawbacks: [fx("errors", 0.8), fx("fragile", 0.8)],
    },
    {
        id: "su-smooth",
        part: "suspension",
        tier: 3,
        name: "Smooth Operation",
        desc: "Superbly kind to the tyres, so stints run much longer. The soft setup has little bite for passing and is slow over one lap.",
        effects: [fx("wear", 0.25)],
        drawbacks: [fx("attack", -0.5), fx("quali", -0.3)],
    },
    // Powertrain
    {
        id: "pt-quali",
        part: "powertrain",
        tier: 1,
        name: "Qualifying Mode",
        desc: "An engine mode that is only good for one lap: a gain in qualifying, nothing in the race. Worth most where passing is hard.",
        effects: [fx("quali", 0.4)],
    },
    {
        id: "pt-top-end",
        part: "powertrain",
        tier: 2,
        name: "Top-End Power",
        desc: "Extra power at the top of the rev range: more passes on the straights, at the cost of an engine that is run hard.",
        effects: [fx("attack", 0.3, straight)],
        drawbacks: [fx("fragile", 0.3)],
    },
    {
        id: "pt-launch",
        part: "powertrain",
        tier: 3,
        name: "Launch Control",
        desc: "A perfect getaway: many more places gained on the first lap and after a standing restart. The clutch and gearbox take a beating.",
        effects: [fx("attack", 1.5, chaotic)],
        drawbacks: [fx("fragile", 0.5)],
    },
    // Chassis
    {
        id: "ch-wet",
        part: "chassis",
        tier: 1,
        name: "Wet Balance",
        desc: "A forgiving balance in low grip: quicker the wetter the track is.",
        effects: [fx("pace", 0.4, wetter)],
    },
    {
        id: "ch-robust",
        part: "chassis",
        tier: 2,
        name: "Robust Monocoque",
        desc: "Takes a knock: contact leaves much less lasting damage. The extra material is heavy and sluggish through the corners.",
        effects: [fx("tough", 0.9)],
        drawbacks: [fx("attack", -0.2, corner)],
    },
    {
        id: "ch-balance",
        part: "chassis",
        tier: 3,
        name: "Perfect Balance",
        desc: "A car that does everything well at circuits with fast, loaded corners: easy on the tyres and sharp in the corners. The stiff chassis is a handful in the wet.",
        effects: [fx("grip", 0.12), fx("attack", 0.4, corner)],
        drawbacks: [fx("pace", -0.8, wetter)],
    },
];

// The traits in use. A shared list that the whole app reads: the saved customisation replaces its content in place.
export const TRAITS = normalizeTraits(DEFAULT_TRAITS);

let BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

export function replaceTraits(list) {
    TRAITS.splice(0, TRAITS.length, ...normalizeTraits(list));
    BY_ID = new Map(TRAITS.map((t) => [t.id, t]));
}

export const getTrait = (id) => BY_ID.get(id);

// A blank trait for a part and tier, with an id that no trait in `list` has
export function newTrait(part, tier, list = TRAITS) {
    const used = new Set(list.map((t) => t.id));
    let id;
    do id = `trait-${Math.random().toString(36).slice(2, 8)}`;
    while (used.has(id));
    return { id, part, tier, name: "New trait", desc: "", effects: [], drawbacks: [] };
}

// The traits a part offers, from the lowest tier up
export const traitsOfPart = (partId) => TRAITS.filter((t) => t.part === partId).sort((a, b) => a.tier - b.tier);

export const traitUnlockAt = (trait) => PART_PERF_TIERS[trait.tier - 1];

export const isUnlocked = (car, trait) => car[trait.part].perf >= traitUnlockAt(trait);

export const unlockedTraits = (car) => TRAITS.filter((t) => isUnlocked(car, t));

// ---------------------------------------------------------------------------------------------
// Circuit context and effect totals
// ---------------------------------------------------------------------------------------------

// What a trait is judged against: the circuit (a trackProfile, or a setup, which carries the same metrics and part weights),
// the race length in laps, the wetness expected over the race (%) and samples of it through the race (so a bot can tell how long
// a wet condition holds), and the number of cars
export const traitContext = ({ metrics, weights }, laps, wet = 0, wets = null, field = 20) => ({
    metrics,
    weights,
    laps,
    wet,
    wets: wets?.length ? wets : [wet],
    tight: metrics.tight,
    field,
});

// The context of a car that expects to start in place `start` and to run around place `rank` when the race has settled (its pace place),
// in a field of ctx.field. The front of the field runs in clean air more of the time than the back. A car that has to climb a long way
// expects to spend much of the race in traffic: the passing traits are worth more to it, defending ones less, it runs in the positions
// between the two and it takes more risks to get there. A car that starts ahead of its pace place is the other way round.
export function gridContext(ctx, start, rank) {
    const climb = start - rank; // places to make up (negative: the car will be passed)
    const pressure = clamp(climb / (ctx.field / 2), -1, 1);
    const stuck = Math.min(1, (Math.max(0, climb) * (0.5 + 1.5 * ctx.tight)) / ctx.laps); // share of the race spent working through the field
    const mid = (start + rank) / 2;
    const front = AI_RANK_TRAFFIC * ((mid - 1) / Math.max(1, ctx.field - 1) - 0.5); // clean air is easier to find in front
    return {
        ...ctx,
        traffic: clamp(AI_STUCK_TRAFFIC + front + AI_GRID_TRAFFIC * stuck - 0.1 * Math.max(0, -pressure), 0.15, 0.9),
        statMult: { attack: Math.max(0.4, 1 + AI_GRID_PUSH * pressure), defend: Math.max(0.4, 1 - AI_GRID_PUSH * pressure) },
        runPos: { from: Math.max(1, Math.min(start, rank) - AI_RUN_SPREAD), to: Math.min(ctx.field, Math.max(start, rank) + AI_RUN_SPREAD) },
        risk: clamp(AI_TRAIT_RISK + AI_TRAFFIC_RISK * Math.max(0, pressure), 0, 0.6),
    };
}

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

const bucketOf = (stat, zone) => (zone && (stat === "attack" || stat === "defend") ? `${stat}${zone === "straight" ? "Zone" : "Corner"}` : stat);

// One effect for a circuit: `scale` applied, the conditions about the circuit settled. What remains is the bucket it feeds, its amount
// and the conditions that are still open during the race; null when the circuit switches it off.
function resolveEffect(e, scale, metrics) {
    let amount = e.amount * scale;
    let zone = null;
    const open = [];
    for (const c of e.when) {
        if (c.type === "track") amount *= rangeFactor(metrics[c.metric] * 100, c);
        else if (c.type === "zone") zone = c.value;
        else open.push(c);
    }
    return amount === 0 ? null : { stat: e.stat, bucket: bucketOf(e.stat, zone), amount, when: open };
}

// The effects of each chosen trait at this circuit, as [{ id, fx, live, lines }]:
//   fx     what the trait always does (every bucket present)
//   live   the effects that depend on the state of the race: [{ bucket, amount, when }]
//   lines  the effects in words, for the UI (the benefits as they come out at this circuit, the drawbacks in full)
export function traitBreakdown(ids, ctx) {
    const out = [];
    for (const id of ids) {
        const t = BY_ID.get(id);
        if (!t) continue;
        const f = traitFit(t, ctx);
        const total = zeroFx();
        const live = [];
        const lines = [];
        for (const [list, scale] of [
            [t.effects, f],
            [t.drawbacks, 1],
        ]) {
            for (const e of list) {
                const r = resolveEffect(e, scale, ctx.metrics);
                if (!r) continue;
                if (r.when.length) live.push(r);
                else total[r.bucket] += r.amount;
                lines.push({ text: effectText({ ...e, when: e.when.filter((c) => c.type !== "track") }, r.amount), bad: isBad(e, r.amount) });
            }
        }
        out.push({ id, fx: total, live, lines });
    }
    return out;
}

// Total of some effect sets, bucket by bucket
export function sumFx(list) {
    const total = zeroFx();
    for (const x of list) for (const k of BUCKETS) total[k] += x[k];
    return total;
}

// The state of a car that the open conditions look at: wet (track wetness %), tyreState (%), following (held up by a car ahead),
// phase (% of the race distance covered), position (null when there is none), chaotic and kind of tyre ("slick" | "inter" | "wet")
export function liveFactor(c, s) {
    switch (c.type) {
        case "air":
            return (c.value === "clean") === !s.following ? 1 : 0;
        case "wet":
            return rangeFactor(s.wet, c);
        case "tyre":
            return rangeFactor(s.tyreState, c);
        case "phase":
            return rangeFactor(s.phase, c);
        case "position":
            return s.position == null ? 0 : rangeFactor(s.position, c);
        case "chaotic":
            return s.chaotic ? 1 : 0;
        case "compound":
            return c.kinds.includes(s.kind) ? 1 : 0;
        default:
            return 1;
    }
}

// What one trait does in a given state: what it always does plus the open effects whose conditions hold, written into `out`
export function traitNow(t, state, out = zeroFx()) {
    for (const k of BUCKETS) out[k] = t.fx[k];
    for (const e of t.live) {
        let f = 1;
        for (const c of e.when) {
            f *= liveFactor(c, state);
            if (f === 0) break;
        }
        if (f !== 0) out[e.bucket] += e.amount * f;
    }
    return out;
}

// The numbers the race reads, from summed effects: the limits that keep the car playable
//   wear is a multiplier on tyre wear, the others are amounts as they are, within their limits
export function resolveFx(total, out = {}) {
    out.pace = total.pace;
    out.grip = Math.min(0.8, total.grip);
    out.wear = Math.max(0.5, 1 - total.wear);
    out.attack = total.attack;
    out.attackZone = total.attackZone;
    out.attackCorner = total.attackCorner;
    out.defend = total.defend;
    out.defendZone = total.defendZone;
    out.defendCorner = total.defendCorner;
    out.tough = Math.min(0.9, total.tough);
    out.quali = total.quali;
    out.errors = Math.max(-0.5, total.errors);
    out.fragile = Math.max(-0.5, total.fragile);
    return out;
}

// ---------------------------------------------------------------------------------------------
// What a bot thinks a trait is worth
// ---------------------------------------------------------------------------------------------

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

const sampleRange = (lo, hi, n, f) => mean(Array.from({ length: n }, (_, i) => f(lo + ((i + 0.5) / n) * (hi - lo))));

const kindAt = (wet) => (wet < 20 ? "slick" : wet < 65 ? "inter" : "wet");

// The share of the race in which an open condition holds, as far as it can be told beforehand
function condFreq(c, stat, ctx) {
    switch (c.type) {
        case "air": {
            const traffic = ctx.traffic ?? AI_STUCK_TRAFFIC;
            return c.value === "clean" ? 1 - traffic : traffic;
        }
        case "wet":
            return mean(ctx.wets.map((w) => rangeFactor(w, c)));
        case "tyre":
            return sampleRange(25, 100, 12, (x) => rangeFactor(x, c)); // a stint runs the tyres from new to about 25%
        case "phase":
            return sampleRange(0, 100, 20, (x) => rangeFactor(x, c));
        case "position": {
            const from = ctx.runPos?.from ?? 1;
            const to = ctx.runPos?.to ?? ctx.field;
            return mean(Array.from({ length: to - from + 1 }, (_, i) => rangeFactor(from + i, c)));
        }
        case "chaotic":
            return Math.min(1, (stat.chaoticMult ?? 1) / ctx.laps);
        case "compound":
            return mean(ctx.wets.map((w) => (c.kinds.includes(kindAt(w)) ? 1 : 0)));
        case "zone":
            return c.value === "straight" ? OVERTAKE_ZONE_SHARE : 1 - OVERTAKE_ZONE_SHARE;
        default:
            return 1;
    }
}

function effectValue(e, scale, ctx) {
    const stat = STATS[e.stat];
    let amount = e.amount * scale;
    let share = 1;
    for (const c of e.when) {
        if (c.type === "track") amount *= rangeFactor(ctx.metrics[c.metric] * 100, c);
        else share *= condFreq(c, stat, ctx);
    }
    return stat.value(amount, ctx) * share * (ctx.statMult?.[e.stat] ?? 1);
}

// What a trait is worth in race seconds at this circuit (drawbacks counted), as a bot reckons it. Bots are a little risk-taking: what a
// drawback costs counts lighter by ctx.risk (a share, AI_TRAIT_RISK unless the context says otherwise).
export function traitValue(trait, ctx) {
    const f = traitFit(trait, ctx);
    const risk = ctx.risk ?? AI_TRAIT_RISK;
    const drawbacks = trait.drawbacks.reduce((s, e) => {
        const v = effectValue(e, 1, ctx);
        return s + (v < 0 ? v * (1 - risk) : v);
    }, 0);
    return trait.effects.reduce((s, e) => s + effectValue(e, f, ctx), 0) + drawbacks;
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
