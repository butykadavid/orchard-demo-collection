# GP Manager

A modern, minimalistic web port of the old C# console Grand Prix manager, built for **Orchard**. Phase 1 covers the core race weekend.

## Phase 1 Features
- 20 drivers and 20+ circuits imported from the original CSV data.
- Race length of 25%, 50%, 75% or 100% of the full distance. Tyre wear scales with the race length.
- One-click qualifying on the chosen starting tyre (normal or reversed grid).
- Continuous real-time race with pause and 1x / 2x / 4x / 8x / 16x speed.
- Broadcast-style circular track map with all cars, timing tower with gaps, tyre and stop info.
- Dynamic weather with a forecast. Tyre choices: Soft, Medium, Hard, Intermediate, Wet.
- AI drivers pick tyres and pit on their own. The player requests pit stops and chooses the next set.
- Spectator mode (no player car).

Shortcuts: `Space` pause/resume, `1`-`5` speed.

Not in Phase 1: car setup, fuel, ERS, championship, grid editor, persistence.

## Source Layout
- `src/engine/` - pure simulation (seeded RNG, pace, weather, AI, qualifying, race stepping). Fixed time step, independent of rendering.
- `src/hooks/useRaceLoop.js` - drives the simulation from `requestAnimationFrame` with the selected speed.
- `src/components/` - Setup, qualifying results, race screen and its panels.
- `src/data/` - driver and track CSVs from the legacy game.

## Development & Packaging for Orchard

```bash
npm install
npm run dev
npm run build
```

Zip the contents of `dist/` and upload it to Orchard.
