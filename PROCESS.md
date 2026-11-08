# Process overview

## How I directed the agent, and how I got from the brief to the harness

I directed the agent by first writing a detailed list of the features I wanted. I first thought of a shared art gallery, but in a gallery people could destroy each other's artworks, whereas in a garden anyone can help but nobody can overwrite someone else's healthy plant.

I had the agent turn the list into a step-by-step plan for the first prototype, and I reviewed and approved the plan before any code was written. The agent built it one milestone at a time, and I approved each step before it moved on, so the history has one commit per working step, such as live updates ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)) and then persistence ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)).

I kept the first prototype to one shared bed anyone could plant, water and compost, then added larger features one at a time: themed beds, where I chose what each bed holds ([`76ad736`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/76ad736), [`e82676e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/e82676e), [`321cb8a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/321cb8a), [`411730c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/411730c)), a private garden grown from gathered seeds ([`3c005e9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/3c005e9)), and a barn and cottage you can walk into ([`2327afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/2327afe), [`67e4f46`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/67e4f46)).

In the garden I chose mouse and touch control over the keyboard so it works on more devices. The calls that shaped the result were mine:

- Figures walk only on the paths round the beds, never on the plots ([`c7d5e8c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/c7d5e8c)).
- A separate panel for the gardener, with a private record of what they have planted, watered and composted ([`445666e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/445666e)). The agent pointed out that this sits close to my "no scoring" rule, so the guardrails went into `CLAUDE.md` first.
- A short "Recent" list of what people have just done ([`5cef7b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5cef7b0)).
- Four themed beds instead of one bigger bed, so more people can be online at once without competing for plots ([`c1bac9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/c1bac9a)).

## The harness

The README's list of what can be checked became the specs in `spec/`. The plant, water and compost rules are tested in [`b950090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/b950090).

`CLAUDE.md` holds the rules I hold the agent to ([`64cbb6e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/64cbb6e)), and each new rule is written in the same step as the feature it protects: figures stay off the plots and their position limits nothing ([`917c852`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/917c852)), a gardener's record stays private ([`6c6509e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/6c6509e)), and the Recent list stays a short glance with no counts ([`6987ec7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/6987ec7)).

The server decides what each person may change: planting only on an empty plot, composting only on a wilted one, only a bed's own plants in that bed, and at most 15 actions in 10 seconds ([`76ad736`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/76ad736), [`048d57b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/048d57b)). The reasons are in [`docs/decisions/0002-access-control.md`](docs/decisions/0002-access-control.md). Every action, refusal, join and leave is logged with the public id and never the cookie ([`277b47a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/277b47a)).

## How I grounded the work

I based my decisions on what my README says "good" means: many people online at once, a shared garden where nobody owns a plot, and no scoring, ranking or win or lose state. That is why a gardener's record is private and never compared with anyone else's, and why the Recent list has no counts or totals.

The rewards I did add were the hardest call against "no scoring". I wanted a reason to keep caring, so looking after the garden unlocks decorations for your own garden and then a pet. To stop them becoming a score, they are private, never compared, unlocked by one fixed order of tasks that is the same for everyone, and never taken back ([`docs/decisions/0003-private-rewards.md`](docs/decisions/0003-private-rewards.md), [`2a6e0f7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/2a6e0f7), [`2327afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/2327afe)).

I checked each new feature in more than one way:

- **Specs.** Each new server rule has a spec in `spec/`.
- **Breaking the rule on purpose.** The agent made the code break a rule, confirmed the spec failed, then restored it.
- **Real browsers.** The agent drove two separate visitors in a real browser to check that one person's actions appear for the other without a reload, and I looked at every visual change in my own browser before approving it. Before pushing, the agent ran `pnpm check` against the Docker image.

I judged usability by hand, which is how I found buttons that were hard to notice.

## Why this stack

The agent proposed the stack and I approved it. It is plain Node with no framework, since the app has only a handful of routes. For live updates I used Server-Sent Events instead of WebSockets. Every update goes from server to browsers, so SSE needs no dependency, and the browser reconnects by itself, which suits Fly stopping idle machines. The cost is that actions travel separately as POST requests ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)).

State lives in SQLite on the Fly volume. I used Node's built-in `node:sqlite` rather than `better-sqlite3`, so the Docker image has no native addon. The cost is that `node:sqlite` is still only a release candidate ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)). TypeScript runs directly on Node 24 with no build step ([`716ad0c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/716ad0c)). Three.js is served from the repo, not a CDN, so a live demo does not depend on a third party.

## What I got wrong and corrected

**Watering looked like it did nothing.** Clicking Water changed nothing on screen, because it only resets the wilt clock. I asked for visible feedback, and plots now show when they were last watered ([`7fb60e8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/7fb60e8)).

**The cookie was leaking.** The agent flagged that each visitor's cookie, their whole identity, was being sent to every other client, so anyone could copy it and act as someone else. I had it fixed before building on it: clients now only see a one-way public id ([`5b4819c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5b4819c)). A spec fails if the cookie ever appears in another visitor's stream, and the agent confirmed it by making the code leak on purpose.

**Waterings that didn't count looked like a bug.** My record said "Watered 34", but the journal still said "water 5 more plants" to unlock the next decoration. A watering only counts on a plot nobody has watered in the last ten minutes, so most of mine had silently not counted. Rather than loosen the rule, I had the page show a short note when a watering didn't count. The rule went into `CLAUDE.md`, and two specs check that only the person who watered is told ([`4dcafd8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/4dcafd8)).

**A few people could take over a bed.** During the final crit, some of my group filled whole beds, even though actions were already rate-limited. That limit stopped floods, not hoarding. I set a stricter planting limit: at most 8 plantings an hour, and no more than 5 of them in one bed ([`2a6e0f7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/2a6e0f7), enforced by `spec/plant-limit.test.ts`).
