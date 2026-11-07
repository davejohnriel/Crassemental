# 🌱 Grass Cutter

A small incremental ("idle") game about cutting grass. Click the lawn, buy mowers,
stack upgrades, catch golden grass, then reseed the lawn for permanent fertilizer bonuses.

Three files, zero dependencies, no build step: `index.html`, `style.css`, `game.js`.

## Play it locally

Double-click `index.html`. That's it — it runs straight from your file system.

## Put it on GitHub Pages

1. On GitHub, click **New repository**. Name it something like `grass-cutter` and create it (public is easiest for Pages).
2. Upload `index.html`, `style.css` and `game.js` to the **top level** of the repository
   ("Add file → Upload files", then **Commit changes**).
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
5. Choose branch **main** and folder **/ (root)**, then click **Save**.
6. Wait a minute or two. The live link appears at the top of that Pages screen:
   `https://your-username.github.io/grass-cutter/`

Any time you edit a file and commit, the site rebuilds itself automatically. No action needed.

> Keep the three files in the same folder — `index.html` loads `style.css` and `game.js` by relative path, so it works at any URL, including a repository subpath.

## How the game works

- **Cut grass** by clicking the lawn (or pressing Space). Grass is the only currency.
- **Cutters** produce grass per second. Each one you buy costs 15% more than the last.
- **Upgrades** are one-time purchases: flat cut power, "cuts also earn a % of your grass/sec",
  and milestone bonuses at 10 / 25 / 50 / 100 of a cutter that double or triple its output.
- **Golden grass** occasionally appears on the lawn. Catch it for a temporary production multiplier.
- **Reseed** (prestige) resets the run in exchange for fertilizer: +2% permanent production each,
  plus six permanent upgrades bought with fertilizer. Achievements also give +1% each, forever.
- **Offline progress**: close the tab and your cutters keep working at 50% speed (upgradeable).
- **Saving** is automatic in the browser's local storage. Use Stats → Export for a backup code.

## Tweaking the balance

Everything lives in plain data at the top of `game.js`:

- `GENS` — cutter names, base costs and grass per second.
- `GEN_GROWTH` — the 1.15 cost multiplier per purchase (lower = easier).
- `MILESTONES` — ownership thresholds, prices and multiplier sizes.
- `PRESTIGE_UPGRADES` — the fertilizer shop.
- `prestigeGain()` — the reset formula, currently `⌊√(run grass ÷ 250K)⌋`.

Change a number, commit, refresh. Your save keeps working as long as you don't rename saved fields.
