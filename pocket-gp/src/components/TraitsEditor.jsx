import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical, Plus, Square, Trash2 } from "lucide-react";
import { MAX_TRAITS } from "../data/customization.js";
import { CARS, DRIVERS, TRACKS } from "../data/index.js";
import { PART_PERF_TIERS, RACE_FRACTIONS } from "../engine/constants.js";
import { lapsTotalFor } from "../engine/pace.js";
import { PARTS, PART_IDS, trackProfile } from "../engine/parts.js";
import { COND, KINDS, KIND_NAMES, METRICS, RANGE_MODES, STATS, STAT_IDS, effectLines, newCondition, newTrait, traitContext, traitValue } from "../engine/traits.js";
import { runTraitBench } from "../engine/traitBench.js";
import { Hint, IconButton, NumInput, inputClass } from "./CustomizeControls.jsx";

const selectClass = `${inputClass} border-zinc-700`;
const labelClass = "text-[10px] uppercase tracking-wider text-zinc-500";
const smallButton = "flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40";

const MODE_NAMES = { range: "between", rising: "builds up", falling: "fades out" };
const BENCH_RUNS = [2, 4, 8];

const signed = (v, digits = 2) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(digits)}`;
const tone = (v) => (v > 0.005 ? "text-emerald-400" : v < -0.005 ? "text-red-400" : "text-zinc-400");

// ---------------------------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------------------------

function ConditionRow({ c, onChange, onRemove }) {
    const range = COND[c.type].range;
    return (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950/40 px-1.5 py-1 text-xs">
            <span className="w-28 shrink-0 text-zinc-400">{COND[c.type].label}</span>
            {c.type === "air" && (
                <select value={c.value} onChange={(e) => onChange({ ...c, value: e.target.value })} className={`${selectClass} w-auto`} aria-label="Air">
                    <option value="clean">clean air</option>
                    <option value="traffic">following another car</option>
                </select>
            )}
            {c.type === "zone" && (
                <select value={c.value} onChange={(e) => onChange({ ...c, value: e.target.value })} className={`${selectClass} w-auto`} aria-label="Where on the track">
                    <option value="straight">straights and braking zones</option>
                    <option value="corner">corners</option>
                </select>
            )}
            {c.type === "chaotic" && <span className="text-zinc-500">first lap and after a standing restart</span>}
            {c.type === "compound" &&
                KINDS.map((k) => (
                    <label key={k} className="flex items-center gap-1 text-zinc-300">
                        <input
                            type="checkbox"
                            checked={c.kinds.includes(k)}
                            onChange={(e) => {
                                const kinds = KINDS.filter((x) => (x === k ? e.target.checked : c.kinds.includes(x)));
                                if (kinds.length) onChange({ ...c, kinds });
                            }}
                        />
                        {KIND_NAMES[k]}
                    </label>
                ))}
            {c.type === "track" && (
                <select value={c.metric} onChange={(e) => onChange({ ...c, metric: e.target.value })} className={`${selectClass} w-auto`} aria-label="Circuit characteristic">
                    {Object.entries(METRICS).map(([id, label]) => (
                        <option key={id} value={id}>
                            {label}
                        </option>
                    ))}
                </select>
            )}
            {range && (
                <>
                    <select value={c.mode} onChange={(e) => onChange({ ...c, mode: e.target.value })} className={`${selectClass} w-auto`} aria-label="Mode">
                        {RANGE_MODES.map((m) => (
                            <option key={m} value={m}>
                                {MODE_NAMES[m]}
                            </option>
                        ))}
                    </select>
                    <NumInput value={c.min} onChange={(min) => onChange({ ...c, min })} min={range.lo} max={c.max} integer={range.int} className="w-14" />
                    <span className="text-zinc-500">to</span>
                    <NumInput value={c.max} onChange={(max) => onChange({ ...c, max })} min={c.min} max={range.hi} integer={range.int} className="w-14" />
                    {range.unit && <span className="text-zinc-500">{range.unit}</span>}
                </>
            )}
            <span className="ml-auto">
                <IconButton onClick={onRemove} title="Remove condition">
                    <Trash2 size={13} />
                </IconButton>
            </span>
        </div>
    );
}

// ---------------------------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------------------------

function EffectRow({ effect, onChange, onRemove }) {
    const stat = STATS[effect.stat];
    const line = effectLines({ effects: [effect], drawbacks: [] })[0];
    const used = effect.when.map((c) => c.type);
    const free = stat.conditions.filter((t) => !used.includes(t));
    const percent = stat.pctUnit;
    const limit = percent ? Math.round(stat.max * 100) : stat.max;

    return (
        <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 p-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <select
                    value={effect.stat}
                    onChange={(e) => onChange({ ...effect, stat: e.target.value })}
                    className={`${selectClass} w-auto min-w-36`}
                    aria-label="What it changes"
                >
                    {STAT_IDS.map((id) => (
                        <option key={id} value={id}>
                            {STATS[id].label}
                        </option>
                    ))}
                </select>
                <NumInput
                    value={percent ? +(effect.amount * 100).toFixed(1) : effect.amount}
                    onChange={(v) => onChange({ ...effect, amount: percent ? v / 100 : v })}
                    min={-limit}
                    max={limit}
                    className="w-20"
                />
                <span className="w-9 text-xs text-zinc-500">{percent ? "%" : stat.unit}</span>
                <span className={`min-w-0 flex-1 text-xs ${line.bad ? "text-red-400" : "text-emerald-400"}`}>{line.text}</span>
                <IconButton onClick={onRemove} title="Remove effect">
                    <Trash2 size={13} />
                </IconButton>
            </div>
            {effect.when.map((c, i) => (
                <ConditionRow
                    key={c.type}
                    c={c}
                    onChange={(next) => onChange({ ...effect, when: effect.when.map((x, j) => (j === i ? next : x)) })}
                    onRemove={() => onChange({ ...effect, when: effect.when.filter((_, j) => j !== i) })}
                />
            ))}
            {free.length > 0 && (
                <select
                    value=""
                    onChange={(e) => e.target.value && onChange({ ...effect, when: [...effect.when, newCondition(e.target.value)] })}
                    className={`${selectClass} w-auto text-zinc-400`}
                    aria-label="Add a condition"
                >
                    <option value="">+ Add a condition</option>
                    {free.map((t) => (
                        <option key={t} value={t}>
                            {COND[t].label}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
}

function EffectList({ title, hint, list, blank, onChange }) {
    return (
        <div>
            <div className="mb-1 flex items-baseline gap-2">
                <span className="text-xs font-semibold text-zinc-300">{title}</span>
                <span className="text-[10px] text-zinc-500">{hint}</span>
            </div>
            <div className="space-y-1.5">
                {list.map((e, i) => (
                    <EffectRow key={i} effect={e} onChange={(next) => onChange(list.map((x, j) => (j === i ? next : x)))} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
                ))}
            </div>
            <button type="button" onClick={() => onChange([...list, blank()])} className={`${smallButton} mt-1.5`}>
                <Plus size={13} /> Add
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------------------------
// Test bench
// ---------------------------------------------------------------------------------------------

function Gain({ label, stat }) {
    return (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
            <div className={labelClass}>{label}</div>
            <div className={`font-mono text-sm ${tone(stat.mean)}`}>
                {signed(stat.mean)} {stat.margin !== null && <span className="text-xs text-zinc-500">&plusmn; {stat.margin.toFixed(2)}</span>}
            </div>
        </div>
    );
}

function BenchPanel({ trait }) {
    const [picked, setPicked] = useState(() => TRACKS.slice(0, 3).map((t) => t.id));
    const [runs, setRuns] = useState(4);
    const [fraction, setFraction] = useState(RACE_FRACTIONS[0]);
    const [state, setState] = useState({ status: "idle", progress: 0, result: null, key: null });
    const signalRef = useRef({ aborted: false });
    const key = JSON.stringify(trait);

    // A run in progress belongs to the trait that was open; leaving it stops the run
    useEffect(() => {
        return () => {
            signalRef.current.aborted = true;
        };
    }, []);

    const tracks = TRACKS.filter((t) => picked.includes(t.id));
    const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    // What the bots reckon the trait is worth: race seconds per race over the chosen circuits, dry
    const botValue = tracks.length ? tracks.reduce((s, t) => s + traitValue(trait, traitContext(trackProfile(t), lapsTotalFor(t, fraction), 0)), 0) / tracks.length : 0;

    const run = async () => {
        const signal = { aborted: false };
        signalRef.current = signal;
        setState({ status: "running", progress: 0, result: null, key });
        try {
            const result = await runTraitBench({
                drivers: DRIVERS,
                cars: CARS,
                tracks,
                traitId: trait.id,
                runs,
                fraction,
                onProgress: (progress) => !signal.aborted && setState((s) => ({ ...s, progress })),
                signal,
            });
            if (signalRef.current === signal) setState(result.runs ? { status: "done", progress: 1, result, key } : { status: "idle", progress: 0, result: null, key: null });
        } catch {
            if (signalRef.current === signal) setState({ status: "idle", progress: 0, result: null, key: null });
        }
    };

    const stop = () => {
        signalRef.current.aborted = true;
    };

    const running = state.status === "running";
    const { result } = state;

    return (
        <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
            <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-zinc-300">Test bench</span>
                <span className="text-[10px] text-zinc-500">
                    A mid-grid team runs full weekends with and without this trait (same circuit, weather and luck); the gain in positions is what the trait is worth.
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {TRACKS.map((t) => (
                    <label
                        key={t.id}
                        className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] ${picked.includes(t.id) ? "border-red-500 bg-red-500/15 text-zinc-100" : "border-zinc-700 text-zinc-400"}`}
                    >
                        <input type="checkbox" className="sr-only" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} disabled={running} />
                        {t.location}
                    </label>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <label className="flex items-center gap-1.5">
                    Weekends per circuit
                    <select value={runs} onChange={(e) => setRuns(Number(e.target.value))} disabled={running} className={`${selectClass} w-auto`}>
                        {BENCH_RUNS.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-1.5">
                    Race length
                    <select value={fraction} onChange={(e) => setFraction(Number(e.target.value))} disabled={running} className={`${selectClass} w-auto`}>
                        {RACE_FRACTIONS.map((f) => (
                            <option key={f} value={f}>
                                {f * 100}%
                            </option>
                        ))}
                    </select>
                </label>
                {running ? (
                    <button type="button" onClick={stop} className={smallButton}>
                        <Square size={13} /> Stop ({Math.round(state.progress * 100)}%)
                    </button>
                ) : (
                    <button type="button" onClick={run} disabled={!tracks.length} className={smallButton}>
                        <FlaskConical size={13} /> Run test
                    </button>
                )}
                <span className="ml-auto" title="How much the bots reckon the trait is worth in a dry race, in seconds over the race distance">
                    Bots rate it <span className={`font-mono ${tone(botValue)}`}>{signed(botValue, 1)} s</span> per race
                </span>
            </div>
            {running && (
                <div className="h-1 overflow-hidden rounded bg-zinc-800">
                    <div className="h-full bg-red-500" style={{ width: `${Math.round(state.progress * 100)}%` }} />
                </div>
            )}
            {result && (
                <div className="space-y-2">
                    {state.key !== key && <p className="text-[11px] text-amber-400">The trait has changed since this test.</p>}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Gain label="Grid positions gained" stat={result.grid} />
                        <Gain label="Race positions gained" stat={result.finish} />
                        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
                            <div className={labelClass}>Retirements per weekend</div>
                            <div className="font-mono text-sm text-zinc-300">
                                {result.retired.withTrait.toFixed(2)} <span className="text-xs text-zinc-500">vs {result.retired.without.toFixed(2)} without</span>
                            </div>
                        </div>
                        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
                            <div className={labelClass}>Test team</div>
                            <div className="truncate text-sm text-zinc-300" title={result.team}>
                                {result.team} <span className="font-mono text-xs text-zinc-500">P{result.position.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-0.5 text-xs">
                        {result.perTrack.map((p) => (
                            <div key={p.track.id} className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-zinc-400">{p.track.location}</span>
                                <span className={`w-24 text-right font-mono ${tone(p.grid)}`}>grid {signed(p.grid, 1)}</span>
                                <span className={`w-24 text-right font-mono ${tone(p.finish)}`}>race {signed(p.finish, 1)}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-zinc-500">
                        {result.runs} weekends. Positive means the trait helps; &plusmn; is the 95% margin. Races hold a lot of luck, so a small gain next to a large margin says little: run more weekends.
                    </p>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------
// Traits
// ---------------------------------------------------------------------------------------------

function TraitCard({ trait, open, onToggle, onChange, onRemove }) {
    const lines = effectLines(trait);
    const Chevron = open ? ChevronDown : ChevronRight;
    return (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-start gap-2 p-2">
                <button type="button" onClick={onToggle} className="mt-0.5 text-zinc-400 hover:text-zinc-100" aria-expanded={open} aria-label={open ? "Close" : "Edit"}>
                    <Chevron size={15} />
                </button>
                <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold">{trait.name || "Unnamed trait"}</div>
                    {lines.length === 0 ? (
                        <div className="text-xs text-zinc-500">No effects yet.</div>
                    ) : (
                        <ul className="mt-0.5 space-y-0.5 text-xs">
                            {lines.map((l, i) => (
                                <li key={i} className={l.bad ? "text-red-400" : "text-emerald-400"}>
                                    {l.text}
                                </li>
                            ))}
                        </ul>
                    )}
                </button>
                <IconButton onClick={onRemove} title="Remove trait">
                    <Trash2 size={13} />
                </IconButton>
            </div>
            {open && (
                <div className="space-y-3 border-t border-zinc-800 p-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_6rem]">
                        <label className="block">
                            <span className={labelClass}>Name</span>
                            <input value={trait.name} onChange={(e) => onChange({ ...trait, name: e.target.value })} className={selectClass} maxLength={40} />
                        </label>
                        <label className="block">
                            <span className={labelClass}>Part</span>
                            <select value={trait.part} onChange={(e) => onChange({ ...trait, part: e.target.value })} className={selectClass}>
                                {PART_IDS.map((id) => (
                                    <option key={id} value={id}>
                                        {PARTS[id].name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className={labelClass}>Tier</span>
                            <select value={trait.tier} onChange={(e) => onChange({ ...trait, tier: Number(e.target.value) })} className={selectClass}>
                                {PART_PERF_TIERS.map((perf, i) => (
                                    <option key={perf} value={i + 1}>
                                        {i + 1} (part {perf}+)
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <label className="block">
                        <span className={labelClass}>Description</span>
                        <textarea value={trait.desc} onChange={(e) => onChange({ ...trait, desc: e.target.value })} rows={2} maxLength={200} className={selectClass} />
                    </label>
                    <EffectList
                        title="Advantages"
                        hint="scale with how much the circuit asks of this part"
                        list={trait.effects}
                        blank={() => ({ stat: "pace", amount: 0.1, when: [] })}
                        onChange={(effects) => onChange({ ...trait, effects })}
                    />
                    <EffectList
                        title="Disadvantages"
                        hint="always count in full"
                        list={trait.drawbacks}
                        blank={() => ({ stat: "pace", amount: -0.05, when: [] })}
                        onChange={(drawbacks) => onChange({ ...trait, drawbacks })}
                    />
                    <BenchPanel trait={trait} />
                </div>
            )}
        </div>
    );
}

export default function TraitsEditor({ traits, onChange }) {
    const [part, setPart] = useState(PART_IDS[0]);
    const [openId, setOpenId] = useState(null);

    const patch = (id, next) => {
        // A trait moved to another part follows the view there
        if (next.part !== part) setPart(next.part);
        onChange(traits.map((t) => (t.id === id ? next : t)));
    };

    const add = (tier) => {
        const t = newTrait(part, tier, traits);
        onChange([...traits, t]);
        setOpenId(t.id);
    };

    const remove = (id) => {
        if (openId === id) setOpenId(null);
        onChange(traits.filter((t) => t.id !== id));
    };

    const ofPart = traits.filter((t) => t.part === part);

    return (
        <>
            <Hint>
                Every part has up to three tiers of traits; a trait unlocks when the part reaches its tier ({PART_PERF_TIERS.join(", ")}). A trait is a list of effects, each with
                conditions that say when it applies: in clean air or traffic, at a given track wetness, tyre life, race distance or running position, on the first lap, on certain
                tyres, at circuits that ask a lot of a characteristic, or on the straights or in the corners (passing only). Advantages are scaled by how much the circuit asks of the
                part; disadvantages always count in full. Bots pick traits by estimating their value, so the test bench is the way to check that a trait is balanced.
            </Hint>
            <div className="mb-3 flex flex-wrap gap-1.5">
                {PART_IDS.map((id) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setPart(id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${part === id ? "border-red-500 bg-red-500/15 text-zinc-100" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}
                    >
                        {PARTS[id].name}
                        <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{traits.filter((t) => t.part === id).length}</span>
                    </button>
                ))}
            </div>
            <div className="space-y-4">
                {PART_PERF_TIERS.map((perf, i) => {
                    const tier = i + 1;
                    const list = ofPart.filter((t) => t.tier === tier);
                    return (
                        <section key={tier}>
                            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Tier {tier} <span className="font-normal normal-case text-zinc-500">unlocks at part performance {perf}</span>
                            </h3>
                            <div className="space-y-1.5">
                                {list.length === 0 && <p className="text-xs text-zinc-600">No traits in this tier.</p>}
                                {list.map((t) => (
                                    <TraitCard key={t.id} trait={t} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} onChange={(next) => patch(t.id, next)} onRemove={() => remove(t.id)} />
                                ))}
                            </div>
                            <button type="button" onClick={() => add(tier)} disabled={traits.length >= MAX_TRAITS} className={`${smallButton} mt-1.5`}>
                                <Plus size={13} /> Add trait
                            </button>
                        </section>
                    );
                })}
            </div>
        </>
    );
}
