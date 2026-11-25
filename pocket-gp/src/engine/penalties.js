import {
    COLLISION_NO_PENALTY,
    COLLISION_SEVERITY_PER_RETIREMENT,
    DRIVE_THROUGH_ENTRIES,
    ILLEGAL_PASS_SHORT,
    PENALTY_SECONDS,
    PENALTY_SEVERITY,
    PIT_SPEEDING_CHANCE,
    PIT_SPEEDING_GAIN,
    SCRUTINEERING_FAIL,
} from "./constants.js";

// ---------------------------------------------------------------------------------------------
// Penalties
//
// Every penalty a car gets is an entry of car.penalties:
//   { lap, reason, seconds, dt, left, outcome }
//   seconds  a time penalty (null for a drive-through)       dt       true for a drive-through
//   left     pit entries still available to serve a drive-through
//   outcome  null while the penalty is pending, then "served" (in a pit stop or a drive-through), "added" (to the race time at the flag)
//            or "dsq" (a drive-through that was not served in time)
// ---------------------------------------------------------------------------------------------

export const newPenalty = (lap, reason, p) =>
    p.dt ? { lap, reason, seconds: null, dt: true, left: DRIVE_THROUGH_ENTRIES, outcome: null } : { lap, reason, seconds: p.seconds, dt: false, left: 0, outcome: null };

// Seconds of time penalty waiting for the next stop
export const pendingTime = (car) => car.penalties.reduce((s, p) => (p.outcome === null && !p.dt ? s + p.seconds : s), 0);

// The drive-through that has to be served, if any
export const pendingDriveThrough = (car) => car.penalties.find((p) => p.dt && p.outcome === null) ?? null;

export const penaltyText = (p) => (p.dt ? "drive-through" : `${p.seconds} s`);

// A collision: nothing (a racing incident), 5 s, 10 s or a drive-through, the more severe the more cars it put out of the race
export function rollCollisionPenalty(rng, victimsRetired) {
    if (rng.next() < COLLISION_NO_PENALTY) return null;
    const severity = rng.next() + COLLISION_SEVERITY_PER_RETIREMENT * victimsRetired;
    if (severity < PENALTY_SEVERITY[0]) return { seconds: PENALTY_SECONDS[0] };
    if (severity < PENALTY_SEVERITY[1]) return { seconds: PENALTY_SECONDS[1] };
    return { dt: true };
}

// An illegal overtake is mostly 5 s, sometimes 10 s
export const rollPassPenalty = (rng) => ({ seconds: rng.next() < ILLEGAL_PASS_SHORT ? PENALTY_SECONDS[0] : PENALTY_SECONDS[1] });

// Speeding in the pit lane: the seconds the car gains by it (0 when it keeps to the limit)
export const rollPitSpeeding = (rng) => (rng.next() < PIT_SPEEDING_CHANCE ? rng.range(PIT_SPEEDING_GAIN[0], PIT_SPEEDING_GAIN[1]) : 0);

// Chance that the car fails the scrutineering after the race: the base chance and what its traits add (the average over the distance it ran)
export const scrutineeringRisk = (illegal) => Math.max(0, SCRUTINEERING_FAIL + illegal);

// What a car is found to have wrong in the scrutineering: the part of the trait that carries most of the risk, or any part when it is plain bad luck
export const SCRUTINEERING_FINDINGS = {
    frontWing: "front wing flexes beyond the permitted limit",
    rearWing: "rear wing opening is outside the limit",
    brakes: "brake cooling ducts are not to the rules",
    suspension: "suspension has a hidden adjustment",
    powertrain: "fuel flow is over the limit",
    chassis: "car is under the minimum weight",
};
