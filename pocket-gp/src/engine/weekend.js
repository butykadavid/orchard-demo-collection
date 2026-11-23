import { QUALI_POINTS, RACE_POINTS } from "./constants.js";

// ---------------------------------------------------------------------------------------------
// Reverse grid weekends: the qualifying and the race both score points, the most points over the weekend wins and the better
// race result settles a tie.
// ---------------------------------------------------------------------------------------------

export const racePoints = (pos) => RACE_POINTS[pos - 1] ?? 0;
export const qualiPoints = (pos) => QUALI_POINTS[pos - 1] ?? 0;

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
