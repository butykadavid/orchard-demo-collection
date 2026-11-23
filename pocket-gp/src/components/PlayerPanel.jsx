import { useState } from "react";
import { Wrench, X } from "lucide-react";
import { TYRE_IDS, TYRES } from "../engine/constants.js";
import { fmtGap, fmtLap } from "../engine/format.js";
import { repairTimeFor } from "../engine/incidents.js";
import { allowedTyres, wearPerLap } from "../engine/pace.js";
import { pitLossNow, neutralShare } from "../engine/pit.js";
import { tyreRuleMet } from "../engine/rules.js";
import { requestPit, setRedFlagTyre } from "../engine/race.js";
import { TyreBadge, WearBar } from "./Tyre.jsx";

export default function PlayerPanel({ race, standings }) {
    const mine = standings.map((s, idx) => ({ s, idx })).filter(({ s }) => s.car.isPlayer);
    if (mine.length === 0) {
        return (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-500">
                Spectator mode — no car to manage.
            </div>
        );
    }

    // Keep the panels in a fixed order (grid order of the drivers) so they do not swap places as positions change
    const cars = mine.slice().sort((a, b) => a.s.car.gridPos - b.s.car.gridPos);
    return (
        <>
            {cars.map(({ s, idx }) => (
                <CarPanel key={s.car.code} race={race} standings={standings} idx={idx} />
            ))}
        </>
    );
}

function CarPanel({ race, standings, idx }) {
    const [next, setNext] = useState("h");

    const s = standings[idx];
    const car = s.car;
    const behind = standings[idx + 1];
    const ahead = standings[idx - 1];
    const wear = wearPerLap(car.tyre, race.lapsTotal, car.setup.wear);
    const lapsLeft = Math.max(0, car.tyreState / wear);
    const suited = allowedTyres(race.wet);
    const onFinalLap = Math.floor(car.pos) >= race.lapsTotal - 1;
    const canPit = !car.finished && !car.pit && !onFinalLap;
    const pending = car.pitRequest !== null;
    const damaged = car.damage > 0.05;
    const repair = repairTimeFor(car.damage);
    const red = race.control.mode === "red";
    const stopCost = pitLossNow(race, neutralShare(race, repair)) + repair;
    const redTyre = car.redTyre ?? car.tyre; // compound of the free set under a red flag

    // Direct problems of this car as compact chips (the explanations live in the info panel)
    const flags = [];
    if (car.punctured) flags.push(["punct", "Puncture", "bg-red-500/20 text-red-300"]);
    else if (car.tyreState < 20 && !car.pit) flags.push(["cliff", "Worn tyres", "bg-amber-500/20 text-amber-300"]);
    if (damaged) flags.push(["dmg", `Damage +${car.damage.toFixed(1)} s/lap`, "bg-orange-500/20 text-orange-300"]);
    if (car.recover > 0 && !car.pit && car.pos >= 0) flags.push(["rec", "Recovering", "bg-amber-500/20 text-amber-300"]);
    if (!tyreRuleMet(car.allTyres) && !car.finished) {
        flags.push(["rule", onFinalLap ? "Tyre rule: DSQ" : "Tyre rule", onFinalLap ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"]);
    }
    if (car.dsq) {
        return (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-3">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-400">{car.team} — {car.code} disqualified</h3>
                <p className="text-sm">
                    {car.code} is disqualified: {car.dsq.reason}. Every car has to use at least two different compounds.
                </p>
            </div>
        );
    }

    if (car.dnf) {
        return (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-3">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-400">{car.team} — {car.code} retired</h3>
                <p className="text-sm">
                    {car.code} is out on lap {car.dnf.lap}: {car.dnf.reason}.
                </p>
            </div>
        );
    }

    const pickTyre = (id) => {
        setNext(id);
        if (pending) requestPit(race, car.code, id);
    };

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="mb-2 flex items-baseline justify-between">
                <h3 className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <span className="mr-1.5 inline-block h-3 w-1 rounded-sm align-middle" style={{ backgroundColor: car.color }} />
                    {car.name}
                </h3>
                <span className="text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-100">P{s.position}</span>
                </span>
            </div>

            <div className="mb-2 flex items-center gap-2.5">
                <TyreBadge id={car.tyre} size={28} />
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

            {flags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                    {flags.map(([key, text, style]) => (
                        <span key={key} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>
                            {text}
                        </span>
                    ))}
                </div>
            )}

            <dl className="mb-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                <Stat label="Last" value={fmtLap(car.lastLap)} />
                <Stat label="Best" value={fmtLap(car.bestLap)} />
                <Stat label={ahead ? `+ ${ahead.car.code}` : "Ahead"} value={ahead ? fmtGap(s.gapAhead, s.lapsBehindAhead) : "—"} />
                <Stat label={behind ? `− ${behind.car.code}` : "Behind"} value={behind ? fmtGap(behind.gapAhead, behind.lapsBehindAhead) : "—"} />
            </dl>

            {red ? (
                <>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Free tyre change</div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-1">
                        {TYRE_IDS.map((id) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setRedFlagTyre(race, car.code, id)}
                                className={`relative flex flex-col items-center gap-0.5 rounded-md border py-2.5 text-[10px] lg:py-1.5 ${redTyre === id ? "border-red-500 bg-red-500/10" : "border-zinc-800 hover:bg-zinc-800"}`}
                            >
                                {suited.includes(id) && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-emerald-400" />}
                                <TyreBadge id={id} size={20} />
                                {TYRES[id].name}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Next set</div>
                    <div className="mb-1.5 grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-1">
                        {TYRE_IDS.map((id) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => pickTyre(id)}
                                className={`relative flex flex-col items-center gap-0.5 rounded-md border py-2.5 text-[10px] lg:py-1.5 ${next === id ? "border-red-500 bg-red-500/10" : "border-zinc-800 hover:bg-zinc-800"
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
                        onClick={() => requestPit(race, car.code, pending ? null : next)}
                        className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-3.5 text-sm font-semibold transition-colors lg:py-2 ${pending
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
                                <Wrench size={14} /> {car.pit ? "In pit lane" : onFinalLap ? "Final lap" : `Box this lap · ~${Math.round(stopCost)} s`}
                            </>
                        )}
                    </button>
                </>
            )}
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="font-mono">{value}</dd>
        </div>
    );
}
