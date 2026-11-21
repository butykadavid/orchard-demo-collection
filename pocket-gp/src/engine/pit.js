import { PIT_LANE_SPAN, PIT_SPEED, PIT_STOP_EXPECTED, PIT_STOP_MAX, PIT_STOP_MIN, PIT_STOP_MODE, PIT_STOP_SD, PIT_SLOW_CHANCE, PIT_SLOW_FROM, PIT_SLOW_MEAN } from "./constants.js";

// Time to drive through the pit lane at the speed limit (s)
export const pitDriveTime = (track) => track.pitLane / PIT_SPEED;

// Time lost by driving through the pit lane instead of racing past it (s). The pit lane replaces PIT_LANE_SPAN of a lap.
export const pitLaneLoss = (track) => pitDriveTime(track) - PIT_LANE_SPAN * track.optLapTime;

// Expected total time lost by a normal stop, without repairs or waiting for a team mate (s)
export const pitLoss = (track) => pitLaneLoss(track) + PIT_STOP_EXPECTED;

// Time a car has to wait for its team mate's service if it entered the pit lane now (s)
export function queueWait(race, car) {
    const busyUntil = race.teamBusyUntil.get(car.team) ?? 0;
    return Math.max(0, busyUntil - (race.clock + pitDriveTime(race.track) / 2));
}

// Service time of one stop (s): normally close to PIT_STOP_MODE (most between 2.5 and 3.0 s), with a small chance of
// a slow stop; both fast and slow extremes get steadily less likely, within PIT_STOP_MIN..PIT_STOP_MAX.
export function rollStopTime(rng) {
    let t;
    if (rng.next() < PIT_SLOW_CHANCE) {
        t = PIT_SLOW_FROM - Math.log(1 - rng.next()) * PIT_SLOW_MEAN;
    } else {
        const z = Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
        t = PIT_STOP_MODE + PIT_STOP_SD * z;
    }
    return Math.min(PIT_STOP_MAX, Math.max(PIT_STOP_MIN, t));
}
