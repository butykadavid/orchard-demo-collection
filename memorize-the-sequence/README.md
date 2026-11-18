# Memorize the Sequence

A classic sequence memory game built for **Orchard** using `@orchardapp/sdk`.

## Game Rules
- **Initial State**: Starts on Round 1 with **2 colored tiles**.
- **Sequence Length**: Every round, tiles randomly light up as many times as the current round number (Round 1 = 1 flash, Round 2 = 2 flashes, etc.).
- **Difficulty Scaling**: Every **5 rounds**, a brand new colored tile is added to the board (Round 5 = 3 tiles, Round 10 = 4 tiles, Round 15 = 5 tiles, etc.).

## Persisted Statistics (`memorizeSequenceStats` namespace)
All statistics are automatically saved to Orchard's database via `@orchardapp/sdk`:
- **All-Time High Score** (most rounds cleared)
- **Average Rounds** (all-time)
- **High Score (Last 2 Weeks)**
- **Average Rounds (Last 2 Weeks)**
- **Tries Overall** (total games played + recent run history)

## Development & Packaging for Orchard

```bash
npm install
npm run dev
npm run build
```

Upload the contents of the `dist/` folder as a `.zip` archive in the Orchard dashboard.
