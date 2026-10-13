# Process overview

## How I directed the agent, and how I got from the brief to the harness

I directed the agent by first writing a detailed list of the features I wanted, and how each should work: not only the feature itself, but how it would be implemented and how a user would interact with it. I originally had another idea for this project, a shared art gallery where people add their own art. I chose the shared garden because it was easier to make collaborative. In a gallery, people editing each other's artworks could destroy them, whereas in the garden anyone can help but nobody can overwrite someone else's healthy plant.

I then had the agent turn the list into a step-by-step plan for the first prototype, and I reviewed and approved the plan before any code was written. The agent built it one milestone at a time. I asked to approve each step, and each commit, before it moved on, so the history is one commit per working step, such as live updates ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)), then persistence ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)).

I built a very simple 2D prototype first, so that real-time and multi-user behaviour worked before I improved how the app looked. Only then did I ask for a 3D scene like the Forest app ([`e76269e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/e76269e)).

**How I directed crit 9.** In the crit 8 version you could watch plants change but not tell whether anyone else was there. Once I had decided how to show who is online, I wrote out the features and the controls for them. I chose mouse control rather than the keyboard so that it is more accessible on different devices. The agent offered ideas and built each step, and I made the calls that shaped the result:

- Figures walk only on the path round the bed, never on the plots: "I dont want them to talk on the garden beds - i only want them to walk around the garden beds." ([`c7d5e8c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/c7d5e8c))
- What people do shows up where it happens, as a small icon over the plot, like the water drops, rather than over a figure's head ([`03e0b93`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/03e0b93)).
- A separate panel for the gardener, with a private record of what they have planted, watered and composted, and the Wave button moved into it ([`445666e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/445666e)). The agent pointed out that a count of your own actions sits close to my "no scoring" rule, so the guardrails went into `CLAUDE.md` first.
- A short "Recent" list of what people have just done, which I picked from the agent's list of improvements and placed between the other two panels ([`5cef7b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5cef7b0)).

## The harness

The README's list of what can be checked became the specs in `spec/`. The plant, water and compost rules are tested in [`b950090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/b950090), and the rule that a visitor's cookie never reaches anyone else is tested in [`5b4819c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5b4819c).

`CLAUDE.md` holds the rules I hold the agent to ([`64cbb6e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/64cbb6e)). Since crit 8 each new rule has been written in the same step as the feature it protects: figures stay off the plots and their position limits nothing ([`917c852`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/917c852)), a gardener's record stays private and is never compared, and waves are never stored or counted ([`6c6509e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/6c6509e)), and the Recent list stays a short glance with no counts ([`6987ec7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/6987ec7)).

Each new server rule has a spec, and the agent checked each one by breaking the rule on purpose and confirming the spec failed before restoring it. What can't be tested, like usability and whether changes reach other browsers within about a second, I judged by hand, as the README says.

## How I grounded the work

I based the crit 9 decisions on what my README says "good" means: many people online at once, a shared garden where nobody owns a plot, and no scoring, ranking or win or lose state. That is why figures stay off the plots, why a gardener's record is private and never compared with anyone else's, and why the Recent list has no counts or totals. I wrote each of those limits into `CLAUDE.md` in the same step as the feature, so a later change cannot quietly break them.

For each new feature I checked the result in more than one way:

- **Specs.** Each new server rule has a spec in `spec/`: presence is validated, rate-limited and capped, waves are never stored, a gardener's record goes only to them, and the Recent list never carries the cookie.
- **Breaking the rule on purpose.** The agent checked each spec by making the code break the rule and confirming the spec failed before restoring it. One of these first gave a false pass because of a bad edit, and the agent redid it correctly.
- **Real browsers.** The agent drove two separate visitors in a real browser to check that one person's actions appear for the other without a reload, and I looked at every visual change in my own browser before approving it.

## Why this stack

The agent proposed the stack and I approved it. It is plain Node with no framework, because the app has only a handful of routes. For live updates I used Server-Sent Events instead of WebSockets. Every update goes from the server to the browsers, so SSE needs no extra dependency, and the browser is designed to reconnect on its own after a dropped connection, which should suit Fly stopping idle machines. The cost is that actions travel separately as POST requests ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)).

State lives in SQLite on the Fly volume. I used Node's built-in `node:sqlite` rather than `better-sqlite3`, so the Docker image has no native addon. The cost is that `node:sqlite` is still only a release candidate ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)). TypeScript runs directly on Node 24 with no build step, and `tsc` only checks the types ([`716ad0c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/716ad0c)). Three.js is served from the repo rather than a CDN, so a live demo does not depend on a third party. To ensure the SSE choice worked, I watched two browsers stay in sync. I also had the agent restart the live Fly machine and confirm that the plants survived, which confirmed the SQLite choice.

For crit 9, who is in the garden is kept in memory only, because a stopped Fly machine has nobody on it. A gardener's own record is stored in a new SQLite table instead, so it is still there when they come back ([`1868cda`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/1868cda)).

## What I got wrong and corrected

**Water looked like it did nothing.** After planting, I clicked Water and nothing on screen changed. Watering only resets the wilt clock, and nothing showed that. I asked for visible feedback, and plots now show when they were last watered ([`7fb60e8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/7fb60e8)).

**The cookie was leaking.** While we were designing the care rings, the agent flagged that each visitor's whole identity, their cookie, was being sent to every other client, so anyone could copy it and act as someone else. I had that fixed before building on it: clients now only see a one-way public id ([`5b4819c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5b4819c)). A spec fails if the cookie ever appears in another visitor's stream. I had the agent confirm the spec works by making the code leak on purpose and watching the test fail.

**The panels did not fit a laptop screen.** With the new Recent panel, the three panels ran off the bottom of a laptop window and had to be scrolled. I asked for them to fit without scrolling and suggested showing fewer entries in Recent. The list now shows four, and the long help text sits behind a "How it works" line ([`5cef7b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5cef7b0)).

## Trade-offs I weighed

The decision I wrote down for this crit is how people see who is here: figures on a path, a who's-here list and a short recent list, rather than a bare count or only the colour rings. The options, the costs and how it is checked are in [`docs/decisions/0001-show-who-is-here.md`](docs/decisions/0001-show-who-is-here.md), committed in [`146725c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/146725c).
