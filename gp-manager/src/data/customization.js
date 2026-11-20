import { DRIVERS, TRACKS } from "./index.js";
import { TYRE_IDS, TYRES } from "../engine/constants.js";

// User customisation (sandbox mode): the grid, the circuits and the tyre compounds can be edited and are
// kept in localStorage. DRIVERS, TRACKS and TYRES are shared module-level objects that the whole app
// imports, so edits are applied to them in place and the defaults are snapshotted at load time.
// Importing this module applies any saved customisation before the UI renders.

const STORAGE_KEY = "gp-manager-customization-v1";
const SECTIONS = ["drivers", "tracks", "tyres"];

const clone = (v) => JSON.parse(JSON.stringify(v));

const DEFAULTS = { drivers: clone(DRIVERS), tracks: clone(TRACKS), tyres: clone(TYRES) };

// The default compounds cannot be removed (the wet-weather ones are needed in the rain); users add dry compounds on top
export const BUILTIN_TYRE_IDS = Object.keys(DEFAULTS.tyres);
export const MAX_TYRES = 12;
const TYRE_KIND_ORDER = { slick: 0, inter: 1, wet: 2 };

function apply(data) {
    DRIVERS.splice(0, DRIVERS.length, ...data.drivers);
    TRACKS.splice(0, TRACKS.length, ...data.tracks);
    // Rebuild TYRES / TYRE_IDS in place: dry compounds first, then intermediate and wet, otherwise in the given order
    const entries = Object.entries(data.tyres).sort(([, a], [, b]) => TYRE_KIND_ORDER[a.kind] - TYRE_KIND_ORDER[b.kind]);
    for (const id of Object.keys(TYRES)) delete TYRES[id];
    for (const [id, t] of entries) TYRES[id] = t;
    TYRE_IDS.splice(0, TYRE_IDS.length, ...entries.map(([id]) => id));
}

const finite = (v) => typeof v === "number" && Number.isFinite(v);

function validTyres(tyres) {
    if (!tyres || typeof tyres !== "object") return false;
    const ids = Object.keys(tyres);
    return (
        ids.length <= MAX_TYRES &&
        BUILTIN_TYRE_IDS.every((id) => tyres[id]?.kind === DEFAULTS.tyres[id].kind) &&
        ids.every((id) => {
            const t = tyres[id];
            return (
                /^[a-z]$/.test(id) &&
                t.id === id &&
                Object.hasOwn(TYRE_KIND_ORDER, t.kind) &&
                typeof t.name === "string" &&
                typeof t.color === "string" &&
                finite(t.pace) &&
                finite(t.wear) &&
                t.wear > 0 &&
                finite(t.wetK)
            );
        })
    );
}

function isValid(data) {
    return (
        data &&
        Array.isArray(data.drivers) &&
        data.drivers.length >= 2 &&
        data.drivers.every((d) => typeof d.code === "string" && typeof d.name === "string" && typeof d.team === "string" && typeof d.color === "string" && finite(d.skill) && finite(d.carPerf)) &&
        new Set(data.drivers.map((d) => d.code)).size === data.drivers.length &&
        Array.isArray(data.tracks) &&
        data.tracks.length >= 1 &&
        data.tracks.every((t) => finite(t.id) && typeof t.location === "string" && finite(t.laps) && finite(t.optLapTime) && finite(t.ovtkMultiplier)) &&
        new Set(data.tracks.map((t) => t.id)).size === data.tracks.length &&
        validTyres(data.tyres)
    );
}

function persist() {
    try {
        if (isCustomized()) localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCustomization()));
        else localStorage.removeItem(STORAGE_KEY);
    } catch {
        // storage unavailable (private mode, quota): the customisation then only lasts for this session
    }
}

export function currentCustomization() {
    return clone({ drivers: DRIVERS, tracks: TRACKS, tyres: TYRES });
}

export function defaultCustomization() {
    return clone(DEFAULTS);
}

export function isCustomized(section) {
    const sections = section ? [section] : SECTIONS;
    const now = currentCustomization();
    return sections.some((s) => JSON.stringify(now[s]) !== JSON.stringify(DEFAULTS[s]));
}

// Replace the live data with `data` (the same shape as currentCustomization()) and save it
export function saveCustomization(data) {
    if (!isValid(data)) return false;
    apply(clone(data));
    persist();
    return true;
}

// Restore the defaults, either everything or a single section ("drivers" | "tracks" | "tyres")
export function resetCustomization(section) {
    const next = currentCustomization();
    for (const s of section ? [section] : SECTIONS) next[s] = clone(DEFAULTS[s]);
    apply(next);
    persist();
}

try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (isValid(saved)) apply(saved);
} catch {
    // ignore unreadable saved data and keep the defaults
}
