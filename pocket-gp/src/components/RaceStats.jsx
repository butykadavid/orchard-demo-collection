import { useState } from "react";
import { Award } from "lucide-react";
import { TYRES } from "../engine/constants.js";
import { fmtClock, fmtLap } from "../engine/format.js";

const W = 640;
const H = 300;

function DriverChips({ rows, isOn, onToggle, onAll, onNone }) {
    return (
        <div className="mt-2 flex flex-wrap items-center gap-1">
            {onAll && (
                <button type="button" onClick={onAll} className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800">
                    All
                </button>
            )}
            {onNone && (
                <button type="button" onClick={onNone} className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800">
                    None
                </button>
            )}
            {rows.map((r) => (
                <button
                    key={r.code}
                    type="button"
                    onClick={() => onToggle(r.code)}
                    title={r.name}
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${isOn(r.code) ? "text-zinc-100" : "border-zinc-800 text-zinc-600"}`}
                    style={isOn(r.code) ? { borderColor: r.color, backgroundColor: `${r.color}33` } : undefined}
                >
                    {r.code}
                </button>
            ))}
        </div>
    );
}

// Path through the defined points of a sparse array; a gap in the data of more than `maxGap` entries breaks the line
function linePath(values, x, y, maxGap = Infinity) {
    let d = "";
    let last = -Infinity;
    values.forEach((v, i) => {
        if (v == null) return;
        d += `${i - last > maxGap || d === "" ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        last = i;
    });
    return d;
}

export function PositionsChart({ stats }) {
    const { rows, lapsTotal } = stats;
    const [focus, setFocus] = useState(null);
    const left = 26;
    const right = 36;
    const top = 8;
    const bottom = 20;
    const n = rows.length;
    const x = (lap) => left + (lap / lapsTotal) * (W - left - right);
    const y = (pos) => top + ((pos - 1) / Math.max(1, n - 1)) * (H - top - bottom);
    const step = Math.max(1, Math.ceil(lapsTotal / 10));
    const ticks = [];
    for (let l = 0; l <= lapsTotal; l += step) ticks.push(l);
    const finalOrder = rows.filter((r) => r.status === "finished");

    // Draw the highlighted car last so it ends up on top
    const ordered = focus ? [...rows.filter((r) => r.code !== focus), ...rows.filter((r) => r.code === focus)] : rows;

    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                {Array.from({ length: n }, (_, i) => (
                    <g key={i}>
                        <line x1={left} x2={W - right} y1={y(i + 1)} y2={y(i + 1)} stroke="#27272a" strokeWidth="0.5" />
                        {(i + 1) % 2 === 1 || n <= 10 ? (
                            <text x={left - 4} y={y(i + 1) + 3} textAnchor="end" fontSize="8" fill="#71717a">
                                {i + 1}
                            </text>
                        ) : null}
                    </g>
                ))}
                {ticks.map((l) => (
                    <text key={l} x={x(l)} y={H - 6} textAnchor="middle" fontSize="8" fill="#71717a">
                        {l === 0 ? "Grid" : l}
                    </text>
                ))}
                {ordered.map((r) => {
                    const dim = focus && focus !== r.code;
                    return (
                        <path
                            key={r.code}
                            d={linePath(r.positions, x, y)}
                            fill="none"
                            stroke={r.color}
                            strokeWidth={focus === r.code ? 3 : r.isPlayer ? 2.5 : 1.3}
                            strokeLinejoin="round"
                            opacity={dim ? 0.12 : r.isPlayer || focus === r.code ? 1 : 0.8}
                        />
                    );
                })}
                {finalOrder.map((r) => (
                    <text key={r.code} x={W - right + 4} y={y(r.position) + 3} fontSize="8" fontWeight={r.isPlayer ? "bold" : "normal"} fill={focus && focus !== r.code ? "#52525b" : r.color}>
                        {r.code}
                    </text>
                ))}
            </svg>
            <p className="text-[10px] text-zinc-500">Position at the end of every lap. Pick a driver to highlight the line.</p>
            <DriverChips rows={rows} isOn={(c) => focus === null || focus === c} onToggle={(c) => setFocus(focus === c ? null : c)} />
        </div>
    );
}

export function LapTimesChart({ stats }) {
    const { rows, lapsTotal } = stats;
    const [selected, setSelected] = useState(() => {
        const s = new Set(rows.filter((r) => r.isPlayer).map((r) => r.code));
        for (const r of rows.slice(0, 3)) s.add(r.code);
        return s;
    });
    const toggle = (code) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });

    const shown = rows.filter((r) => selected.has(r.code));
    const left = 44;
    const right = 8;
    const top = 8;
    const bottom = 20;

    const times = shown.flatMap((r) => r.lapLog.filter((l) => !l.slow).map((l) => l.time)).sort((a, b) => a - b);
    let lo = 0;
    let hi = 1;
    if (times.length > 0) {
        const min = times[0];
        const max = Math.min(times[times.length - 1], times[Math.floor(times.length * 0.97)] * 1.01);
        const pad = Math.max(0.2, (max - min) * 0.08);
        lo = min - pad;
        hi = Math.max(max, min + 1) + pad;
    }

    const x = (lap) => left + ((lap - 1) / Math.max(1, lapsTotal - 1)) * (W - left - right);
    const y = (t) => top + ((t - lo) / (hi - lo)) * (H - top - bottom);
    const step = Math.max(1, Math.ceil(lapsTotal / 10));
    const xTicks = [];
    for (let l = 1; l <= lapsTotal; l += step) xTicks.push(l);
    const yTicks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);

    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                {yTicks.map((t) => (
                    <g key={t}>
                        <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="#27272a" strokeWidth="0.5" />
                        <text x={left - 4} y={y(t) + 3} textAnchor="end" fontSize="8" fill="#71717a">
                            {fmtLap(t)}
                        </text>
                    </g>
                ))}
                {xTicks.map((l) => (
                    <text key={l} x={x(l)} y={H - 6} textAnchor="middle" fontSize="8" fill="#71717a">
                        {l}
                    </text>
                ))}
                {shown.map((r) => {
                    const values = [];
                    for (const l of r.lapLog) if (!l.slow && l.time >= lo && l.time <= hi) values[l.lap] = l.time;
                    return (
                        <g key={r.code}>
                            {r.pitLog.map((p, i) => (
                                <line key={i} x1={x(p.lap + 0.5)} x2={x(p.lap + 0.5)} y1={top} y2={H - bottom} stroke={r.color} strokeWidth="0.8" strokeDasharray="2 3" opacity="0.5" />
                            ))}
                            <path d={linePath(values, x, y, 1)} fill="none" stroke={r.color} strokeWidth={r.isPlayer ? 2.2 : 1.4} strokeLinejoin="round" />
                            {values.map((v, lap) => (v == null ? null : <circle key={lap} cx={x(lap)} cy={y(v)} r={r.isPlayer ? 1.8 : 1.2} fill={r.color} />))}
                        </g>
                    );
                })}
                {shown.length === 0 && (
                    <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="10" fill="#71717a">
                        Select at least one driver
                    </text>
                )}
            </svg>
            <p className="text-[10px] text-zinc-500">
                Lap times on clean laps. The start lap, pit laps and laps under a safety car, virtual safety car or red flag are left out. Dotted lines mark the pit stops.
            </p>
            <DriverChips rows={rows} isOn={(c) => selected.has(c)} onToggle={toggle} onAll={() => setSelected(new Set(rows.map((r) => r.code)))} onNone={() => setSelected(new Set())} />
        </div>
    );
}

