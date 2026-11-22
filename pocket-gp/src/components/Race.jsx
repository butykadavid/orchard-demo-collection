import { useEffect, useRef, useState } from "react";
import { FastForward, ListOrdered, Map as MapIcon, Play, Wrench } from "lucide-react";
import { GAP_UPDATE_TICKS, SIM_DT, SPEEDS } from "../engine/constants.js";
import { fmtClock, fmtLap, overtakingLabel } from "../engine/format.js";
import { pitDriveTime } from "../engine/pit.js";
import { getStandings, restartRace, simulateToEnd } from "../engine/race.js";
import { forecast } from "../engine/weather.js";
import { useRaceLoop } from "../hooks/useRaceLoop.js";
import EventFeed from "./EventFeed.jsx";
import MobileCarStrip from "./MobileCarStrip.jsx";
import PlayerPanel from "./PlayerPanel.jsx";
import RaceControlBanner from "./RaceControlBanner.jsx";
import RaceResults from "./RaceResults.jsx";
import SpeedControls from "./SpeedControls.jsx";
import TimingTower from "./TimingTower.jsx";
import TrackMap from "./TrackMap.jsx";
import { WeatherPanel } from "./WeatherPanel.jsx";

export default function Race({ race, onExit }) {
    const [paused, setPaused] = useState(true);
    const [started, setStarted] = useState(false);
    const [speed, setSpeed] = useState(4);
    const [tab, setTab] = useState("race"); // phone layout only: one section at a time

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
    const fc = forecast(race.weather, race.fraction, Math.max(0, leader.pos), race.lapsTotal, 10, race.weatherShift);
    const players = race.cars.filter((c) => c.isPlayer);
    const playerDone = players.length > 0 && players.every((c) => c.finished || c.dnf) && !race.finished;

    const boxPending = players.some((c) => c.pitRequest !== null && !c.dnf);
    const carAlert = players.some((c) => !c.dnf && !c.finished && (c.punctured || c.tyreState < 20));
    const tabs = [
        { id: "race", label: "Race", Icon: MapIcon },
        { id: "timing", label: "Timing", Icon: ListOrdered },
        { id: "cars", label: "My cars", Icon: Wrench, dot: boxPending ? "bg-amber-400" : carAlert ? "bg-red-500" : null },
    ];

    const setSpeedAndRun = (s) => {
        setSpeed(s);
        setPaused(false);
        setStarted(true);
    };

    const skipToEnd = () => {
        simulateToEnd(race, SIM_DT);
        force();
    };

    const restart = () => {
        restartRace(race);
        setPaused(false);
        setStarted(true);
        force();
    };

    const mode = race.control.mode;
    const mapBorder = mode === "red" ? "border-red-500/70" : mode === "green" ? "border-zinc-800" : "border-amber-500/60";

    return (
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-3 p-3 pb-20 lg:pb-3">
            <header className="sticky top-0 z-20 -mx-3 -mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur lg:static lg:mx-0 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <div className="min-w-0">
                    <div className="flex items-center gap-3">
                        <h1 className="text-base font-bold tracking-tight">{race.track.location}</h1>
                        <span className="text-xs text-zinc-500">
                            Lap {lap}/{race.lapsTotal} · {fmtClock(race.clock)}
                        </span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                        Ref. lap {fmtLap(race.track.optLapTime)} · Overtaking {overtakingLabel(race.track.ovtkMultiplier)}
                    </div>
                </div>
                <div className="flex w-full items-center gap-2 lg:w-auto">
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
                <div className={`${tab === "timing" ? "block" : "hidden"} lg:block`}>
                    <TimingTower standings={standings} fastestCode={race.fastest?.code} />
                </div>

                <div className={`${tab === "race" ? "flex" : "hidden"} flex-col gap-3 lg:flex`}>
                    <div className="flex flex-col gap-3">
                        <WeatherPanel wet={race.wet} rain={race.rain} forecast={fc} compact />
                        <RaceControlBanner race={race} onRestart={restart} />
                        <div className={`relative rounded-lg border ${mapBorder} bg-zinc-900/60 p-3`}>
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
                        <MobileCarStrip standings={standings} onOpen={() => setTab("cars")} />
                    </div>
                    <EventFeed events={race.events} />
                </div>

                <div className={`${tab === "cars" ? "flex" : "hidden"} flex-col gap-3 lg:flex`}>
                    <PlayerPanel race={race} standings={standings} />
                </div>
            </div>

            <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
                {tabs.map(({ id, label, Icon, dot }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === id ? "text-red-400" : "text-zinc-500"}`}
                    >
                        <Icon size={18} />
                        {label}
                        {dot && <span className={`absolute right-[30%] top-1.5 h-2 w-2 rounded-full ${dot}`} />}
                    </button>
                ))}
            </nav>

            {race.finished && (
                <RaceResults standings={standings} fastest={race.fastest} playerTeam={race.playerTeam} onBack={onExit} />
            )}
        </div>
    );
}
