import { useState } from "react";
import { Wrench, X } from "lucide-react";
import { PIT_LOSS, TYRE_IDS, TYRES } from "../engine/constants.js";
import { fmtGap, fmtLap } from "../engine/format.js";
import { repairTimeFor } from "../engine/incidents.js";
import { allowedTyres, wearPerLap } from "../engine/pace.js";
import { requestPit } from "../engine/race.js";
import { TyreBadge, WearBar } from "./Tyre.jsx";

export default function PlayerPanel({ race, standings }) {
    const [next, setNext] = useState("h");
    const idx = standings.findIndex((s) => s.car.isPlayer);
    if (idx === -1) {
        return (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-500">
                Spectator mode — no car to manage.
            </div>
        );
    }

    const s = standings[idx];
    const car = s.car;
    const behind = standings[idx + 1];
    const ahead = standings[idx - 1];
    const wear = wearPerLap(car.tyre, race.lapsTotal);
    const lapsLeft = Math.max(0, car.tyreState / wear);
    const suited = allowedTyres(race.wet);
    const onFinalLap = Math.floor(car.pos) >= race.lapsTotal - 1;
    const canPit = !car.finished && !car.pit && !onFinalLap;
    const pending = car.pitRequest !== null;
    const damaged = car.damage > 0.05;
    const repair = repairTimeFor(car.damage);

    if (car.dnf) {
        return (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-3">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-400">Your car — retired</h3>
                <p className="text-sm">
                    {car.code} is out on lap {car.dnf.lap}: {car.dnf.reason}.
                </p>
            </div>
        );
    }

    const pickTyre = (id) => {
        setNext(id);
        if (pending) requestPit(race, id);
    };

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Your car</h3>
                <span className="text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-100">{car.code}</span> · P{s.position}
                </span>
            </div>

            <div className="mb-3 flex items-center gap-3">
                <TyreBadge id={car.tyre} size={34} />
                <div className="flex-1">
                    <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold">{TYRES[car.tyre].name}</span>
                        <span className="font-mono text-zinc-300">{Math.max(0, Math.round(car.tyreState))}%</span>
                    </div>
                    <WearBar value={car.tyreState} className="my-1 h-1.5" />
                    <div className="text-[10px] text-zinc-500">
                        {car.pit ? "In the pit lane" : `~${lapsLeft.toFixed(1)} laps of life · ${wear.toFixed(1)}%/lap`}
                    </div>
                </div>
            </div>

            {car.punctured ? (
                <p className="mb-3 rounded-md bg-red-500/15 px-2 py-1.5 text-xs text-red-300">
                    Puncture! Limping to the pits. A tyre is fitted automatically unless you choose one below.
                </p>
            ) : (
                car.tyreState < 20 &&
                !car.pit && (
                    <p className="mb-3 rounded-md bg-amber-500/15 px-2 py-1.5 text-xs text-amber-300">
                        Tyres past the cliff: lap times are dropping and a puncture is possible.
                    </p>
                )
            )}

            {car.recover > 0 && !car.pit && car.pos >= 0 && (
                <p className="mb-3 rounded-md bg-amber-500/15 px-2 py-1.5 text-xs text-amber-300">Recovering from an incident: running slowly.</p>
            )}
            {damaged && (
                <p className="mb-3 rounded-md bg-orange-500/15 px-2 py-1.5 text-xs text-orange-300">
                    Car damage: +{car.damage.toFixed(1)} s per lap. Repairing it adds about {Math.round(repair)} s to your next stop.
                </p>
            )}

            <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-zinc-500">Last lap</dt>
                <dd className="text-right font-mono">{fmtLap(car.lastLap)}</dd>
                <dt className="text-zinc-500">Best lap</dt>
                <dd className="text-right font-mono">{fmtLap(car.bestLap)}</dd>
                <dt className="text-zinc-500">{ahead ? `Ahead (${ahead.car.code})` : "Ahead"}</dt>
                <dd className="text-right font-mono">{ahead ? fmtGap(s.gapAhead, s.lapsBehindAhead) : "—"}</dd>
                <dt className="text-zinc-500">{behind ? `Behind (${behind.car.code})` : "Behind"}</dt>
                <dd className="text-right font-mono">{behind ? fmtGap(behind.gapAhead, behind.lapsBehindAhead) : "—"}</dd>
            </dl>

            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Next set</div>
            <div className="mb-2 grid grid-cols-5 gap-1">
                {TYRE_IDS.map((id) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => pickTyre(id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[10px] ${next === id ? "border-red-500 bg-red-500/10" : "border-zinc-800 hover:bg-zinc-800"
                            }`}
                    >
                        {suited.includes(id) && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-emerald-400" />}
                        <TyreBadge id={id} size={20} />
                        {TYRES[id].name}
                    </button>
                ))}
            </div>

            <button
                type="button"
                disabled={!canPit && !pending}
                onClick={() => requestPit(race, pending ? null : next)}
                className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${pending
                    ? "pulse-box bg-amber-500 text-zinc-950 hover:bg-amber-400"
                    : "bg-red-600 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                    }`}
            >
                {pending ? (
                    <>
                        <X size={14} /> BOX THIS LAP — cancel
                    </>
                ) : (
                    <>
                        <Wrench size={14} /> {car.pit ? "In pit lane" : onFinalLap ? "Final lap" : "Box this lap"}
                    </>
                )}
            </button>
            <p className="mt-1.5 text-[10px] text-zinc-500">A stop costs about {Math.round(PIT_LOSS + repair)} s{damaged ? " including repairs" : ""}. You enter the pits at the end of the current lap.</p>
        </div>
    );
}
