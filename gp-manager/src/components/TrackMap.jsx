import { useMemo } from "react";
import { CloudRain } from "lucide-react";
import { PIT_ENTRY } from "../engine/constants.js";
import { buildTrackShape } from "../engine/trackShape.js";

const SIZE = 400;
const ROAD_WIDTH = 16;
const PIT_OFFSET = 15; // pit lane distance inside the track centreline

export default function TrackMap({ race, standings, lap }) {
    const shape = useMemo(() => buildTrackShape(race.track), [race.track]);
    const rankOf = new Map(standings.map((s) => [s.car.code, s.position]));
    const wetOpacity = Math.min(0.6, (race.wet / 100) * 0.9);
    const [lineA, lineB] = [shape.place(0, -ROAD_WIDTH / 2 - 1), shape.place(0, ROAD_WIDTH / 2 + 1)];

    return (
        <div className="relative mx-auto aspect-square w-full max-w-130">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
                {/* Tarmac */}
                <path d={shape.loop} fill="none" stroke="#3f3f46" strokeWidth={ROAD_WIDTH + 2} strokeLinejoin="round" />
                <path d={shape.loop} fill="none" stroke="#27272a" strokeWidth={ROAD_WIDTH} strokeLinejoin="round" />
                <path
                    d={shape.loop}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={ROAD_WIDTH}
                    strokeLinejoin="round"
                    strokeOpacity={wetOpacity}
                />

                {/* Pit lane */}
                <path
                    d={shape.pathBetween(PIT_ENTRY, 1.04, -PIT_OFFSET, 16)}
                    fill="none"
                    stroke="#3f3f46"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Start / finish line */}
                <line x1={lineA[0]} y1={lineA[1]} x2={lineB[0]} y2={lineB[1]} stroke="#e4e4e7" strokeWidth="3" opacity="0.85" />

                {/* Cars */}
                {race.cars
                    .filter((car) => !car.dnf)
                    .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))
                    .map((car) => {
                        const frac = ((car.pos % 1) + 1) % 1;
                        const stagger = car.gridPos % 2 === 0 ? 3 : -3;
                        const [x, y] = shape.place(frac, car.pit ? -PIT_OFFSET : stagger);
                        const position = rankOf.get(car.code);
                        const showLabel = car.isPlayer || position <= 3;
                        const color = car.color ?? "#a1a1aa";
                        const [lx, ly] = shape.place(frac, 20);
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
