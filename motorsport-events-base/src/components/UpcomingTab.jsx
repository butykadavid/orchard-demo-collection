import { useState, useEffect } from 'react';
import { CURRENT_YEAR } from '../config/sports';
import { api } from '../api/blacktop';
import SeasonPicker from './SeasonPicker';
import EventCard from './EventCard';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ErrorBanner from './ErrorBanner';

function isUpcoming(event) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = event.endDate
        ? new Date(event.endDate)
        : event.startDate
            ? new Date(event.startDate)
            : null;
    if (!end) return true;
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return endDay >= today;
}

export default function UpcomingTab({ sport }) {
    const [season, setSeason] = useState(CURRENT_YEAR);
    const [events, setEvents] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setEvents(null);

        api
            .getEvents(sport.slug, season)
            .then(res => {
                const upcoming = (res.data || [])
                    .filter(isUpcoming)
                    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                setEvents(upcoming);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [sport.slug, season]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Upcoming Events</h2>
                    <p className="text-slate-500 text-xs mt-0.5">{sport.label}</p>
                </div>
                <SeasonPicker sport={sport} value={season} onChange={setSeason} />
            </div>

            {loading && <Spinner message="Loading calendar…" />}
            {!loading && error && <ErrorBanner message={error} />}
            {!loading && !error && events?.length === 0 && (
                <EmptyState
                    title="No upcoming events"
                    message={`No scheduled events found for ${sport.label} in ${season}.`}
                />
            )}
            {!loading && !error && events && events.length > 0 && (
                <div className="flex flex-col gap-3">
                    {events.map(event => (
                        <EventCard key={event.id} event={event} />
                    ))}
                </div>
            )}
        </div>
    );
}
