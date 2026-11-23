import { Lock, Sparkles } from "lucide-react";
import { PART_PERF_TIERS, RATING_MAX } from "../engine/constants.js";
import { PARTS, PART_IDS, partFailChance } from "../engine/parts.js";
import { effectLines, isUnlocked, traitContext, traitFit, traitUnlockAt, traitsOfPart } from "../engine/traits.js";

function Bar({ value, className, ticks = false }) {
    return (
        <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full rounded-full ${className}`} style={{ width: `${(100 * value) / RATING_MAX}%` }} />
            {ticks && PART_PERF_TIERS.map((t) => <span key={t} className="absolute top-0 h-full w-px bg-zinc-950" style={{ left: `${(100 * t) / RATING_MAX}%` }} />)}
        </div>
    );
}

const fitLabel = (f) => `${Math.round(f * 100)}% effect here`;
const fitColor = (f) => (f >= 0.8 ? "text-emerald-400" : f >= 0.45 ? "text-amber-400" : "text-zinc-500");

// The player's car for the weekend: its six parts, what the circuit asks of them, and the traits to run (up to `setup.slots`, one per part)
export default function CarTraits({ car, setup, wet, wets = null, lapsTotal, picks, onChange, onSuggest }) {
    const ctx = traitContext(setup, lapsTotal, wet, wets);
    const full = picks.length >= setup.slots;

    const toggle = (trait) => {
        if (picks.includes(trait.id)) return onChange(picks.filter((id) => id !== trait.id));
        const rest = picks.filter((id) => !traitsOfPart(trait.part).some((t) => t.id === id));
        if (rest.length >= setup.slots) return;
        onChange([...rest, trait.id]);
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-400">
                <span>
                    Car <span className="font-mono text-zinc-200">{Math.round(setup.avgRating)}</span> · at this circuit{" "}
                    <span className="font-mono text-zinc-200">{Math.round(setup.rating)}</span> · breakdown risk{" "}
                    <span className="font-mono text-zinc-200">{(setup.failRate * 100).toFixed(1)}%</span>
                </span>
                <button type="button" onClick={onSuggest} className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800" title="Pick the traits that suit this circuit and forecast">
                    <Sparkles size={12} /> Suggest
                </button>
            </div>
            <div className="grid gap-2">
                {PART_IDS.map((id) => {
                    const part = PARTS[id];
                    const p = car[id];
                    return (
                        <div key={id} className="rounded-md border border-zinc-800 p-2">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                                <span className="font-semibold">{part.name}</span>
                                <span className="text-[10px] text-zinc-500">
                                    counts {Math.round(setup.weights[id] * 100)}% here · fails {(partFailChance(id, p.rel) * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-1 grid grid-cols-[2.5rem_1fr_2rem] items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500">
                                <span>Perf</span>
                                <Bar value={p.perf} className="bg-red-500" ticks />
                                <span className="text-right font-mono text-zinc-300">{p.perf}</span>
                                <span>Rel</span>
                                <Bar value={p.rel} className="bg-sky-500" />
                                <span className="text-right font-mono text-zinc-300">{p.rel}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5">
                                {traitsOfPart(id).length === 0 && <span className="text-[10px] text-zinc-500">No traits for this part (add some on the Customize page).</span>}
                                {traitsOfPart(id).map((t) => {
                                    const unlocked = isUnlocked(car, t);
                                    const on = picks.includes(t.id);
                                    const blocked = !on && full && !picks.some((x) => traitsOfPart(id).some((y) => y.id === x));
                                    const f = traitFit(t, ctx);
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            disabled={!unlocked || blocked}
                                            onClick={() => toggle(t)}
                                            title={t.desc}
                                            className={`flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left text-[11px] disabled:cursor-not-allowed ${on ? "border-red-500 bg-red-500/10" : "border-zinc-800 enabled:hover:bg-zinc-800"
                                                } ${unlocked ? "" : "opacity-50"} ${blocked ? "opacity-60" : ""}`}
                                        >
                                            <span className="flex items-center justify-between gap-1 font-semibold">
                                                {t.name}
                                                {!unlocked && <Lock size={11} className="shrink-0 text-zinc-500" />}
                                            </span>
                                            {unlocked ? (
                                                <>
                                                    <span className="flex flex-col text-[10px]">
                                                        {effectLines(t).map((l, i) => (
                                                            <span key={i} className={l.bad ? "text-red-400" : "text-zinc-400"}>
                                                                {l.bad ? "- " : "+ "}
                                                                {l.text}
                                                            </span>
                                                        ))}
                                                    </span>
                                                    <span className={`text-[10px] ${fitColor(f)}`}>{fitLabel(f)}</span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-zinc-500">unlocks at {traitUnlockAt(t)} performance</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
                {picks.length}/{setup.slots} traits. One per part; the stronger ones pay off only at the circuits and in the conditions that suit them.
            </p>
        </div>
    );
}
