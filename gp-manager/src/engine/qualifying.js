import { lapNoise, lapTimeFor, lapsTotalFor } from "./pace.js";
import { pickStartTyre } from "./ai.js";
import { waterAt } from "./weather.js";

// One-click qualifying: a single flying lap per driver on the chosen starting tyre.
// `reversed` flips the grid (slowest on pole).
export function runQualifying({ drivers, track, weather, fraction, playerCode, playerTyre, reversed, rng }) {
    const wet = waterAt(weather, 0, fraction);
    const lapsTotal = lapsTotalFor(track, fraction);

    const results = drivers.map((driver) => {
        const tyre = driver.code === playerCode ? playerTyre : pickStartTyre(weather, fraction, track, rng, lapsTotal);
        const time = lapTimeFor(driver, track, tyre, 100, wet, lapNoise(rng));
        return { driver, tyre, time };
    });

    results.sort((a, b) => (reversed ? b.time - a.time : a.time - b.time));
    return results.map((r, i) => ({ ...r, gridPos: i + 1 }));
}
