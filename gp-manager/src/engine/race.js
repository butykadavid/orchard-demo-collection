import {
    ATTEMPTS_PER_LAP,
    CLOSE_RATE,
    CRASH_CHAIN,
    CRASH_PER_ATTEMPT,
    CRASH_RANGE_S,
    ERROR_PER_RACE,
    FOLLOW_GAP_S,
    LAP1_INCIDENT_MULT,
    LAP1_OVERTAKE_MIN_RATE,
    LAP1_OVERTAKE_MULT,
    MECH_FAIL_PER_RACE,
    MIN_GAP_S,
    OVERTAKE_ZONES,
    OVTK_EASY_LEVEL,
    OVTK_HARDNESS_EXP,
    OVERTAKE_ZONE_SHARE,
    OVERTAKE_ZONE_WIDTH,
    PIT_DURATION,
    PIT_ENTRY,
    PIT_LANE_FACTOR,
    PUNCTURE_SPEED,
    RECOVER_SPEED,
    SECTORS,
    START_CORNER,
    START_CRASH_CHANCE,
    START_GAP_S,
} from "./constants.js";
import { choosePlan, decideBotPit, emergencyTyre, tyreName } from "./ai.js";
import { addDamage, damageLabel, repairTimeFor, rollIncident } from "./incidents.js";
import { lapNoise, lapTimeFor, lapsTotalFor, punctureHazard, wearPerLap } from "./pace.js";
import { waterAt, rainAt } from "./weather.js";

const MECH_REASONS = ["engine failure", "gearbox failure", "hydraulics failure", "overheating", "brake failure", "electrical problem"];
const ERROR_REASONS = ["spins and hits the barrier", "goes off and is stuck in the gravel", "crashes out"];

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------------------------

export function createRace({ grid, track, weather, fraction, playerTeam, rng }) {
    const lapsTotal = lapsTotalFor(track, fraction);

    const cars = grid.map((g) => ({
        driver: g.driver,
        code: g.driver.code,
        name: g.driver.name,
        team: g.driver.team,
        color: g.driver.color,
        isPlayer: playerTeam !== null && playerTeam !== undefined && g.driver.team === playerTeam,
        gridPos: g.gridPos,
        pos: (-(g.gridPos - 1) * START_GAP_S) / track.optLapTime, // in laps, negative = behind the line
        prevPos: 0,
        speed: 0,
        pace: track.optLapTime,
        noise: lapNoise(rng),
        tyre: g.tyre,
        tyreState: 100,
        allTyres: g.tyre,
        stops: 0,
        pitThreshold: rng.int(26, 51),
        pit: null,
        pitRequest: null,
        punctured: false,
        damage: 0, // lap time penalty (s per lap) until repaired in the pits
        recover: 0, // seconds still to spend crawling after a spin or contact
        dnf: null,
        plan: null, // bot race strategy: [{ tyre, laps }]
        stintIdx: 0,
        stintStart: 0, // lap index at which the current stint began
        jitter: rng.int(-1, 2),
        foresight: rng.range(0.6, 1.3), // how much a bot trusts the weather forecast
        chaseTarget: null,
        chaseLaps: 0, // distance followed behind the same car
        // Retirement chances per lap of race distance (independent of race length)
        mechRate: MECH_FAIL_PER_RACE / lapsTotal,
        errorRate: (ERROR_PER_RACE * (1 + (100 - g.driver.skill) / 25)) / lapsTotal,
        following: false,
        lapsDone: 0,
        lapStart: 0,
        lastLap: null,
        bestLap: null,
        finished: false,
        finishTime: null,
        sectorTimes: new Float64Array(lapsTotal * SECTORS + 2).fill(-1),
    }));
    cars.forEach((c) => (c.prevPos = c.pos));

    cars.forEach((c) => {
        if (!c.isPlayer) c.plan = choosePlan(rng, c.tyre, weather, fraction, track, lapsTotal);
    });

    return {
        track,
        weather,
        fraction,
        lapsTotal,
        rng,
        cars,
        order: cars.slice(),
        clock: 0,
        wet: waterAt(weather, 0, fraction),
        rain: rainAt(weather, 0, fraction),
        finished: false,
        events: [],
        eventSeq: 0,
        fastest: null,
        playerTeam,
    };
}

