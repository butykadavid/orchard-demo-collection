import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { fmtGap, fmtLap } from "../engine/format.js";
import { penaltyText } from "../engine/penalties.js";
import { buildRaceStats } from "../engine/stats.js";
import { racePoints, weekendTable } from "../engine/weekend.js";
import { TyreBadge } from "./Tyre.jsx";
import { LapTimesChart, PositionsChart, StrategyPanel, SummaryPanel, TraitsPanel } from "./RaceStats.jsx";

const TABS = [
    { id: "result", label: "Classification" },
    { id: "summary", label: "Summary" },
    { id: "positions", label: "Positions" },
    { id: "laps", label: "Lap times" },
    { id: "strategy", label: "Strategy" },
    { id: "traits", label: "Traits" },
];

// A reverse grid weekend ends with the weekend result: qualifying and race points together
const WEEKEND_TAB = { id: "weekend", label: "Weekend" };

function DriverCell({ car }) {
    return (
        <>
            <span className="mr-2 inline-block h-3 w-1 rounded-sm align-middle" style={{ backgroundColor: car.color }} />
            <span className="font-semibold">{car.code}</span> <span className="text-zinc-400">{car.name}</span>
        </>
    );
}

function WeekendPanel({ table }) {
    const winner = table[0];
    return (
        <>
            <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr className="border-b border-zinc-800">
                        <th className="w-8 py-1.5">Pos</th>
                        <th className="py-1.5">Driver</th>
                        <th className="py-1.5 text-right">Qualifying</th>
                        <th className="py-1.5 text-right">Race</th>
                        <th className="py-1.5 text-right">Points</th>
                    </tr>
                </thead>
                <tbody>
                    {table.map((r) => (
                        <tr key={r.car.code} className={r.car.isPlayer ? "bg-red-500/15" : "odd:bg-zinc-800/30"}>
                            <td className="py-0.5 font-mono text-zinc-400">{r.position}</td>
                            <td className="py-0.5">
                                <DriverCell car={r.car} />
                            </td>
                            <td className="py-0.5 text-right font-mono">
                                <span className="text-zinc-500">P{r.quali}</span> <span className="inline-block w-8">{r.qualiPts > 0 ? `+${r.qualiPts}` : ""}</span>
                            </td>
                            <td className="py-0.5 text-right font-mono">
                                {r.car.dsq ? <span className="text-red-400">DSQ</span> : r.car.dnf ? <span className="text-red-400">DNF</span> : <span className="text-zinc-500">P{r.race}</span>}{" "}
                                <span className="inline-block w-8">{r.racePts > 0 ? `+${r.racePts}` : ""}</span>
                            </td>
                            <td className="py-0.5 text-right font-mono font-semibold">{r.total}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="mt-2 text-xs text-amber-400">
                Weekend winner: {winner.car.name} — {winner.total} points (qualifying {winner.qualiPts} + race {winner.racePts}). Equal points: the better race result wins.
            </p>
        </>
    );
}

export default function RaceResults({ race, standings, fastest, playerTeam, onBack }) {
    const mine = standings.filter((s) => s.car.isPlayer);
    const reversed = race.reversed;
    const [tab, setTab] = useState(reversed ? "weekend" : "result");
    const stats = useMemo(() => buildRaceStats(race, standings), [race, standings]);
    const weekend = useMemo(() => (reversed ? weekendTable(standings) : null), [reversed, standings]);
    const tabs = reversed ? [WEEKEND_TAB, ...TABS] : TABS;

    return (
        <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-zinc-950/85 p-3 backdrop-blur-sm">
            <div className="my-auto w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
                <div className="mb-3 flex items-center gap-2">
                    <Trophy size={18} className="text-amber-400" />
                    <h2 className="text-lg font-bold tracking-tight">{race.track.location}</h2>
                    {mine.length > 0 && (
                        <span className="ml-auto text-sm text-zinc-400">
                            {playerTeam}: {mine.map((s) => `${s.car.code} P${s.position}`).join(" · ")}
                        </span>
                    )}
                </div>

                <div className="mb-3 flex overflow-x-auto rounded-md border border-zinc-700">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`flex-1 whitespace-nowrap px-3 py-1.5 text-xs font-medium ${tab === t.id ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "weekend" && weekend && <WeekendPanel table={weekend} />}
                {tab === "summary" && <SummaryPanel stats={stats} />}
                {tab === "positions" && <PositionsChart stats={stats} />}
                {tab === "laps" && <LapTimesChart stats={stats} />}
                {tab === "strategy" && <StrategyPanel stats={stats} />}
                {tab === "traits" && <TraitsPanel stats={stats} />}
                {tab === "result" && (
                    <>

                        <table className="w-full text-xs">
                            <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                                <tr className="border-b border-zinc-800">
                                    <th className="w-8 py-1.5">Pos</th>
                                    <th className="py-1.5">Driver</th>
                                    <th className="py-1.5 text-right">Gap</th>
                                    <th className="py-1.5 text-right">Best lap</th>
                                    <th className="py-1.5 pl-3">Tyres</th>
                                    {reversed && <th className="py-1.5 pl-3 text-right">Pts</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {standings.map((s) => (
                                    <tr key={s.car.code} className={s.car.isPlayer ? "bg-red-500/15" : "odd:bg-zinc-800/30"}>
                                        <td className="py-0.5 font-mono text-zinc-400">{s.position}</td>
                                        <td className="py-0.5">
                                            <span className="mr-2 inline-block h-3 w-1 rounded-sm align-middle" style={{ backgroundColor: s.car.color }} />
                                            <span className="font-semibold">{s.car.code}</span>{" "}
                                            <span className="text-zinc-400">{s.car.name}</span>
                                            {s.car.penalties.map((p, i) => (
                                                <span
                                                    key={i}
                                                    className={`ml-1 rounded px-1 font-mono text-[10px] ${p.outcome === "dsq" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/15 text-yellow-300"}`}
                                                    title={`Lap ${p.lap}: ${penaltyText(p)} for ${p.reason}${p.outcome ? ` (${p.outcome})` : ""}`}
                                                >
                                                    {p.dt ? "DT" : `+${p.seconds}s`}
                                                </span>
                                            ))}
                                        </td>
                                        <td className="py-0.5 text-right font-mono">
                                            {s.car.dsq ? (
                                                <span className="text-red-400" title={s.car.dsq.reason}>
                                                    DSQ · {s.car.dsq.reason}
                                                </span>
                                            ) : s.car.dnf ? (
                                                <span className="text-red-400" title={s.car.dnf.reason}>
                                                    DNF L{s.car.dnf.lap} · {s.car.dnf.reason}
                                                </span>
                                            ) : s.position === 1 ? (
                                                "Winner"
                                            ) : (
                                                fmtGap(s.gapLeader, s.lapsBehindLeader)
                                            )}
                                        </td>
                                        <td className={`py-0.5 text-right font-mono ${fastest?.code === s.car.code ? "text-fuchsia-400" : ""}`}>
                                            {fmtLap(s.car.bestLap)}
                                        </td>
                                        <td className="py-0.5 pl-3">
                                            <span className="flex gap-0.5">
                                                {s.car.allTyres.split("").map((t, i) => (
                                                    <TyreBadge key={i} id={t} size={14} />
                                                ))}
                                            </span>
                                        </td>
                                        {reversed && (
                                            <td className="py-0.5 pl-3 text-right font-mono text-amber-400">
                                                {s.car.dnf || s.car.dsq ? "" : racePoints(s.position) || ""}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {race.cancelled && (
                            <p className="mt-2 text-xs text-red-300">
                                Race cancelled after {race.cancelled.laps} of {race.lapsTotal} laps: the conditions did not improve in time, so the order at the red flag is the result.
                            </p>
                        )}
                        {fastest && (
                            <p className="mt-2 text-xs text-fuchsia-400">
                                Fastest lap: {fastest.name} — {fmtLap(fastest.time)} (lap {fastest.lap})
                            </p>
                        )}
                    </>
                )}

                <div className="mt-4 flex justify-end">
                    <button type="button" onClick={onBack} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                        Back to setup
                    </button>
                </div>
            </div>
        </div>
    );
}
