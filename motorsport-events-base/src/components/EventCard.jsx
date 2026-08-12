import { MapPin, Calendar, ChevronDown, ChevronUp, Radio } from 'lucide-react';

function formatDateRange(startDate, endDate) {
    if (!startDate) return '';
    const start = new Date(startDate);
    const options = { day: 'numeric', month: 'short' };
    if (!endDate || startDate === endDate) {
        return start.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    }
    const end = new Date(endDate);
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }
    return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
}

function getEventStatus(event) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = event.startDate ? new Date(event.startDate) : null;
    const end = event.endDate ? new Date(event.endDate) : start;
    if (!start) return 'unknown';
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : startDay;
    if (startDay <= today && endDay >= today) return 'live';
    if (startDay > today) return 'upcoming';
    return 'past';
}

function daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getLocationString(event) {
    const loc = event.location || event.circuit?.location || {};
    const parts = [
        loc.name || event.circuitName || event.circuit?.name || '',
        [loc.city || '', loc.country || ''].filter(Boolean).join(', '),
    ].filter(Boolean);
    return parts;
}

export default function EventCard({ event, past = false, expanded = false, onClick }) {
    const status = getEventStatus(event);
    const [circuitName, locationStr] = getLocationString(event);
    const dateStr = formatDateRange(event.startDate, event.endDate);
    const days = status === 'upcoming' && event.startDate ? daysUntil(event.startDate) : null;
    const isNext = days !== null && days >= 0 && days <= 3;

    return (
        <div
            className={`bg-slate-900 border rounded-xl overflow-hidden transition-all duration-200 ${past
                    ? `cursor-pointer ${expanded ? 'border-red-800/60' : 'border-slate-800 hover:border-slate-600'}`
                    : isNext
                        ? 'border-red-800/60'
                        : 'border-slate-800'
                }`}
            onClick={past ? onClick : undefined}
        >
            {/* Next event accent bar */}
            {isNext && status === 'upcoming' && (
                <div className="h-0.5 bg-gradient-to-r from-red-500 to-orange-500" />
            )}

            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {event.round != null && (
                                <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                    RD {event.round}
                                </span>
                            )}
                            {status === 'live' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded">
                                    <Radio size={10} />
                                    LIVE
                                </span>
                            )}
                            {status === 'upcoming' && days !== null && (
                                <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded ${days === 0
                                            ? 'bg-red-600 text-white'
                                            : days <= 3
                                                ? 'bg-orange-950 text-orange-400'
                                                : days <= 7
                                                    ? 'bg-slate-800 text-yellow-400'
                                                    : 'bg-slate-800 text-slate-400'
                                        }`}
                                >
                                    {days === 0
                                        ? 'TODAY'
                                        : days === 1
                                            ? 'TOMORROW'
                                            : `IN ${days} DAYS`}
                                </span>
                            )}
                        </div>

                        {/* Event name */}
                        <h3 className="font-bold text-white text-base leading-snug">
                            {event.name}
                        </h3>

                        {/* Circuit name */}
                        {circuitName && (
                            <p className="text-slate-500 text-xs mt-0.5 truncate">{circuitName}</p>
                        )}

                        {/* Location + date */}
                        <div className="mt-2 flex flex-col gap-1">
                            {locationStr && (
                                <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                                    <MapPin size={12} className="shrink-0 text-slate-500" />
                                    <span className="truncate">{locationStr}</span>
                                </div>
                            )}
                            {dateStr && (
                                <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                                    <Calendar size={12} className="shrink-0 text-slate-500" />
                                    <span>{dateStr}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right side */}
                    {past && (
                        <div className="shrink-0 mt-1">
                            {expanded ? (
                                <ChevronUp size={18} className="text-slate-500" />
                            ) : (
                                <ChevronDown size={18} className="text-slate-500" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
