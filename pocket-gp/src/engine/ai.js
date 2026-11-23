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
import { cliffPenalty, lapTimeFor, overtakeRate, passFactor, punctureHazard, tyrePace, wearPerLap } from "./pace.js";
import { repairTimeFor } from "./incidents.js";
import { neutralShare, pitLoss, pitLossNow, queueWait } from "./pit.js";
import { legalTyres, tyreRuleMet } from "./rules.js";
import { predictWater } from "./weather.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------------------------
// Outlook: what a bot expects the rest of the race to cost, given the weather it expects.
// Laps are counted from "now" (index 0 = the next lap to be run).
// ---------------------------------------------------------------------------------------------

// Expected track wetness for the next `count` laps. The first value is the real current wetness; later values
// follow the forecast, scaled by how much the bot trusts it (`foresight`). `nowS` is the race clock; the laps are
// assumed to take the reference lap time, the weather itself moves with the clock.
function wetProfile(weather, fraction, nowS, nowWet, count, foresight) {
    const base = predictWater(weather, fraction, nowS, nowS);
    const out = new Float64Array(count + 1);
    for (let k = 0; k <= count; k++) {
        out[k] = clamp(nowWet + (predictWater(weather, fraction, nowS, nowS + k * weather.lapS) - base) * foresight, 0, 100);
    }
    return out;
}

// Cost tables for covering `R` laps under the expected wetness `wet`. All costs are extra seconds versus an
// ideal lap: tyre wear, the tyre cliff, the expected cost of punctures and the pace of the compound in the
// conditions of that particular lap, plus the cost of every stop (pit loss and rejoining in traffic, which
// hurts more on tracks where overtaking is hard).
// `lapsTotal` only sets how fast tyres wear (wear scales with race length): pass the race length divided by the car's wear multiplier.
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
    // gn[j][c] = the stint length (laps) that achieves it
    const g = new Array(R + 1);
    const gc = new Array(R + 1);
    const gn = new Array(R + 1);
    g[R] = { cost: 0, tyre: "m" };
    gc[R] = {};
    gn[R] = {};
    for (let j = R - 1; j >= 0; j--) {
        const row = {};
        const rowN = {};
        let best = { cost: Infinity, tyre: "m" };
        for (const c of TYRE_IDS) {
            let bestC = Infinity;
            let bestN = 1;
            for (let n = 1; n <= R - j; n++) {
                const cost = stint(c, j, n) + (j + n < R ? stopCost + g[j + n].cost : 0);
                if (cost < bestC) {
                    bestC = cost;
                    bestN = n;
                }
            }
            row[c] = bestC;
            rowN[c] = bestN;
            if (bestC < best.cost) best = { cost: bestC, tyre: c };
        }
        g[j] = best;
        gc[j] = row;
        gn[j] = rowN;
    }

    // Compounds that are competitive (within the margin of the fastest) at some point of the race
    const candidates = TYRE_IDS.filter((c) => {
        for (let j = 0; j < R; j++) {
            const fastest = Math.min(...TYRE_IDS.map((t) => tyrePace(t, wet[j])));
            if (tyrePace(c, wet[j]) <= fastest + AI_COMPETITIVE_MARGIN) return true;
        }
        return false;
    });

    return { R, wet, lapsTotal, stopCost, stint, g, gc, gn, candidates, pace };
}

// Cheapest way to cover laps j.. starting on a fresh set; `legal` (compounds that satisfy the tyre rule) limits the first compound
function cheapest(o, j, legal) {
    if (!legal) return o.g[j];
    let best = { cost: Infinity, tyre: legal[0] };
    for (const c of legal) if (o.gc[j][c] < best.cost) best = { cost: o.gc[j][c], tyre: c };
    return best;
}