export function StrategyPanel({ stats }) {
    const { rows, lapsTotal } = stats;
    return (
        <div>
            <div className="flex flex-col gap-1">
                {rows.map((r) => (
                    <div key={r.code} className={`flex items-center gap-2 rounded px-1 py-0.5 ${r.isPlayer ? "bg-red-500/15" : ""}`}>
                        <span className="w-9 shrink-0 font-mono text-[11px] font-semibold" style={{ color: r.color }}>
                            {r.code}
                        </span>
                        <div className="relative flex h-5 flex-1 overflow-hidden rounded bg-zinc-800/60">
                            {r.stints.map((s, i) => {
                                const t = TYRES[s.tyre];
                                return (
                                    <div
                                        key={i}
                                        className="flex items-center justify-center overflow-hidden border-r border-zinc-950 text-[9px] font-bold text-zinc-950"
                                        style={{ width: `${(s.laps / lapsTotal) * 100}%`, backgroundColor: t.color }}
                                        title={`${t.name}: laps ${s.from}-${s.to}${s.avg ? `, average ${fmtLap(s.avg)}` : ""}`}
                                    >
                                        {s.laps >= 3 ? `${s.tyre.toUpperCase()} ${s.laps}` : ""}
                                    </div>
                                );
                            })}
                        </div>
                        <span className="w-28 shrink-0 text-right text-[10px] text-zinc-400">
                            {r.status !== "finished" ? <span className="text-red-400">{r.status === "dsq" ? "DSQ" : "DNF"} · </span> : null}
                            {r.stops} stop{r.stops === 1 ? "" : "s"}
                            {r.redChanges > 0 ? " + red flag" : ""}
                            {r.avgStop !== null ? ` · ${r.avgStop.toFixed(1)} s` : ""}
                        </span>
                    </div>
                ))}
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
                Tyre stints per driver (hover for the average clean-lap pace of a stint). The time next to the stops is the average standing time in the pit box.
            </p>
        </div>
    );
}

