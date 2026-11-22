import { useMemo, useState } from "react";
import { Dices, Flag, RefreshCw } from "lucide-react";
import { CARS, DRIVERS, TRACKS } from "../data/index.js";
import { RACE_FRACTIONS, TYRE_IDS, TYRES } from "../engine/constants.js";
import { allowedTyres, lapsTotalFor, wearPerLap } from "../engine/pace.js";
import { buildSetup, expectedWetness, flatCar } from "../engine/setup.js";
import { trackProfile } from "../engine/parts.js";
import { suggestTraits, traitContext, validTraits } from "../engine/traits.js";
import { overtakingLabel } from "../engine/format.js";
import { createRng } from "../engine/rng.js";
import { createWeather, forecast, rainAt, waterAt } from "../engine/weather.js";
import CarTraits from "./CarTraits.jsx";
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

// Teams in grid order with their colour and driver codes (a team is a group of drivers with the same team name)
function teamsOf(drivers) {
    const teams = [];
    for (const d of drivers) {
        let t = teams.find((x) => x.name === d.team);
        if (!t) teams.push((t = { name: d.team, color: d.color, codes: [] }));
        t.codes.push(d.code);
    }
    return teams;
}

export default function Setup({ initial, onRunQualifying }) {
    const [trackId, setTrackId] = useState(initial?.trackId ?? 43);
    const [fraction, setFraction] = useState(initial?.fraction ?? 0.25);
    const teams = teamsOf(DRIVERS);
    const [playerTeam, setPlayerTeam] = useState(() => {
        const wanted = initial?.playerTeam === undefined ? teams[0]?.name : initial.playerTeam;
        return teams.some((t) => t.name === wanted) ? wanted : null; // null = spectate (e.g. the team was removed or renamed)
    });
    // Starting tyre per driver code; a missing or removed (custom) compound falls back to Medium
    const [tyres, setTyres] = useState(() => initial?.tyres ?? {});
    const tyreOf = (code) => (TYRES[tyres[code]] ? tyres[code] : "m");
    const [reversed, setReversed] = useState(initial?.reversed ?? false);
    const [seed, setSeed] = useState(initial?.seed ?? Date.now());
    // Traits the player picked (null = not touched yet: the suggested ones for the circuit and forecast are used)
    const [picks, setPicks] = useState(() => initial?.traits ?? null);

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

    const myDrivers = DRIVERS.filter((d) => d.team === playerTeam);

    // The player's car resolved for this circuit and the expected weather
    const car = playerTeam !== null ? (CARS[playerTeam] ?? flatCar()) : null;
    const expectedWet = useMemo(() => expectedWetness(weather, fraction, lapsTotal), [weather, fraction, lapsTotal]);
    const traits = car ? (picks ? validTraits(car, picks) : suggestTraits(car, traitContext(trackProfile(track), lapsTotal, expectedWet))) : [];
    const setup = car ? buildSetup({ team: playerTeam, car, track, lapsTotal, traitIds: traits, wet: expectedWet }) : null;
    const suggest = () => setPicks(null);
    const chooseTeam = (name) => {
        setPlayerTeam(name);
        setPicks(null);
    };

    const run = () =>
        onRunQualifying({ trackId: track.id, fraction, playerTeam, traits: setup ? setup.traits : null, tyres: Object.fromEntries(myDrivers.map((d) => [d.code, tyreOf(d.code)])), reversed, seed, weather });

    return (
        <div className="mx-auto grid max-w-5xl gap-3 p-3 md:grid-cols-[1fr_320px] md:p-6">
            <header className="flex items-center gap-2 md:col-span-2">
                <Flag size={20} className="text-red-500" />
                <h1 className="text-lg font-bold tracking-tight">Pocket GP</h1>
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
                            <span className="font-mono text-zinc-200">{overtakingLabel(track.ovtkMultiplier)}</span>
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

                <Card title="Team (you manage all of its drivers)">
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => chooseTeam(null)}
                            className={`rounded-md border px-2 py-1.5 text-left text-xs ${playerTeam === null ? "border-red-500 bg-red-500/10" : "border-zinc-800 hover:bg-zinc-800"
                                }`}
                        >
                            <span className="font-semibold">Spectate</span>
                            <span className="block text-[10px] text-zinc-500">watch only</span>
                        </button>
                        {teams.map((t) => (
                            <button
                                key={t.name}
                                type="button"
                                onClick={() => chooseTeam(t.name)}
                                className={`rounded-md border border-l-4 px-2 py-1.5 text-left text-xs ${playerTeam === t.name ? "border-y-red-500 border-r-red-500 bg-red-500/10" : "border-y-zinc-800 border-r-zinc-800 hover:bg-zinc-800"
                                    }`}
                                style={{ borderLeftColor: t.color }}
                            >
                                <span className="font-semibold">{t.name}</span>
                                <span className="block text-[10px] text-zinc-500">{t.codes.join(" · ")}</span>
                            </button>
                        ))}
                    </div>
                </Card>

                {setup && (
                    <Card title={`Car and traits — ${playerTeam}`}>
                        <CarTraits car={car} setup={setup} wet={expectedWet} lapsTotal={lapsTotal} picks={setup.traits} onChange={setPicks} onSuggest={suggest} />
                    </Card>
                )}

                {myDrivers.map((d) => (
                    <Card key={d.code} title={`Starting tyre — ${d.name}`}>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1.5">
                            {TYRE_IDS.map((id) => {
                                const t = TYRES[id];
                                const life = Math.round(100 / wearPerLap(id, lapsTotal, setup?.wear ?? 1));
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setTyres((prev) => ({ ...prev, [d.code]: id }))}
                                        className={`relative flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs ${tyreOf(d.code) === id ? "border-red-500 bg-red-500/10" : "border-zinc-800 hover:bg-zinc-800"
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
                    </Card>
                ))}
                {myDrivers.length > 0 && <p className="-mt-1 px-1 text-[10px] text-zinc-500">Green dot: suits the expected conditions at the start.</p>}
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