function pushEvent(race, kind, text) {
    const leader = race.order[0];
    const lap = Math.min(race.lapsTotal, Math.max(0, Math.floor(leader.pos)) + 1);
    race.events.push({ id: race.eventSeq++, t: race.clock, lap, kind, text });
    if (race.events.length > 60) race.events.shift();
}

// ---------------------------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------------------------

// Request a stop for a player car's next pit entry (null cancels). Returns false when no stop is possible.
export function requestPit(race, code, tyreId) {
    const car = race.cars.find((c) => c.isPlayer && c.code === code);
    if (!car || car.finished || car.dnf) return false;
    car.pitRequest = tyreId;
    return true;
}

// ---------------------------------------------------------------------------------------------
// Ranking, gaps, standings
// ---------------------------------------------------------------------------------------------

// Classified finishers first, then running cars, then retirements (furthest distance first).
const group = (c) => (c.finished ? 0 : c.dnf ? 2 : 1);

function rank(cars) {
    return cars.slice().sort((a, b) => {
        const ga = group(a);
        const gb = group(b);
        if (ga !== gb) return ga - gb;
        if (ga === 0) return a.finishTime - b.finishTime;
        if (ga === 2) return b.pos - a.pos || b.dnf.time - a.dnf.time;
        return b.pos - a.pos;
    });
}

// Time at which `car` was at track position `pos` (laps), or -1 when unknown.
// Sector times only exist for sectors the car has already completed; inside its current sector the car's
// present position and time are used as the end point, so short gaps do not jump by up to a sector.
function timeAt(race, car, pos) {
    if (pos < 0) return -1;
    const x = pos * SECTORS;
    const k = Math.floor(x);
    const t0 = car.sectorTimes[k];
    if (!(t0 >= 0)) return -1;
    const t1 = car.sectorTimes[k + 1];
    if (t1 >= 0) return t0 + (x - k) * (t1 - t0);
    const endX = car.pos * SECTORS;
    const endT = car.finished ? car.finishTime : car.dnf ? car.dnf.time : race.clock;
    if (endX <= k || endT <= t0) return t0;
    return t0 + Math.min(1, (x - k) / (endX - k)) * (endT - t0);
}

function gapSeconds(race, car, other) {
    if (car === other) return 0;
    if (car.finished && other.finished) return car.finishTime - other.finishTime;
    const t = timeAt(race, other, car.pos);
    if (t >= 0) return Math.max(0, race.clock - t);
    return Math.max(0, (other.pos - car.pos) * race.track.optLapTime);
}

export function getStandings(race) {
    const order = rank(race.cars);
    const leader = order[0];
    return order.map((car, i) => {
        const ahead = i > 0 ? order[i - 1] : null;
        return {
            car,
            position: i + 1,
            gapLeader: i === 0 ? 0 : gapSeconds(race, car, leader),
            gapAhead: ahead ? gapSeconds(race, car, ahead) : 0,
            lapsBehindLeader: i === 0 ? 0 : Math.floor(leader.pos - car.pos),
            lapsBehindAhead: ahead ? Math.floor(ahead.pos - car.pos) : 0,
        };
    });
}

// ---------------------------------------------------------------------------------------------
// Overtaking: a continuous pass rate (hazard) per lap travelled behind the car ahead
// ---------------------------------------------------------------------------------------------

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