// Cheapest way to keep running the current tyre for at least one more lap and stop later (or never).
// Damage adds its lap time penalty to every lap that is stayed out; a later stop pays the repair time as well.
// `held` ({ L, n }: seconds lost per lap and expected laps still stuck) adds the time lost behind a slower car.
// `legal` is set while the tyre rule is not met yet: the car then has to stop later, onto one of those compounds.
function bestStay(o, tyre, state, damage = 0, held = null, legal = null) {
    const wear = wearPerLap(tyre, o.lapsTotal);
    const repair = repairTimeFor(damage);
    let best = Infinity;
    let sum = 0;
    for (let k = 1; k <= o.R; k++) {
        const s = Math.max(state - (k - 0.5) * wear, -100);
        sum += (100 - s) / 25 + cliffPenalty(s) + punctureHazard(s) * PUNCTURE_COST + tyrePace(tyre, o.wet[k - 1]) + damage;
        if (held) sum += held.L * clamp(held.n - (k - 1), 0, 1);
        const cost = k < o.R ? sum + o.stopCost + repair + cheapest(o, k, legal).cost : legal ? Infinity : sum;
        if (cost < best) best = cost;
    }
    return best;
}

// `laps` overrides the number of laps still to run (by default the laps after the one the car is in)
function outlookFor(car, race, pos, laps = null) {
    const R = laps ?? Math.max(1, race.lapsTotal - Math.floor(pos) - 1);
    const wet = wetProfile(race.weather, race.fraction, race.clock, race.wet, R, car.foresight ?? 1);
    return buildOutlook(wet, R, race.lapsTotal / car.live.wear, race.track);
}

// ---------------------------------------------------------------------------------------------
// Pre-race planning (cached per race): every sensible compound sequence with optimal stint lengths
// ---------------------------------------------------------------------------------------------

const cache = new WeakMap();

function startEntry(weather, fraction, track, lapsTotal, wearMult) {
    let byKey = cache.get(weather);
    if (!byKey) cache.set(weather, (byKey = new Map()));
    const key = `${fraction}|${lapsTotal}|${wearMult.toFixed(3)}|${track.ovtkMultiplier}|${track.pitLane}|${track.optLapTime}`;
    let entry = byKey.get(key);
    if (!entry) {
        const nowWet = predictWater(weather, fraction, 0, 0);
        const wet = wetProfile(weather, fraction, 0, nowWet, lapsTotal, 1);
        entry = { outlook: buildOutlook(wet, lapsTotal, lapsTotal / wearMult, track), plans: null };
        byKey.set(key, entry);
    }
    return entry;
}

