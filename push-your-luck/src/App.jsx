import { useEffect, useReducer, useRef, useState, useCallback } from "react";
import { createStore } from "@orchardapp/sdk";
import {
    Dice1,
    Dice2,
    Dice3,
    Dice4,
    Dice5,
    Dice6,
    Dices,
    Hand,
    RotateCcw,
    Trophy,
    Flame,
    Target,
    History,
    Trash2,
    Swords,
} from "lucide-react";

const TARGET = 100;
const ROLL_DURATION_MS = 500;
const AI_THINK_MS = 900;

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

const DIFFICULTIES = {
    cautious: { label: "Cautious", holdAt: 15, desperate: false },
    normal: { label: "Normal", holdAt: 20, desperate: true },
    reckless: { label: "Reckless", holdAt: 28, desperate: true },
};

const INITIAL_STORE_STATE = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    fewestTurnsToWin: null,
    biggestTurn: 0,
    history: [],
};

function createGame(gameId) {
    return {
        gameId,
        scores: [0, 0],
        turn: 0, // 0 = player, 1 = computer
        turnScore: 0,
        die: null,
        rolling: false,
        winner: null,
        playerTurns: 0,
        biggestTurn: 0,
        event: { type: "start" },
    };
}

function finishTurn(state, nextState) {
    return {
        ...nextState,
        turn: 1 - state.turn,
        turnScore: 0,
        playerTurns: state.playerTurns + (state.turn === 0 ? 1 : 0),
    };
}

function reducer(state, action) {
    switch (action.type) {
        case "NEW":
            return createGame(action.gameId);

        case "ROLL_START":
            if (state.rolling || state.winner !== null) return state;
            return { ...state, rolling: true };

        case "ROLL_RESULT": {
            if (state.winner !== null) return state;
            const value = action.value;
            const who = state.turn;

            if (value === 1) {
                return finishTurn(state, {
                    ...state,
                    rolling: false,
                    die: 1,
                    event: { type: "bust", who, lost: state.turnScore },
                });
            }

            const turnScore = state.turnScore + value;
            const total = state.scores[who] + turnScore;

            if (total >= TARGET) {
                const scores = [...state.scores];
                scores[who] = total;
                return {
                    ...state,
                    rolling: false,
                    die: value,
                    scores,
                    turnScore: 0,
                    winner: who,
                    playerTurns: state.playerTurns + (who === 0 ? 1 : 0),
                    biggestTurn: who === 0 ? Math.max(state.biggestTurn, turnScore) : state.biggestTurn,
                    event: { type: "win", who },
                };
            }

            return {
                ...state,
                rolling: false,
                die: value,
                turnScore,
                event: { type: "roll", who, value },
            };
        }

        case "HOLD": {
            if (state.rolling || state.winner !== null || state.turnScore === 0) return state;
            const who = state.turn;
            const banked = state.turnScore;
            const scores = [...state.scores];
            scores[who] += banked;
            const biggestTurn = who === 0 ? Math.max(state.biggestTurn, banked) : state.biggestTurn;

            if (scores[who] >= TARGET) {
                return {
                    ...state,
                    scores,
                    turnScore: 0,
                    winner: who,
                    playerTurns: state.playerTurns + (who === 0 ? 1 : 0),
                    biggestTurn,
                    event: { type: "win", who },
                };
            }

            return finishTurn(state, {
                ...state,
                scores,
                biggestTurn,
                event: { type: "hold", who, banked },
            });
        }

        default:
            return state;
    }
}

function shouldComputerHold(state, difficulty) {
    if (state.turnScore === 0) return false;
    const cfg = DIFFICULTIES[difficulty];
    const cpuTotal = state.scores[1] + state.turnScore;
    if (cpuTotal >= TARGET) return true;
    if (state.turnScore >= cfg.holdAt) {
        // Player is close to winning and CPU is behind: keep pushing instead of settling.
        if (cfg.desperate && state.scores[0] >= TARGET - 20 && state.scores[1] < state.scores[0]) {
            return false;
        }
        return true;
    }
    return false;
}

