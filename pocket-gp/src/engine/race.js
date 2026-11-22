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
    NEUTRAL_COOLDOWN_LAPS,
    NEUTRAL_WEAR,
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
    RED_MIN_REMAINING_LAPS,
    RED_RAIN_MAX_WAIT_S,
    RED_RAIN_RATE,
    RED_RAIN_RESUME_WET,
    RED_RAIN_WET,
    RED_WAIT_S,
    RED_WARP,
    SC_CATCHUP,
    SC_GAP_S,
    SC_LAPS,
    SC_SPEED,
    SECTORS,
    START_CORNER,
    START_CRASH_CHANCE,
    START_GAP_S,
    TYRES,
    VSC_LAPS,
    VSC_SPEED,
} from "./constants.js";
import { choosePlan, decideBotPit, emergencyTyre, planRestart, tyreName } from "./ai.js";
import { createControl, rollRaceControl, weatherLapOf } from "./control.js";
import { addDamage, damageLabel, repairTimeFor, rollIncident } from "./incidents.js";
import { lapNoise, lapTimeFor, lapsTotalFor, overtakeEase, overtakeRate, punctureHazard, wearPerLap } from "./pace.js";
import { pitDriveTime, queueWait, rollStopTime } from "./pit.js";
import { tyreRuleMet, tyreRuleReason } from "./rules.js";
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
        parked: false, // standing in the pit lane under a red flag
        redRank: 0, // position when the red flag came out (the restart grid order)
        redLapsDown: 0, // laps behind the leader when the red flag came out
        redTyre: null, // player: compound chosen for the free tyre change under the red flag (null keeps the current set)
        regrid: false, // lined up for a standing restart: the next line crossing is not a lap
        chaosEnd: 0, // distance (laps) up to which the car is in the chaotic first lap after a standing restart
        damage: 0, // lap time penalty (s per lap) until repaired in the pits
        recover: 0, // seconds still to spend crawling after a spin or contact
        dnf: null,
        dsq: null, // disqualified at the flag for breaking the tyre rule: { reason }
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
        control: createControl(), // safety car, virtual safety car and red flag state
        weatherShift: 0, // laps the weather has moved on while the race stood still under a red flag
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

// Classified finishers first, then running cars, then retirements (furthest distance first), disqualified cars last.
// Under a red flag the running cars keep the order they had when it came out.
const group = (c) => (c.dsq ? 3 : c.finished ? 0 : c.dnf ? 2 : 1);