function getPlans(entry) {
    if (entry.plans) return entry.plans;
    const { outlook: o } = entry;
    const m = o.R;
    const minLen = Math.max(1, Math.min(Math.max(3, Math.ceil(m * AI_MIN_STINT_FRACTION)), Math.floor(m / 2)));
    const maxStints = Math.max(2, Math.min(AI_MAX_STINTS, Math.floor(m / minLen))); // the tyre rule needs at least two stints

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
        if (seq.length > 0 && tyreRuleMet(seq.join(""))) {
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
export function pickStartTyre(weather, fraction, track, rng, lapsTotal, wearMult = 1) {
    const entry = startEntry(weather, fraction, track, lapsTotal, wearMult);
    const plans = getPlans(entry);
    const { candidates, wet } = entry.outlook;
    const slowest = Math.max(...candidates.map((c) => tyrePace(c, wet[0])));
    const options = candidates
        .map((tyre) => {
            const costs = plans.filter((p) => p.seq[0] === tyre).map((p) => p.cost);
            return { tyre, cost: Math.min(...costs) - AI_GRID_VALUE * (slowest - tyrePace(tyre, wet[0])) };
        })
        .filter((o) => Number.isFinite(o.cost));
    if (options.length === 0) return candidates[0] ?? "m";
    return sampleByCost(options, (o) => o.cost, rng).tyre;
}

// Race plan for a bot that starts on `startTyre`: [{ tyre, laps }, ...]. Null when no plan fits.
export function choosePlan(rng, startTyre, weather, fraction, track, lapsTotal, wearMult = 1) {
    const options = getPlans(startEntry(weather, fraction, track, lapsTotal, wearMult)).filter((p) => p.seq[0] === startTyre);
    if (options.length === 0) return null;
    const plan = sampleByCost(options, (p) => p.cost, rng);
    return plan.seq.map((tyre, i) => ({ tyre, laps: plan.laps[i] }));
}

// Tyre for an unplanned stop (puncture) - cheapest way to cover the remaining laps in the expected weather,
// on a compound that satisfies the tyre rule if it is not met yet.
export function emergencyTyre(race, car) {
    const legal = tyreRuleMet(car.allTyres) ? null : legalTyres(car.allTyres);
    return cheapest(outlookFor(car, race, car.pos), 0, legal).tyre;
}

// Free tyre change under a red flag: the tyre and the new stint plan that cover the `laps` laps still to run most cheaply
// in the weather expected at the restart (a compound that satisfies the tyre rule if it is not met yet).
// A bot that has stops left in its plan treats the free set like a stop it never had to pay for.
export function planRestart(race, car, laps) {
    const o = outlookFor(car, race, car.pos, Math.max(1, laps));
    const legal = tyreRuleMet(car.allTyres) ? null : legalTyres(car.allTyres);
    const { tyre } = cheapest(o, 0, legal);
    const plan = [];
    let lap = 0;
    let c = tyre;
    while (lap < o.R) {
        const n = o.gn[lap][c];
        plan.push({ tyre: c, laps: n });
        lap += n;
        if (lap < o.R) c = o.g[lap].tyre;
    }
    return { tyre, plan };
}

// ---------------------------------------------------------------------------------------------
// Traffic and rivals. A bot only reasons about what a team can see on track (positions, pace, tyre state);
// it never reads the plans of other cars, human or bot, but assumes how they will behave.
// ---------------------------------------------------------------------------------------------

const freshPace = (race, car, tyre) => lapTimeFor(car.driver, car.live, race.track, tyre, 100, race.wet, 0);

// Cars that are racing on track (not retired, finished or in the pit lane)
const racingRivals = (race, car) => race.cars.filter((c) => c !== car && !c.dnf && !c.finished && !c.pit && !c.parked && c.pos >= 0);

// Time per lap the bot is losing behind a slower car (L) and how many laps it expects to remain stuck (n).
// Stuck for longer when the car ahead is about as fast or the track is hard to pass on; a damaged car is slower,
// so it is stuck for longer as well.
function heldLoss(car, race, o) {
    const ahead = car.following ? car.aheadCar : null;
    if (!ahead || ahead.dnf || ahead.finished || ahead.pit) return null;
    const L = (car.trafficLoss + car.lossAcc) / 2;
    if (L < 0.05) return null;
    const rate = overtakeRate(ahead.pace - car.pace, race.track.ovtkMultiplier, car.chaseLaps, passFactor(car.live, ahead.live));
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
        const rate = overtakeRate(L, race.track.ovtkMultiplier, 0, passFactor(car.live, c.live));
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
            const laps = clamp((ahead.tyreState - 25) / wearPerLap(ahead.tyre, race.lapsTotal, ahead.live.wear), 1, AI_UNDERCUT_HORIZON);
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
// Under a safety car or virtual safety car the field is slow, so a stop through the pit lane costs much less: bots weigh
// that cheaper stop against staying out (and paying the full price later), which brings in cars with worn tyres or a stop
// due soon. The saving only exists for the part of the stop that is still under the neutralisation: a stop made while the
// safety car is coming in (or the virtual safety car is about to end) costs nearly the full price, with the rejoin into the
// released field on top, so bots do not rush into the pits then. Nobody can pass while the race is neutralised, so traffic
// and undercuts play no part when the whole stop is covered by it. Laps behind a safety car wear the tyres much less than
// racing laps, so they count for less when a stint is measured against its plan.
export function decideBotPit(car, race, pos = car.pos) {
    const remaining = race.lapsTotal - Math.floor(pos) - 1;
    if (remaining < 1) return null;

    const o = outlookFor(car, race, pos);
    // Tyre rule: until two different compounds have been fitted, the next stop has to bring a different one, and a stop is
    // mandatory. The last pit entry before the final lap is the last chance, so the bot takes it whatever it costs.
    const legal = tyreRuleMet(car.allTyres) ? null : legalTyres(car.allTyres);
    const first = cheapest(o, 0, legal);
    if (car.punctured || (legal && remaining <= 1)) {
        car.plan = null;
        return first.tyre;
    }

    const bias = (car.pitThreshold - 38) * 0.15; // some teams stop a little earlier or later than others
    const repair = repairTimeFor(car.damage);
    const stintLaps = Math.floor(pos) + 1 - car.stintStart - Math.round(car.neutralSaved);
    const current = car.plan?.[car.stintIdx];
    const next = car.plan?.[car.stintIdx + 1];
    const plannedStop = current ? current.laps + car.jitter : null;
    const stopIn = Math.max(1, plannedStop !== null ? plannedStop - stintLaps : (car.tyreState - 25) / wearPerLap(car.tyre, race.lapsTotal, car.live.wear));

    // Costs as if the track was empty: used to decide whether the plan itself is still sound
    const stay0 = bestStay(o, car.tyre, car.tyreState, car.damage, null, legal);
    const stopNow0 = o.stopCost + repair + first.cost + bias;

    // Costs with the traffic around: time lost while stuck, the rejoin position, and the undercut/cover value
    const flatTraffic = AI_TRAFFIC_BASE + AI_TRAFFIC_PER_OVTK * race.track.ovtkMultiplier;
    // The crew can only service one car of the team at a time: if a team mate is in the box, stopping now means waiting.
    // That is a tactical cost only (it passes), so it is not part of the plan soundness checks above.
    const wait = queueWait(race, car);
    // Share of the stop (drive through the lane, service, repair, wait) that is still made under the neutralisation:
    // the saving of a cheap stop shrinks to nothing as the safety car comes in or the virtual safety car runs out
    const slowShare = neutralShare(race, repair + wait);
    const neutral = slowShare >= 1; // the whole stop is covered: the field stays slow, nobody can pass
    // what a stop made right now costs
    const nowStop = neutral ? pitLossNow(race, 1) : slowShare > 0 ? pitLossNow(race, slowShare) + flatTraffic : o.stopCost;
    const held = neutral ? null : heldLoss(car, race, o);
    const rivals = racingRivals(race, car);
    const stopCostWith = (tyre, futureCost) => {
        const traffic = neutral ? 0 : clamp(rejoinTraffic(car, race, pos, o, tyre, repair, wait, rivals) - flatTraffic, -AI_CLEAN_AIR_BONUS, AI_TRAFFIC_MAX);
        const bonus = neutral ? 0 : positionBonus(car, race, pos, tyre, rivals, stopIn);
        return nowStop + wait + traffic - bonus + repair + futureCost + bias;
    };
    const stay = held ? bestStay(o, car.tyre, car.tyreState, car.damage, held, legal) : stay0;

    if (car.plan) {
        const worn = !!next && car.tyreState - wearPerLap(car.tyre, race.lapsTotal, car.live.wear) < AI_SAFETY_STATE;
        const due = !!next && (stintLaps >= plannedStop || worn);
        const planCost0 = due ? o.stopCost + repair + o.gc[0][next.tyre] + bias : stay0;
        if (planCost0 - Math.min(stay0, stopNow0) > AI_REPLAN_MARGIN) {
            car.plan = null;
        } else {
            if (next && !worn) {
                const margin = AI_TRAFFIC_MARGIN / (car.aggression ?? 1);
                const stopNext = stopCostWith(next.tyre, o.gc[0][next.tyre]);
                // Early stop: out of the traffic or ahead of a rival (under a safety car: any stop that the cheap pit lane makes worthwhile)
                if (!due && (neutral || plannedStop - stintLaps <= AI_TRAFFIC_FLEX) && stopNext < stay - margin) {
                    respreadPlan(car, remaining);
                    return next.tyre;
                }
                // Late stop: the rejoin would be in a queue (or a rival's stop is about to open the road)
                if (due && !neutral && stintLaps - plannedStop < AI_TRAFFIC_FLEX && stay < stopNext - margin) return null;
            }
            if (due) {
                respreadPlan(car, remaining);
                return next.tyre;
            }
            return null;
        }
    }

    return stopCostWith(first.tyre, first.cost) < stay ? first.tyre : null;
}

export function tyreName(id) {
    return TYRES[id].name;
}
