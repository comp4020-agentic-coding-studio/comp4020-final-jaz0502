# Rules for working on the community garden

These come from `README.md`, which says what "good" means for this app. If a rule here and the README disagree, fix both in the same step.

## What this app must never do

- Never add scoring, points, rankings or any win or lose state. The garden is a shared, collaborative space.
- Never send a visitor's `gid` cookie to anyone. It is their whole identity. Clients only get the one-way `publicId(gid)`, and anything leaving the server goes through `toPublic()` in `src/routes.ts`. `spec/privacy.test.ts` enforces this.
- Never let one visitor overwrite or remove another's healthy plant. Planting only works on an empty plot, and composting only on a wilted one.
- Never put a gardener's figure on the plots. Figures walk only along the flagstone path round the bed.
- Never turn a gardener's record of what they have planted, watered and composted into a score. It stays a plain record, private to them: never shown to anyone else, never compared between gardeners, and never given goals, levels, streaks, badges, achievements or targets. Word it as a record ("Planted 12"), never as an achievement.

## What a change must not break

- Anyone can plant an empty plot and water any plot. Nobody owns a plot. `spec/plots.test.ts` enforces this.
- Watering resets the wilt clock, and a wilted plot cannot be watered or replanted until someone composts it.
- A plot's stage is derived from stored timestamps by `derivePlot` in `src/garden.ts`. Never use a per-plot timer, because Fly stops the machine when it is idle. The database only stores `empty` or `planted`.
- Live updates go over Server-Sent Events (`/events`). The page changes in response to those events, not to the POST response.
- A figure's position is only for show. Where a gardener's figure stands never limits what anyone can do to a plot, and no action may depend on it.
- Presence lives in memory only and is keyed by the public id, so two tabs from one browser are one gardener with one figure. A stranger's browser is a source of messages, so `POST /api/presence` stays validated, rate-limited and capped (`src/presence.ts`). `spec/presence.test.ts` enforces this.
- A wave is a hello and nothing more. It is never stored, counted, ranked or sent to anyone in particular, and `POST /api/wave` stays validated, rate-limited, and open only to someone with the event stream open (`src/presence.ts`). `spec/wave.test.ts` enforces this.
- A gardener's record lives in `gardener_stats`, keyed by the public id and never the cookie, and is sent only to that gardener's own streams as a `stats` event, never broadcast. Only a capped number of gardeners are counted. `spec/stats.test.ts` enforces this.
- The server says what each gardener does, one `key=value` line to stdout for each plant, water, compost and wave (and for each one refused, with a reason), and for each gardener joining or leaving, so `flyctl logs` shows who did what. Every line goes through `logEvent` in `src/log.ts`, which takes the public id and never the cookie. Figure moves are not logged, because they are many and say nothing. A new action gets a log line and a spec. `spec/logging.test.ts` enforces this.
- The course invariants keep passing: `/` returns 200 and `/readme/` publishes the README's headings.
- The app runs on one 256 MB Fly machine with one volume at `/data`. Do not change the fixed settings in `fly.toml`.

## How to work

- Work one step at a time. Show the result and wait for approval before the next step. Do not commit or push unless asked, and commit each step separately.
- Check anything visual in a real browser, not just with types and tests.
- Before a deploy, build the Docker image and run `pnpm check` against it, as CI does. CI deploys every push to `main`, so only deploy by hand if asked.
- When a rule changes, change the spec and the README in the same step. A claim in the README must match what a spec enforces or be listed as judged.
- Never move the `crit-8` tag again. It is frozen on `0d788b8`, because after a crit's cutoff its tag records what the tutor marked. Later crits get their own tags (`crit-9`, `crit-10`), made only when asked.
- In the process docs, say who did what. If the agent ran a check or a restart, say so, and do not invent sources or claim the author read or did something they did not.
