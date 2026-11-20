import { Trophy } from "lucide-react";
import { fmtGap, fmtLap } from "../engine/format.js";
import { TyreBadge } from "./Tyre.jsx";

export default function RaceResults({ standings, fastest, playerTeam, onBack }) {
    const mine = standings.filter((s) => s.car.isPlayer);

    return (
        <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-zinc-950/85 p-3 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
                <div className="mb-3 flex items-center gap-2">
                    <Trophy size={18} className="text-amber-400" />
                    <h2 className="text-lg font-bold tracking-tight">Final classification</h2>
                    {mine.length > 0 && (
                        <span className="ml-auto text-sm text-zinc-400">
                            {playerTeam}: {mine.map((s) => `${s.car.code} P${s.position}`).join(" · ")}
                        </span>
                    )}
                </div>

                <table className="w-full text-xs">
                    <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                        <tr className="border-b border-zinc-800">
                            <th className="w-8 py-1.5">Pos</th>
                            <th className="py-1.5">Driver</th>
                            <th className="py-1.5 text-right">Gap</th>
                            <th className="py-1.5 text-right">Best lap</th>
                            <th className="py-1.5 pl-3">Tyres</th>
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
                                </td>
                                <td className="py-0.5 text-right font-mono">
                                    {s.car.dnf ? (
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
                            </tr>
                        ))}
                    </tbody>
                </table>

                {fastest && (
                    <p className="mt-2 text-xs text-fuchsia-400">
                        Fastest lap: {fastest.name} — {fmtLap(fastest.time)} (lap {fastest.lap})
                    </p>
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
