// Weather is generated once per race on the full-length timeline (legacy algorithm, one tick per lap of the
// full race at the circuit's reference lap time). It is bound to the race clock, not to laps: a tick lasts `lapS`
// seconds in a full race. Shorter races sample the same timeline faster, so a 25% race still sees the whole
// weather story compressed into less time. Whatever the cars are doing (racing, crawling behind a safety car,
// parked under a red flag), the weather keeps moving with the clock.
// All lookups below take the race clock in seconds.

import { RACE_FRACTIONS, RED_CANCEL_S } from "./constants.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function sample(arr, idx) {
    const i = clamp(idx, 0, arr.length - 1);
    const lo = Math.floor(i);
    const hi = Math.min(arr.length - 1, lo + 1);
    return arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
}

// Position on the weather timeline (in ticks) at race clock `t`
const tickAt = (weather, fraction, t) => Math.max(0, t) / (weather.lapS * fraction);

export function createWeather(rng, track) {
    // Spare ticks after the race: enough for a red flag that lasts until the race is cancelled, even in the shortest
    // race (where a tick is shortest), so the weather never freezes while the cars wait
    const spare = Math.ceil(RED_CANCEL_S / (track.optLapTime * Math.min(...RACE_FRACTIONS)));
    const n = track.laps + 14 + spare;
    const rain = new Array(n).fill(0);

    rain[0] = rng.int(0, 10) !== 9 ? 0 : rng.int(0, 100);
    let harder = rain[0] > 0 ? rng.int(0, 3) === 2 : rng.int(0, 10) === 9;

    for (let i = 1; i < n; i++) {
        if (harder) {
            rain[i] = rain[i - 1] + rng.int(1, 11);
            harder = rng.int(0, 15) !== 0;
        } else {
            rain[i] = rain[i - 1] + rng.int(-5, 0);
            harder = rng.int(0, 40) === 0;
        }
        rain[i] = clamp(rain[i], 0, 100);
    }

    // Water on track lags rain: average of the last 5 ticks
    const water = rain.map((_, i) => {
        let sum = 0;
        for (let j = i - 4; j <= i; j++) if (j >= 0) sum += rain[j];
        return Math.floor(sum / 5);
    });

    // Cumulative noise used to make the forecast less reliable the further ahead it looks
    const noise = new Array(n).fill(0);
    for (let i = 1; i < n; i++) noise[i] = noise[i - 1] - rng.int(-5, 6);

    return { rain, water, noise, lapS: track.optLapTime };
}

export function waterAt(weather, t, fraction) {
    return sample(weather.water, tickAt(weather, fraction, t));
}

export function rainAt(weather, t, fraction) {
    return sample(weather.rain, tickAt(weather, fraction, t));
}

// Track wetness expected at race clock `t`, seen from clock `nowS`: the past is known, the future uses the same noisy
// forecast the player sees (reliability falls off with distance). Used by the AI to plan around weather.
export function predictWater(weather, fraction, nowS, t) {
    const last = weather.rain.length - 1;
    const nowIdx = tickAt(weather, fraction, nowS);
    const nowTick = Math.min(last, Math.floor(nowIdx));
    const tickWater = (tick) => {
        let sum = 0;
        for (let j = tick - 4; j <= tick; j++) {
            if (j < 0) continue;
            const k = Math.min(last, j);
            const r = weather.rain[k];
            const known = j <= nowIdx || r < 5 || r > 94;
            sum += known ? r : clamp(r + weather.noise[k] - weather.noise[nowTick], 0, 100);
        }
        return Math.floor(sum / 5);
    };
    const i = clamp(tickAt(weather, fraction, t), 0, last);
    const lo = Math.floor(i);
    const hi = Math.min(last, lo + 1);
    const a = tickWater(lo);
    return a + (tickWater(hi) - a) * (i - lo);
}

// Forecast for `count` laps starting at the current lap, as it will be if the laps are run at the reference lap time
// from race clock `nowS` on (so it moves on while a red flag stops the race). Lap numbers are 1-based for display.
export function forecast(weather, fraction, nowS, fromLap, lapsTotal, count = 10) {
    const base = Math.floor(Math.max(0, fromLap));
    const nowIdx = tickAt(weather, fraction, nowS);
    const out = [];
    for (let k = 0; k < count; k++) {
        const lapIndex = base + k;
        if (lapIndex >= lapsTotal) break;
        const idx = tickAt(weather, fraction, nowS + k * weather.lapS);
        const rain = sample(weather.rain, idx);
        const value =
            rain < 5 || rain > 94
                ? rain
                : clamp(rain + (sample(weather.noise, idx) - sample(weather.noise, nowIdx)), 0, 100);
        out.push({ lap: lapIndex + 1, rain: Math.round(value) });
    }
    return out;
}
