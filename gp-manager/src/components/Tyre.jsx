import { TYRES } from "../engine/constants.js";

export function TyreBadge({ id, size = 20 }) {
    const t = TYRES[id];
    return (
        <span
            className="inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-zinc-900 font-bold uppercase leading-none"
            style={{ width: size, height: size, borderColor: t.color, color: t.color, fontSize: size * 0.5 }}
            title={t.name}
        >
            {id}
        </span>
    );
}

export function WearBar({ value, className = "" }) {
    const v = Math.max(0, Math.min(100, value));
    const color = v > 50 ? "#22c55e" : v > 25 ? "#facc15" : "#ef4444";
    return (
        <span className={`block h-1 overflow-hidden rounded-full bg-zinc-800 ${className}`}>
            <span className="block h-full rounded-full" style={{ width: `${v}%`, backgroundColor: color }} />
        </span>
    );
}
