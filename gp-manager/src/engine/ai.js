import {
    AI_COMPETITIVE_MARGIN,
    AI_GRID_VALUE,
    AI_MAX_STINTS,
    AI_MIN_STINT_FRACTION,
    AI_PLAN_TEMPERATURE,
    AI_REPLAN_MARGIN,
    AI_SAFETY_STATE,
    AI_TRAFFIC_BASE,
    AI_TRAFFIC_PER_OVTK,
    PIT_LOSS,
    PUNCTURE_COST,
    TYRES,
    TYRE_IDS,
} from "./constants.js";
import { cliffPenalty, punctureHazard, tyrePace, wearPerLap } from "./pace.js";
import { repairTimeFor } from "./incidents.js";
import { predictWater } from "./weather.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------------------------
// Outlook: what a bot expects the rest of the race to cost, given the weather it expects.
// Laps are counted from "now" (index 0 = the next lap to be run).
// ---------------------------------------------------------------------------------------------

// Expected track wetness for the next `count` laps. The first value is the real current wetness; later values
// follow the forecast, scaled by how much the bot trusts it (`foresight`).
function wetProfile(weather, fraction, nowLap, nowWet, count, foresight) {
    const base = predictWater(weather, fraction, nowLap, nowLap);
    const out = new Float64Array(count + 1);
    for (let k = 0; k <= count; k++) {
        out[k] = clamp(nowWet + (predictWater(weather, fraction, nowLap, nowLap + k) - base) * foresight, 0, 100);
    }
    return out;
}

// Cost tables for covering `R` laps under the expected wetness `wet`. All costs are extra seconds versus an
// ideal lap: tyre wear, the tyre cliff, the expected cost of punctures and the pace of the compound in the
// conditions of that particular lap, plus the cost of every stop (pit loss and rejoining in traffic, which
// hurts more on tracks where overtaking is hard).
function buildOutlook(wet, R, lapsTotal, track) {
    const stopCost = PIT_LOSS + AI_TRAFFIC_BASE + AI_TRAFFIC_PER_OVTK * track.ovtkMultiplier;
    const pace = {}; // pace[c][j] = summed compound pace of laps 0..j-1
    const wearCost = {}; // wearCost[c][n] = wear related cost of n laps on a fresh set
    for (const c of TYRE_IDS) {
        const p = new Float64Array(R + 1);
        for (let j = 0; j < R; j++) p[j + 1] = p[j] + tyrePace(c, wet[j]);
        pace[c] = p;
        const w = new Float64Array(R + 1);
        const wear = wearPerLap(c, lapsTotal);
        for (let n = 1; n <= R; n++) {
            const s = Math.max(100 - (n - 0.5) * wear, -100);
            w[n] = w[n - 1] + (100 - s) / 25 + cliffPenalty(s) + punctureHazard(s) * PUNCTURE_COST;
        }
        wearCost[c] = w;
    }

    // Cost of running laps j..j+n-1 on a fresh set of compound c
    const stint = (c, j, n) => wearCost[c][n] + pace[c][j + n] - pace[c][j];

    // g[j] = cheapest way to cover laps j..R-1 starting on a fresh set (any number of stops), gc[j][c] per compound
    const g = new Array(R + 1);
    const gc = new Array(R + 1);
    g[R] = { cost: 0, tyre: "m" };
    gc[R] = {};
    for (let j = R - 1; j >= 0; j--) {
        const row = {};
        let best = { cost: Infinity, tyre: "m" };
        for (const c of TYRE_IDS) {
            let bestC = Infinity;
            for (let n = 1; n <= R - j; n++) {
                const cost = stint(c, j, n) + (j + n < R ? stopCost + g[j + n].cost : 0);
                if (cost < bestC) bestC = cost;
            }
            row[c] = bestC;
            if (bestC < best.cost) best = { cost: bestC, tyre: c };
        }
        g[j] = best;
        gc[j] = row;
    }

    // Compounds that are competitive (within the margin of the fastest) at some point of the race
    const candidates = TYRE_IDS.filter((c) => {
        for (let j = 0; j < R; j++) {
            const fastest = Math.min(...TYRE_IDS.map((t) => tyrePace(t, wet[j])));
            if (tyrePace(c, wet[j]) <= fastest + AI_COMPETITIVE_MARGIN) return true;
        }
        return false;
    });

    return { R, wet, lapsTotal, stopCost, stint, g, gc, candidates, pace };
}

