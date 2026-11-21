import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { currentCustomization, isCustomized, resetCustomization, saveCustomization, BUILTIN_TYRE_IDS, MAX_TYRES } from "../data/customization.js";
import { buildTrackShape } from "../engine/trackShape.js";
import { TyreBadge } from "./Tyre.jsx";

const MIN_DRIVERS = 2;
const MAX_DRIVERS = 26;
const CODE_PATTERN = /^[A-Z0-9]{2,4}$/;

const inputClass = "w-full rounded-md border bg-zinc-900 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-red-500";

// Text input that edits freely but only commits values `parse` accepts (it returns undefined for invalid text)
function CommitInput({ value, parse, onCommit, className = "", ...rest }) {
    const [text, setText] = useState(null); // null while the field is not being edited
    const invalid = text !== null && parse(text) === undefined;
    return (
        <input
            {...rest}
            value={text ?? String(value)}
            onFocus={() => setText(String(value))}
            onChange={(e) => {
                setText(e.target.value);
                const parsed = parse(e.target.value);
                if (parsed !== undefined) onCommit(parsed);
            }}
            onBlur={() => setText(null)}
            className={`${inputClass} ${invalid ? "border-red-500" : "border-zinc-700"} ${className}`}
        />
    );
}

function NumInput({ value, onChange, min, max, integer = false, className = "" }) {
    const parse = (text) => {
        if (text.trim() === "") return undefined;
        // Mobile decimal keypads in many locales only offer a comma
        const n = Number(text.trim().replace(",", "."));
        if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return undefined;
        return n;
    };
    return <CommitInput value={value} parse={parse} onCommit={onChange} inputMode="decimal" title={`${min} to ${max}`} className={`text-right font-mono ${className}`} />;
}

function ColorInput({ value, onChange, title }) {
    return (
        <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            title={title}
            className="h-7 w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 p-0.5"
        />
    );
}

function IconButton({ onClick, disabled, title, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        >
            {children}
        </button>
    );
}

function Hint({ children }) {
    return <p className="mb-3 text-xs text-zinc-500">{children}</p>;
}

// ---------------------------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------------------------

const GRID_COLUMNS = "grid-cols-[4.5rem_minmax(8rem,1fr)_minmax(8rem,1fr)_2.75rem_4.25rem_4.25rem_1.75rem]";

