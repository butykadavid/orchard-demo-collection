import { RED_RAIN_RESUME_WET, RED_RAIN_WET, SC_SPEED, VSC_SPEED } from "./constants.js";

// Race control state: the race is `green`, neutralised by a virtual safety car (`vsc`) or a safety car (`sc`),
// or stopped by a red flag (`red`).
//   sc:  lapsLeft = leader laps still to run behind the safety car, ending = it comes in at the end of this lap
//        collecting = the field is still being collected: everybody runs the same slow speed and the leader slower still,
//        until he crosses the line `collectLap` (a lap count of the leader's distance)
//   vsc: until = race clock at which the virtual safety car period ends
//   red: phase = stopping (cars drive to the pit lane) | waiting (cars parked, tyres can be changed) |
//        awaiting (everything is ready, the race is frozen until the player restarts it) | cancelled (the conditions
//        did not allow a restart in time: the race is over)
//        since = race clock at which the flag came out, rain = stopped because of the weather
//   quietUntil = leader distance (laps) before which no new neutralisation is called
export function createControl() {
    return {
        mode: "green",
        phase: null,
        since: 0,
        until: 0,
        lapsLeft: 0,
        ending: false,
        collecting: false,
        collectLap: 0,
        quietUntil: 0,
        lap: 0, // laps the leader has completed (to spot the leader crossing the line)
        waitStart: 0,
        waitS: 0,
        rain: false,
        rainUsed: false,
    };
}

// Chances that an incident leads to a red flag, safety car or virtual safety car
const CHANCES = {
    mechanical: { red: 0, sc: 0.25, vsc: 0.4 }, // a car stops on track
    crash: { red: 0.05, sc: 0.5, vsc: 0.25 }, // a driver error ends in the barrier
    spin: { red: 0, sc: 0.02, vsc: 0.08 }, // a driver error that costs time but not the race
};

// By the number of cars that retire in a collision (0 .. 3 or more)
const COLLISION_CHANCES = [
    { red: 0, sc: 0.12, vsc: 0.25 },
    { red: 0.06, sc: 0.55, vsc: 0.2 },
    { red: 0.2, sc: 0.65, vsc: 0.1 },
    { red: 0.4, sc: 0.55, vsc: 0 },
];

// One roll for an incident: "red", "sc", "vsc" or null (race goes on)
export function rollRaceControl(rng, kind, retired = 0) {
    const c = kind === "collision" ? COLLISION_CHANCES[Math.min(retired, COLLISION_CHANCES.length - 1)] : CHANCES[kind];
    let r = rng.next();
    if (r < c.red) return "red";
    r -= c.red;
    if (r < c.sc) return "sc";
    r -= c.sc;
    if (r < c.vsc) return "vsc";
    return null;
}

// Speed of the field relative to racing speed while it is neutralised (1 when racing)
export function fieldSpeed(race) {
    if (race.control.mode === "sc") return SC_SPEED;
    if (race.control.mode === "vsc") return VSC_SPEED;
    return 1;
}

// Seconds the current neutralisation can still be counted on to last, as far as a team can tell: the virtual safety car
// has a timer, a safety car announces that it comes in at the end of the lap (then it is over when the leader crosses the line);
// before that announcement it lasts for at least another lap or so, which is longer than any pit stop (Infinity).
export function neutralLeft(race) {
    const c = race.control;
    if (c.mode === "vsc") return Math.max(0, c.until - race.clock);
    if (c.mode !== "sc") return 0;
    if (!c.ending) return Infinity;
    const lead = Math.max(race.order[0].pos, 0);
    return ((Math.ceil(lead) - lead) * race.track.optLapTime) / SC_SPEED;
}

// Track wetness (%) the race has to be below before a red flag can be restarted: a stoppage for rain needs the rain to ease clearly,
// any other red flag only needs conditions in which the race would not be stopped for rain
export const redRestartWet = (control) => (control.rain ? RED_RAIN_RESUME_WET : RED_RAIN_WET);
