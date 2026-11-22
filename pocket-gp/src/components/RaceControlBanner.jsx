import { Flag, Play, ShieldAlert } from "lucide-react";
import { fmtClock } from "../engine/format.js";

const STYLE = {
    vsc: "border-amber-500/60 bg-amber-500/10 text-amber-200",
    sc: "border-amber-500/60 bg-amber-500/10 text-amber-200",
    red: "border-red-500/70 bg-red-500/10 text-red-200",
};

// Race control status above the track map: safety car, virtual safety car and red flag (with the restart button)
export default function RaceControlBanner({ race, onRestart }) {
    const c = race.control;
    if (c.mode === "green") return null;

    let title;
    let text;
    if (c.mode === "vsc") {
        title = "Virtual safety car";
        text = "Everybody slows down and holds the gaps. No overtaking. A stop through the pits costs less.";
    } else if (c.mode === "sc") {
        title = "Safety car";
        text = c.ending
            ? "The safety car comes in at the end of this lap. Racing resumes at the line."
            : "The field closes up behind the safety car. No overtaking. A stop through the pits costs much less.";
    } else {
        title = "Red flag";
        if (c.phase === "stopping") text = "The race is stopped. The cars are driving to the pit lane.";
        else if (c.phase === "waiting") {
            const left = Math.max(0, c.waitS - (race.clock - c.waitStart));
            text = c.rain && left <= 0 ? "Waiting for the rain to ease." : `Cars in the pit lane, free tyre change for everybody. Restart in about ${fmtClock(left)}.`;
        } else text = "Everything is ready. Standing start: the lap counter carries on, everybody has fresh tyres.";
    }

    const canRestart = c.mode === "red" && (c.phase === "waiting" || c.phase === "awaiting");

    return (
        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${STYLE[c.mode]}`}>
            {c.mode === "red" ? <Flag size={18} className="shrink-0" /> : <ShieldAlert size={18} className="shrink-0" />}
            <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wider">{title}</div>
                <div className="text-xs opacity-90">{text}</div>
            </div>
            {canRestart && (
                <button
                    type="button"
                    onClick={onRestart}
                    className={`flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${c.phase === "awaiting" ? "pulse-box bg-red-600 text-white hover:bg-red-500" : "border border-red-500/60 text-red-200 hover:bg-red-500/20"}`}
                >
                    <Play size={13} /> {c.phase === "awaiting" ? "Restart race" : "Restart now"}
                </button>
            )}
        </div>
    );
}
