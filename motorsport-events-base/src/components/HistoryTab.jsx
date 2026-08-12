import { useState, useEffect } from 'react';
import { CURRENT_YEAR } from '../config/sports';
import { api } from '../api/blacktop';
import SeasonPicker from './SeasonPicker';
import EventCard from './EventCard';
import SessionsPanel from './SessionsPanel';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ErrorBanner from './ErrorBanner';

function isPast(event) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = event.endDate
        ? new Date(event.endDate)
        : event.startDate
            ? new Date(event.startDate)
            : null;
    if (!end) return false;
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return endDay < today;
}

export default function HistoryTab({ sport }) {
    const [season, setSeason] = useState(CURRENT_YEAR);
    const [events, setEvents] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setEvents(null);
        setExpandedId(null);

        api
            .getEvents(sport.slug, season)
            .then(res => {
                const past = (res.data || [])
                    .filter(isPast)
                    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // most recent first
                setEvents(past);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [sport.slug, season]);

    // Also reset expanded when season changes
    useEffect(() => {
        setExpandedId(null);
    }, [season]);

    function toggle(id) {
        setExpandedId(prev => (prev === id ? null : id));
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Race History</h2>
                    <p className="text-slate-500 text-xs mt-0.5">{sport.label}</p>
                </div>
                <SeasonPicker sport={sport} value={season} onChange={setSeason} />
            </div>

            {loading && <Spinner message="Loading results…" />}
            {!loading && error && <ErrorBanner message={error} />}
            {!loading && !error && events?.length === 0 && (
                <EmptyState
                    title="No past events"
                    message={`No completed events found for ${sport.label} in ${season}.`}
                />
            )}
            {!loading && !error && events && events.length > 0 && (
                <div className="flex flex-col gap-3">
                    {events.map(event => (
                        <div key={event.id} className="rounded-xl overflow-hidden">
                            <EventCard
                                event={event}
                                past
                                expanded={expandedId === event.id}
                                onClick={() => toggle(event.id)}
                            />
                            {expandedId === event.id && (
                                <SessionsPanel sport={sport} eventId={event.id} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