// Relative passing opportunity at a lap fraction (averages 1 over a lap): concentrated in the zones.
function zoneDensity(pos, zones) {
    const frac = pos - Math.floor(pos);
    const covered = zones.length * OVERTAKE_ZONE_WIDTH;
    for (const z of zones) if (frac >= z && frac < z + OVERTAKE_ZONE_WIDTH) return OVERTAKE_ZONE_SHARE / covered;
    return (1 - OVERTAKE_ZONE_SHARE) / (1 - covered);
}

// ---------------------------------------------------------------------------------------------
// Simulation step
// ---------------------------------------------------------------------------------------------

function crossed(oldPos, newPos, mark) {
    return Math.floor(newPos - mark) > Math.floor(oldPos - mark);
}

function startPit(race, car, tyre) {
    // Repairs keep the car stationary for extra time on top of the normal stop
    const repair = repairTimeFor(car.damage);
    const duration = PIT_DURATION + repair / (1 - PIT_LANE_FACTOR);
    car.pit = { elapsed: 0, duration, tyre, swapped: false };
    car.pitRequest = null;
    car.punctured = false;
    car.recover = 0;
    if (car.plan) car.stintIdx += 1;
    car.stintStart = Math.floor(car.pos) + 1;
    car.jitter = race.rng.int(-1, 2);
    pushEvent(race, "pit", `${car.code} pits for ${tyreName(tyre).toLowerCase()}s${repair > 0.2 ? " and repairs" : ""}`);
}

function retire(race, car, reason) {
    const lap = Math.min(race.lapsTotal, Math.max(0, Math.floor(car.pos)) + 1);
    car.dnf = { reason, lap, time: race.clock };
    car.speed = 0;
    car.pit = null;
    car.pitRequest = null;
    car.punctured = false;
    car.recover = 0;
    car.following = false;
}

// Outcome of a mistake or contact for one car: it retires, or carries on after losing time and maybe damage.
function incident(race, car, kind, reason, retireText) {
    const o = rollIncident(race.rng, kind);
    if (o.retire) {
        retire(race, car, reason);
        pushEvent(race, "dnf", retireText);
        return;
    }
    car.recover += o.loss / (1 - RECOVER_SPEED);
    car.damage = addDamage(car.damage, o.damage);
    const dmg = damageLabel(o.damage);
    pushEvent(race, "incident", `${car.code} ${o.verb}, loses ${Math.round(o.loss)} s${dmg ? `, ${dmg}` : ""}`);
}

// Collision between `car` and the car ahead of it; the car right behind may be caught up as well.
function crash(race, order, car, ahead) {
    pushEvent(race, "incident", `${car.code} and ${ahead.code} collide`);
    const behind = order[order.indexOf(car) + 1];
    const caught =
        behind &&
        !behind.finished &&
        !behind.dnf &&
        !behind.pit &&
        behind.pos >= 0 &&
        (car.pos - behind.pos) * behind.pace < 0.8 &&
        race.rng.next() < CRASH_CHAIN;
    incident(race, car, "collision", "collision", `${car.code} retires after the collision`);
    incident(race, ahead, "collision", "collision", `${ahead.code} retires after the collision`);
    if (caught) incident(race, behind, "caught", "collision", `${behind.code} is caught up and retires`);
}

function recordSectors(race, car, oldPos, newPos, t0, dt) {
    if (newPos <= oldPos) return;
    const first = oldPos < 0 ? 0 : Math.floor(oldPos * SECTORS) + 1;
    const last = Math.floor(Math.min(newPos, race.lapsTotal) * SECTORS);
    for (let k = first; k <= last; k++) {
        const ratio = clamp01((k / SECTORS - oldPos) / (newPos - oldPos));
        car.sectorTimes[k] = t0 + dt * ratio;
    }
}