function rank(cars, redFlag = false) {
    return cars.slice().sort((a, b) => {
        const ga = group(a);
        const gb = group(b);
        if (ga !== gb) return ga - gb;
        if (ga === 0 || ga === 3) return a.finishTime - b.finishTime;
        if (ga === 2) return b.pos - a.pos || b.dnf.time - a.dnf.time;
        return redFlag ? a.redRank - b.redRank : b.pos - a.pos;
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
    const redFlag = race.control.mode === "red";
    const order = rank(race.cars, redFlag);
    const leader = order[0];
    return order.map((car, i) => {
        const ahead = i > 0 ? order[i - 1] : null;
        if (redFlag && !car.finished && !car.dnf) {
            // The race is stopped: no gaps, only the laps each car was behind when the flag came out
            const aheadRunning = ahead && !ahead.finished && !ahead.dnf;
            return {
                car,
                position: i + 1,
                gapLeader: null,
                gapAhead: null,
                lapsBehindLeader: car.redLapsDown,
                lapsBehindAhead: aheadRunning ? car.redLapsDown - ahead.redLapsDown : 0,
            };
        }
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
// Returns true when the car retired.
function incident(race, car, kind, reason, retireText) {
    const o = rollIncident(race.rng, kind);
    if (o.retire) {
        retire(race, car, reason);
        pushEvent(race, "dnf", retireText);
        return true;
    }
    car.recover += o.loss / (1 - RECOVER_SPEED);
    car.damage = addDamage(car.damage, o.damage);
    const dmg = damageLabel(o.damage);
    pushEvent(race, "incident", `${car.code} ${o.verb}, loses ${Math.round(o.loss)} s${dmg ? `, ${dmg}` : ""}`);
    return false;
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
    let retired = 0;
    if (incident(race, car, "collision", "collision", `${car.code} retires after the collision`)) retired++;
    if (incident(race, ahead, "collision", "collision", `${ahead.code} retires after the collision`)) retired++;
    if (caught && incident(race, behind, "caught", "collision", `${behind.code} is caught up and retires`)) retired++;
    callRaceControl(race, "collision", retired);
}

// ---------------------------------------------------------------------------------------------
// Race control: safety car, virtual safety car, red flag
// ---------------------------------------------------------------------------------------------

const SEVERITY = { vsc: 1, sc: 2, red: 3 };

// An incident may lead to a neutralisation of the race. A stronger one replaces a weaker one that is already in force.
function callRaceControl(race, kind, retired = 0) {
    const c = race.control;
    if (c.mode === "red" || race.finished) return;
    const lead = Math.max(race.order[0].pos, 0);
    const remaining = race.lapsTotal - lead;
    if (remaining < 2) return; // never in the last two laps
    if (c.mode === "green" && lead < c.quietUntil) return;
    let call = rollRaceControl(race.rng, kind, retired);
    if (!call) return;
    if (call === "red" && remaining < RED_MIN_REMAINING_LAPS) call = "sc";
    if (c.mode !== "green" && SEVERITY[call] <= SEVERITY[c.mode]) return;
    if (call === "red") startRedFlag(race, false);
    else if (call === "sc") deploySafetyCar(race);
    else deployVirtualSafetyCar(race);
}

// Nobody can pass while the race is neutralised: moves in progress are called off
function calmField(race) {
    for (const c of race.cars) {
        c.pass = null;
        c.chaseTarget = null;
        c.battle = false;
    }
}

function deploySafetyCar(race) {
    const c = race.control;
    const lead = Math.max(race.order[0].pos, 0);
    c.mode = "sc";
    c.since = race.clock;
    c.ending = false;
    c.lapsLeft = Math.max(1, Math.min(race.rng.int(SC_LAPS[0], SC_LAPS[1] + 1) - 1, Math.floor(race.lapsTotal - lead) - 2));
    calmField(race);
    pushEvent(race, "control", "Safety car deployed");
}

function deployVirtualSafetyCar(race) {
    const c = race.control;
    const lead = Math.max(race.order[0].pos, 0);
    const laps = Math.min(race.rng.range(VSC_LAPS[0], VSC_LAPS[1]), race.lapsTotal - lead - 1);
    c.mode = "vsc";
    c.since = race.clock;
    c.until = race.clock + laps * race.track.optLapTime;
    calmField(race);
    pushEvent(race, "control", "Virtual safety car");
}

function endNeutral(race) {
    const c = race.control;
    c.mode = "green";
    c.ending = false;
    c.quietUntil = Math.max(race.order[0].pos, 0) + NEUTRAL_COOLDOWN_LAPS;
    pushEvent(race, "control", "Green flag: racing resumes");
}

function startRedFlag(race, rain) {
    const c = race.control;
    const order = rank(race.cars);
    const leaderPos = order[0].pos;
    let n = 0;
    for (const car of order) {
        if (car.finished || car.dnf) continue;
        car.redRank = ++n;
        car.redLapsDown = Math.max(0, Math.floor(leaderPos - car.pos));
        car.pitRequest = null;
    }
    calmField(race);
    c.mode = "red";
    c.phase = "stopping";
    c.since = race.clock;
    c.ending = false;
    c.rain = rain;
    if (rain) c.rainUsed = true;
    pushEvent(race, "red", rain ? "Red flag: the race is stopped because of the rain" : "Red flag: the race is stopped");
}

// Under a red flag every car drives down the pit lane and stops there
function parkCar(car) {
    car.parked = true;
    car.speed = 0;
    car.pit = null;
    car.following = false;
    car.recover = 0;
}

const playerRacing = (race) => race.cars.some((c) => c.isPlayer && !c.dnf && !c.finished);

// Called at the end of every step: ends neutralisations, moves a red flag through its phases, and may stop the race for rain
function updateRaceControl(race, dt) {
    const c = race.control;
    const lead = race.order[0];
    const leadLap = Math.max(0, Math.floor(lead.pos));
    const crossedLine = leadLap > c.lap && !lead.finished && !lead.dnf;
    if (leadLap > c.lap) c.lap = leadLap;

    if (c.mode === "vsc") {
        if (race.clock >= c.until) endNeutral(race);
    } else if (c.mode === "sc") {
        if (crossedLine) {
            if (c.ending) endNeutral(race);
            else if (--c.lapsLeft <= 0) {
                c.ending = true;
                pushEvent(race, "control", "Safety car in this lap");
            }
        }
    } else if (c.mode === "green") {
        if (crossedLine && !c.rainUsed && lead.pos >= 1 && race.wet >= RED_RAIN_WET && race.lapsTotal - lead.pos >= RED_MIN_REMAINING_LAPS && lead.pos >= c.quietUntil) {
            if (race.rng.next() < RED_RAIN_RATE) startRedFlag(race, true);
        }
    } else if (c.phase === "stopping") {
        if (race.cars.every((x) => x.finished || x.dnf || x.parked)) {
            c.phase = "waiting";
            c.waitStart = race.clock;
            c.waitS = race.rng.range(RED_WAIT_S[0], RED_WAIT_S[1]);
            pushEvent(race, "red", "All cars are in the pit lane: tyres can be changed");
        }
    } else if (c.phase === "waiting") {
        race.weatherShift += dt / race.track.optLapTime; // the weather keeps moving while the race stands still
        const elapsed = race.clock - c.waitStart;
        const dry = !c.rain || race.wet < RED_RAIN_RESUME_WET || elapsed >= RED_RAIN_MAX_WAIT_S;
        if (elapsed >= c.waitS && dry) {
            if (playerRacing(race)) {
                c.phase = "awaiting";
                pushEvent(race, "red", "The race can be restarted");
            } else restartRace(race);
        }
    }
}

// Player: choose the compound of the free tyre change under the red flag
export function setRedFlagTyre(race, code, tyreId) {
    const c = race.control;
    const car = race.cars.find((x) => x.isPlayer && x.code === code);
    if (!car || c.mode !== "red" || car.dnf || car.finished || !TYRES[tyreId]) return false;
    car.redTyre = tyreId;
    return true;
}

// Standing restart: the cars line up in their red flag order, on new tyres, and the lap counter carries on
export function restartRace(race) {
    const c = race.control;
    if (c.mode !== "red" || (c.phase !== "waiting" && c.phase !== "awaiting")) return false;
    const running = race.cars.filter((x) => !x.finished && !x.dnf).sort((a, b) => a.redRank - b.redRank);
    if (running.length === 0) return false;

    const lead = running[0];
    const oldLeadPos = Math.max(lead.pos, 0);
    const k = Math.max(0, Math.floor(lead.pos));
    const gap = START_GAP_S / race.track.optLapTime;

    // Everybody gets a new set. Bots pick the cheapest tyre for the weather expected at the restart and plan the rest of the race on it.
    // (all decisions first: the weather lookup depends on where the leader is)
    const fitted = running.map((car) => {
        const lineLap = Math.max(0, k - car.redLapsDown);
        if (car.isPlayer) return { car, lineLap, tyre: car.redTyre ?? car.tyre, plan: null };
        const r = planRestart(race, car, race.lapsTotal - lineLap);
        return { car, lineLap, tyre: r.tyre, plan: r.plan };
    });

    race.teamBusyUntil.clear();
    fitted.forEach(({ car, lineLap, tyre, plan }, j) => {
        car.tyre = tyre;
        car.tyreState = 100;
        car.stops += 1; // the free change counts as a stop and shows up in the tyre history
        car.allTyres += tyre;
        car.damage = 0;
        car.punctured = false;
        car.recover = 0;
        car.redTyre = null;
        car.pitRequest = null;
        car.pitThreshold = race.rng.int(26, 51);
        car.jitter = race.rng.int(-1, 2);
        if (!car.isPlayer) {
            car.plan = plan;
            car.stintIdx = 0;
        }
        car.stintStart = lineLap;
        car.parked = false;
        car.pit = null;
        car.pass = null;
        car.following = false;
        car.aheadCar = null;
        car.chaseTarget = null;
        car.trafficLoss = 0;
        car.lossAcc = 0;
        car.speed = 0;
        car.pos = lineLap - j * gap;
        car.prevPos = car.pos;
        car.lapsDone = lineLap;
        car.regrid = Math.floor(car.pos) < lineLap;
        car.lapStart = race.clock;
        car.chaosEnd = lineLap + 1;
        car.sectorTimes.fill(-1);
    });

    race.weatherShift += oldLeadPos - Math.max(lead.pos, 0);
    c.mode = "green";
    c.phase = null;
    c.lap = Math.max(c.lap, Math.floor(lead.pos));
    c.quietUntil = lead.pos + NEUTRAL_COOLDOWN_LAPS;
    pushEvent(race, "control", `Standing restart: lap ${Math.min(race.lapsTotal, k + 1)} of ${race.lapsTotal}`);
    return true;
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

// The first lap of the race and the first lap after a standing restart are chaotic
const chaos = (car) => car.lapsDone === 0 || car.pos < car.chaosEnd;

export function stepRace(race, dt) {
    if (race.finished) return;
    if (race.control.mode === "red" && race.control.phase === "awaiting") return; // waiting for the restart
    const { track, lapsTotal, rng, fraction } = race;
    const { mode, phase } = race.control;
    const neutral = mode !== "green";
    const slowCar = mode === "sc" || (mode === "red" && phase === "stopping"); // field bunches up behind a (virtual) leader
    const minGapS = slowCar ? SC_GAP_S : MIN_GAP_S;

    const order = rank(race.cars, mode === "red");
    race.order = order;

    const weatherLap = weatherLapOf(race);
    race.wet = waterAt(race.weather, weatherLap, fraction);
    race.rain = rainAt(race.weather, weatherLap, fraction);
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
        if (car.finished || car.dnf || car.parked) continue;

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
            if (p.elapsed >= p.total) {
                car.pit = null;
                if (mode === "red") {
                    parkCar(car); // a car that is in the pit lane when the flag comes out stays there
                    continue;
                }
            }
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

        // Neutralised race: everybody drives slowly, the field closes up behind the safety car
        if (mode === "vsc") speed = free * VSC_SPEED;
        else if (slowCar) speed = free * (ahead && (ahead.prevPos - oldPos) * car.pace > FOLLOW_GAP_S ? SC_CATCHUP : SC_SPEED);

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
                const minGapLaps = minGapS / car.pace;
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
                callRaceControl(race, "mechanical");
                continue;
            }
            if (!neutral && rng.next() < car.errorRate * (1 + wet / 100) * (chaos(car) ? LAP1_INCIDENT_MULT : 1) * advance) {
                const retired = incident(race, car, "error", "driver error", `${car.code} ${ERROR_REASONS[rng.int(0, ERROR_REASONS.length)]}`);
                callRaceControl(race, retired ? "crash" : "spin");
                if (car.dnf) continue;
            }
        }

        if (!car.pit) car.tyreState -= wearPerLap(car.tyre, lapsTotal) * speed * dt * (neutral ? NEUTRAL_WEAR : 1);

        let newPos = oldPos + speed * dt;

        if (following) {
            const minGapLaps = minGapS / car.pace;
            newPos = Math.max(oldPos, Math.min(newPos, ahead.pos - minGapLaps * 0.5));
        }

        // Overtaking attempts and first-corner contact (not while the race is neutralised)
        if (following && !neutral) {
            // Overtaking attempts at the overtaking zones (a crawling car counts as far slower than its free pace)
            const paceOf = (c) => (c.recover > 0 ? c.pace / RECOVER_SPEED : c.pace);
            const delta = paceOf(ahead) - paceOf(car);
            const close = (ahead.prevPos - oldPos) * car.pace < CRASH_RANGE_S;
            const lap1 = chaos(car);
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

        // Pit entry decision (once per lap, never on the final lap). Under a red flag the cars stop in the pit lane instead.
        let park = false;
        if (!car.pit && oldPos >= 0 && crossed(oldPos, newPos, PIT_ENTRY) && Math.floor(newPos) < lapsTotal - 1) {
            if (mode === "red") park = true;
            else {
                let tyre;
                if (car.isPlayer) tyre = car.punctured ? (car.pitRequest ?? emergencyTyre(race, car)) : car.pitRequest;
                else tyre = decideBotPit(car, race, newPos);
                if (tyre) startPit(race, car, tyre);
            }
        }

        // Start line / lap completion
        const fOld = Math.floor(oldPos);
        const fNew = Math.floor(newPos);
        let crossTime = t0 + dt;
        if (fNew > fOld) {
            crossTime = t0 + dt * clamp01((fNew - oldPos) / (newPos - oldPos));
            if (fNew >= 1) {
                car.lapsDone = fNew;
                // The line crossing that follows a standing restart only closes up the grid: it is not a lap
                if (!car.regrid) {
                    const lap = crossTime - car.lapStart;
                    car.lastLap = lap;
                    if (car.bestLap === null || lap < car.bestLap) car.bestLap = lap;
                    if (fNew >= 2 && (!race.fastest || lap < race.fastest.time)) {
                        race.fastest = { time: lap, code: car.code, name: car.name, lap: fNew };
                        pushEvent(race, "fastest", `Fastest lap: ${car.code} ${lap.toFixed(3)}`);
                    }
                }
            }
            car.regrid = false;
            car.lapStart = crossTime;
            car.noise = lapNoise(rng);
            car.trafficLoss = (car.trafficLoss + car.lossAcc) / 2;
            car.lossAcc = 0;
        }

        recordSectors(race, car, oldPos, newPos, t0, dt);
        car.pos = newPos;
        if (park) parkCar(car);

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
            if (!tyreRuleMet(car.allTyres)) {
                car.dsq = { reason: tyreRuleReason };
                pushEvent(race, "dnf", `${car.code} is disqualified: ${tyreRuleReason}`);
            } else if (!order.some((c) => c !== car && c.finished && !c.dsq)) {
                pushEvent(race, "finish", `${car.code} takes the chequered flag`);
            }
        }

        if (!car.pit && !car.finished && !car.parked) blocker = car;
    }

    race.clock = t0 + dt;
    updateRaceControl(race, dt);
    if (race.cars.every((c) => c.finished || c.dnf)) {
        race.finished = true;
        race.order = rank(race.cars);
    }
}

// Run the remainder of the race instantly (used for "skip to results").
export function simulateToEnd(race, dt) {
    let guard = 0;
    while (!race.finished && guard++ < 200000) {
        const { mode, phase } = race.control;
        if (mode === "red" && phase === "awaiting") restartRace(race);
        stepRace(race, mode === "red" && phase === "waiting" ? dt * RED_WARP : dt);
    }
}
