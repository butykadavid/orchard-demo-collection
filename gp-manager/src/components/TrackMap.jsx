import { CloudRain } from "lucide-react";
import { PIT_ENTRY, TEAMS } from "../engine/constants.js";

const SIZE = 400;
const C = SIZE / 2;
const R = 150;
const PIT_R = R - 22;

const angleOf = (frac) => frac * 2 * Math.PI - Math.PI / 2;
const pointAt = (frac, r) => [C + r * Math.cos(angleOf(frac)), C + r * Math.sin(angleOf(frac))];

function arc(fromFrac, toFrac, r) {
    const [x1, y1] = pointAt(fromFrac, r);
    const [x2, y2] = pointAt(toFrac, r);
    const large = toFrac - fromFrac > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export default function TrackMap({ race, standings, lap }) {
    const rankOf = new Map(standings.map((s) => [s.car.code, s.position]));
    const wetOpacity = Math.min(0.6, (race.wet / 100) * 0.9);

    return (
        <div className="relative mx-auto aspect-square w-full max-w-130">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
                {/* Tarmac */}
                <circle cx={C} cy={C} r={R} fill="none" stroke="#27272a" strokeWidth="26" />
                <circle cx={C} cy={C} r={R} fill="none" stroke="#3b82f6" strokeWidth="26" strokeOpacity={wetOpacity} />
                <circle cx={C} cy={C} r={R + 13} fill="none" stroke="#3f3f46" strokeWidth="1" />
                <circle cx={C} cy={C} r={R - 13} fill="none" stroke="#3f3f46" strokeWidth="1" />

                {/* Pit lane */}
                <path d={arc(PIT_ENTRY, 1.04, PIT_R)} fill="none" stroke="#3f3f46" strokeWidth="6" strokeLinecap="round" />

                {/* Start / finish line */}
                <rect x={C - 1.5} y={C - R - 13} width="3" height="26" fill="#e4e4e7" opacity="0.85" />

                {/* Cars */}
                {race.cars
                    .filter((car) => !car.dnf)
                    .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))
                    .map((car) => {
                        const frac = ((car.pos % 1) + 1) % 1;
                        const stagger = car.gridPos % 2 === 0 ? 4 : -4;
                        const r = car.pit ? PIT_R : R + stagger;
                        const [x, y] = pointAt(frac, r);
                        const position = rankOf.get(car.code);
                        const showLabel = car.isPlayer || position <= 3;
                        const color = TEAMS[car.team]?.color ?? "#a1a1aa";
                        const [lx, ly] = pointAt(frac, R + 26);
                        return (
                            <g key={car.code} opacity={car.finished ? 0.55 : 1}>
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={car.isPlayer ? 6.5 : 4.5}
                                    fill={color}
                                    stroke={car.isPlayer ? "#ffffff" : "#09090b"}
                                    strokeWidth={car.isPlayer ? 2 : 1}
                                />
                                {showLabel && (
                                    <text
                                        x={lx}
                                        y={ly}
                                        fontSize="10"
                                        fontWeight="700"
                                        fill={car.isPlayer ? "#ffffff" : "#a1a1aa"}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                    >
                                        {car.code}
                                    </text>
                                )}
                            </g>
                        );
                    })}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Lap</div>
                <div className="font-mono text-4xl font-bold leading-none">
                    {lap}
                    <span className="text-xl text-zinc-500">/{race.lapsTotal}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-zinc-400">
                    <CloudRain size={13} className={race.rain >= 5 ? "text-sky-400" : "text-zinc-600"} />
                    <span className="font-mono">{Math.round(race.wet)}%</span> wet
                </div>
            </div>
        </div>
    );
}