const signed = (v, digits = 1) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v).toFixed(digits);
const tone = (v, bad = false) => (Math.abs(v) < 0.05 ? "text-zinc-600" : (v > 0) !== bad ? "text-emerald-400" : "text-red-400");

// Cell with a value that is good when positive (or bad, for the risk column), dimmed while it is practically nothing
function FxCell({ value, digits = 1, unit = "", bad = false, scale = 1 }) {
    const v = value * scale;
    return <td className={`py-0.5 text-right font-mono ${tone(v, bad)}`}>{Math.abs(v) < 0.05 ? "-" : `${signed(v, digits)}${unit}`}</td>;
}

export function TraitsPanel({ stats }) {
    const { drivers, moments } = stats.traits;
    const hasMine = drivers.some((d) => d.isPlayer);
    const [mineOnly, setMineOnly] = useState(hasMine);

    if (drivers.length === 0) return <p className="py-6 text-center text-sm text-zinc-400">No car ran any traits in this race.</p>;

    const shown = mineOnly ? drivers.filter((d) => d.isPlayer) : drivers;
    const codes = new Set(shown.map((d) => d.code));
    const list = moments.filter((m) => codes.has(m.code));
    const good = list.filter((m) => m.good).length;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span>
                    <span className="font-semibold text-emerald-400">{good} helped</span> · <span className="font-semibold text-red-400">{list.length - good} hurt</span>
                </span>
                {hasMine && (
                    <div className="ml-auto flex overflow-hidden rounded-md border border-zinc-700">
                        {[
                            [true, "My team"],
                            [false, "Everyone"],
                        ].map(([v, label]) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => setMineOnly(v)}
                                className={`px-2.5 py-1 text-[11px] font-medium ${mineOnly === v ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h3 className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Moments</h3>
                {list.length === 0 ? (
                    <p className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-3 text-xs text-zinc-400">
                        No trait changed the outcome of a pass, incident or damage in this race. Traits that only make the car quicker show up in the table below.
                    </p>
                ) : (
                    <ul className="max-h-60 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-800/30">
                        {list.map((m, i) => (
                            <li key={i} className="flex items-start gap-2 border-b border-zinc-800 px-2.5 py-1.5 text-xs last:border-b-0">
                                <span className={`mt-0.5 w-3 shrink-0 text-center font-mono font-bold ${m.good ? "text-emerald-400" : "text-red-400"}`}>{m.good ? "+" : "-"}</span>
                                <span className="w-9 shrink-0 font-mono text-zinc-500">L{m.lap}</span>
                                <span className="w-9 shrink-0 font-mono font-semibold" style={{ color: m.color }}>
                                    {m.code}
                                </span>
                                <span className="text-zinc-300">{m.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="overflow-x-auto">
                <h3 className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Overall effect</h3>
                <table className="w-full text-xs">
                    <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                        <tr className="border-b border-zinc-800">
                            <th className="py-1.5">Driver / trait</th>
                            <th className="py-1.5 text-right" title="Race time gained (or lost) by traits that change the pace, including the wet-weather ones">
                                Pace
                            </th>
                            <th className="py-1.5 text-right" title="Expected extra passes made (negative: passes the trait cost)">
                                Passes
                            </th>
                            <th className="py-1.5 text-right" title="Expected passes kept off the car (negative: extra passes conceded)">
                                Defence
                            </th>
                            <th className="py-1.5 text-right" title="Extra chance of a driver error or breakdown caused by the trait">
                                Risk
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((d) => (
                            <FragmentRows key={d.code} d={d} />
                        ))}
                    </tbody>
                </table>
                <p className="mt-2 text-[10px] text-zinc-500">
                    Passes and defence are expected values: at every moment of a fight the pass chance with the trait is compared with the chance without it. Moments are logged each time such a count reaches a whole
                    pass. Pace is the time the trait saved over the whole race, which is how a trait that is just a little quicker shows up.
                </p>
            </div>
        </div>
    );
}

function FragmentRows({ d }) {
    return (
        <>
            <tr className={d.isPlayer ? "bg-red-500/15" : "bg-zinc-800/30"}>
                <td className="py-1" colSpan={5}>
                    <span className="mr-2 inline-block h-3 w-1 rounded-sm align-middle" style={{ backgroundColor: d.color }} />
                    <span className="font-semibold">{d.code}</span> <span className="text-zinc-400">{d.name}</span>
                    <span className="ml-2 font-mono text-zinc-500">{d.status === "finished" ? `P${d.position}` : d.status === "dsq" ? "DSQ" : "DNF"}</span>
                </td>
            </tr>
            {d.traits.map((t) => (
                <tr key={t.id}>
                    <td className="py-0.5 pl-4">
                        <div className="text-zinc-200">{t.name}</div>
                        <div className="text-[10px] leading-snug">
                            {t.lines.map((l, i) => (
                                <span key={i} className={l.bad ? "text-red-400/80" : "text-emerald-400/80"}>
                                    {i > 0 ? " · " : ""}
                                    {l.text}
                                </span>
                            ))}
                        </div>
                    </td>
                    <FxCell value={t.pace} digits={1} unit=" s" />
                    <FxCell value={t.passes} digits={1} />
                    <FxCell value={t.defended} digits={1} />
                    <FxCell value={t.risk} digits={1} unit="%" bad scale={100} />
                </tr>
            ))}
        </>
    );
}

function Tile({ label, value }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
            <div className="font-mono text-sm font-semibold">{value}</div>
        </div>
    );
}

export function SummaryPanel({ stats }) {
    const { rows, awards, summary } = stats;
    const gainText = (r) => (r.gained === null ? "-" : r.gained > 0 ? `+${r.gained}` : r.gained === 0 ? "0" : String(r.gained));
    const gainColor = (r) => (r.gained > 0 ? "text-emerald-400" : r.gained < 0 ? "text-red-400" : "text-zinc-400");

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label="Distance" value={`${summary.laps} laps`} />
                <Tile label="Race time" value={summary.raceTime ? fmtClock(summary.raceTime) : "-"} />
                <Tile label="On-track passes" value={summary.overtakes} />
                <Tile label="Pit stops" value={summary.stops} />
                <Tile label="Safety cars" value={summary.counts.sc} />
                <Tile label="Virtual safety cars" value={summary.counts.vsc} />
                <Tile label="Red flags" value={summary.counts.red} />
                <Tile label="Retirements" value={summary.retirements + summary.disqualified} />
            </div>

            {awards.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {awards.map((a) => {
                        const r = rows.find((x) => x.code === a.code);
                        return (
                            <div key={a.key} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
                                <Award size={16} className="shrink-0 text-amber-400" />
                                <div className="min-w-0">
                                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">{a.title}</div>
                                    <div className="truncate text-xs">
                                        <span className="mr-1 inline-block h-2.5 w-1 rounded-sm align-middle" style={{ backgroundColor: r?.color }} />
                                        <span className="font-semibold">{a.code}</span> <span className="text-zinc-400">{a.name}</span>
                                    </div>
                                    <div className="text-[11px] text-zinc-400">{a.detail}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                        <tr className="border-b border-zinc-800">
                            <th className="py-1.5">Driver</th>
                            <th className="py-1.5 text-right">Grid</th>
                            <th className="py-1.5 text-right">Finish</th>
                            <th className="py-1.5 text-right">+/-</th>
                            <th className="py-1.5 text-right" title="Passes made / times passed">
                                Passes
                            </th>
                            <th className="py-1.5 text-right">Stops</th>
                            <th className="py-1.5 text-right" title="Average lap time on clean laps">
                                Avg pace
                            </th>
                            <th className="py-1.5 text-right" title="Standard deviation of the clean lap times">
                                Spread
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.code} className={r.isPlayer ? "bg-red-500/15" : "odd:bg-zinc-800/30"}>
                                <td className="py-0.5">
                                    <span className="mr-2 inline-block h-3 w-1 rounded-sm align-middle" style={{ backgroundColor: r.color }} />
                                    <span className="font-semibold">{r.code}</span>
                                </td>
                                <td className="py-0.5 text-right font-mono text-zinc-400">{r.grid}</td>
                                <td className="py-0.5 text-right font-mono">{r.status === "finished" ? r.position : r.status === "dsq" ? "DSQ" : "DNF"}</td>
                                <td className={`py-0.5 text-right font-mono ${gainColor(r)}`}>{gainText(r)}</td>
                                <td className="py-0.5 text-right font-mono">
                                    {r.overtakes}
                                    <span className="text-zinc-500"> / {r.overtaken}</span>
                                </td>
                                <td className="py-0.5 text-right font-mono">{r.stops}</td>
                                <td className="py-0.5 text-right font-mono">{r.avg !== null ? fmtLap(r.avg) : "-"}</td>
                                <td className="py-0.5 text-right font-mono text-zinc-400">{r.consistency !== null ? `${r.consistency.toFixed(2)} s` : "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
