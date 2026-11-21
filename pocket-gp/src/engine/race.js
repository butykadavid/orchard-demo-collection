import {
    AI_AGGRESSION,
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
    OVERTAKE_ZONE_SHARE,
    OVERTAKE_ZONE_WIDTH,
    PIT_ENTRY,
    PASS_CLOSING_SPEED,
    PASS_CORNER_LOSS,
    PASS_TIMEOUT_S,
    PIT_LANE_SPAN,
    PIT_TEAM_BUFFER,
    PUNCTURE_SPEED,
    RECOVER_SPEED,
    SECTORS,
    START_CORNER,
    START_CRASH_CHANCE,
    START_GAP_S,
} from "./constants.js";
import { choosePlan, decideBotPit, emergencyTyre, tyreName } from "./ai.js";
import { addDamage, damageLabel, repairTimeFor, rollIncident } from "./incidents.js";
import { lapNoise, lapTimeFor, lapsTotalFor, overtakeEase, overtakeRate, punctureHazard, wearPerLap } from "./pace.js";
import { pitDriveTime, queueWait, rollStopTime } from "./pit.js";
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
        pass: null, // overtake in progress: { target, elapsed, announced }; the car drives free of `target` until it is clear ahead
        aheadCar: null, // the car this one is held up by (ignoring any car it is currently passing or being passed by)
        trafficLoss: 0, // seconds per lap lost behind slower cars (running average, used by the AI)
        lossAcc: 0, // the same for the lap in progress
        aggression: rng.range(AI_AGGRESSION[0], AI_AGGRESSION[1]), // how readily a bot takes tactical strategy risks
        battle: false, // in a pass in progress, either as the passer or the car being passed
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
        teamBusyUntil: new Map(), // team -> race clock until which its pit crew is busy (one car is serviced at a time)
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
// (the rate itself, overtakeRate(), lives in pace.js so the AI can estimate it too)
// ---------------------------------------------------------------------------------------------

// Relative passing opportunity at a lap fraction (averages 1 over a lap): concentrated in the zones.
function zoneDensity(pos, zones) {
    const frac = pos - Math.floor(pos);
    const covered = zones.length * OVERTAKE_ZONE_WIDTH;
    for (const z of zones) if (frac >= z && frac < z + OVERTAKE_ZONE_WIDTH) return OVERTAKE_ZONE_SHARE / covered;
    return (1 - OVERTAKE_ZONE_SHARE) / (1 - covered);
}

function inOvertakeZone(pos) {
    const frac = pos - Math.floor(pos);
    return OVERTAKE_ZONES.some((z) => frac >= z && frac < z + OVERTAKE_ZONE_WIDTH);
}

// ---------------------------------------------------------------------------------------------
// Simulation step
// ---------------------------------------------------------------------------------------------

function crossed(oldPos, newPos, mark) {
    return Math.floor(newPos - mark) > Math.floor(oldPos - mark);
}