function GridEditor({ drivers, onChange }) {
    const teams = [...new Set(drivers.map((d) => d.team))];

    const patch = (i, changes) => onChange(drivers.map((d, j) => (j === i ? { ...d, ...changes } : d)));

    const setTeam = (i, team) => {
        // Joining an existing team adopts its colour
        const mate = drivers.find((d, j) => j !== i && d.team === team);
        patch(i, mate ? { team, color: mate.color } : { team });
    };

    // A team shares one car colour, so changing it recolours every driver of that team
    const setColor = (i, color) => {
        const team = drivers[i].team;
        onChange(drivers.map((d) => (d.team === team ? { ...d, color } : d)));
    };

    const add = () => {
        let n = drivers.length + 1;
        while (drivers.some((d) => d.code === `D${String(n).padStart(2, "0")}`)) n++;
        const code = `D${String(n).padStart(2, "0")}`;
        onChange([...drivers, { code, name: "New Driver", skill: 80, team: "Independent", color: "#a1a1aa", carPerf: 60, defaultGridPos: drivers.length + 1 }]);
    };

    const remove = (i) => onChange(drivers.filter((_, j) => j !== i));

    return (
        <>
            <Hint>
                Skill (1-100) sets driver pace and error rate. Car (0-200) is the car performance: every point is 0.01 s per lap. Changing a car colour recolours the whole
                team. Codes are 2-4 letters or digits and must be unique.
            </Hint>
            <div className="overflow-x-auto">
                <div className="min-w-176 space-y-1">
                    <div className={`grid ${GRID_COLUMNS} items-end gap-2 px-1 text-[10px] uppercase tracking-wider text-zinc-500`}>
                        <span>Code</span>
                        <span>Driver</span>
                        <span>Team</span>
                        <span>Colour</span>
                        <span className="text-right">Skill</span>
                        <span className="text-right">Car</span>
                        <span />
                    </div>
                    {drivers.map((d, i) => (
                        <div key={i} className={`grid ${GRID_COLUMNS} items-center gap-2 rounded-md border border-l-4 border-zinc-800 bg-zinc-900/40 p-1`} style={{ borderLeftColor: d.color }}>
                            <CommitInput
                                value={d.code}
                                parse={(t) => {
                                    const code = t.trim().toUpperCase();
                                    return CODE_PATTERN.test(code) && !drivers.some((o, j) => j !== i && o.code === code) ? code : undefined;
                                }}
                                onCommit={(code) => patch(i, { code })}
                                maxLength={4}
                                title="Unique 2-4 character code"
                                className="font-mono uppercase"
                            />
                            <input value={d.name} onChange={(e) => patch(i, { name: e.target.value })} className={`${inputClass} border-zinc-700`} aria-label="Driver name" />
                            <input value={d.team} onChange={(e) => setTeam(i, e.target.value)} list="team-names" className={`${inputClass} border-zinc-700`} aria-label="Team" />
                            <ColorInput value={d.color} onChange={(c) => setColor(i, c)} title="Team colour" />
                            <NumInput value={d.skill} onChange={(skill) => patch(i, { skill })} min={1} max={100} />
                            <NumInput value={d.carPerf} onChange={(carPerf) => patch(i, { carPerf })} min={0} max={200} />
                            <IconButton onClick={() => remove(i)} disabled={drivers.length <= MIN_DRIVERS} title="Remove driver">
                                <Trash2 size={13} />
                            </IconButton>
                        </div>
                    ))}
                </div>
            </div>
            <datalist id="team-names">
                {teams.map((t) => (
                    <option key={t} value={t} />
                ))}
            </datalist>
            <button
                type="button"
                onClick={add}
                disabled={drivers.length >= MAX_DRIVERS}
                className="mt-3 flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
                <Plus size={13} /> Add driver
            </button>
        </>
    );
}

// ---------------------------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------------------------

const TRACK_COLUMNS = "grid-cols-[2.75rem_minmax(9rem,1fr)_4.25rem_4.75rem_4.25rem_4.5rem_1.75rem]";

function TrackThumb({ id, difficulty }) {
    const loop = useMemo(() => buildTrackShape({ id, ovtkMultiplier: difficulty }).loop, [id, difficulty]);
    return (
        <svg viewBox="0 0 400 400" className="h-10 w-10">
            <path d={loop} fill="none" stroke="#a1a1aa" strokeWidth="26" strokeLinejoin="round" />
        </svg>
    );
}

