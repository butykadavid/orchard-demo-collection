const POS_COLORS = { 1: 'text-yellow-400', 2: 'text-slate-300', 3: 'text-orange-400' };

function resolveEntrantName(standing, isDrivers) {
    if (isDrivers) {
        const person = standing.driver || standing.rider || {};
        if (person.firstName || person.lastName) {
            return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
        }
        if (person.name) return person.name;
    }
    const entity =
        standing.team ??
        standing.constructor ??
        standing.manufacturer ??
        standing.owner ??
        {};
    return entity.name ?? '—';
}

function resolveTLA(standing) {
    return standing.driver?.tla ?? standing.rider?.tla ?? null;
}

function resolveNumber(standing) {
    const num = standing.driver?.number ?? standing.rider?.number;
    return num != null ? num : null;
}

function resolveTeam(standing) {
    return standing.team?.name ?? standing.constructor?.name ?? null;
}

export default function StandingsTable({ standings, type }) {
    const isDrivers = type === 'drivers';

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                        <th className="text-left px-3 py-3 text-slate-400 font-semibold text-xs w-10">#</th>
                        <th className="text-left px-3 py-3 text-slate-400 font-semibold text-xs">
                            {isDrivers ? 'Driver' : 'Team / Constructor'}
                        </th>
                        {isDrivers && (
                            <th className="text-left px-3 py-3 text-slate-400 font-semibold text-xs hidden sm:table-cell">
                                Team
                            </th>
                        )}
                        <th className="text-right px-3 py-3 text-slate-400 font-semibold text-xs">
                            Points
                        </th>
                        <th className="text-right px-3 py-3 text-slate-400 font-semibold text-xs hidden sm:table-cell">
                            Wins
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((standing, i) => {
                        const pos = standing.position ?? i + 1;
                        const name = resolveEntrantName(standing, isDrivers);
                        const tla = isDrivers ? resolveTLA(standing) : null;
                        const num = isDrivers ? resolveNumber(standing) : null;
                        const team = isDrivers ? resolveTeam(standing) : null;
                        const points = standing.points ?? '—';
                        const wins = standing.wins ?? '—';

                        return (
                            <tr
                                key={standing.id ?? i}
                                className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/25 transition-colors"
                            >
                                <td className="px-3 py-3">
                                    <span
                                        className={`font-bold text-base ${POS_COLORS[pos] ?? 'text-slate-500'
                                            }`}
                                    >
                                        {pos}
                                    </span>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                        {num != null && (
                                            <span className="text-xs font-mono text-slate-600 w-5 text-right shrink-0">
                                                {num}
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <span className="font-semibold text-white">
                                                {tla ?? name}
                                            </span>
                                            {tla && (
                                                <span className="text-slate-400 text-xs ml-2 hidden sm:inline">
                                                    {name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                {isDrivers && (
                                    <td className="px-3 py-3 text-slate-400 text-xs hidden sm:table-cell truncate max-w-40">
                                        {team ?? '—'}
                                    </td>
                                )}
                                <td className="px-3 py-3 text-right">
                                    <span className="font-bold text-white text-base">{points}</span>
                                </td>
                                <td className="px-3 py-3 text-right text-slate-400 hidden sm:table-cell">
                                    {wins}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
