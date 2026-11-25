import { fmtGap } from "../engine/format.js";
import { pendingDriveThrough, pendingTime } from "../engine/penalties.js";
import { TyreBadge, WearBar } from "./Tyre.jsx";

export default function TimingTower({ standings, fastestCode }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
            <div className="grid grid-cols-[1.25rem_0.25rem_2.5rem_1fr_3.5rem_3rem] items-center gap-x-2 border-b border-zinc-800 px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                <span>P</span>
                <span />
                <span>Drv</span>
                <span className="text-right">Int / Gap</span>
                <span>Tyre</span>
                <span className="text-right">Stops</span>
            </div>
            <ul>
                {standings.map((s) => {
                    const { car } = s;
                    const dsq = Boolean(car.dsq);
                    const out = Boolean(car.dnf) || dsq;
                    const interval = dsq ? "DSQ" : out ? "DNF" : s.position === 1 ? "LEADER" : fmtGap(s.gapAhead, s.lapsBehindAhead);
                    const gap = out || s.position === 1 ? "" : fmtGap(s.gapLeader, s.lapsBehindLeader);
                    const owedDt = out || car.finished ? null : pendingDriveThrough(car);
                    const owedTime = out || car.finished ? 0 : pendingTime(car);
                    return (
                        <li
                            key={car.code}
                            className={`grid grid-cols-[1.25rem_0.25rem_2.5rem_1fr_3.5rem_3rem] items-center gap-x-2 px-2 py-0.75 text-xs ${car.isPlayer ? "bg-red-500/15" : "odd:bg-zinc-900/40"
                                } ${out ? "opacity-50" : ""}`}
                            title={dsq ? `Disqualified: ${car.dsq.reason}` : out ? `Retired lap ${car.dnf.lap}: ${car.dnf.reason}` : undefined}
                        >
                            <span className="font-mono text-zinc-400">{s.position}</span>
                            <span className="h-4 w-1 rounded-sm" style={{ backgroundColor: car.color }} />
                            <span className={`font-semibold ${fastestCode === car.code ? "text-fuchsia-400" : ""}`}>{car.code}</span>
                            <span className="truncate text-right font-mono">
                                <span className={s.position === 1 && !out ? "text-zinc-400" : out ? "text-red-400" : ""}>{interval}</span>
                                {gap && <span className="ml-2 text-[10px] text-zinc-500">{gap}</span>}
                            </span>
                            <span className="flex items-center gap-1">
                                <TyreBadge id={car.tyre} size={16} />
                                <WearBar value={car.tyreState} className="w-full" />
                            </span>
                            <span className="text-right font-mono text-zinc-400">
                                {dsq ? "DSQ" : car.finished ? "FIN" : out ? "OUT" : car.pit || car.parked ? <span className="text-amber-400">PIT</span> : car.punctured ? <span className="text-red-400">PNC</span> : (
                                    <>
                                        {owedDt ? (
                                            <span className="mr-1 text-red-400" title="Drive-through penalty to serve">
                                                DT
                                            </span>
                                        ) : (
                                            owedTime > 0 && (
                                                <span className="mr-1 text-yellow-300" title={`Time penalty of ${owedTime} s to serve at the next stop`}>
                                                    +{owedTime}
                                                </span>
                                            )
                                        )}
                                        {car.damage > 0.05 && (
                                            <span className="mr-1 text-orange-400" title={`Damage: +${car.damage.toFixed(1)} s/lap`}>
                                                DMG
                                            </span>
                                        )}
                                        {car.stops}
                                    </>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