// Cheapest way to keep running the current tyre for at least one more lap and stop later (or never).
// Damage adds its lap time penalty to every lap that is stayed out; a later stop pays the repair time as well.
function bestStay(o, tyre, state, damage = 0) {
    const wear = wearPerLap(tyre, o.lapsTotal);
    const repair = repairTimeFor(damage);
    let best = Infinity;
    let sum = 0;
    for (let k = 1; k <= o.R; k++) {
        const s = Math.max(state - (k - 0.5) * wear, -100);
        sum += (100 - s) / 25 + cliffPenalty(s) + punctureHazard(s) * PUNCTURE_COST + tyrePace(tyre, o.wet[k - 1]) + damage;
        const cost = k < o.R ? sum + o.stopCost + repair + o.g[k].cost : sum;
        if (cost < best) best = cost;
    }
    return best;
}

function outlookFor(car, race, pos) {
    const R = Math.max(1, race.lapsTotal - Math.floor(pos) - 1);
    const leaderPos = Math.max(race.order[0].pos, 0);
    const wet = wetProfile(race.weather, race.fraction, leaderPos, race.wet, R, car.foresight ?? 1);
    return buildOutlook(wet, R, race.lapsTotal, race.track);
}

// ---------------------------------------------------------------------------------------------
// Pre-race planning (cached per race): every sensible compound sequence with optimal stint lengths
// ---------------------------------------------------------------------------------------------

const cache = new WeakMap();

function startEntry(weather, fraction, track, lapsTotal) {
    let byKey = cache.get(weather);
    if (!byKey) cache.set(weather, (byKey = new Map()));
    const key = `${fraction}|${lapsTotal}|${track.ovtkMultiplier}`;
    let entry = byKey.get(key);
    if (!entry) {
        const nowWet = predictWater(weather, fraction, 0, 0);
        const wet = wetProfile(weather, fraction, 0, nowWet, lapsTotal, 1);
        entry = { outlook: buildOutlook(wet, lapsTotal, lapsTotal, track), plans: null };
        byKey.set(key, entry);
    }
    return entry;
}

function getPlans(entry) {
    if (entry.plans) return entry.plans;
    const { outlook: o } = entry;
    const m = o.R;
    const minLen = Math.max(3, Math.ceil(m * AI_MIN_STINT_FRACTION));
    const maxStints = Math.max(1, Math.min(AI_MAX_STINTS, Math.floor(m / minLen)));

    const optimise = (seq) => {
        let prev = new Float64Array(m + 1).fill(Infinity);
        prev[0] = 0;
        const choices = [];
        for (let j = 0; j < seq.length; j++) {
            const cur = new Float64Array(m + 1).fill(Infinity);
            const choice = new Int16Array(m + 1);
            for (let t = minLen * (j + 1); t <= m; t++) {
                for (let n = minLen; n <= t - minLen * j; n++) {
                    const c = prev[t - n] + o.stint(seq[j], t - n, n);
                    if (c < cur[t]) {
                        cur[t] = c;
                        choice[t] = n;
                    }
                }
            }
            choices.push(choice);
            prev = cur;
        }
        if (!Number.isFinite(prev[m])) return null;
        const laps = new Array(seq.length);
        let t = m;
        for (let j = seq.length - 1; j >= 0; j--) {
            laps[j] = choices[j][t];
            t -= laps[j];
        }
        return { seq: seq.slice(), laps, cost: prev[m] + (seq.length - 1) * o.stopCost };
    };

    const plans = [];
    const seq = [];
    const extend = () => {
        if (seq.length > 0) {
            const plan = optimise(seq);
            if (plan) plans.push(plan);
        }
        if (seq.length === maxStints) return;
        for (const c of o.candidates) {
            seq.push(c);
            extend();
            seq.pop();
        }
    };
    extend();

    entry.plans = plans;
    return plans;
}

