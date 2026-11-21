// Small seeded PRNG (mulberry32) so races are reproducible and testable.
export function createRng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        // integer in [min, maxExclusive)
        int: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
        // float in [min, max)
        range: (min, max) => min + next() * (max - min),
    };
}
