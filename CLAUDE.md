# Rules for working on the community garden

These come from `README.md`, which says what "good" means for this app. If a rule here and the README disagree, fix both in the same step.

## What this app must never do

- Never add scoring, points, rankings or any win or lose state. The garden is a shared, collaborative space.
- Never send a visitor's `gid` cookie to anyone. It is their whole identity. Clients only get the one-way `publicId(gid)`, and anything leaving the server goes through `toPublic()` in `src/routes.ts`. `spec/privacy.test.ts` enforces this.
- Never let one visitor overwrite or remove another's healthy plant. Planting only works on an empty plot, and composting only on a wilted one.

## What a change must not break

- Anyone can plant an empty plot and water any plot. Nobody owns a plot. `spec/plots.test.ts` enforces this.
- Watering resets the wilt clock, and a wilted plot cannot be watered or replanted until someone composts it.
- A plot's stage is derived from stored timestamps by `derivePlot` in `src/garden.ts`. Never use a per-plot timer, because Fly stops the machine when it is idle. The database only stores `empty` or `planted`.
- Live updates go over Server-Sent Events (`/events`). The page changes in response to those events, not to the POST response.
- The course invariants keep passing: `/` returns 200 and `/readme/` publishes the README's headings.
- The app runs on one 256 MB Fly machine with one volume at `/data`. Do not change the fixed settings in `fly.toml`.

## How to work

- Work one step at a time. Show the result and wait for approval before the next step. Do not commit or push unless asked, and commit each step separately.
- Check anything visual in a real browser, not just with types and tests.
- Before a deploy, build the Docker image and run `pnpm check` against it, as CI does. CI deploys every push to `main`, so only deploy by hand if asked.
- When a rule changes, change the spec and the README in the same step. A claim in the README must match what a spec enforces or be listed as judged.
- In the process docs, say who did what. If the agent ran a check or a restart, say so, and do not invent sources or claim the author read or did something they did not.
