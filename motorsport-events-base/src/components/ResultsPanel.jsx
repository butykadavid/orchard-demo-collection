import { useState, useEffect } from 'react';
import { api } from '../api/blacktop';
import Spinner from './Spinner';

function resolveDriverName(result) {
    if (result.drivers && result.drivers.length > 0) {
        return result.drivers
            .map(d => (d.tla ? d.tla : `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()))
            .join(' / ');
    }
    const person = result.driver || result.rider || {};
    if (person.firstName || person.lastName) {
        return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
    }
    if (person.name) return person.name;
    return null;
}

function resolveTLA(result) {
    if (result.drivers && result.drivers.length === 1) return result.drivers[0].tla ?? null;
    return result.driver?.tla ?? result.rider?.tla ?? null;
}

function resolveNumber(result) {
    const num = result.driver?.number ?? result.rider?.number ?? result.car?.number;
    return num != null ? num : null;
}

function resolveTeam(result) {
    return (
        result.team?.name ??
        result.constructor?.name ??
        result.car?.team?.name ??
        null
    );
}

function resolveTime(result) {
    return result.time ?? result.bestLap ?? result.totalTime ?? result.gap ?? null;
}

function resolveStatus(result) {
    if (result.status && result.status !== 'Finished') return result.status;
    return null;
}

const POS_COLORS = {
    1: 'text-yellow-400',
    2: 'text-slate-300',
    3: 'text-orange-400',
};

export default function ResultsPanel({ sport, eventId, sessionId }) {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setResults(null);

        api
            .getResults(sport.slug, eventId, sessionId)
            .then(res => setResults(res.data || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [sport.slug, eventId, sessionId]);

    if (loading) return <Spinner message="Loading results…" />;

    if (error) return <p className="text-red-400 text-sm py-2">{error}</p>;

    if (!results || results.length === 0) {
        return <p className="text-slate-500 text-sm py-2">No results available yet.</p>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                        <th className="text-left px-3 py-2.5 text-slate-400 font-semibold text-xs w-10">#</th>
                        <th className="text-left px-3 py-2.5 text-slate-400 font-semibold text-xs">Driver</th>
                        <th className="text-left px-3 py-2.5 text-slate-400 font-semibold text-xs hidden sm:table-cell">
                            Team
                        </th>
                        <th className="text-right px-3 py-2.5 text-slate-400 font-semibold text-xs">
                            Time / Status
                        </th>
                        <th className="text-right px-3 py-2.5 text-slate-400 font-semibold text-xs hidden sm:table-cell">
                            Pts
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((result, i) => {
                        const pos = result.position ?? i + 1;
                        const name = resolveDriverName(result);
                        const tla = resolveTLA(result);
                        const num = resolveNumber(result);
                        const team = resolveTeam(result);
                        const time = resolveTime(result);
                        const status = resolveStatus(result);
                        const pts = result.points;

                        return (
                            <tr
                                key={result.id ?? i}
                                className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/25 transition-colors"
                            >
                                <td className="px-3 py-2.5">
                                    <span
                                        className={`font-bold ${POS_COLORS[pos] ?? 'text-slate-500'
                                            }`}
                                    >
                                        {pos}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        {num != null && (
                                            <span className="text-xs font-mono text-slate-600 w-5 text-right shrink-0">
                                                {num}
                                            </span>
                                        )}
                                        <span className="font-semibold text-white">
                                            {tla ?? name ?? '—'}
                                        </span>
                                        {tla && name && (
                                            <span className="text-slate-500 text-xs hidden sm:inline truncate max-w-28">
                                                {name}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2.5 text-slate-400 text-xs hidden sm:table-cell truncate max-w-36">
                                    {team ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    {time ? (
                                        <span className="font-mono text-xs text-slate-300">{time}</span>
                                    ) : status ? (
                                        <span className="text-xs text-slate-500">{status}</span>
                                    ) : (
                                        <span className="text-slate-600">—</span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-right text-slate-300 font-semibold hidden sm:table-cell">
                                    {pts != null ? pts : '—'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
