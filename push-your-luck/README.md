# Push Your Luck

A quick game of **Pig** against the computer, built for **Orchard** using `@orchardapp/sdk`.

## Game Rules
- Players take turns rolling a single die.
- Roll **2-6**: the value is added to your turn total, then roll again or hold.
- Roll **1**: you lose the turn total and the turn passes to the opponent.
- **Hold** to bank the turn total into your score.
- First to **100** wins.

## Computer Difficulty
- **Cautious**: holds at 15 points.
- **Normal**: holds at 20 points.
- **Reckless**: holds at 28 points.

Normal and Reckless also go all-in when the player is close to winning.

## Persisted Statistics (`pushYourLuckStats` namespace)
- Games played, wins, losses
- Current and best win streak
- Fewest turns needed for a win
- Biggest single banked turn
- Recent game history

## Development & Packaging for Orchard

```bash
npm install
npm run dev
npm run build
```

Upload the contents of the `dist/` folder as a `.zip` archive in the Orchard dashboard.
