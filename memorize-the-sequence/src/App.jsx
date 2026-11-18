import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createStore, isEmbedded } from "@orchardapp/sdk";
import {
    Play,
    RotateCcw,
    Trophy,
    Activity,
    Calendar,
    Hash,
    Sparkles,
    Volume2,
    VolumeX,
    Layers,
    Trash2,
    History,
} from "lucide-react";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const TILE_PALETTE = [
    {
        name: "Emerald",
        base: "bg-emerald-950/80 border-emerald-500/40 text-emerald-300 hover:border-emerald-400/70",
        lit: "bg-emerald-400 border-emerald-200 text-slate-950 shadow-[0_0_35px_rgba(52,211,153,0.85)] scale-[1.04]",
        dot: "bg-emerald-400",
        freq: 261.63, // C4
    },
    {
        name: "Cyan",
        base: "bg-cyan-950/80 border-cyan-500/40 text-cyan-300 hover:border-cyan-400/70",
        lit: "bg-cyan-400 border-cyan-200 text-slate-950 shadow-[0_0_35px_rgba(34,211,238,0.85)] scale-[1.04]",
        dot: "bg-cyan-400",
        freq: 329.63, // E4
    },
    {
        name: "Amber",
        base: "bg-amber-950/80 border-amber-500/40 text-amber-300 hover:border-amber-400/70",
        lit: "bg-amber-400 border-amber-200 text-slate-950 shadow-[0_0_35px_rgba(251,191,36,0.85)] scale-[1.04]",
        dot: "bg-amber-400",
        freq: 392.0, // G4
    },
    {
        name: "Rose",
        base: "bg-rose-950/80 border-rose-500/40 text-rose-300 hover:border-rose-400/70",
        lit: "bg-rose-400 border-rose-200 text-slate-950 shadow-[0_0_35px_rgba(251,113,133,0.85)] scale-[1.04]",
        dot: "bg-rose-400",
        freq: 523.25, // C5
    },
    {
        name: "Violet",
        base: "bg-violet-950/80 border-violet-500/40 text-violet-300 hover:border-violet-400/70",
        lit: "bg-violet-400 border-violet-200 text-slate-950 shadow-[0_0_35px_rgba(167,139,250,0.85)] scale-[1.04]",
        dot: "bg-violet-400",
        freq: 587.33, // D5
    },
    {
        name: "Orange",
        base: "bg-orange-950/80 border-orange-500/40 text-orange-300 hover:border-orange-400/70",
        lit: "bg-orange-400 border-orange-200 text-slate-950 shadow-[0_0_35px_rgba(251,146,60,0.85)] scale-[1.04]",
        dot: "bg-orange-400",
        freq: 659.25, // E5
    },
    {
        name: "Pink",
        base: "bg-pink-950/80 border-pink-500/40 text-pink-300 hover:border-pink-400/70",
        lit: "bg-pink-400 border-pink-200 text-slate-950 shadow-[0_0_35px_rgba(244,114,182,0.85)] scale-[1.04]",
        dot: "bg-pink-400",
        freq: 783.99, // G5
    },
    {
        name: "Lime",
        base: "bg-lime-950/80 border-lime-500/40 text-lime-300 hover:border-lime-400/70",
        lit: "bg-lime-400 border-lime-200 text-slate-950 shadow-[0_0_35px_rgba(163,230,53,0.85)] scale-[1.04]",
        dot: "bg-lime-400",
        freq: 880.0, // A5
    },
    {
        name: "Sky",
        base: "bg-sky-950/80 border-sky-500/40 text-sky-300 hover:border-sky-400/70",
        lit: "bg-sky-400 border-sky-200 text-slate-950 shadow-[0_0_35px_rgba(56,189,248,0.85)] scale-[1.04]",
        dot: "bg-sky-400",
        freq: 987.77, // B5
    },
    {
        name: "Indigo",
        base: "bg-indigo-950/80 border-indigo-500/40 text-indigo-300 hover:border-indigo-400/70",
        lit: "bg-indigo-400 border-indigo-200 text-slate-950 shadow-[0_0_35px_rgba(129,140,248,0.85)] scale-[1.04]",
        dot: "bg-indigo-400",
        freq: 1046.5, // C6
    },
];

const INITIAL_STORE_STATE = {
    allTimeHighScore: 0,
    totalTries: 0,
    history: [],
};

