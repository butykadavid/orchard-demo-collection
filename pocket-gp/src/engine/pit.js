import { PIT_LANE_SPAN, PIT_SPEED, PIT_STOP_EXPECTED, PIT_STOP_MAX, PIT_STOP_MIN, PIT_STOP_MODE, PIT_STOP_SD, PIT_SLOW_CHANCE, PIT_SLOW_FROM, PIT_SLOW_MEAN } from "./constants.js";
import { fieldSpeed, neutralLeft } from "./control.js";

// Time to drive through the pit lane at the speed limit (s)
export const pitDriveTime = (track) => track.pitLane / PIT_SPEED;

// Time lost by driving through the pit lane instead of racing past it (s). The pit lane replaces PIT_LANE_SPAN of a lap.
// `fieldSpeed` is the speed of the cars on track relative to racing speed: behind a safety car they cover that stretch slowly,
// so the pit lane costs less.
export const pitLaneLoss = (track, fieldSpeed = 1) => pitDriveTime(track) - (PIT_LANE_SPAN * track.optLapTime) / fieldSpeed;

// Expected total time lost by a normal stop, without repairs or waiting for a team mate (s)
export const pitLoss = (track, fieldSpeed = 1) => pitLaneLoss(track, fieldSpeed) + PIT_STOP_EXPECTED;

// Share (0..1) of a stop made now that is still covered by a safety car or virtual safety car, so that the cheap neutralised
// stop cost applies to it: 1 while the field stays slow throughout the stop, falling to 0 as the safety car comes in or the
// virtual safety car runs out. `extra` is time added to the stop by repairs and waiting for the crew (s).
export function neutralShare(race, extra = 0) {
    if (fieldSpeed(race) >= 1) return 0;
    const stopTime = pitDriveTime(race.track) + PIT_STOP_EXPECTED + extra;
    return Math.min(1, Math.max(0, neutralLeft(race) / stopTime));
}

// Expected time lost by a stop made now (s), without repairs or waiting: the neutralised and the full cost, weighted by `share`
export const pitLossNow = (race, share) => share * pitLoss(race.track, fieldSpeed(race)) + (1 - share) * pitLoss(race.track);

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
