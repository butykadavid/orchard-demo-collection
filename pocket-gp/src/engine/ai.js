import {
    AI_CLEAN_AIR_BONUS,
    AI_COMPETITIVE_MARGIN,
    AI_GRID_VALUE,
    AI_MAX_STINTS,
    AI_MIN_STINT_FRACTION,
    AI_OUTLAP_LOSS,
    AI_PLAN_TEMPERATURE,
    AI_POSITION_VALUE,
    AI_REPLAN_MARGIN,
    AI_SAFETY_STATE,
    AI_TRAFFIC_BASE,
    AI_TRAFFIC_FLEX,
    AI_TRAFFIC_MARGIN,
    AI_TRAFFIC_MAX,
    AI_TRAFFIC_PER_OVTK,
    AI_TRAFFIC_WINDOW_S,
    AI_UNDERCUT_HORIZON,
    AI_UNDERCUT_RANGE_S,
    PUNCTURE_COST,
    TYRES,
    TYRE_IDS,
} from "./constants.js";
import { cliffPenalty, lapTimeFor, overtakeRate, punctureHazard, tyrePace, wearPerLap } from "./pace.js";
import { repairTimeFor } from "./incidents.js";
import { pitLoss, queueWait } from "./pit.js";
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
    const stopCost = pitLoss(track) + AI_TRAFFIC_BASE + AI_TRAFFIC_PER_OVTK * track.ovtkMultiplier;
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
// `held` ({ L, n }: seconds lost per lap and expected laps still stuck) adds the time lost behind a slower car.
function bestStay(o, tyre, state, damage = 0, held = null) {
    const wear = wearPerLap(tyre, o.lapsTotal);
    const repair = repairTimeFor(damage);
    let best = Infinity;
    let sum = 0;
    for (let k = 1; k <= o.R; k++) {
        const s = Math.max(state - (k - 0.5) * wear, -100);
        sum += (100 - s) / 25 + cliffPenalty(s) + punctureHazard(s) * PUNCTURE_COST + tyrePace(tyre, o.wet[k - 1]) + damage;
        if (held) sum += held.L * clamp(held.n - (k - 1), 0, 1);
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
    const key = `${fraction}|${lapsTotal}|${track.ovtkMultiplier}|${track.pitLane}|${track.optLapTime}`;
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

// ---------------------------------------------------------------------------------------------
// Traffic and rivals. A bot only reasons about what a team can see on track (positions, pace, tyre state);
// it never reads the plans of other cars, human or bot, but assumes how they will behave.
// ---------------------------------------------------------------------------------------------

const freshPace = (race, car, tyre) => lapTimeFor(car.driver, race.track, tyre, 100, race.wet, 0);

// Cars that are racing on track (not retired, finished or in the pit lane)
const racingRivals = (race, car) => race.cars.filter((c) => c !== car && !c.dnf && !c.finished && !c.pit && c.pos >= 0);

// Time per lap the bot is losing behind a slower car (L) and how many laps it expects to remain stuck (n).
// Stuck for longer when the car ahead is about as fast or the track is hard to pass on; a damaged car is slower,
// so it is stuck for longer as well.
function heldLoss(car, race, o) {
    const ahead = car.following ? car.aheadCar : null;
    if (!ahead || ahead.dnf || ahead.finished || ahead.pit) return null;
    const L = (car.trafficLoss + car.lossAcc) / 2;
    if (L < 0.05) return null;
    const rate = overtakeRate(ahead.pace - car.pace, race.track.ovtkMultiplier, car.chaseLaps);
    return { L, n: clamp(1 / Math.max(rate, 0.08), 0.5, o.R) };
}

// Expected time lost behind slower cars after a stop: the cars that would be just ahead where the bot rejoins
// (it falls back by the pit time plus any repair and wait for the crew, on a fresh and therefore usually quicker car) each hold it up
// until it is past; the harder the track is to overtake on, the longer.
function rejoinTraffic(car, race, pos, o, tyre, repair, wait, rivals) {
    const mine = freshPace(race, car, tyre);
    const rejoinPos = pos - (pitLoss(race.track) + repair + wait) / car.pace;
    let cost = 0;
    for (const c of rivals) {
        if (c.pos <= rejoinPos || (c.pos - rejoinPos) * mine > AI_TRAFFIC_WINDOW_S) continue;
        const L = c.pace - mine;
        if (L <= 0) continue;
        const rate = overtakeRate(L, race.track.ovtkMultiplier, 0);
        cost += L * clamp(1 / Math.max(rate, 0.08), 0.3, o.R);
    }
    return Math.min(cost, AI_TRAFFIC_MAX);
}

// Worth (in seconds) of gaining or holding a position by stopping now: an undercut on the car ahead (fresh
// tyres make up the gap before it stops itself) or a cover stop against a car behind that could do that to us.
// The rival's stop is not known; it is assumed to come when its tyres are worn.
function positionBonus(car, race, pos, tyre, rivals, stopIn) {
    let ahead = null;
    let behind = null;
    for (const c of rivals) {
        if (c.pos > pos) {
            if (!ahead || c.pos < ahead.pos) ahead = c;
        } else if (!behind || c.pos > behind.pos) behind = c;
    }

    let gain = false;
    if (ahead) {
        const gap = (ahead.pos - pos) * car.pace;
        if (gap <= AI_UNDERCUT_RANGE_S) {
            const laps = clamp((ahead.tyreState - 25) / wearPerLap(ahead.tyre, race.lapsTotal), 1, AI_UNDERCUT_HORIZON);
            gain = (ahead.pace - freshPace(race, car, tyre)) * laps - gap - AI_OUTLAP_LOSS > 0;
        }
    }
    if (!gain && behind) {
        const gap = (pos - behind.pos) * behind.pace;
        if (gap <= AI_UNDERCUT_RANGE_S) {
            gain = (car.pace - freshPace(race, behind, tyre)) * clamp(stopIn, 1, AI_UNDERCUT_HORIZON) - gap - AI_OUTLAP_LOSS > 0;
        }
    }
    return gain ? AI_POSITION_VALUE * (car.aggression ?? 1) : 0;
}

// Plan stints that are still to come are stretched or squeezed to fit the laps that remain after an early or late stop
function respreadPlan(car, laps) {
    const rest = car.plan.slice(car.stintIdx + 1);
    const total = rest.reduce((s, p) => s + p.laps, 0);
    if (rest.length < 2 || total <= 0) return;
    for (const p of rest) p.laps = Math.max(3, Math.round((p.laps * laps) / total));
}

// Called when a bot reaches the pit entry. Returns the tyre to fit, or null to stay out.
// Bots follow their planned stints, but every lap they compare that against the best alternative given the
// weather they currently expect. When following the plan would cost clearly more (wrong tyres for coming rain,
// tyres failing early, damage, a puncture) the plan is dropped and the cheapest option is taken instead.
// On top of that they react to traffic without abandoning the plan: stuck behind a slower car, or facing a
// rejoin into a queue, they pull a stop forward (to get into clean air or undercut) or push it back (overcut,
// or let the queue clear) by a few laps, if that saves time. Damage counts in all of these comparisons.
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
    const stintLaps = Math.floor(pos) + 1 - car.stintStart;
    const current = car.plan?.[car.stintIdx];
    const next = car.plan?.[car.stintIdx + 1];
    const plannedStop = current ? current.laps + car.jitter : null;
    const stopIn = Math.max(1, plannedStop !== null ? plannedStop - stintLaps : (car.tyreState - 25) / wearPerLap(car.tyre, race.lapsTotal));

    // Costs as if the track was empty: used to decide whether the plan itself is still sound
    const stay0 = bestStay(o, car.tyre, car.tyreState, car.damage);
    const stopNow0 = o.stopCost + repair + o.g[0].cost + bias;

    // Costs with the traffic around: time lost while stuck, the rejoin position, and the undercut/cover value
    const held = heldLoss(car, race, o);
    const rivals = racingRivals(race, car);
    const flatTraffic = AI_TRAFFIC_BASE + AI_TRAFFIC_PER_OVTK * race.track.ovtkMultiplier;
    // The crew can only service one car of the team at a time: if a team mate is in the box, stopping now means waiting.
    // That is a tactical cost only (it passes), so it is not part of the plan soundness checks above.
    const wait = queueWait(race, car);
    const stopCostWith = (tyre, futureCost) => {
        const traffic = clamp(rejoinTraffic(car, race, pos, o, tyre, repair, wait, rivals) - flatTraffic, -AI_CLEAN_AIR_BONUS, AI_TRAFFIC_MAX);
        return o.stopCost + wait + traffic - positionBonus(car, race, pos, tyre, rivals, stopIn) + repair + futureCost + bias;
    };
    const stay = held ? bestStay(o, car.tyre, car.tyreState, car.damage, held) : stay0;

    if (car.plan) {
        const worn = !!next && car.tyreState - wearPerLap(car.tyre, race.lapsTotal) < AI_SAFETY_STATE;
        const due = !!next && (stintLaps >= plannedStop || worn);
        const planCost0 = due ? o.stopCost + repair + o.gc[0][next.tyre] + bias : stay0;
        if (planCost0 - Math.min(stay0, stopNow0) > AI_REPLAN_MARGIN) {
            car.plan = null;
        } else {
            if (next && !worn) {
                const margin = AI_TRAFFIC_MARGIN / (car.aggression ?? 1);
                const stopNext = stopCostWith(next.tyre, o.gc[0][next.tyre]);
                // Early stop: out of the traffic or ahead of a rival
                if (!due && plannedStop - stintLaps <= AI_TRAFFIC_FLEX && stopNext < stay - margin) {
                    respreadPlan(car, remaining);
                    return next.tyre;
                }
                // Late stop: the rejoin would be in a queue (or a rival's stop is about to open the road)
                if (due && stintLaps - plannedStop < AI_TRAFFIC_FLEX && stay < stopNext - margin) return null;
            }
            if (due) {
                respreadPlan(car, remaining);
                return next.tyre;
            }
            return null;
        }
    }

    return stopCostWith(o.g[0].tyre, o.g[0].cost) < stay ? o.g[0].tyre : null;
}

export function tyreName(id) {
    return TYRES[id].name;
}
