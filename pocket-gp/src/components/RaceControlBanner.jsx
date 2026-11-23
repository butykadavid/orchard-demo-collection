import { Flag, Play, ShieldAlert } from "lucide-react";
import { RED_CANCEL_S } from "../engine/constants.js";
import { redRestartWet } from "../engine/control.js";
import { fmtClock } from "../engine/format.js";

const VSC_ENDING_S = 10; // race seconds before the end of a virtual safety car in which "ending" is shown

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
        if (c.until - race.clock <= VSC_ENDING_S) {
            title = "Virtual safety car ending";
            text = "Racing resumes any moment. Get ready to push.";
        } else {
            title = "Virtual safety car";
            text = "Everybody slows down and holds the gaps. No overtaking. A stop through the pits costs less.";
        }
    } else if (c.mode === "sc") {
        if (c.ending) {
            title = "Safety car in this lap";
            text = "The safety car comes in at the end of this lap. Racing resumes at the line.";
        } else if (c.collecting && race.order[0].pos < c.pickupLap) {
            title = "Safety car";
            text = "The safety car is out and the field slows down. It picks up the leader at the line. No overtaking. A stop through the pits costs much less.";
        } else if (c.collecting) {
            title = "Safety car";
            text = "The field slows down behind the safety car and the leader slows down further to collect it. No overtaking. A stop through the pits costs much less.";
        } else {
            title = "Safety car";
            text = "The field is closed up behind the safety car. No overtaking. A stop through the pits costs much less.";
        }
    } else {
        title = "Red flag";
        if (c.phase === "stopping") text = "The race is stopped. The cars are driving to the pit lane.";
        else if (c.phase === "cancelled") {
            title = "Race cancelled";
            text = "The conditions did not improve in time. The order at the red flag is the final result.";
        } else if (c.phase === "waiting") {
            const left = Math.max(0, c.waitS - (race.clock - c.waitStart));
            if (race.wet >= redRestartWet(c)) {
                text = `Waiting for the track to be fit for racing. The race is cancelled if it cannot restart within ${fmtClock(Math.max(0, RED_CANCEL_S - (race.clock - c.since)))}.`;
            } else {
                text = `Cars in the pit lane, free tyre change for everybody. Restart in about ${fmtClock(left)}.`;
            }
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