function TracksEditor({ tracks, onChange }) {
    const patch = (id, changes) => onChange(tracks.map((t) => (t.id === id ? { ...t, ...changes } : t)));

    const add = () => {
        const id = Math.max(0, ...tracks.map((t) => t.id)) + 1;
        onChange([
            ...tracks,
            { id, location: "New Circuit", laps: 55, optLapTime: 85, ovtkMultiplier: 5, optDownForce: 15, optCarBalance: 11, optTraction: 7, optBreakBalance: 8, optTopSpeed: 32, pitLane: 450 },
        ]);
    };

    return (
        <>
            <Hint>
                Laps is the full race distance. Ref. lap is the base lap time in seconds. Overtaking difficulty (1 easy - 10 extreme) makes passing exponentially harder, makes
                pit stops costlier and gives the circuit map more tight corners and fewer long straights. Pit lane is its length in metres: the longer it is, the more time a
                pit stop costs (cars drive through it at 60 km/h, plus the 1.8 - 10 s the service itself takes).
            </Hint>
            <div className="overflow-x-auto">
                <div className="min-w-156 space-y-1">
                    <div className={`grid ${TRACK_COLUMNS} items-end gap-2 px-1 text-[10px] uppercase tracking-wider text-zinc-500`}>
                        <span />
                        <span>Circuit</span>
                        <span className="text-right">Laps</span>
                        <span className="text-right">Ref. lap (s)</span>
                        <span className="text-right">Overtaking</span>
                        <span className="text-right">Pit lane (m)</span>
                        <span />
                    </div>
                    {tracks.map((t) => (
                        <div key={t.id} className={`grid ${TRACK_COLUMNS} items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-1`}>
                            <TrackThumb id={t.id} difficulty={t.ovtkMultiplier} />
                            <input value={t.location} onChange={(e) => patch(t.id, { location: e.target.value })} className={`${inputClass} border-zinc-700`} aria-label="Circuit name" />
                            <NumInput value={t.laps} onChange={(laps) => patch(t.id, { laps })} min={3} max={150} integer />
                            <NumInput value={t.optLapTime} onChange={(optLapTime) => patch(t.id, { optLapTime })} min={20} max={300} />
                            <NumInput value={t.ovtkMultiplier} onChange={(ovtkMultiplier) => patch(t.id, { ovtkMultiplier })} min={1} max={10} />
                            <NumInput value={t.pitLane} onChange={(pitLane) => patch(t.id, { pitLane })} min={100} max={1500} integer />
                            <IconButton onClick={() => onChange(tracks.filter((o) => o.id !== t.id))} disabled={tracks.length <= 1} title="Remove circuit">
                                <Trash2 size={13} />
                            </IconButton>
                        </div>
                    ))}
                </div>
            </div>
            <button type="button" onClick={add} className="mt-3 flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                <Plus size={13} /> Add circuit
            </button>
        </>
    );
}

// ---------------------------------------------------------------------------------------------
// Tyres
// ---------------------------------------------------------------------------------------------

const TYRE_COLUMNS = "grid-cols-[2rem_minmax(7rem,1fr)_2.75rem_5rem_5rem_5rem_1.75rem]";
const NEW_TYRE_COLORS = ["#f97316", "#a855f7", "#ec4899", "#14b8a6", "#84cc16", "#06b6d4"];