function statusMessage(event) {
    const name = (who) => (who === 0 ? "You" : "Computer");
    switch (event.type) {
        case "start":
            return "Roll the die. A 1 loses your turn points.";
        case "roll":
            return `${name(event.who)} rolled a ${event.value}.`;
        case "hold":
            return `${name(event.who)} banked ${event.banked} points.`;
        case "bust":
            return event.lost > 0
                ? `${name(event.who)} rolled a 1 and lost ${event.lost} points.`
                : `${name(event.who)} rolled a 1.`;
        case "win":
            return event.who === 0 ? "You reached 100. You win!" : "The computer reached 100.";
        default:
            return "";
    }
}

function formatDate(ts) {
    return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function App() {
    const [persisted, setPersisted] = useState(INITIAL_STORE_STATE);
    const [difficulty, setDifficulty] = useState("normal");
    const [confirmClear, setConfirmClear] = useState(false);
    const [game, dispatch] = useReducer(reducer, undefined, () => createGame(Date.now()));

    const storeRef = useRef(null);
    const rollTimerRef = useRef(null);
    const recordedGameRef = useRef(null);

    // Orchard SDK store
    useEffect(() => {
        const store = createStore("pushYourLuckStats", INITIAL_STORE_STATE);
        storeRef.current = store;

        const unsubscribe = store.subscribe((data) => {
            if (data && typeof data === "object") {
                setPersisted({
                    gamesPlayed: Number(data.gamesPlayed) || 0,
                    wins: Number(data.wins) || 0,
                    losses: Number(data.losses) || 0,
                    currentStreak: Number(data.currentStreak) || 0,
                    bestStreak: Number(data.bestStreak) || 0,
                    fewestTurnsToWin:
                        data.fewestTurnsToWin === null || data.fewestTurnsToWin === undefined
                            ? null
                            : Number(data.fewestTurnsToWin) || null,
                    biggestTurn: Number(data.biggestTurn) || 0,
                    history: Array.isArray(data.history) ? data.history : [],
                });
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(rollTimerRef.current);
        };
    }, []);

    const rollDie = useCallback(() => {
        dispatch({ type: "ROLL_START" });
        clearTimeout(rollTimerRef.current);
        rollTimerRef.current = setTimeout(() => {
            dispatch({ type: "ROLL_RESULT", value: Math.floor(Math.random() * 6) + 1 });
        }, ROLL_DURATION_MS);
    }, []);

    const startNewGame = (nextDifficulty = difficulty) => {
        clearTimeout(rollTimerRef.current);
        setDifficulty(nextDifficulty);
        dispatch({ type: "NEW", gameId: Date.now() });
    };

    // Computer turn
    useEffect(() => {
        if (game.turn !== 1 || game.winner !== null || game.rolling) return;

        const timer = setTimeout(() => {
            if (shouldComputerHold(game, difficulty)) {
                dispatch({ type: "HOLD" });
            } else {
                rollDie();
            }
        }, AI_THINK_MS);

        return () => clearTimeout(timer);
    }, [game, difficulty, rollDie]);

    // Record the result once per finished game
    useEffect(() => {
        if (game.winner === null || recordedGameRef.current === game.gameId) return;
        if (!storeRef.current) return;
        recordedGameRef.current = game.gameId;

        const won = game.winner === 0;
        const entry = {
            id: `${game.gameId}-${Math.random().toString(36).slice(2, 7)}`,
            won,
            playerScore: game.scores[0],
            computerScore: game.scores[1],
            difficulty,
            turns: game.playerTurns,
            timestamp: Date.now(),
        };

        storeRef.current.update((prev) => {
            const safe = prev && typeof prev === "object" ? prev : INITIAL_STORE_STATE;
            const prevHistory = Array.isArray(safe.history) ? safe.history : [];
            const streak = won ? (Number(safe.currentStreak) || 0) + 1 : 0;
            const prevFewest =
                safe.fewestTurnsToWin === null || safe.fewestTurnsToWin === undefined
                    ? null
                    : Number(safe.fewestTurnsToWin) || null;

            return {
                gamesPlayed: (Number(safe.gamesPlayed) || 0) + 1,
                wins: (Number(safe.wins) || 0) + (won ? 1 : 0),
                losses: (Number(safe.losses) || 0) + (won ? 0 : 1),
                currentStreak: streak,
                bestStreak: Math.max(Number(safe.bestStreak) || 0, streak),
                fewestTurnsToWin: won
                    ? prevFewest === null
                        ? game.playerTurns
                        : Math.min(prevFewest, game.playerTurns)
                    : prevFewest,
                biggestTurn: Math.max(Number(safe.biggestTurn) || 0, game.biggestTurn),
                history: [entry, ...prevHistory].slice(0, 100),
            };
        });
    }, [game, difficulty]);

    const clearStats = () => {
        if (!storeRef.current) return;
        storeRef.current.update(() => INITIAL_STORE_STATE);
        setConfirmClear(false);
    };

    const isPlayerTurn = game.turn === 0 && game.winner === null;
    const canRoll = isPlayerTurn && !game.rolling;
    const canHold = canRoll && game.turnScore > 0;
    const DieIcon = game.die ? DICE_ICONS[game.die - 1] : Dices;
    const isBust = game.event.type === "bust";
    const winRate = persisted.gamesPlayed > 0 ? Math.round((persisted.wins / persisted.gamesPlayed) * 100) : 0;

    const players = [
        { name: "You", score: game.scores[0], accent: "emerald" },
        { name: "Computer", score: game.scores[1], accent: "rose" },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
            <div className="mx-auto max-w-3xl space-y-6">
                <header className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
                            <Dices className="h-8 w-8 text-amber-400" />
                            Push Your Luck
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            First to {TARGET}. Roll a 1 and you lose your turn points.
                        </p>
                    </div>
                    <button
                        onClick={() => startNewGame()}
                        className="absolute sm:relative top-8 right-4 sm:top-0 sm:right-0 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                    >
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">New game</span>
                    </button>
                </header>

                {/* Difficulty */}
                <div className="flex items-center gap-2">
                    {Object.entries(DIFFICULTIES).map(([key, cfg]) => (
                        <button
                            key={key}
                            onClick={() => key !== difficulty && startNewGame(key)}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition ${key === difficulty
                                ? "border-amber-400/70 bg-amber-400/10 text-amber-300"
                                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"
                                }`}
                        >
                            {cfg.label}
                        </button>
                    ))}
                </div>

                {/* Scoreboard */}
                <div className="grid grid-cols-2 gap-4">
                    {players.map((p, idx) => {
                        const active = game.turn === idx && game.winner === null;
                        const isWinner = game.winner === idx;
                        const pct = Math.min(100, (p.score / TARGET) * 100);
                        const barColor = idx === 0 ? "bg-emerald-400" : "bg-rose-400";
                        return (
                            <div
                                key={p.name}
                                className={`rounded-2xl border p-4 transition ${isWinner
                                    ? "border-amber-400 bg-amber-400/10"
                                    : active
                                        ? "border-slate-500 bg-slate-900"
                                        : "border-slate-800 bg-slate-900/60"
                                    }`}
                            >
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span className="font-medium text-slate-200">{p.name}</span>
                                    {isWinner && <Trophy className="h-4 w-4 text-amber-400" />}
                                    {active && <span className="text-xs text-amber-300">Playing</span>}
                                </div>
                                <div className="mt-2 text-4xl font-bold tabular-nums">{p.score}</div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                                    <div
                                        className={`h-full ${barColor} transition-all duration-500`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Table */}
                <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
                    <div className="mb-4 text-sm uppercase tracking-wider text-slate-500">
                        {game.winner !== null
                            ? "Game over"
                            : game.turn === 0
                                ? "Your turn"
                                : "Computer's turn"}
                    </div>

                    <div className="flex justify-center">
                        <DieIcon
                            strokeWidth={1.25}
                            className={`h-28 w-28 ${game.rolling ? "dice-rolling" : ""} ${isBust ? "text-rose-400" : "text-amber-300"
                                }`}
                        />
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-lg">
                        <Flame className="h-5 w-5 text-orange-400" />
                        <span className="text-slate-400">Turn total:</span>
                        <span className="text-2xl font-bold tabular-nums text-orange-300">{game.turnScore}</span>
                    </div>

                    <p
                        className={`mt-3 min-h-6 text-sm ${isBust ? "text-rose-300" : game.winner !== null ? "text-amber-300" : "text-slate-300"
                            }`}
                        aria-live="polite"
                    >
                        {statusMessage(game.event)}
                    </p>

                    <div className="mt-6 flex justify-center gap-3">
                        {game.winner !== null ? (
                            <button
                                onClick={() => startNewGame()}
                                className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-amber-300"
                            >
                                <RotateCcw className="h-5 w-5" />
                                Play again
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={rollDie}
                                    disabled={!canRoll}
                                    className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Dices className="h-5 w-5" />
                                    Roll
                                </button>
                                <button
                                    onClick={() => dispatch({ type: "HOLD" })}
                                    disabled={!canHold}
                                    className="flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-6 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Hand className="h-5 w-5" />
                                    Hold
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-semibold">
                            <Target className="h-5 w-5 text-slate-400" />
                            Stats
                        </h2>
                        {confirmClear ? (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-400">Clear all stats?</span>
                                <button
                                    onClick={clearStats}
                                    className="rounded-lg bg-rose-500 px-3 py-1 font-medium text-white hover:bg-rose-400"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => setConfirmClear(false)}
                                    className="rounded-lg border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800"
                                >
                                    No
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmClear(true)}
                                disabled={persisted.gamesPlayed === 0}
                                className="flex items-center gap-1 text-sm text-slate-500 transition hover:text-rose-400 disabled:opacity-40 disabled:hover:text-slate-500"
                            >
                                <Trash2 className="h-4 w-4" />
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                            { label: "Games", value: persisted.gamesPlayed },
                            { label: "Win rate", value: `${winRate}%` },
                            { label: "Wins / Losses", value: `${persisted.wins} / ${persisted.losses}` },
                            { label: "Streak (best)", value: `${persisted.currentStreak} (${persisted.bestStreak})` },
                            { label: "Biggest turn", value: persisted.biggestTurn },
                            {
                                label: "Fewest turns to win",
                                value: persisted.fewestTurnsToWin ?? "-",
                            },
                        ].map((s) => (
                            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                                <div className="text-xs text-slate-500">{s.label}</div>
                                <div className="mt-1 text-xl font-semibold tabular-nums">{s.value}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* History */}
                {persisted.history.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="flex items-center gap-2 text-lg font-semibold">
                            <History className="h-5 w-5 text-slate-400" />
                            Recent games
                        </h2>
                        <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 text-sm">
                            {persisted.history.slice(0, 10).map((h) => (
                                <li key={h.id} className="flex items-center justify-between px-4 py-2">
                                    <span className={h.won ? "text-emerald-300" : "text-rose-300"}>
                                        {h.won ? "Win" : "Loss"}
                                    </span>
                                    <span className="tabular-nums text-slate-300">
                                        {h.playerScore} - {h.computerScore}
                                    </span>
                                    <span className="text-slate-500">
                                        {DIFFICULTIES[h.difficulty]?.label ?? h.difficulty}
                                    </span>
                                    <span className="text-slate-500">{formatDate(h.timestamp)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
