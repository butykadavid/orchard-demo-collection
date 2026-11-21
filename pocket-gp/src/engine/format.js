export function fmtLap(s) {
    if (s == null || !Number.isFinite(s)) return "-:--.---";
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return `${m}:${r.toFixed(3).padStart(6, "0")}`;
}

export function fmtClock(s) {
    const t = Math.max(0, Math.floor(s));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = t % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function fmtGap(seconds, lapsBehind = 0) {
    if (lapsBehind >= 1) return `+${lapsBehind}L`;
    if (seconds == null || !Number.isFinite(seconds)) return "";
    if (seconds >= 60) {
        const m = Math.floor(seconds / 60);
        return `+${m}:${(seconds - m * 60).toFixed(1).padStart(4, "0")}`;
    }
    return `+${seconds.toFixed(seconds < 10 ? 3 : 2)}`;
}

export function surfaceLabel(wet) {
    if (wet < 3) return "Dry";
    if (wet < 18) return "Damp";
    if (wet < 40) return "Wet";
    if (wet < 65) return "Very wet";
    return "Flooded";
}

export function rainLabel(rain) {
    if (rain < 5) return "None";
    if (rain < 25) return "Drizzle";
    if (rain < 50) return "Light";
    if (rain < 75) return "Heavy";
    return "Storm";
}
