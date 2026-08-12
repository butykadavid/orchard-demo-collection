import { useState, useEffect } from 'react';
import { api } from '../api/blacktop';
import ResultsPanel from './ResultsPanel';
import Spinner from './Spinner';

export default function SessionsPanel({ sport, eventId }) {
    const [sessions, setSessions] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeSessionId, setActiveSessionId] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setSessions(null);
        setActiveSessionId(null);

        api
            .getSessions(sport.slug, eventId)
            .then(res => setSessions(res.data || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [sport.slug, eventId]);

    if (loading) {
        return (
            <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-4">
                <Spinner message="Loading sessions…" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
            </div>
        );
    }

    if (!sessions || sessions.length === 0) {
        return (
            <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-3">
                <p className="text-slate-500 text-sm">No session data available.</p>
            </div>
        );
    }

    return (
        <div className="border-t border-slate-800 bg-slate-950/60">
            <div className="px-4 pt-3 pb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Sessions
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                    {sessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() =>
                                setActiveSessionId(prev =>
                                    prev === session.id ? null : session.id
                                )
                            }
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeSessionId === session.id
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {session.name || session.type || 'Session'}
                        </button>
                    ))}
                </div>

                {activeSessionId && (
                    <ResultsPanel
                        sport={sport}
                        eventId={eventId}
                        sessionId={activeSessionId}
                    />
                )}
            </div>
        </div>
    );
}
