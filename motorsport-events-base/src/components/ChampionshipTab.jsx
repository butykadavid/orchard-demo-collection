import { useState, useEffect } from 'react';
import { CURRENT_YEAR } from '../config/sports';
import { api } from '../api/blacktop';
import SeasonPicker from './SeasonPicker';
import StandingsTable from './StandingsTable';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ErrorBanner from './ErrorBanner';

export default function ChampionshipTab({ sport }) {
    const [season, setSeason] = useState(CURRENT_YEAR);
    const [type, setType] = useState(sport.standingsTypes[0].value);
    const [standings, setStandings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Reset standings type when sport changes
    useEffect(() => {
        setType(sport.standingsTypes[0].value);
        setStandings(null);
        setError(null);
    }, [sport.slug]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setStandings(null);

        api
            .getStandings(sport.slug, season, type)
            .then(res => setStandings(res.data || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [sport.slug, season, type]);

    const selectedTypeLabel =
        sport.standingsTypes.find(t => t.value === type)?.label ?? 'Standings';

    return (
        <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white">Championship</h2>
                    <p className="text-slate-500 text-xs mt-0.5">{sport.label}</p>
                </div>
                <SeasonPicker sport={sport} value={season} onChange={setSeason} />
            </div>

            {/* Standings type pills */}
            {sport.standingsTypes.length > 1 && (
                <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                    {sport.standingsTypes.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setType(value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${type === value
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {loading && <Spinner message={`Loading ${selectedTypeLabel.toLowerCase()} standings…`} />}
            {!loading && error && <ErrorBanner message={error} />}
            {!loading && !error && standings?.length === 0 && (
                <EmptyState
                    title="No standings data"
                    message={`${selectedTypeLabel} standings for ${sport.label} ${season} aren't available yet.`}
                />
            )}
            {!loading && !error && standings && standings.length > 0 && (
                <StandingsTable standings={standings} type={type} />
            )}
        </div>
    );
}
