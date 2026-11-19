import { useEffect, useRef, useState } from "react";
import { FastForward, Play } from "lucide-react";
import { GAP_UPDATE_TICKS, SIM_DT, SPEEDS } from "../engine/constants.js";
import { fmtClock } from "../engine/format.js";
import { getStandings, simulateToEnd } from "../engine/race.js";
import { forecast } from "../engine/weather.js";
import { useRaceLoop } from "../hooks/useRaceLoop.js";
import EventFeed from "./EventFeed.jsx";
import PlayerPanel from "./PlayerPanel.jsx";
import RaceResults from "./RaceResults.jsx";
import SpeedControls from "./SpeedControls.jsx";
import TimingTower from "./TimingTower.jsx";
import TrackMap from "./TrackMap.jsx";
import { WeatherPanel } from "./WeatherPanel.jsx";

export default function Race({ race, onExit }) {
    const [paused, setPaused] = useState(true);
    const [started, setStarted] = useState(false);
    const [speed, setSpeed] = useState(4);

    const gapCache = useRef({ tick: -1, byCode: new Map() });

    const force = useRaceLoop(race, { running: !paused, speed });

    useEffect(() => {
        const onKey = (e) => {
            if (e.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
            if (e.code === "Space") {
                e.preventDefault();
                setStarted(true);
                setPaused((p) => !p);
            } else if (/^[1-5]$/.test(e.key)) {
                setSpeed(SPEEDS[Number(e.key) - 1]);
                setPaused(false);
                setStarted(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Positions are live, but the gap numbers only refresh every GAP_UPDATE_TICKS simulation steps to stay readable.
    // A cached gap is only reused while the car ahead (and the leader) are still the same cars.
    const live = getStandings(race);
    const cache = gapCache.current;
    const tick = Math.floor(Math.round(race.clock / SIM_DT) / GAP_UPDATE_TICKS);
    if (tick !== cache.tick || race.finished) {
        cache.tick = tick;
        cache.byCode = new Map(
            live.map((s, i) => [
                s.car.code,
                {
                    aheadCode: i > 0 ? live[i - 1].car.code : null,
                    leaderCode: live[0].car.code,
                    gapAhead: s.gapAhead,
                    gapLeader: s.gapLeader,
                    lapsBehindAhead: s.lapsBehindAhead,
                    lapsBehindLeader: s.lapsBehindLeader,
                },
            ]),
        );
    }
    const standings = live.map((s, i) => {
        const c = cache.byCode.get(s.car.code);
        if (!c || c.aheadCode !== (i > 0 ? live[i - 1].car.code : null) || c.leaderCode !== live[0].car.code) return s;
        return {
            ...s,
            gapAhead: c.gapAhead,
            gapLeader: c.gapLeader,
            lapsBehindAhead: c.lapsBehindAhead,
            lapsBehindLeader: c.lapsBehindLeader,
        };
    });
    const leader = standings[0].car;
    const lap = Math.min(race.lapsTotal, Math.max(0, Math.floor(leader.pos)) + 1);
    const fc = forecast(race.weather, race.fraction, Math.max(0, leader.pos), race.lapsTotal, 10);
    const player = race.cars.find((c) => c.isPlayer);
    const playerDone = (player?.finished || player?.dnf) && !race.finished;

    const setSpeedAndRun = (s) => {
        setSpeed(s);
        setPaused(false);
        setStarted(true);
    };

    const skipToEnd = () => {
        simulateToEnd(race, SIM_DT);
        force();
    };

    return (
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-3 p-3">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-3">
                    <h1 className="text-base font-bold tracking-tight">{race.track.location}</h1>
                    <span className="text-xs text-zinc-500">
                        Lap {lap}/{race.lapsTotal} · {fmtClock(race.clock)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {playerDone && (
                        <button
                            type="button"
                            onClick={skipToEnd}
                            className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                            <FastForward size={13} /> Skip to results
                        </button>
                    )}
                    <SpeedControls
                        paused={paused}
                        speed={speed}
                        onTogglePause={() => {
                            setStarted(true);
                            setPaused((p) => !p);
                        }}
                        onSpeed={setSpeedAndRun}
                    />
                    <button type="button" onClick={onExit} className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-200">
                        Quit
                    </button>
                </div>
            </header>

            <div className="grid flex-1 gap-3 lg:grid-cols-[340px_1fr_280px]">
                <div className="order-2 lg:order-1">
                    <TimingTower standings={standings} fastestCode={race.fastest?.code} />
                </div>

                <div className="order-1 flex flex-col gap-3 lg:order-2">
                    <div className="relative rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                        <TrackMap race={race} standings={standings} lap={lap} />
                        {!started && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-950/60">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStarted(true);
                                        setPaused(false);
                                    }}
                                    className="flex items-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                                >
                                    <Play size={16} /> Lights out
                                </button>
                            </div>
                        )}
                    </div>
                    <EventFeed events={race.events} />
                </div>

                <div className="order-3 flex flex-col gap-3">
                    <PlayerPanel race={race} standings={standings} />
                    <WeatherPanel wet={race.wet} rain={race.rain} forecast={fc} />
                </div>
            </div>

            {race.finished && (
                <RaceResults standings={standings} fastest={race.fastest} playerCode={race.playerCode} onBack={onExit} />
            )}
        </div>
    );
}