export function stepRace(race, dt) {
    if (race.finished) return;
    const { track, lapsTotal, rng, fraction } = race;

    const order = rank(race.cars);
    race.order = order;

    const leaderPos = Math.max(order[0].pos, 0);
    race.wet = waterAt(race.weather, leaderPos, fraction);
    race.rain = rainAt(race.weather, leaderPos, fraction);
    const wet = race.wet;
    const t0 = race.clock;

    let blocker = null; // nearest car ahead that is actually racing (not finished, not in the pits)

    for (const car of order) {
        if (car.finished || car.dnf) continue;

        const oldPos = car.pos;
        car.prevPos = oldPos;

        // Pit phase: slow progress through the pit lane, tyres swapped halfway through
        if (car.pit) {
            car.pit.elapsed += dt;
            if (!car.pit.swapped && car.pit.elapsed >= car.pit.duration / 2) {
                car.tyre = car.pit.tyre;
                car.tyreState = 100;
                car.damage = 0;
                car.stops += 1;
                car.allTyres += car.pit.tyre;
                car.pitThreshold = rng.int(26, 51);
                car.pit.swapped = true;
            }
            if (car.pit.elapsed >= car.pit.duration) car.pit = null;
        }

        car.pace = lapTimeFor(car.driver, track, car.tyre, car.tyreState, wet, car.noise) / (car.punctured ? PUNCTURE_SPEED : 1) + car.damage;
        const free = 1 / car.pace;
        let speed = free;
        let following = false;

        if (car.pit) {
            speed = free * PIT_LANE_FACTOR;
        } else if (blocker) {
            const gapLaps = blocker.prevPos - oldPos;
            if (gapLaps * car.pace < FOLLOW_GAP_S) {
                following = true;
                const minGapLaps = MIN_GAP_S / car.pace;
                const cap = blocker.speed + Math.max(0, gapLaps - minGapLaps) * CLOSE_RATE;
                if (cap < speed) speed = cap;
            }
        }

        // Crawling after a spin or contact
        const recovering = car.recover > 0 && !car.pit && oldPos >= 0;
        if (recovering) {
            speed = Math.min(speed, free * RECOVER_SPEED);
            car.recover -= dt;
        }

        car.speed = speed;
        car.following = following;
        if (!following) car.chaseTarget = null;

        // Random incidents: puncture on worn tyres, mechanical failure, driver error
        if (oldPos >= 0 && !car.pit) {
            const advance = speed * dt; // laps covered this step
            const hazard = punctureHazard(car.tyreState);
            if (!car.punctured && hazard > 0 && rng.next() < hazard * advance) {
                car.punctured = true;
                pushEvent(race, "puncture", `${car.code} has a puncture`);
            }
            if (rng.next() < car.mechRate * advance) {
                retire(race, car, "mechanical");
                pushEvent(race, "dnf", `${car.code} retires: ${MECH_REASONS[rng.int(0, MECH_REASONS.length)]}`);
                continue;
            }
            if (rng.next() < car.errorRate * (1 + wet / 100) * (car.lapsDone === 0 ? LAP1_INCIDENT_MULT : 1) * advance) {
                incident(race, car, "error", "driver error", `${car.code} ${ERROR_REASONS[rng.int(0, ERROR_REASONS.length)]}`);
                if (car.dnf) continue;
            }
        }

        if (!car.pit) car.tyreState -= wearPerLap(car.tyre, lapsTotal) * speed * dt;

        let newPos = oldPos + speed * dt;

        if (following) {
            const minGapLaps = MIN_GAP_S / car.pace;
            newPos = Math.max(oldPos, Math.min(newPos, blocker.pos - minGapLaps * 0.5));

            // Overtaking attempts at the overtaking zones (a crawling car counts as far slower than its free pace)
            const paceOf = (c) => (c.recover > 0 ? c.pace / RECOVER_SPEED : c.pace);
            const delta = paceOf(blocker) - paceOf(car);
            const close = (blocker.prevPos - oldPos) * car.pace < CRASH_RANGE_S;
            const lap1 = car.lapsDone === 0;
            const wetFactor = (1 + wet / 40) * (lap1 ? LAP1_INCIDENT_MULT : 1);
            const travelled = speed * dt;
            let collided = false;

            // First-corner melee
            if (close && oldPos >= 0 && lap1 && crossed(oldPos, newPos, START_CORNER) && rng.next() < START_CRASH_CHANCE * wetFactor) {
                crash(race, order, car, blocker);
                collided = true;
            }

            if (!collided && oldPos >= 0 && blocker.code !== car.chaseTarget) {
                car.chaseTarget = blocker.code;
                car.chaseLaps = 0;
            }

            let rate = overtakeRate(delta, track.ovtkMultiplier, car.chaseLaps);
            if (lap1) rate = Math.max(rate * LAP1_OVERTAKE_MULT, LAP1_OVERTAKE_MIN_RATE * overtakeEase(track.ovtkMultiplier));
            if (!collided && rate > 0 && oldPos >= 0) {
                const zones = lap1 ? [START_CORNER, ...OVERTAKE_ZONES] : OVERTAKE_ZONES;
                const exposure = travelled * zoneDensity(oldPos + travelled / 2, zones);
                if (close && rng.next() < CRASH_PER_ATTEMPT * ATTEMPTS_PER_LAP * wetFactor * exposure) {
                    crash(race, order, car, blocker);
                    collided = true;
                } else if (rng.next() < 1 - Math.exp(-rate * exposure)) {
                    newPos = Math.max(newPos, blocker.pos + minGapLaps);
                    pushEvent(race, "overtake", `${car.code} passes ${blocker.code}`);
                    car.chaseLaps = 0;
                }
            }

            if (collided) {
                if (blocker.dnf) blocker = null;
                if (car.dnf) continue;
            }
            if (oldPos >= 0) car.chaseLaps += travelled;
        }

        // Pit entry decision (once per lap, never on the final lap)
        if (!car.pit && oldPos >= 0 && crossed(oldPos, newPos, PIT_ENTRY) && Math.floor(newPos) < lapsTotal - 1) {
            let tyre;
            if (car.isPlayer) tyre = car.punctured ? (car.pitRequest ?? emergencyTyre(race, car)) : car.pitRequest;
            else tyre = decideBotPit(car, race, newPos);
            if (tyre) startPit(race, car, tyre);
        }

        // Start line / lap completion
        const fOld = Math.floor(oldPos);
        const fNew = Math.floor(newPos);
        let crossTime = t0 + dt;
        if (fNew > fOld) {
            crossTime = t0 + dt * clamp01((fNew - oldPos) / (newPos - oldPos));
            if (fNew >= 1) {
                const lap = crossTime - car.lapStart;
                car.lastLap = lap;
                car.lapsDone = fNew;
                if (car.bestLap === null || lap < car.bestLap) car.bestLap = lap;
                if (fNew >= 2 && (!race.fastest || lap < race.fastest.time)) {
                    race.fastest = { time: lap, code: car.code, name: car.name, lap: fNew };
                    pushEvent(race, "fastest", `Fastest lap: ${car.code} ${lap.toFixed(3)}`);
                }
            }
            car.lapStart = crossTime;
            car.noise = lapNoise(rng);
        }

        recordSectors(race, car, oldPos, newPos, t0, dt);
        car.pos = newPos;

        if (newPos >= lapsTotal) {
            car.finished = true;
            car.finishTime = crossTime;
            car.pos = lapsTotal;
            car.speed = 0;
            car.pit = null;
            if (!order.some((c) => c !== car && c.finished)) pushEvent(race, "finish", `${car.code} takes the chequered flag`);
        }

        if (!car.pit && !car.finished) blocker = car;
    }

    race.clock = t0 + dt;
    if (race.cars.every((c) => c.finished || c.dnf)) {
        race.finished = true;
        race.order = rank(race.cars);
    }
}

// Run the remainder of the race instantly (used for "skip to results").
export function simulateToEnd(race, dt) {
    let guard = 0;
    while (!race.finished && guard++ < 200000) stepRace(race, dt);
}