function startPit(race, car, tyre) {
    // The car drives down the pit lane, stops at its box for the service and drives on. Repairs add to the standing time.
    // The crew works on one car at a time (plus a short buffer), so a team mate arriving during a service has to wait.
    // All times below are seconds since the car turned into the pit lane.
    const repair = repairTimeFor(car.damage);
    const drive = pitDriveTime(race.track);
    const arrive = drive / 2; // the box is in the middle of the pit lane
    const wait = queueWait(race, car);
    const start = arrive + wait;
    const end = start + rollStopTime(race.rng) + repair;
    race.teamBusyUntil.set(car.team, race.clock + end + PIT_TEAM_BUFFER);
    car.pit = { elapsed: 0, laneSpeed: PIT_LANE_SPAN / drive, arrive, start, end, total: end + drive / 2, tyre, swapped: false };
    car.pitRequest = null;
    car.punctured = false;
    car.recover = 0;
    if (car.plan) car.stintIdx += 1;
    car.stintStart = Math.floor(car.pos) + 1;
    car.trafficLoss = 0;
    car.lossAcc = 0;
    car.jitter = race.rng.int(-1, 2);
    pushEvent(race, "pit", `${car.code} pits for ${tyreName(tyre).toLowerCase()}s${repair > 0.2 ? " and repairs" : ""}${wait > 0.3 ? ", waiting for the crew" : ""}`);
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

    // Both cars of a pass in progress are "in a battle" (the passer and the car being passed)
    for (const c of order) c.battle = false;
    for (const c of order) {
        if (c.pass) {
            c.battle = true;
            c.pass.target.battle = true;
        }
    }
    for (const car of order) {
        if (car.finished || car.dnf) continue;

        const oldPos = car.pos;
        car.prevPos = oldPos;

        // Pit phase: drive down the pit lane, stand still for the service (tyres swapped halfway through it), drive on
        if (car.pit) {
            const p = car.pit;
            p.elapsed += dt;
            if (!p.swapped && p.elapsed >= (p.start + p.end) / 2) {
                car.tyre = p.tyre;
                car.tyreState = 100;
                car.damage = 0;
                car.stops += 1;
                car.allTyres += p.tyre;
                car.pitThreshold = rng.int(26, 51);
                p.swapped = true;
            }
            if (p.elapsed >= p.total) car.pit = null;
        }

        // A pass in progress ends when either car leaves the track or the pits, or it drags on too long
        if (car.pass) {
            const t = car.pass.target;
            car.pass.elapsed += dt;
            if (car.pit || t.pit || t.dnf || t.finished || car.pass.elapsed > PASS_TIMEOUT_S) car.pass = null;
        }

        // The car that actually holds this one up: a car being passed (or passing this one) does not count
        let ahead = blocker;
        while (ahead && (car.pass?.target === ahead || ahead.pass?.target === car)) ahead = ahead.aheadCar;
        car.aheadCar = ahead;

        car.pace = lapTimeFor(car.driver, track, car.tyre, car.tyreState, wet, car.noise) / (car.punctured ? PUNCTURE_SPEED : 1) + car.damage;
        const free = 1 / car.pace;
        // Fighting for the position through a corner: neither car has the ideal line, so both lose time for as long as it lasts
        const lineLoss = car.battle && !car.pit && oldPos >= 0 && !inOvertakeZone(oldPos) ? 1 - PASS_CORNER_LOSS : 1;
        let speed = free * lineLoss;
        let following = false;

        // While passing, the car drives its own pace as if the other car was not there (at least slightly quicker, so the pass completes)
        if (car.pass) speed = Math.max(speed, car.pass.target.speed * (1 + PASS_CLOSING_SPEED));

        if (car.pit) {
            // Pit lane speed limit, standing still at the box while waiting for the crew and during the service
            const p = car.pit;
            speed = p.elapsed >= p.arrive && p.elapsed < p.end ? 0 : p.laneSpeed;
        } else if (ahead) {
            const gapLaps = ahead.prevPos - oldPos;
            if (gapLaps * car.pace < FOLLOW_GAP_S) {
                following = true;
                const minGapLaps = MIN_GAP_S / car.pace;
                const cap = ahead.speed + Math.max(0, gapLaps - minGapLaps) * CLOSE_RATE;
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
        // Time lost this step because the car ahead holds it up (bots use this to judge whether they are stuck)
        if (following && !car.pit && oldPos >= 0) car.lossAcc += dt * Math.max(0, 1 - speed * car.pace);

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
            newPos = Math.max(oldPos, Math.min(newPos, ahead.pos - minGapLaps * 0.5));

            // Overtaking attempts at the overtaking zones (a crawling car counts as far slower than its free pace)
            const paceOf = (c) => (c.recover > 0 ? c.pace / RECOVER_SPEED : c.pace);
            const delta = paceOf(ahead) - paceOf(car);
            const close = (ahead.prevPos - oldPos) * car.pace < CRASH_RANGE_S;
            const lap1 = car.lapsDone === 0;
            const wetFactor = (1 + wet / 40) * (lap1 ? LAP1_INCIDENT_MULT : 1);
            const travelled = speed * dt;
            let collided = false;

            // First-corner melee
            if (close && oldPos >= 0 && lap1 && crossed(oldPos, newPos, START_CORNER) && rng.next() < START_CRASH_CHANCE * wetFactor) {
                crash(race, order, car, ahead);
                collided = true;
            }

            if (!collided && oldPos >= 0 && ahead.code !== car.chaseTarget) {
                car.chaseTarget = ahead.code;
                car.chaseLaps = 0;
            }

            let rate = overtakeRate(delta, track.ovtkMultiplier, car.chaseLaps);
            if (lap1) rate = Math.max(rate * LAP1_OVERTAKE_MULT, LAP1_OVERTAKE_MIN_RATE * overtakeEase(track.ovtkMultiplier));
            if (!collided && rate > 0 && oldPos >= 0) {
                const zones = lap1 ? [START_CORNER, ...OVERTAKE_ZONES] : OVERTAKE_ZONES;
                const exposure = travelled * zoneDensity(oldPos + travelled / 2, zones);
                if (close && rng.next() < CRASH_PER_ATTEMPT * ATTEMPTS_PER_LAP * wetFactor * exposure) {
                    crash(race, order, car, ahead);
                    collided = true;
                } else if (rng.next() < 1 - Math.exp(-rate * exposure)) {
                    // The move is on: from the next step the car drives past at its own pace, no position jump
                    car.pass = { target: ahead, elapsed: 0, announced: false };
                    car.chaseLaps = 0;
                }
            }

            if (collided) {
                if (blocker?.dnf) blocker = null;
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
            car.trafficLoss = (car.trafficLoss + car.lossAcc) / 2;
            car.lossAcc = 0;
        }

        recordSectors(race, car, oldPos, newPos, t0, dt);
        car.pos = newPos;

        // The pass counts once the car is in front, and is over when it is clear of the defender
        if (car.pass) {
            const t = car.pass.target;
            if (!car.pass.announced && car.pos > t.pos) {
                car.pass.announced = true;
                pushEvent(race, "overtake", `${car.code} passes ${t.code}`);
            }
            if (car.pos >= t.pos + MIN_GAP_S / car.pace) car.pass = null;
        }

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
