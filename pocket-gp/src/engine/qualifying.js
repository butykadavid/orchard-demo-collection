import { TYRES } from "./constants.js";
import { lapNoise, lapTimeFor, lapsTotalFor } from "./pace.js";
import { pickStartTyre } from "./ai.js";
import { buildSetups, paceRanks, qualifyingSetup } from "./setup.js";
import { qualiPoints } from "./weekend.js";
import { waterAt } from "./weather.js";

// One-click qualifying: a single flying lap per driver on the chosen starting tyre.
// `reversed` flips the grid (slowest on pole) and scores the qualifying: the quickest laps earn points (see QUALI_POINTS) that count
// towards the weekend, so the bots weigh a fast lap against the place on the grid it costs. `cars` holds every team's parts; the
// player's team runs `playerTraits` (suggested ones when not given) and the bots choose theirs for the circuit, the forecast and,
// in a reverse grid weekend, the traffic they expect. Each result carries the `setup` the car takes into the race, the place of its
// lap time (`qualiPos`, 1 = quickest, also in a reverse grid weekend) with the points it earned, and its `paceRank` (the place the
// bots expected it to have).
export function runQualifying({ drivers, cars, track, weather, fraction, playerTeam, playerTraits, playerTyres, reversed, rng }) {
    const wet = waterAt(weather, 0, fraction);
    const lapsTotal = lapsTotalFor(track, fraction);
    const ranks = paceRanks({ drivers, cars, track });
    const setups = buildSetups({ drivers, cars, track, weather, fraction, lapsTotal, playerTeam, playerTraits, rng, ranks, reversed });

    const results = drivers.map((driver) => {
        const setup = setups.get(driver.team);
        // Drivers of the player's team start on the tyre chosen for them, everyone else on the bots' choice
        const tyre =
            driver.team === playerTeam
                ? (playerTyres[driver.code] ?? "m")
                : pickStartTyre(weather, fraction, track, rng, lapsTotal, setup.wear, { rank: ranks.get(driver.code), field: drivers.length, reversed });
        const time = lapTimeFor(driver, qualifyingSetup(setup, wet, TYRES[tyre].kind), track, tyre, 100, wet, lapNoise(rng), true);
        return { driver, tyre, time, setup, paceRank: ranks.get(driver.code) };
    });

    results
        .slice()
        .sort((a, b) => a.time - b.time)
        .forEach((r, i) => {
            r.qualiPos = i + 1;
            r.qualiPts = reversed ? qualiPoints(i + 1) : 0;
        });
    results.sort((a, b) => (reversed ? b.time - a.time : a.time - b.time));
    return results.map((r, i) => ({ ...r, gridPos: i + 1 }));
}
