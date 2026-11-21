import { CloudRain } from "lucide-react";
import { rainLabel, surfaceLabel } from "../engine/format.js";

function barColor(rain) {
    if (rain < 5) return "#52525b";
    if (rain < 25) return "#7dd3fc";
    if (rain < 50) return "#38bdf8";
    if (rain < 75) return "#2563eb";
    return "#4338ca";
}

export function WeatherPanel({ wet, rain, forecast, title = "Weather", compact = false }) {
    if (compact) {
        // Horizontal strip: surface and rain readings on the left, rain forecast bars on the right
        return (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <CloudRain size={16} className={rain >= 5 ? "text-sky-400" : "text-zinc-600"} />
                <div className="text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">Track</div>
                    <div className="font-semibold">
                        {surfaceLabel(wet)} <span className="font-mono text-zinc-400">{Math.round(wet)}%</span>
                    </div>
                </div>
                <div className="text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">Rain</div>
                    <div className="font-semibold">
                        {rainLabel(rain)} <span className="font-mono text-zinc-400">{Math.round(rain)}%</span>
                    </div>
                </div>
                <div className="min-w-48 flex-1">
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider text-zinc-500">Forecast (rain %)</div>
                    <div className="flex h-8 items-end gap-1">
                        {forecast.map((f) => (
                            <div
                                key={f.lap}
                                className="flex-1 rounded-sm"
                                style={{ height: `${Math.max(2, f.rain * 0.3)}px`, backgroundColor: barColor(f.rain) }}
                                title={`Lap ${f.lap}: ${f.rain}%`}
                            />
                        ))}
                    </div>
                    <div className="mt-0.5 flex gap-1">
                        {forecast.map((f) => (
                            <div key={f.lap} className="flex-1 text-center font-mono text-[9px] text-zinc-500">
                                {f.lap}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
                <CloudRain size={14} className={rain >= 5 ? "text-sky-400" : "text-zinc-600"} />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                    <div className="text-zinc-500">Track</div>
                    <div className="text-sm font-semibold">
                        {surfaceLabel(wet)} <span className="font-mono text-zinc-400">{Math.round(wet)}%</span>
                    </div>
                </div>
                <div>
                    <div className="text-zinc-500">Rain</div>
                    <div className="text-sm font-semibold">
                        {rainLabel(rain)} <span className="font-mono text-zinc-400">{Math.round(rain)}%</span>
                    </div>
                </div>
            </div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Forecast (rain %)</div>
            <div className="flex h-14 items-end gap-1">
                {forecast.map((f) => (
                    <div key={f.lap} className="flex flex-1 flex-col items-center justify-end gap-0.5">
                        <div
                            className="w-full rounded-sm"
                            style={{ height: `${Math.max(3, f.rain * 0.4)}px`, backgroundColor: barColor(f.rain) }}
                            title={`Lap ${f.lap}: ${f.rain}%`}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-1 flex gap-1">
                {forecast.map((f) => (
                    <div key={f.lap} className="flex-1 text-center font-mono text-[9px] text-zinc-500">
                        {f.lap}
                    </div>
                ))}
            </div>
        </div>
    );
}
