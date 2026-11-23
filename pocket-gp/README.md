# Pocket GP

A modern, minimalistic web port of the old C# console Grand Prix manager, built for **Orchard**. Phase 1 covers the core race weekend.

## Phase 1 Features
- 20 fantasy drivers in 10 teams and 45 fantasy circuits, defined in CSV data (team colours live in the grid file).
- Race length of 25%, 50%, 75% or 100% of the full distance. Tyre wear scales with the race length.
- One-click qualifying on the chosen starting tyre, set separately for each driver of your team (normal or reversed grid).
- Reverse grid weekends: the slowest qualifier starts on pole, but the qualifying scores points (12-10-8-7-6-5-4-3-2-1 for the quickest laps) and the race scores the current F1 points (25-18-15-12-10-8-6-4-2-1, none for a retirement or disqualification). The most points over the weekend wins, the better race result settles a tie; the results screen opens on the Weekend tab. The bots know this: they choose their traits for the traffic they expect (a quick car that starts at the back favours passing traits and takes more risk), weigh a fast qualifying lap against the grid place it costs by the points it is expected to bring, play a bolder strategy when they are behind in the weekend points, and value a place in an undercut or cover stop by the race points it is worth. In every weekend the bots are also slightly risk-taking when they choose traits (a drawback counts a little lighter than it is).
- Continuous real-time race with pause and 1x / 2x / 4x / 8x / 16x speed.
- Broadcast-style circular track map with all cars, timing tower with gaps, tyre and stop info.
- Dynamic weather with a forecast, running on the race clock. Tyre choices: Soft, Medium, Hard, Intermediate, Wet.
- AI drivers pick tyres and pit on their own. You manage a whole team (all of its drivers at once): each car has its own pit stop request and next tyre set.
- Spectator mode (no team to manage).
- Tyre rule: every car has to use at least two different compounds during the race or it is disqualified at the flag (intermediate or wet tyres exempt a car). AI drivers plan around it.
- Race control: incidents can bring out the safety car, a virtual safety car or a red flag (also for heavy rain). Nobody can overtake under a safety car. The whole field slows down and the leader slows down further to collect it by the next line, so there is time to pit before it is closed up. Stops through the pits cost less while it lasts (not when it is about to come in) and the AI reacts to that. After a red flag everybody gets a free set of tyres (you pick yours) and the race restarts from a standing start with the lap counter carrying on, once the track is fit for racing. If that does not happen within 30 minutes the race is cancelled and the order at the red flag is the result.
- Cars and traits: every team has a car of six parts (front wing, rear wing, brakes, suspension, powertrain, chassis), each rated 0-1000 for performance and reliability (0.01 s per performance point, weighted by what the circuit asks of each part; weak reliability means breakdowns). A part unlocks three traits at 250 / 500 / 750 performance; a team runs up to three per race, at most one per part. Circuits strongly favour some parts over others (a part can weigh 5% on one track and 35% on another). No trait is a flat lap-time change: each one pays off under a condition (clean air, worn tyres, rain, a DRS zone, qualifying) or trades against a clear drawback (more driver errors, more part failures, tyre wear, weaker passing, poor wet grip...). A trait's benefits scale with how much its part matters at the circuit, so pick the traits that suit the circuit and the forecast (the bots do the same). Traits are data: a list of effects (lap time, tyre grip, tyre wear, passes made, passes suffered, contact damage, qualifying lap, driver errors, part failures), each with conditions (air, track wetness, tyre life, race distance, running position, first lap and restarts, tyre type, circuit characteristics, straights or corners for passing). The default roster lives in `src/engine/traits.js`; the Traits tab of Customize edits it.
- Trait analysis: the results have a Traits tab listing the moments in which a trait visibly changed the race (extra or lost passes, held-off attackers, a driver error or breakdown the car was more prone to, damage avoided), good and bad alike, plus a table of each trait's overall effect. Traits that just make the car a little quicker only appear there as seconds gained over the race.
- Customize tab: edit the grid (drivers, teams, colours, skill), the cars (parts), the circuits (laps, lap time, overtaking difficulty), the tyre compounds (including adding your own dry compounds) and the traits (add, edit or remove traits per part and tier: name, tier, advantages, disadvantages and their conditions) for a sandbox experience. Each trait has a test bench (`src/engine/traitBench.js`): a mid-grid team runs full weekends with and without the trait on the chosen circuits, sharing circuit, weather and seed, and the gain in grid and finishing positions (with its 95% margin) shows whether the trait is balanced. Changes are saved through the Orchard SDK (in the browser's localStorage when running outside Orchard) and can be reset to the defaults per tab or all at once.

Shortcuts: `Space` pause/resume, `1`-`5` speed.

Not in Phase 1: part upgrades, fuel, ERS, championship, saving race results.

## Source Layout
- `src/engine/` - pure simulation (seeded RNG, pace, weather, AI, qualifying, race stepping). Fixed time step, independent of rendering.
- `src/hooks/useRaceLoop.js` - drives the simulation from `requestAnimationFrame` with the selected speed.
- `src/components/` - Setup, qualifying results, race screen and its panels.
- `src/data/` - driver/team and track CSVs.

## Development & Packaging for Orchard

```bash
npm install
npm run dev
npm run build
```

Zip the contents of `dist/` and upload it to Orchard.
