import { SC_SPEED, VSC_SPEED } from "./constants.js";

// Race control state: the race is `green`, neutralised by a virtual safety car (`vsc`) or a safety car (`sc`),
// or stopped by a red flag (`red`).
//   sc:  lapsLeft = leader laps still to run behind the safety car, ending = it comes in at the end of this lap
//   vsc: until = race clock at which the virtual safety car period ends
//   red: phase = stopping (cars drive to the pit lane) | waiting (cars parked, tyres can be changed) |
//        awaiting (everything is ready, the race is frozen until the player restarts it)
//        gridLap = laps the leader had completed when the flag came out, rain = stopped because of the weather
//   quietUntil = leader distance (laps) before which no new neutralisation is called
export function createControl() {
    return {
        mode: "green",
        phase: null,
        since: 0,
        until: 0,
        lapsLeft: 0,
        ending: false,
        quietUntil: 0,
        lap: 0, // laps the leader has completed (to spot the leader crossing the line)
        gridLap: 0,
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

// Position on the weather timeline in laps: the leader's distance plus the time the race stood still under a red flag
export const weatherLapOf = (race) => Math.max(race.order[0].pos, 0) + race.weatherShift;
