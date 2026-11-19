import { Pause, Play } from "lucide-react";
import { SPEEDS } from "../engine/constants.js";

export default function SpeedControls({ paused, speed, onTogglePause, onSpeed }) {
    return (
        <div className="flex items-center gap-1">
            <button
                type="button"
                onClick={onTogglePause}
                className={`flex h-7 w-7 items-center justify-center rounded-md border ${paused ? "border-amber-500 bg-amber-500/15 text-amber-400" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    }`}
                title="Pause / resume (Space)"
            >
                {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            {SPEEDS.map((s, i) => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onSpeed(s)}
                    className={`h-7 min-w-9 rounded-md border px-1.5 font-mono text-xs ${!paused && speed === s ? "border-red-500 bg-red-600 text-white" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        }`}
                    title={`${s}x (key ${i + 1})`}
                >
                    {s}x
                </button>
            ))}
        </div>
    );
}
