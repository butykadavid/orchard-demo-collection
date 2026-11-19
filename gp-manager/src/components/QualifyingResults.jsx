import { ArrowLeft, Flag } from "lucide-react";
import { TEAMS, TYRES } from "../engine/constants.js";
import { fmtLap } from "../engine/format.js";
import { TyreBadge } from "./Tyre.jsx";

export default function QualifyingResults({ results, track, reversed, playerCode, onBack, onStartRace }) {
    const pole = results.find((r) => r.gridPos === 1);
    const best = Math.min(...results.map((r) => r.time));

    return (
        <div className="mx-auto max-w-2xl p-3 md:p-6">
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold tracking-tight">Qualifying — {track.location}</h1>
                    <p className="text-xs text-zinc-500">
                        {reversed ? "Reversed grid: slowest car starts on pole" : `Pole: ${pole.driver.name}`}
                    </p>
                </div>
            </header>

            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
                <table className="w-full text-sm">
                    <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                        <tr className="border-b border-zinc-800">
                            <th className="w-10 px-3 py-2">Pos</th>
                            <th className="px-2 py-2">Driver</th>
                            <th className="hidden px-2 py-2 sm:table-cell">Team</th>
                            <th className="px-2 py-2">Tyre</th>
                            <th className="px-3 py-2 text-right">Time</th>
                            <th className="px-3 py-2 text-right">Gap</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r) => {
                            const mine = r.driver.code === playerCode;
                            return (
                                <tr key={r.driver.code} className={mine ? "bg-red-500/10" : "odd:bg-zinc-900/40"}>
                                    <td className="px-3 py-1 font-mono text-zinc-400">{r.gridPos}</td>
                                    <td className="px-2 py-1">
                                        <span className="mr-2 inline-block h-3 w-1 rounded-sm align-middle" style={{ backgroundColor: TEAMS[r.driver.team]?.color }} />
                                        <span className="font-semibold">{r.driver.code}</span>{" "}
                                        <span className="text-zinc-400">{r.driver.name}</span>
                                    </td>
                                    <td className="hidden px-2 py-1 text-zinc-400 sm:table-cell">{TEAMS[r.driver.team]?.label}</td>
                                    <td className="px-2 py-1" title={TYRES[r.tyre].name}>
                                        <TyreBadge id={r.tyre} size={18} />
                                    </td>
                                    <td className="px-3 py-1 text-right font-mono">{fmtLap(r.time)}</td>
                                    <td className="px-3 py-1 text-right font-mono text-zinc-500">
                                        {r.time === best ? "" : `+${Math.abs(r.time - best).toFixed(3)}`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-3 flex justify-between">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                    <ArrowLeft size={14} /> Setup
                </button>
                <button
                    type="button"
                    onClick={onStartRace}
                    className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                >
                    <Flag size={14} /> Go to race
                </button>
            </div>
        </div>
    );
}