// Random pick weighted by exp(-extra cost / temperature): near-optimal options are about equally likely.
function sampleByCost(items, costOf, rng) {
    const costs = items.map(costOf);
    const min = Math.min(...costs);
    const weights = costs.map((c) => Math.exp(-(c - min) / AI_PLAN_TEMPERATURE));
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

// ---------------------------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------------------------

// Starting tyre (also used in qualifying): best expected race plan for that compound under the forecast, minus
// the value of the grid positions a faster compound gains in qualifying. Near-equal options are picked at random.
export function pickStartTyre(weather, fraction, track, rng, lapsTotal) {
    const entry = startEntry(weather, fraction, track, lapsTotal);
    const plans = getPlans(entry);
    const { candidates, wet } = entry.outlook;
    const slowest = Math.max(...candidates.map((c) => tyrePace(c, wet[0])));
    const options = candidates
        .map((tyre) => {
            const costs = plans.filter((p) => p.seq[0] === tyre).map((p) => p.cost);
            return { tyre, cost: Math.min(...costs) - AI_GRID_VALUE * (slowest - tyrePace(tyre, wet[0])) };
        })
        .filter((o) => Number.isFinite(o.cost));
    return sampleByCost(options, (o) => o.cost, rng).tyre;
}

// Race plan for a bot that starts on `startTyre`: [{ tyre, laps }, ...]. Null when no plan fits.
export function choosePlan(rng, startTyre, weather, fraction, track, lapsTotal) {
    const options = getPlans(startEntry(weather, fraction, track, lapsTotal)).filter((p) => p.seq[0] === startTyre);
    if (options.length === 0) return null;
    const plan = sampleByCost(options, (p) => p.cost, rng);
    return plan.seq.map((tyre, i) => ({ tyre, laps: plan.laps[i] }));
}

// Tyre for an unplanned stop (puncture) - cheapest way to cover the remaining laps in the expected weather.
export function emergencyTyre(race, car) {
    return outlookFor(car, race, car.pos).g[0].tyre;
}

// Called when a bot reaches the pit entry. Returns the tyre to fit, or null to stay out.
// Bots follow their planned stints, but every lap they compare that against the best alternative given the
// weather they currently expect. When following the plan would cost clearly more (wrong tyres for coming rain,
// tyres failing early, a puncture) the plan is dropped and the cheapest option is taken instead.
export function decideBotPit(car, race, pos = car.pos) {
    const remaining = race.lapsTotal - Math.floor(pos) - 1;
    if (remaining < 1) return null;

    const o = outlookFor(car, race, pos);
    if (car.punctured) {
        car.plan = null;
        return o.g[0].tyre;
    }

    const bias = (car.pitThreshold - 38) * 0.15; // some teams stop a little earlier or later than others
    const repair = repairTimeFor(car.damage);
    const stay = bestStay(o, car.tyre, car.tyreState, car.damage);
    const stopNow = o.stopCost + repair + o.g[0].cost + bias;

    if (car.plan) {
        const current = car.plan[car.stintIdx];
        const next = car.plan[car.stintIdx + 1];
        let stop = false;
        let planCost = stay;
        if (next) {
            const stintLaps = Math.floor(pos) + 1 - car.stintStart;
            const worn = car.tyreState - wearPerLap(car.tyre, race.lapsTotal) < AI_SAFETY_STATE;
            stop = stintLaps >= current.laps + car.jitter || worn;
            if (stop) planCost = o.stopCost + repair + o.gc[0][next.tyre] + bias;
        }
        if (planCost - Math.min(stay, stopNow) <= AI_REPLAN_MARGIN) return stop ? next.tyre : null;
        car.plan = null;
    }

    return stopNow < stay ? o.g[0].tyre : null;
}

export function tyreName(id) {
    return TYRES[id].name;
}
