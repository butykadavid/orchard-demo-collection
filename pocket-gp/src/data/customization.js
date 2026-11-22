import { createStore } from "@orchardapp/sdk";
import { DRIVERS, TRACKS } from "./index.js";
import { DEFAULT_PIT_LANE, TYRE_IDS, TYRES } from "../engine/constants.js";

// User customisation (sandbox mode): the grid, the circuits and the tyre compounds can be edited and are
// saved in an Orchard store (the SDK falls back to localStorage when the app runs outside Orchard).
// DRIVERS, TRACKS and TYRES are shared module-level objects that the whole app imports, so edits are
// applied to them in place and the defaults are snapshotted at load time.
// Inside Orchard the saved data arrives asynchronously: `onCustomizationLoaded` tells the UI to refresh.

const LEGACY_STORAGE_KEY = "gp-manager-customization-v1"; // where earlier versions kept the data (localStorage only)
const store = createStore("pocketGpCustomization", { customization: null });
const loadedListeners = new Set();
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

// Saved data from before tracks had a pit lane length gets the default circuit's length (or a typical one)
function withPitLanes(data) {
    const tracks = data.tracks.map((t) => (finite(t.pitLane) ? t : { ...t, pitLane: DEFAULTS.tracks.find((d) => d.id === t.id)?.pitLane ?? DEFAULT_PIT_LANE }));
    return { ...data, tracks };
}

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
    store.set({ customization: isCustomized() ? currentCustomization() : null });
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
    if (!isValid(data) || !data.tracks.every((t) => finite(t.pitLane) && t.pitLane > 0)) return false;
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

// Called when saved data from the store replaces the live data after the UI has already rendered
export function onCustomizationLoaded(fn) {
    loadedListeners.add(fn);
    return () => loadedListeners.delete(fn);
}

function readLegacy() {
    try {
        const saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? "null");
        return isValid(saved) ? saved : null;
    } catch {
        return null;
    }
}

// Outside Orchard this runs synchronously on import (before the UI renders), inside it when the data arrives.
// Data saved by earlier versions in localStorage is moved into the store once. Unreadable data keeps the defaults.
store.subscribe((state) => {
    let saved = state?.customization;
    const legacy = !saved;
    if (legacy) saved = readLegacy();
    if (!isValid(saved)) return;
    const data = withPitLanes(saved);
    if (JSON.stringify(data) === JSON.stringify(currentCustomization())) return;
    apply(clone(data));
    if (legacy) {
        persist();
        try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
            // storage unavailable
        }
    }
    loadedListeners.forEach((fn) => fn());
});
