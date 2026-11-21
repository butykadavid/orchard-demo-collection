import { fmtGap } from "../engine/format.js";
import { TyreBadge } from "./Tyre.jsx";

// Phone-only summary of the player's cars shown under the track map; tapping a card opens the full car panel
export default function MobileCarStrip({ standings, onOpen }) {
    const mine = standings.filter((s) => s.car.isPlayer).sort((a, b) => a.car.gridPos - b.car.gridPos);
    if (mine.length === 0) return null;

    return (
        <div className="grid gap-2 lg:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(mine.length, 2)}, minmax(0, 1fr))` }}>
            {mine.map((s) => {
                const { car } = s;
                const alert = !car.dnf && (car.punctured || car.tyreState < 20);
                const status = car.dnf
                    ? "Retired"
                    : car.finished
                        ? "Finished"
                        : car.pit
                            ? "In pit lane"
                            : car.pitRequest !== null
                                ? "BOX this lap"
                                : s.position > 1
                                    ? fmtGap(s.gapAhead, s.lapsBehindAhead)
                                    : "Leader";
                return (
                    <button
                        key={car.code}
                        type="button"
                        onClick={onOpen}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-left ${car.pitRequest !== null
                            ? "border-amber-500 bg-amber-500/10"
                            : alert
                                ? "border-red-500/60 bg-red-500/10"
                                : "border-zinc-800 bg-zinc-900/60"
                            } ${car.dnf ? "opacity-50" : ""}`}
                    >
                        <span className="h-8 w-1 shrink-0 rounded-sm" style={{ backgroundColor: car.color }} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between text-xs">
                                <span className="font-semibold">{car.code}</span>
                                <span className="font-mono text-zinc-300">{car.dnf ? "OUT" : `P${s.position}`}</span>
                            </div>
                            <div className="truncate font-mono text-[10px] text-zinc-400">{status}</div>
                        </div>
                        {!car.dnf && (
                            <div className="flex shrink-0 flex-col items-center gap-0.5">
                                <TyreBadge id={car.tyre} size={20} />
                                <span className={`font-mono text-[10px] ${alert ? "text-red-400" : "text-zinc-400"}`}>
                                    {Math.max(0, Math.round(car.tyreState))}%
                                </span>
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
