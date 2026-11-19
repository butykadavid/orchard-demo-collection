import { DAMAGE_MAX, REPAIR_PER_DAMAGE } from "./constants.js";

// Outcome tables for driver errors and collisions.
//   loss:   seconds lost recovering (spin, gravel, limping back), taken at a crawl on track
//   damage: lap time penalty (s per lap) that stays until the car is repaired in the pits
//   retire: the car is out of the race
const TABLES = {
    // A driver makes a mistake on his own
    error: [
        { w: 45, verb: "spins", loss: [4, 10], damage: [0, 0] },
        { w: 30, verb: "runs wide", loss: [8, 16], damage: [0.3, 1.2] },
        { w: 25, retire: true },
    ],
    // One of the two cars in a collision
    collision: [
        { w: 30, verb: "continues", loss: [3, 8], damage: [0.3, 1.0] },
        { w: 35, verb: "limps on", loss: [8, 18], damage: [1.0, 3.5] },
        { w: 35, retire: true },
    ],
    // A car behind that gets caught up in somebody else's collision
    caught: [
        { w: 45, verb: "spins", loss: [3, 8], damage: [0, 0] },
        { w: 30, verb: "continues", loss: [3, 8], damage: [0.3, 1.0] },
        { w: 15, verb: "limps on", loss: [8, 18], damage: [1.0, 3.5] },
        { w: 10, retire: true },
    ],
};

export function rollIncident(rng, kind) {
    const table = TABLES[kind];
    let r = rng.next() * table.reduce((sum, o) => sum + o.w, 0);
    let pick = table[table.length - 1];
    for (const o of table) {
        r -= o.w;
        if (r <= 0) {
            pick = o;
            break;
        }
    }
    if (pick.retire) return { retire: true };
    return {
        retire: false,
        verb: pick.verb,
        loss: rng.range(pick.loss[0], pick.loss[1]),
        damage: rng.range(pick.damage[0], pick.damage[1]),
    };
}

export const addDamage = (current, extra) => Math.min(DAMAGE_MAX, current + extra);

// Time a repair adds to a pit stop (s of standing still).
export const repairTimeFor = (damage) => damage * REPAIR_PER_DAMAGE;

export function damageLabel(damage) {
    if (damage >= 2) return "heavy damage";
    if (damage >= 0.7) return "damage";
    if (damage > 0.05) return "light damage";
    return "";
}