/**
 * Starts with 2 tiles on Round 1.
 * Every 5 rounds a new tile is added (Round 5 -> 3 tiles, Round 10 -> 4 tiles, etc.)
 */
function getTileCountForRound(round) {
    return Math.min(TILE_PALETTE.length, 2 + Math.floor(round / 5));
}

function generateSequence(round, tileCount) {
    const seq = [];
    for (let i = 0; i < round; i++) {
        seq.push(Math.floor(Math.random() * tileCount));
    }
    return seq;
}

export default function App() {
    const [persisted, setPersisted] = useState(INITIAL_STORE_STATE);
    const storeRef = useRef(null);

    // Game state
    const [phase, setPhase] = useState("idle"); // 'idle' | 'watching' | 'input' | 'round-clear' | 'gameover'
    const [round, setRound] = useState(1);
    const [sequence, setSequence] = useState([]);
    const [userStep, setUserStep] = useState(0);
    const [activeTile, setActiveTile] = useState(null);
    const [wrongTile, setWrongTile] = useState(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [lastCompletedScore, setLastCompletedScore] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);

    const audioCtxRef = useRef(null);
    const timeoutsRef = useRef([]);

    // Initialize Orchard SDK store
    useEffect(() => {
        const orchardStore = createStore("memorizeSequenceStats", INITIAL_STORE_STATE);
        storeRef.current = orchardStore;

        const unsubscribe = orchardStore.subscribe((data) => {
            if (data && typeof data === "object") {
                setPersisted({
                    allTimeHighScore: Number(data.allTimeHighScore) || 0,
                    totalTries: Number(data.totalTries) || 0,
                    history: Array.isArray(data.history) ? data.history : [],
                });
            }
        });

        return () => {
            unsubscribe();
            clearAllTimers();
        };
    }, []);

    const clearAllTimers = () => {
        timeoutsRef.current.forEach((id) => clearTimeout(id));
        timeoutsRef.current = [];
    };

    const schedule = (fn, delay) => {
        const id = setTimeout(fn, delay);
        timeoutsRef.current.push(id);
        return id;
    };

    const playTone = useCallback(
        (freq, duration = 0.18, type = "sine") => {
            if (!soundEnabled) return;
            try {
                if (!audioCtxRef.current) {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContextClass) return;
                    audioCtxRef.current = new AudioContextClass();
                }
                const ctx = audioCtxRef.current;
                if (ctx.state === "suspended") {
                    ctx.resume();
                }
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, ctx.currentTime);

                gain.gain.setValueAtTime(0.14, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch {
                // Ignore audio errors on restricted environments
            }
        },
        [soundEnabled]
    );

    const playRoundSequence = useCallback(
        (targetRound) => {
            clearAllTimers();
            const tileCount = getTileCountForRound(targetRound);
            const nextSeq = generateSequence(targetRound, tileCount);

            setRound(targetRound);
            setSequence(nextSeq);
            setUserStep(0);
            setActiveTile(null);
            setWrongTile(null);
            setPhase("watching");

            // Speed up slightly in higher rounds while keeping it readable
            const flashDuration = Math.max(220, 420 - targetRound * 8);
            const gapDuration = Math.max(110, 200 - targetRound * 4);
            const startDelay = 550;

            nextSeq.forEach((tileIdx, stepIdx) => {
                const onTime = startDelay + stepIdx * (flashDuration + gapDuration);
                const offTime = onTime + flashDuration;

                schedule(() => {
                    setActiveTile(tileIdx);
                    playTone(TILE_PALETTE[tileIdx % TILE_PALETTE.length].freq, flashDuration / 1000);
                }, onTime);

                schedule(() => {
                    setActiveTile(null);
                }, offTime);
            });

            const totalPlaybackTime =
                startDelay + nextSeq.length * (flashDuration + gapDuration) + 80;

            schedule(() => {
                setActiveTile(null);
                setPhase("input");
            }, totalPlaybackTime);
        },
        [playTone]
    );

    const startGame = () => {
        setLastCompletedScore(null);
        playRoundSequence(1);
    };

    const recordGameResult = (roundsCleared, failedAtRound) => {
        if (!storeRef.current) return;

        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            score: roundsCleared,
            roundReached: failedAtRound,
            tilesReached: getTileCountForRound(failedAtRound),
            timestamp: Date.now(),
        };

        storeRef.current.update((prev) => {
            const safePrev = prev && typeof prev === "object" ? prev : INITIAL_STORE_STATE;
            const prevHistory = Array.isArray(safePrev.history) ? safePrev.history : [];
            const nextHighScore = Math.max(
                Number(safePrev.allTimeHighScore) || 0,
                roundsCleared
            );
            const nextTries = (Number(safePrev.totalTries) || prevHistory.length) + 1;

            return {
                allTimeHighScore: nextHighScore,
                totalTries: nextTries,
                history: [entry, ...prevHistory].slice(0, 500),
            };
        });
    };

    const handleTileClick = (tileIdx) => {
        if (phase !== "input") return;

        clearAllTimers();
        setActiveTile(tileIdx);

        const expectedTile = sequence[userStep];

        if (tileIdx !== expectedTile) {
            // Wrong tile clicked -> Game Over
            playTone(130.81, 0.4, "sawtooth");
            setWrongTile(tileIdx);
            setPhase("gameover");

            const score = round - 1;
            setLastCompletedScore(score);
            recordGameResult(score, round);

            schedule(() => {
                setActiveTile(null);
            }, 400);
            return;
        }

        // Correct tile clicked
        playTone(TILE_PALETTE[tileIdx % TILE_PALETTE.length].freq, 0.16);
        schedule(() => {
            setActiveTile(null);
        }, 180);

        const nextStep = userStep + 1;
        if (nextStep < sequence.length) {
            setUserStep(nextStep);
        } else {
            // Completed the full sequence for this round!
            setUserStep(nextStep);
            setPhase("round-clear");

            schedule(() => {
                playRoundSequence(round + 1);
            }, 750);
        }
    };

    // Keyboard shortcuts (keys 1-9, 0) for fast play
    useEffect(() => {
        const onKeyDown = (e) => {
            if (phase !== "input") return;
            const tileCount = getTileCountForRound(round);
            const num = e.key === "0" ? 9 : parseInt(e.key, 10) - 1;
            if (!Number.isNaN(num) && num >= 0 && num < tileCount) {
                handleTileClick(num);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    const handleResetStats = () => {
        if (!storeRef.current) return;
        storeRef.current.set(INITIAL_STORE_STATE);
        setConfirmClear(false);
    };

    // Computed statistics from Orchard DB state
    const stats = useMemo(() => {
        const history = Array.isArray(persisted.history) ? persisted.history : [];
        const totalTries = Math.max(Number(persisted.totalTries) || 0, history.length);

        const allScores = history.map((h) => Number(h.score) || 0);
        const allTimeHigh = Math.max(
            Number(persisted.allTimeHighScore) || 0,
            allScores.length > 0 ? Math.max(...allScores) : 0
        );

        const avgRoundsAllTime =
            allScores.length > 0
                ? allScores.reduce((acc, val) => acc + val, 0) / allScores.length
                : 0;

        const cutoff = Date.now() - TWO_WEEKS_MS;
        const recentEntries = history.filter((h) => (Number(h.timestamp) || 0) >= cutoff);
        const recentScores = recentEntries.map((h) => Number(h.score) || 0);

        const highLastTwoWeeks =
            recentScores.length > 0 ? Math.max(...recentScores) : 0;
        const avgLastTwoWeeks =
            recentScores.length > 0
                ? recentScores.reduce((acc, val) => acc + val, 0) / recentScores.length
                : 0;

        return {
            allTimeHigh,
            avgRoundsAllTime: avgRoundsAllTime.toFixed(1),
            highLastTwoWeeks,
            avgLastTwoWeeks: avgLastTwoWeeks.toFixed(1),
            totalTries,
            recentTriesCount: recentEntries.length,
        };
    }, [persisted]);

    const currentTileCount = getTileCountForRound(round);
    const nextTileAtRound = (Math.floor(round / 5) + 1) * 5;
    const roundsUntilNextTile = nextTileAtRound - round;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 md:p-6">
            <div className="max-w-5xl w-full mx-auto flex flex-col gap-6">

                {/* Main Game Area + Recent History */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start justify-center">
                    {/* Arena (2 cols) */}
                    <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6 flex flex-col gap-5 shadow-xl">
                        {/* Round & Status Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 border border-slate-800/80 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                                        Current Round
                                    </span>
                                    <span className="text-2xl font-extrabold text-white">
                                        {round}
                                    </span>
                                </div>
                                <div className="h-8 w-px bg-slate-800" />
                                <div>
                                    <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                                        Active Tiles
                                    </span>
                                    <span className="text-lg font-bold text-emerald-400">
                                        {currentTileCount}
                                    </span>
                                    <span className="text-xs text-slate-500 ml-1.5">
                                        (+1 in {roundsUntilNextTile} {roundsUntilNextTile === 1 ? "round" : "rounds"})
                                    </span>
                                </div>
                                <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                                <div className="hidden sm:block">
                                    <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                                        Sequence Progress
                                    </span>
                                    <span className="text-lg font-bold text-cyan-300">
                                        {phase === "idle" ? "0 / 0" : `${userStep} / ${sequence.length}`}
                                    </span>
                                </div>
                            </div>

                            {/* Phase Pill */}
                            <div>
                                {phase === "idle" && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                                        Ready to Start
                                    </span>
                                )}
                                {phase === "watching" && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                        Watch Sequence ({sequence.length})...
                                    </span>
                                )}
                                {phase === "input" && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        Your Turn! Repeat ({userStep}/{sequence.length})
                                    </span>
                                )}
                                {phase === "round-clear" && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                        Round {round} Cleared!
                                    </span>
                                )}
                                {phase === "gameover" && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        Game Over • Score: {lastCompletedScore}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Progress Dots for Current Sequence */}
                        {sequence.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 py-1">
                                {sequence.map((_, idx) => {
                                    const isDone = idx < userStep;
                                    const isCurrent = phase === "input" && idx === userStep;
                                    return (
                                        <span
                                            key={idx}
                                            className={`h-2 rounded-full transition-all duration-200 ${isDone
                                                ? "w-4 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                                                : isCurrent
                                                    ? "w-4 bg-amber-400 animate-pulse"
                                                    : "w-2 bg-slate-800"
                                                }`}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* Dynamic Tiles Grid */}
                        <div
                            className={`grid gap-4 my-2 ${currentTileCount === 2
                                ? "grid-cols-2"
                                : currentTileCount <= 4
                                    ? "grid-cols-2 sm:grid-cols-2"
                                    : currentTileCount <= 6
                                        ? "grid-cols-2 sm:grid-cols-3"
                                        : "grid-cols-2 sm:grid-cols-4"
                                }`}
                        >
                            {Array.from({ length: currentTileCount }).map((_, idx) => {
                                const palette = TILE_PALETTE[idx % TILE_PALETTE.length];
                                const isLit = activeTile === idx;
                                const isWrong = wrongTile === idx;
                                const canClick = phase === "input";

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={!canClick}
                                        onClick={() => handleTileClick(idx)}
                                        className={`cursor-pointer relative h-38 sm:h-40 rounded-2xl border-2 transition-all duration-150 flex flex-col items-center justify-center select-none ${isWrong
                                            ? "bg-rose-600 border-rose-200 text-white shadow-[0_0_40px_rgba(225,29,72,0.9)] scale-95"
                                            : isLit
                                                ? `${palette.lit} tile-lit`
                                                : palette.base
                                            } ${canClick
                                                ? "cursor-pointer active:scale-95"
                                                : "cursor-default opacity-90"
                                            }`}
                                    >
                                    </button>
                                );
                            })}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                            {/* <div className="text-xs text-slate-400">
                                {phase === "idle" &&
                                    "Press Start Round 1 to begin. You can also use number keys (1–9)."}
                                {phase === "watching" &&
                                    "Memorize the order the tiles light up..."}
                                {phase === "input" &&
                                    "Click the tiles in the exact order they flashed."}
                                {phase === "round-clear" &&
                                    (round + 1 >= 5 && (round + 1) % 5 === 0
                                        ? `Nice! Round ${round + 1} adds a brand new tile!`
                                        : "Great memory! Preparing next sequence...")}
                                {phase === "gameover" &&
                                    `You cleared ${lastCompletedScore} ${lastCompletedScore === 1 ? "round" : "rounds"
                                    } (failed on round ${round}). Stats saved to Orchard!`}
                            </div> */}

                            <div className="flex items-center gap-2 ml-auto">
                                {phase === "idle" || phase === "gameover" ? (
                                    <button
                                        onClick={startGame}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                                    >
                                        {phase === "gameover" ? (
                                            <>
                                                <RotateCcw className="w-4 h-4" />
                                                Play Again
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 fill-current" />
                                                Start Round 1
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={startGame}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Restart
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Recent Runs & Rules */}
                    {/*
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-emerald-400" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                                    Recent Tries
                                </h2>
                            </div>

                            {persisted.history.length > 0 && (
                                <div>
                                    {confirmClear ? (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={handleResetStats}
                                                className="text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                                            >
                                                Confirm Reset
                                            </button>
                                            <button
                                                onClick={() => setConfirmClear(false)}
                                                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmClear(true)}
                                            className="text-xs text-slate-500 hover:text-rose-400 transition inline-flex items-center gap-1"
                                            title="Reset all saved statistics"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Reset
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {persisted.history.length === 0 ? (
                            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                No games completed yet. Finish a run to log your stats in Orchard!
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                                {persisted.history.slice(0, 15).map((item, idx) => {
                                    const date = new Date(item.timestamp);
                                    const isBest =
                                        item.score > 0 && item.score === stats.allTimeHigh;
                                    return (
                                        <div
                                            key={item.id || idx}
                                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span
                                                    className={`px-2 py-0.5 rounded-md font-bold ${isBest
                                                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                                            : "bg-slate-800 text-slate-200"
                                                        }`}
                                                >
                                                    {item.score} {item.score === 1 ? "rd" : "rds"}
                                                </span>
                                                <span className="text-slate-400">
                                                    Reached Rd {item.roundReached} ({item.tilesReached || 2} tiles)
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-slate-500">
                                                {date.toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                })}{" "}
                                                {date.toLocaleTimeString(undefined, {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-2 pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
                            <div className="font-semibold text-slate-300">How Scaling Works</div>
                            <p>• Rounds 1–4: 2 tiles (flashes = round number)</p>
                            <p>• Rounds 5–9: 3 tiles</p>
                            <p>• Rounds 10–14: 4 tiles (+1 tile every 5 rounds)</p>
                        </div>
                    </div>*/}
                </div>

                {/* Header */}
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    Memorize the Sequence
                                </h1>
                            </div>
                            <p className="text-xs text-slate-400">
                                Starts with 2 tiles • Flashes equal the round number • +1 new tile every 5 rounds
                            </p>
                        </div>
                    </div>

                    <div className="md:w-auto w-full flex items-center justify-end gap-2">
                        <button
                            onClick={() => setSoundEnabled((prev) => !prev)}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
                            title={soundEnabled ? "Mute sound" : "Enable sound"}
                        >
                            {soundEnabled ? (
                                <Volume2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <VolumeX className="w-4 h-4 text-slate-500" />
                            )}
                        </button>
                    </div>
                </header>

                {/* 5 Key Statistics Banner */}
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard
                        icon={<Trophy className="w-4 h-4 text-amber-400" />}
                        label="All-Time High"
                        value={`${stats.allTimeHigh}`}
                        sub="Best rounds cleared"
                        accent="border-amber-500/25 bg-amber-500/5"
                    />
                    <StatCard
                        icon={<Activity className="w-4 h-4 text-emerald-400" />}
                        label="Average Rounds"
                        value={stats.avgRoundsAllTime}
                        sub="All-time average"
                        accent="border-emerald-500/25 bg-emerald-500/5"
                    />
                    <StatCard
                        icon={<Calendar className="w-4 h-4 text-cyan-400" />}
                        label="High (Last 2 Wks)"
                        value={`${stats.highLastTwoWeeks}`}
                        sub={`${stats.recentTriesCount} tries in 14d`}
                        accent="border-cyan-500/25 bg-cyan-500/5"
                    />
                    <StatCard
                        icon={<Layers className="w-4 h-4 text-violet-400" />}
                        label="Avg (Last 2 Wks)"
                        value={stats.avgLastTwoWeeks}
                        sub="14-day rolling avg"
                        accent="border-violet-500/25 bg-violet-500/5"
                    />
                    <StatCard
                        icon={<Hash className="w-4 h-4 text-rose-400" />}
                        label="Tries Overall"
                        value={`${stats.totalTries}`}
                        sub="Total games played"
                        accent="border-rose-500/25 bg-rose-500/5 col-span-2 sm:col-span-1"
                    />
                </section>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, accent }) {
    return (
        <div
            className={`rounded-2xl border p-3.5 flex flex-col justify-between ${accent}`}
        >
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-medium text-slate-300">{label}</span>
                {icon}
            </div>
            <div className="text-2xl font-extrabold text-white tracking-tight">
                {value}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
        </div>
    );
}
