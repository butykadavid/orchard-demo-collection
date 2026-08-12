const BASE_URL = 'https://api.ocblacktop.com/v1';
const API_KEY = import.meta.env.VITE_BLACKTOP_API_KEY;

async function apiFetch(path, params = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, String(v));
        }
    });

    const res = await fetch(url.toString(), {
        headers: { 'X-API-Key': API_KEY },
    });

    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            message = body.message || message;
        } catch {
            // ignore parse error
        }
        throw new Error(message);
    }

    return res.json();
}

export const api = {
    getEvents: (sport, season) =>
        apiFetch(`/${sport}/events`, { season, limit: 50, page: 1 }),

    getSessions: (sport, eventId) =>
        apiFetch(`/${sport}/events/${eventId}/sessions`, { limit: 20 }),

    getResults: (sport, eventId, sessionId) =>
        apiFetch(`/${sport}/events/${eventId}/sessions/${sessionId}/results`, {
            limit: 50,
        }),

    getStandings: (sport, season, type) =>
        apiFetch(`/${sport}/standings`, { season, type, limit: 50 }),
};
