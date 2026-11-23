import {
    AI_AGGRESSION,
    AI_AVG_PLACE_POINTS,
    AI_BOLD_AGGRESSION,
    AI_BOLD_DEFICIT,
    AI_FINISH_VALUE,
    AI_GRID_KEPT,
    AI_GRID_KEPT_SHORT,
    AI_GRID_KEPT_TIGHT,
    AI_PLACE_WEIGHT,
    AI_POINT_VALUE,
    QUALI_POINTS,
    RACE_POINTS,
} from "./constants.js";
import { trackMetrics } from "./parts.js";

// ---------------------------------------------------------------------------------------------
// Reverse grid weekends: the qualifying and the race both score points, the most points over the weekend wins and the better
// race result settles a tie. Everything here is also what the bots reckon with when they plan for such a weekend.
// ---------------------------------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const racePoints = (pos) => RACE_POINTS[pos - 1] ?? 0;
export const qualiPoints = (pos) => QUALI_POINTS[pos - 1] ?? 0;

// Points at a place that is not a whole number (an expectation), between the points of the two places around it
export function pointsAtRank(table, rank) {
    const r = Math.max(1, rank);
    const lo = Math.floor(r);
    const at = (k) => table[k - 1] ?? 0;
    return at(lo) + (at(lo + 1) - at(lo)) * (r - lo);
}

// Where a car is expected to finish: from the place it starts to the place its pace deserves, as far as the race gets it there.
// Where passing is hard (and in a short race) more of the start is kept to the flag.
export function expectedFinish(pace, start, tight, fraction) {
    const kept = clamp(AI_GRID_KEPT + AI_GRID_KEPT_TIGHT * tight + AI_GRID_KEPT_SHORT * (1 - fraction), 0, 0.9);
    return pace + (start - pace) * kept;
}

// What a finishing place (fractional, an expectation) is worth to a bot in race seconds: the race points it earns and, points or not,
// a little for every place
export function finishValue(finish, field) {
    return AI_POINT_VALUE * pointsAtRank(RACE_POINTS, finish) + AI_FINISH_VALUE * (field - finish);
}

// What a qualifying place (fractional) is worth in race seconds in a reverse grid weekend, where it scores points
export const qualiValue = (qRank) => AI_POINT_VALUE * pointsAtRank(QUALI_POINTS, qRank);

// Laps a car that starts in place `start` and is `pace`th quickest expects to be stuck in the field on its first stint (none when it starts
// ahead of its pace place): the places it has to make up, and more laps for each of them where passing is hard
export function heldLaps(start, pace, tight, lapsTotal) {
    return clamp(Math.max(0, start - pace) * (0.5 + 1.5 * tight), 0, lapsTotal);
}

// Right before the race of a reverse grid weekend: every car's expected weekend total (its qualifying points and the race points its
// grid place and pace point to) decides how boldly its bot plays. A car that can still win the weekend and is expected to fall short of
// the best one gambles more the further it is behind; one that cannot win but is not in the points tries something to get there.
// Boldness (0-1) widens the choice of strategy (see choosePlan) and raises the aggression of the bot.
export function setStakes(cars, track, fraction) {
    const { tight } = trackMetrics(track);
    const rows = cars.map((c) => {
        const finish = expectedFinish(c.paceRank ?? c.gridPos, c.gridPos, tight, fraction);
        return { c, finish, total: c.qualiPts + pointsAtRank(RACE_POINTS, finish) };
    });
    const best = Math.max(...rows.map((r) => r.total));
    for (const { c, finish, total } of rows) {
        const canWin = c.qualiPts + RACE_POINTS[0] >= best;
        c.boldness = canWin ? clamp((best - total) / AI_BOLD_DEFICIT, 0, 1) : finish > RACE_POINTS.length + 0.5 ? 0.3 : 0;
        c.aggression = clamp(c.aggression * (1 + AI_BOLD_AGGRESSION * c.boldness), AI_AGGRESSION[0], AI_AGGRESSION[1] * (1 + AI_BOLD_AGGRESSION));
    }
}

// How much a place is worth to a bot when it judges an undercut (gaining the place ahead of `place`) or a cover stop (keeping `place`),
// against an average place in the points: places at the front and at the edge of the points are worth more than those in the middle.
// 1 when the weekend has no points.
export function placeWeight(race, place, gain) {
    if (!race.reversed) return 1;
    const a = gain ? place - 1 : place;
    return clamp((racePoints(a) - racePoints(a + 1)) / AI_AVG_PLACE_POINTS, AI_PLACE_WEIGHT[0], AI_PLACE_WEIGHT[1]);
}

// The weekend result from the race standings (each car carries the place and points of its qualifying): best total first, a tie goes to
// the better race result. A car that retired or was disqualified has no race points.
export function weekendTable(standings) {
    return standings
        .map((s) => {
            const car = s.car;
            const out = !!(car.dnf || car.dsq);
            const racePts = out ? 0 : racePoints(s.position);
            return { car, race: s.position, out, racePts, quali: car.qualiPos, qualiPts: car.qualiPts, total: car.qualiPts + racePts };
        })
        .sort((a, b) => b.total - a.total || a.race - b.race)
        .map((r, i) => ({ ...r, position: i + 1 }));
}
