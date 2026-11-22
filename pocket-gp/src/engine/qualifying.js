import { lapNoise, lapTimeFor, lapsTotalFor } from "./pace.js";
import { pickStartTyre } from "./ai.js";
import { buildSetups } from "./setup.js";
import { waterAt } from "./weather.js";

// One-click qualifying: a single flying lap per driver on the chosen starting tyre.
// `reversed` flips the grid (slowest on pole). `cars` holds every team's parts; the player's team runs `playerTraits`
// (suggested ones when not given) and the bots choose theirs for the circuit and the forecast. Each result carries the
// `setup` the car takes into the race.
export function runQualifying({ drivers, cars, track, weather, fraction, playerTeam, playerTraits, playerTyres, reversed, rng }) {
    const wet = waterAt(weather, 0, fraction);
    const lapsTotal = lapsTotalFor(track, fraction);
    const setups = buildSetups({ drivers, cars, track, weather, fraction, lapsTotal, playerTeam, playerTraits, rng });

    const results = drivers.map((driver) => {
        const setup = setups.get(driver.team);
        // Drivers of the player's team start on the tyre chosen for them, everyone else on the bots' choice
        const tyre = driver.team === playerTeam ? (playerTyres[driver.code] ?? "m") : pickStartTyre(weather, fraction, track, rng, lapsTotal, setup.wear);
        const time = lapTimeFor(driver, setup, track, tyre, 100, wet, lapNoise(rng), true);
        return { driver, tyre, time, setup };
    });

    results.sort((a, b) => (reversed ? b.time - a.time : a.time - b.time));
    return results.map((r, i) => ({ ...r, gridPos: i + 1 }));
}
