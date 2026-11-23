import { SIM_DT } from "./constants.js";
import { carRating } from "./parts.js";
import { runQualifying } from "./qualifying.js";
import { createRace, getStandings, simulateToEnd } from "./race.js";
import { createRng } from "./rng.js";
import { flatCar } from "./setup.js";
import { getTrait, traitUnlockAt } from "./traits.js";
import { createWeather } from "./weather.js";

// ---------------------------------------------------------------------------------------------
// Trait test bench
//
// Puts a number on a trait: a team from the middle of the grid runs whole race weekends (qualifying and race) with the trait
// and without it, in pairs that share the circuit, the weather and the random seed, and the average difference in grid and finishing
// position is what the trait is worth. The rest of the field does not change between the two runs. The team's car is lifted just far
// enough in the trait's part for the trait to unlock, in both runs, so the comparison is fair.
// A race has a lot of luck in it: the result says how sure it is (the +/- is a 95% margin), a handful of races says very little.
// ---------------------------------------------------------------------------------------------

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// Average and 95% margin of the average
function summary(xs) {
    const m = mean(xs);
    if (xs.length < 2) return { mean: m, margin: null };
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
    return { mean: m, margin: (1.96 * sd) / Math.sqrt(xs.length) };
}

// The team that stands in for the field: the one with the car in the middle of the grid
export function benchTeam(drivers, cars) {
    const teams = [...new Set(drivers.map((d) => d.team))];
    const rated = teams.map((team) => ({ team, rating: carRating(cars[team] ?? flatCar()) })).sort((a, b) => a.rating - b.rating);
    return rated[Math.floor(rated.length / 2)].team;
}

// One race weekend for `team` running `picks`: the team's average grid and finishing position and how many of its cars did not finish
function weekend({ drivers, cars, track, seed, fraction, team, picks }) {
    const weather = createWeather(createRng(seed ^ (track.id * 7919)), track);
    const tyres = Object.fromEntries(drivers.filter((d) => d.team === team).map((d) => [d.code, "m"]));
    const grid = runQualifying({ drivers, cars, track, weather, fraction, playerTeam: team, playerTraits: picks, playerTyres: tyres, reversed: false, rng: createRng(seed + 1) });
    // every car is run by the bots, so the team makes its own pit stops
    const race = createRace({ grid, track, weather, fraction, playerTeam: null, rng: createRng(seed + 2) });
    simulateToEnd(race, SIM_DT);
    const mine = getStandings(race).filter((s) => s.car.team === team);
    return {
        grid: mean(grid.filter((r) => r.driver.team === team).map((r) => r.gridPos)),
        finish: mean(mine.map((s) => s.position)),
        out: mine.filter((s) => s.car.dnf || s.car.dsq).length,
    };
}

// Runs the bench for one trait over the given circuits, `runs` weekends on each. Resolves with the result; `onProgress` gets the share
// done (0-1) and the work is split up so the page stays responsive. Setting `signal.aborted` stops it early (the result covers what ran).
export async function runTraitBench({ drivers, cars, tracks, traitId, runs = 4, fraction = 0.25, seed = 1, onProgress, signal }) {
    const trait = getTrait(traitId);
    if (!trait) throw new Error("Unknown trait");
    const team = benchTeam(drivers, cars);
    const base = cars[team] ?? flatCar();
    const testCars = { ...cars, [team]: { ...base, [trait.part]: { ...base[trait.part], perf: Math.max(base[trait.part].perf, traitUnlockAt(trait)) } } };

    const jobs = tracks.flatMap((track) => Array.from({ length: runs }, (_, k) => ({ track, seed: seed + k * 7919 + track.id * 31 })));
    const samples = [];
    for (let i = 0; i < jobs.length; i++) {
        if (signal?.aborted) break;
        const { track, seed: s } = jobs[i];
        const common = { drivers, cars: testCars, track, seed: s, fraction, team };
        const withTrait = weekend({ ...common, picks: [traitId] });
        const without = weekend({ ...common, picks: [] });
        samples.push({ track, withTrait, without });
        onProgress?.((i + 1) / jobs.length);
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const diff = (list, key) => list.map((s) => s.without[key] - s.withTrait[key]); // positive: the trait helped
    return {
        team,
        runs: samples.length,
        grid: summary(diff(samples, "grid")), // positions gained on the grid
        finish: summary(diff(samples, "finish")), // positions gained in the race
        retired: { withTrait: mean(samples.map((s) => s.withTrait.out)), without: mean(samples.map((s) => s.without.out)) }, // cars out of the race, per weekend
        position: mean(samples.map((s) => s.without.finish)), // where the team finishes without the trait
        perTrack: tracks.map((track) => {
            const own = samples.filter((s) => s.track === track);
            return { track, runs: own.length, grid: mean(diff(own, "grid")), finish: mean(diff(own, "finish")) };
        }),
    };
}
