# Player Tracker

A two-page game-night earnings tracker using plain HTML, CSS, JavaScript, Node.js and JSON. No installation or npm dependencies are needed. Use Node.js 22 or newer.

```sh
node server.js
```

Open http://localhost:3000. The dashboard shows standings and expandable game history. On **Log Game**, enter a date and base buy-in (the title is optional), add players by name, and enter their buy-in counts and final chips. Names are matched without regard to capitalization. New players are persisted together with the game when you save.

Money is calculated from the total pool divided by final chips. Buy-ins accept half increments; zero final chips is valid for an individual player, but the combined chip count must be positive. Calculations retain full floating-point precision and displayed money rounds to at most two decimals. Results within half a paisa of zero count as break-even.

## Files and data

- `index.html` / `dashboard.js`: standings and game history, derived from saved results.
- `game.html` / `game.js`: game entry and live calculations.
- `styles.css`: shared responsive dark theme.
- `shared.js`: calculations, formatting, player matching and API helpers, also used by the server.
- `server.js`: built-in HTTP server, validation and atomic JSON writes.
- `data.json`: players and games. No leaderboard statistics are stored on players.

The server preserves a copy of the original data as `data.json.bak` before its first write. Subsequent saves atomically replace `data.json`. Older games using `results[].amount` remain supported; unavailable buy-in/chip details show a dash. Capitalization duplicates are consolidated by ID when reading, and historical results remain included. Malformed data returns an actionable error and blocks writes; a missing file starts an empty tracker. Keep your own periodic backups if you need recovery beyond the first-write snapshot.

The API saves individual games rather than replacing the entire dataset. The server calculates money itself and resolves player IDs at save time. Run one server process per data file. This is an unauthenticated app intended for a trusted local environment.

## Verification

```sh
node --test tests/tracker.test.js
```

Tests use an isolated temporary JSON file and a temporary localhost port. They cover page/asset responses, calculations, validation, saving, player reuse, persistence, deletion, legacy data, missing files and malformed-file protection.

Optional environment variables: `PORT` (defaults to 3000) and `DATA_FILE` (defaults to this directory’s `data.json`).

“Biggest win (% of buy-in)” is the highest profit divided by that player’s total investment (base buy-in × number of buy-ins), multiplied by 100. It is derived from saved games and recalculates after deletion. Legacy games without investment details are excluded; a dash means no investment details are available.