function TyresEditor({ tyres, onChange }) {
    const ids = Object.keys(tyres);
    const patch = (id, changes) => onChange({ ...tyres, [id]: { ...tyres[id], ...changes } });

    const add = () => {
        // The compound id is a single letter (shown on the tyre badge) that is not used yet, preferably the first letter of the name
        const name = "New compound";
        const letters = [...name.toLowerCase().replace(/[^a-z]/g, ""), ..."abcdefghijklmnopqrstuvwxyz"];
        const id = letters.find((c) => !ids.includes(c));
        onChange({ ...tyres, [id]: { id, name, pace: 1.4, wear: 3.5, wetK: 0.37, kind: "slick", color: NEW_TYRE_COLORS[ids.length % NEW_TYRE_COLORS.length] } });
    };

    const remove = (id) => {
        const { [id]: _removed, ...rest } = tyres;
        onChange(rest);
    };

    return (
        <>
            <Hint>
                Pace is the lap time lost per lap on a dry track (lower is faster). Wear is how quickly the compound wears out (higher means shorter stints). Wet penalty is
                the extra time per lap a slick loses for each point of track wetness. Intermediate and wet tyres follow fixed wet-weather pace curves, so only their name,
                colour and wear can be changed. Added compounds are dry slicks; the bots and the pit stop menu use them automatically. The default compounds cannot be removed.
            </Hint>
            <div className="overflow-x-auto">
                <div className="min-w-136 space-y-1">
                    <div className={`grid ${TYRE_COLUMNS} items-end gap-2 px-1 text-[10px] uppercase tracking-wider text-zinc-500`}>
                        <span />
                        <span>Compound</span>
                        <span>Colour</span>
                        <span className="text-right">Pace (s)</span>
                        <span className="text-right">Wear</span>
                        <span className="text-right">Wet penalty</span>
                        <span />
                    </div>
                    {ids.map((id) => {
                        const t = tyres[id];
                        const slick = t.kind === "slick";
                        return (
                            <div key={id} className={`grid ${TYRE_COLUMNS} items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-1`}>
                                <TyreBadge id={id} size={24} />
                                <input value={t.name} onChange={(e) => patch(id, { name: e.target.value })} className={`${inputClass} border-zinc-700`} aria-label="Compound name" />
                                <ColorInput value={t.color} onChange={(color) => patch(id, { color })} title="Compound colour" />
                                {slick ? <NumInput value={t.pace} onChange={(pace) => patch(id, { pace })} min={-5} max={15} /> : <span className="text-right text-xs text-zinc-600">fixed</span>}
                                <NumInput value={t.wear} onChange={(wear) => patch(id, { wear })} min={0.5} max={12} />
                                {slick ? <NumInput value={t.wetK} onChange={(wetK) => patch(id, { wetK })} min={0} max={2} /> : <span className="text-right text-xs text-zinc-600">fixed</span>}
                                {BUILTIN_TYRE_IDS.includes(id) ? (
                                    <span />
                                ) : (
                                    <IconButton onClick={() => remove(id)} title="Remove compound">
                                        <Trash2 size={13} />
                                    </IconButton>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <button
                type="button"
                onClick={add}
                disabled={ids.length >= MAX_TYRES}
                className="mt-3 flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
                <Plus size={13} /> Add compound
            </button>
        </>
    );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

const TABS = [
    { id: "drivers", label: "Grid" },
    { id: "tracks", label: "Circuits" },
    { id: "tyres", label: "Tyres" },
];

export default function Customize() {
    const [tab, setTab] = useState("drivers");
    const [data, setData] = useState(currentCustomization);

    // Every edit is applied and saved straight away; the store hands back the normalised data (e.g. compound order)
    const update = (changes) => {
        if (saveCustomization({ ...data, ...changes })) setData(currentCustomization());
    };

    // window.confirm is blocked or silently ignored in many mobile browsers, so confirmation is done inline
    const [pendingReset, setPendingReset] = useState(null); // null | { section?: string }

    const reset = (section) => setPendingReset({ section });

    const confirmReset = () => {
        resetCustomization(pendingReset.section);
        setData(currentCustomization());
        setPendingReset(null);
    };

    const pendingLabel = pendingReset?.section ? TABS.find((t) => t.id === pendingReset.section).label.toLowerCase() : "everything";

    return (
        <div className="mx-auto max-w-5xl p-3 pt-1 md:p-6 md:pt-2">
            <header className="mb-3 flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">Customize</h1>
                <span className="text-xs text-zinc-500">Build your own sandbox. Changes are saved automatically in this browser.</span>
                {isCustomized() && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">Customized</span>}
                <button
                    type="button"
                    onClick={() => reset()}
                    disabled={!isCustomized()}
                    className="ml-auto flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                    <RotateCcw size={13} /> Reset all to defaults
                </button>
            </header>

            <div className="mb-3 flex items-center gap-2">
                <div className="flex overflow-hidden rounded-md border border-zinc-700">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`px-3 py-1.5 text-xs font-medium ${tab === t.id ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
                        >
                            {t.label}
                            {isCustomized(t.id) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" title="Changed from the defaults" />}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => reset(tab)}
                    disabled={!isCustomized(tab)}
                    className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                    <RotateCcw size={13} /> Reset this tab
                </button>
            </div>

            {pendingReset && (
                <div role="alertdialog" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-2 text-xs text-zinc-200">
                    <span>Reset {pendingLabel} to the defaults? Your changes will be lost.</span>
                    <button type="button" onClick={confirmReset} className="ml-auto rounded-md bg-red-600 px-2.5 py-1.5 font-medium text-white hover:bg-red-500">
                        Reset
                    </button>
                    <button type="button" onClick={() => setPendingReset(null)} className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800">
                        Cancel
                    </button>
                </div>
            )}

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                {tab === "drivers" && <GridEditor drivers={data.drivers} onChange={(drivers) => update({ drivers })} />}
                {tab === "tracks" && <TracksEditor tracks={data.tracks} onChange={(tracks) => update({ tracks })} />}
                {tab === "tyres" && <TyresEditor tyres={data.tyres} onChange={(tyres) => update({ tyres })} />}
            </section>
        </div>
    );
}
