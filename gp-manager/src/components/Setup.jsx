import { useMemo, useState } from "react";
import { Dices, Flag, RefreshCw } from "lucide-react";
import { DRIVERS, TRACKS } from "../data/index.js";
import { RACE_FRACTIONS, TEAMS, TYRE_IDS, TYRES } from "../engine/constants.js";
import { allowedTyres, lapsTotalFor, wearPerLap } from "../engine/pace.js";
import { createRng } from "../engine/rng.js";
import { createWeather, forecast, rainAt, waterAt } from "../engine/weather.js";
import { TyreBadge } from "./Tyre.jsx";
import { WeatherPanel } from "./WeatherPanel.jsx";

function Card({ title, children, className = "" }) {
    return (
        <section className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 ${className}`}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
            {children}
        </section>
    );
}

function Segmented({ options, value, onChange }) {
    return (
        <div className="flex overflow-hidden rounded-md border border-zinc-700">
            {options.map((o) => (
                <button
                    key={String(o.value)}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${o.value === value ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                        }`}
                >
                    {o.label}
                    {o.sub && <span className="block text-[10px] font-normal opacity-70">{o.sub}</span>}
                </button>
            ))}
        </div>
    );
}

export default function Setup({ initial, onRunQualifying }) {
    const [trackId, setTrackId] = useState(initial?.trackId ?? 43);
    const [fraction, setFraction] = useState(initial?.fraction ?? 0.25);
    const [playerCode, setPlayerCode] = useState(initial?.playerCode === undefined ? "HAM" : initial.playerCode);
    const [tyre, setTyre] = useState(initial?.tyre ?? "m");
    const [reversed, setReversed] = useState(initial?.reversed ?? false);
    const [seed, setSeed] = useState(initial?.seed ?? Date.now());

    const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];
    const lapsTotal = lapsTotalFor(track, fraction);

    const weather = useMemo(() => createWeather(createRng(seed ^ (track.id * 7919)), track), [seed, track]);
    const startWet = waterAt(weather, 0, fraction);
    const startRain = rainAt(weather, 0, fraction);
    const fc = forecast(weather, fraction, 0, lapsTotal, 10);
    const recommended = allowedTyres(waterAt(weather, 2, fraction));

    const randomTrack = () => {
        const t = TRACKS[Math.floor(Math.random() * TRACKS.length)];
        setTrackId(t.id);
        setSeed(Date.now());
    };

    const run = () => onRunQualifying({ trackId: track.id, fraction, playerCode, tyre, reversed, seed, weather });

    return (
        <div className="mx-auto grid max-w-5xl gap-3 p-3 md:grid-cols-[1fr_320px] md:p-6">
            <header className="flex items-center gap-2 md:col-span-2">
                <Flag size={20} className="text-red-500" />
                <h1 className="text-lg font-bold tracking-tight">GP Manager</h1>
                <span className="text-xs text-zinc-500">Race weekend setup</span>
            </header>

            <div className="flex flex-col gap-3">
                <Card title="Circuit">
                    <div className="flex gap-2">
                        <select
                            value={track.id}
                            onChange={(e) => {
                                setTrackId(Number(e.target.value));
                                setSeed(Date.now());
                            }}
                            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                        >
                            {TRACKS.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.location}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={randomTrack}
                            className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 text-xs text-zinc-300 hover:bg-zinc-800"
                            title="Random circuit"
                        >
                            <Dices size={14} /> Random
                        </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                        <div>
                            Laps <span className="font-mono text-zinc-200">{track.laps}</span>
                        </div>
                        <div>
                            Ref. lap <span className="font-mono text-zinc-200">{track.optLapTime}s</span>
                        </div>
                        <div>
                            Overtaking{" "}
                            <span className="font-mono text-zinc-200">
                                {track.ovtkMultiplier >= 8 ? "very hard" : track.ovtkMultiplier >= 5 ? "hard" : track.ovtkMultiplier >= 3 ? "normal" : "easy"}
                            </span>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2">
                    <Card title="Race length">
                        <Segmented
                            value={fraction}
                            onChange={setFraction}
                            options={RACE_FRACTIONS.map((f) => ({
                                value: f,
                                label: `${f * 100}%`,
                                sub: `${lapsTotalFor(track, f)} laps`,
                            }))}
                        />
                    </Card>
                    <Card title="Qualifying">
                        <Segmented
                            value={reversed}
                            onChange={setReversed}
                            options={[
                                { value: false, label: "Normal" },
                                { value: true, label: "Reversed grid" },
                            ]}
                        />
                    </Card>
                </div>

                <Card title="Driver">
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <button
                            type="button"
                            onClick={() => setPlayerCode(null)}
                            className={`rounded-md border px-2 py-1.5 text-left text-xs ${playerCode === null ? "border-red-500 bg-red-500/10" : "border-zinc-800 hover:bg-zinc-800"
                                }`}
                        >
                            <span className="font-semibold">Spectate</span>
                            <span className="block text-[10px] text-zinc-500">watch only</span>
                        </button>
                        {DRIVERS.map((d) => (
                            <button
                                key={d.code}
                                type="button"
                                onClick={() => setPlayerCode(d.code)}
                                className={`rounded-md border border-l-4 px-2 py-1.5 text-left text-xs ${playerCode === d.code ? "border-y-red-500 border-r-red-500 bg-red-500/10" : "border-y-zinc-800 border-r-zinc-800 hover:bg-zinc-800"
                                    }`}
                                style={{ borderLeftColor: TEAMS[d.team]?.color }}
                            >
                                <span className="font-semibold">{d.code}</span>{" "}
                                <span className="text-zinc-400">{d.name.split(" ").slice(-1)[0]}</span>
                            </button>
                        ))}
                    </div>
                </Card>

                <Card title="Starting tyre (used in qualifying and race)">
                    <div className="grid grid-cols-5 gap-1.5">
                        {TYRE_IDS.map((id) => {
                            const t = TYRES[id];
                            const life = Math.round(100 / wearPerLap(id, lapsTotal));
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setTyre(id)}
                                    className={`relative flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs ${tyre === id ? "border-red-500 bg-red-500/10" : "border-zinc-800 hover:bg-zinc-800"
                                        }`}
                                >
                                    {recommended.includes(id) && (
                                        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" title="Suits the conditions" />
                                    )}
                                    <TyreBadge id={id} size={26} />
                                    <span className="font-semibold">{t.name}</span>
                                    <span className="text-[10px] text-zinc-500">~{life} laps</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500">Green dot: suits the expected conditions at the start.</p>
                </Card>
            </div>

            <div className="flex flex-col gap-3">
                <WeatherPanel wet={startWet} rain={startRain} forecast={fc} title="Conditions at the start" />
                <button
                    type="button"
                    onClick={() => setSeed(Date.now())}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                    <RefreshCw size={13} /> Re-roll weather
                </button>
                <button
                    type="button"
                    onClick={run}
                    className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                    Run qualifying
                </button>
            </div>
        </div>
    );
}
