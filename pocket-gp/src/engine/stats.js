import { fmtLap } from "./format.js";

// Post-race statistics, built from the per-lap, pit and overtake records the race keeps for every car

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const stdev = (a) => {
    const m = mean(a);
    return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};

// Tyre stints: a stop is made during lap `lap` and the new tyres start on the lap after it
function buildStints(car, lapsTotal) {
    const tyres = car.allTyres.split("");
    const end = car.finished ? lapsTotal : car.dnf ? Math.min(lapsTotal, car.dnf.lap) : lapsTotal;
    const stints = [];
    let from = 1;
    tyres.forEach((tyre, i) => {
        const to = i < car.pitLog.length ? Math.min(car.pitLog[i].lap, end) : end;
        const laps = to - from + 1;
        if (laps > 0) {
            const clean = car.lapLog.filter((l) => !l.slow && l.lap >= from && l.lap <= to).map((l) => l.time);
            stints.push({ tyre, from, to, laps, avg: clean.length ? mean(clean) : null });
        }
        from = Math.max(from, to + 1);
    });
    return stints;
}

export function buildRaceStats(race, standings) {
    const lapsTotal = race.lapsTotal;

    const rows = standings.map((s) => {
        const car = s.car;
        const status = car.dsq ? "dsq" : car.dnf ? "dnf" : "finished";
        const clean = car.lapLog.filter((l) => !l.slow).map((l) => l.time);
        const positions = [car.gridPos];
        for (const l of car.lapLog) positions[l.lap] = l.pos;
        if (status === "finished") positions[lapsTotal] = s.position;
        const stops = car.pitLog.filter((p) => !p.red);
        return {
            code: car.code,
            name: car.name,
            color: car.color,
            isPlayer: car.isPlayer,
            grid: car.gridPos,
            position: s.position,
            status,
            gained: status === "finished" ? car.gridPos - s.position : null,
            overtakes: car.overtakes,
            overtaken: car.overtaken,
            stops: stops.length,
            redChanges: car.pitLog.length - stops.length,
            avgStop: stops.length ? mean(stops.map((p) => p.stand)) : null,
            best: car.bestLap,
            avg: clean.length ? mean(clean) : null,
            consistency: clean.length >= 3 ? stdev(clean) : null,
            cleanLaps: clean.length,
            positions,
            stints: buildStints(car, lapsTotal),
            pitLog: car.pitLog,
            lapLog: car.lapLog,
        };
    });

    const finishers = rows.filter((r) => r.status === "finished");
    const awards = [];

    if (race.fastest) {
        awards.push({ key: "fastest", title: "Fastest lap", code: race.fastest.code, name: race.fastest.name, detail: `${fmtLap(race.fastest.time)} on lap ${race.fastest.lap}` });
    }

    const climber = finishers.filter((r) => r.gained > 0).sort((a, b) => b.gained - a.gained || b.overtakes - a.overtakes || a.position - b.position)[0];
    if (climber) {
        awards.push({
            key: "day",
            title: "Driver of the day",
            code: climber.code,
            name: climber.name,
            detail: `+${climber.gained} places (P${climber.grid} to P${climber.position})`,
        });
    }

    const passer = rows.filter((r) => r.overtakes > 0).sort((a, b) => b.overtakes - a.overtakes || a.position - b.position)[0];
    if (passer) {
        awards.push({ key: "passes", title: "Most overtakes", code: passer.code, name: passer.name, detail: `${passer.overtakes} on-track pass${passer.overtakes === 1 ? "" : "es"}` });
    }

    let stop = null;
    for (const r of rows) {
        for (const p of r.pitLog) {
            if (!p.red && p.stand > 0 && (!stop || p.stand < stop.time)) stop = { code: r.code, name: r.name, time: p.stand, lap: p.lap };
        }
    }
    if (stop) awards.push({ key: "stop", title: "Fastest pit stop", code: stop.code, name: stop.name, detail: `${stop.time.toFixed(2)} s standing, lap ${stop.lap}` });

    const pace = finishers.filter((r) => r.cleanLaps >= 5).sort((a, b) => a.avg - b.avg)[0];
    if (pace) awards.push({ key: "pace", title: "Best race pace", code: pace.code, name: pace.name, detail: `${fmtLap(pace.avg)} average on clean laps` });

    const winner = standings.find((s) => s.car.finished && !s.car.dsq)?.car ?? null;
    const summary = {
        laps: lapsTotal,
        raceTime: winner ? winner.finishTime : null,
        counts: race.counts,
        retirements: rows.filter((r) => r.status === "dnf").length,
        disqualified: rows.filter((r) => r.status === "dsq").length,
        overtakes: rows.reduce((n, r) => n + r.overtakes, 0),
        stops: rows.reduce((n, r) => n + r.stops, 0),
    };

    return { rows, awards, summary, lapsTotal };
}
