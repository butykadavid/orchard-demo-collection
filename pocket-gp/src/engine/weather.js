// Weather is generated once per race on the full-length timeline (legacy algorithm, one value per lap
// of the full race). Shorter races sample the same timeline faster, so a 25% race still sees the
// whole weather story compressed into fewer laps.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function sample(arr, idx) {
    const i = clamp(idx, 0, arr.length - 1);
    const lo = Math.floor(i);
    const hi = Math.min(arr.length - 1, lo + 1);
    return arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
}

export function createWeather(rng, track) {
    const n = track.laps + 14;
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

    // Water on track lags rain: average of the last 5 laps
    const water = rain.map((_, i) => {
        let sum = 0;
        for (let j = i - 4; j <= i; j++) if (j >= 0) sum += rain[j];
        return Math.floor(sum / 5);
    });

    // Cumulative noise used to make the forecast less reliable the further ahead it looks
    const noise = new Array(n).fill(0);
    for (let i = 1; i < n; i++) noise[i] = noise[i - 1] - rng.int(-5, 6);

    return { rain, water, noise };
}

export function waterAt(weather, lap, fraction) {
    return sample(weather.water, lap / fraction);
}

export function rainAt(weather, lap, fraction) {
    return sample(weather.rain, lap / fraction);
}

// Track wetness expected at `lap`, seen from `nowLap`: the past is known, the future uses the same noisy
// forecast the player sees (reliability falls off with distance). Used by the AI to plan around weather.
export function predictWater(weather, fraction, nowLap, lap) {
    const last = weather.rain.length - 1;
    const nowIdx = Math.max(0, nowLap) / fraction;
    const nowTick = Math.min(last, Math.floor(nowIdx));
    const tickWater = (t) => {
        let sum = 0;
        for (let j = t - 4; j <= t; j++) {
            if (j < 0) continue;
            const k = Math.min(last, j);
            const r = weather.rain[k];
            const known = j <= nowIdx || r < 5 || r > 94;
            sum += known ? r : clamp(r + weather.noise[k] - weather.noise[nowTick], 0, 100);
        }
        return Math.floor(sum / 5);
    };
    const i = clamp(Math.max(0, lap) / fraction, 0, last);
    const lo = Math.floor(i);
    const hi = Math.min(last, lo + 1);
    const a = tickWater(lo);
    return a + (tickWater(hi) - a) * (i - lo);
}

// Forecast for `count` laps starting at the current lap. Lap numbers are 1-based for display.
export function forecast(weather, fraction, fromLap, lapsTotal, count = 10) {
    const base = Math.floor(Math.max(0, fromLap));
    const nowIdx = Math.max(0, fromLap) / fraction;
    const out = [];
    for (let k = 0; k < count; k++) {
        const lapIndex = base + k;
        if (lapIndex >= lapsTotal) break;
        const idx = lapIndex / fraction;
        const rain = sample(weather.rain, idx);
        const value =
            rain < 5 || rain > 94
                ? rain
                : clamp(rain + (sample(weather.noise, idx) - sample(weather.noise, nowIdx)), 0, 100);
        out.push({ lap: lapIndex + 1, rain: Math.round(value) });
    }
    return out;
}
