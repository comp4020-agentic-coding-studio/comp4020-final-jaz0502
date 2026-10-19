# Process overview

## How I directed the agent, and how I got from the brief to the harness

I directed the agent by first writing a detailed list of the features I wanted, and how each should work: not only the feature itself, but how a user would interact with it. I first thought of a shared art gallery, but chose the shared garden because it was easier to make collaborative. In a gallery, people editing each other's artworks could destroy them, whereas in the garden anyone can help but nobody can overwrite someone else's healthy plant.

I then had the agent turn the list into a step-by-step plan for the first prototype, and I reviewed and approved the plan before any code was written. The agent built it one milestone at a time, and I approved each step and commit before it moved on, so the history is one commit per working step, such as live updates ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)), then persistence ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)).

Once I had decided how to show who is online via the figures, I wrote out the features and the controls for them. I chose mouse control rather than the keyboard so that it is more accessible on different devices. The calls that shaped the result were mine:

- Figures walk only on the paths round the beds, never on the plots: "I dont want them to talk on the garden beds - i only want them to walk around the garden beds." ([`c7d5e8c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/c7d5e8c))
- A separate panel for the gardener, with a private record of what they have planted, watered and composted, and the Wave button moved into it ([`445666e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/445666e)). The agent pointed out that a count of your own actions sits close to my "no scoring" rule, so the guardrails went into `CLAUDE.md` first.
- A short "Recent" list of what people have just done, which I picked from the agent's list of improvements ([`5cef7b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5cef7b0)).
- Four themed beds instead of one bigger bed, so more people can be online at once without competing for plots ([`c1bac9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/c1bac9a)). I refined each bed one at a time and looked at it in my browser before approving its commit.

## The harness

The README's list of what can be checked became the specs in `spec/`. The plant, water and compost rules are tested in [`b950090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/b950090).

`CLAUDE.md` holds the rules I hold the agent to ([`64cbb6e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/64cbb6e)), and each new rule is written in the same step as the feature it protects: figures stay off the plots and their position limits nothing ([`917c852`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/917c852)), a gardener's record stays private and is never compared ([`6c6509e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/6c6509e)), and the Recent list stays a short glance with no counts ([`6987ec7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/6987ec7)).

The server decides what each person may change: planting only on an empty plot, composting only on a wilted one, only a bed's own plants in that bed, and at most 15 actions in 10 seconds ([`76ad736`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/76ad736), [`048d57b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/048d57b)). The reasons are in [`docs/decisions/0002-access-control.md`](docs/decisions/0002-access-control.md). Every action, refusal, join and leave is logged with the public id and never the cookie ([`277b47a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/277b47a)), so `flyctl logs` shows who did what.

## How I grounded the work

I based my decisions on what my README says "good" means: many people online at once, a shared garden where nobody owns a plot, and no scoring, ranking or win or lose state. That is why figures stay off the plots, why a gardener's record is private and never compared with anyone else's, and why the Recent list has no counts or totals.

For each new feature I checked the result in more than one way:

- **Specs.** Each new server rule has a spec in `spec/`.
- **Breaking the rule on purpose.** The agent checked each spec by making the code break the rule and confirming the spec failed before restoring it.
- **Real browsers.** The agent drove two separate visitors in a real browser to check that one person's actions appear for the other without a reload, and I looked at every visual change in my own browser before approving it. Before I pushed, the agent also built the Docker image and ran `pnpm check` against it.

I judged what can't be tested, like usability, by hand.

## Why this stack

The agent proposed the stack and I approved it. It is plain Node with no framework, because the app has only a handful of routes. For live updates I used Server-Sent Events instead of WebSockets. Every update goes from the server to the browsers, so SSE needs no extra dependency and the browser is designed to reconnect on its own after a dropped connection, which suits Fly stopping idle machines. The cost is that actions travel separately as POST requests ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)).

State lives in SQLite on the Fly volume. I used Node's built-in `node:sqlite` rather than `better-sqlite3`, so the Docker image has no native addon. The cost is that `node:sqlite` is still only a release candidate ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)). TypeScript runs directly on Node 24 with no build step ([`716ad0c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/716ad0c)). Three.js is served from the repo, not a CDN, so a live demo does not depend on a third party. I watched two browsers stay in sync, and had the agent restart the live Fly machine and confirm that the plants survived.

Who is in the garden is kept in memory only, because a stopped Fly machine has nobody on it. A gardener's own record is stored in a new SQLite table instead, so it is still there when they come back ([`1868cda`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/1868cda)).

## What I got wrong and corrected

**Water looked like it did nothing.** After planting, I clicked Water and nothing on screen changed, because watering only resets the wilt clock. I asked for visible feedback, and plots now show when they were last watered ([`7fb60e8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/7fb60e8)).

**The cookie was leaking.** The agent flagged that each visitor's whole identity, their cookie, was being sent to every other client, so anyone could copy it and act as someone else. I had that fixed before building on it: clients now only see a one-way public id ([`5b4819c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5b4819c)). A spec fails if the cookie ever appears in another visitor's stream. I had the agent confirm the spec works by making the code leak on purpose and watching the test fail.

**Moving between the beds was clunky.** Navigation was a list in the left panel, so it was unclear where you were going. I added buttons that hover above each bed, which show which garden you will go to ([`ffb7d8f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/ffb7d8f)).
