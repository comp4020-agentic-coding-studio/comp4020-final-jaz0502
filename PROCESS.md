# Process overview

## How I directed the agent, and how I got from the brief to the harness

I directed the agent by first creating a detailed list of the features I wanted to include, and the functionality for each of them. For example, not only the feature itself, but how it would be implemented and the interactivity with the user. I originally had another idea for this project: to create a shared art gallery space where people can add their own art. However, I decided to go with the shared garden idea instead because it was easier to implement collaborative features with the garden. For the art gallery, I thought about allowing people to edit each other's artworks, but this could lead to destruction as well. Hence, I decided to create something that is more collaborative.

I then had the agent turn the list of features into a step-by-step plan for the first prototype, and I reviewed and approved the plan before any code was written. The agent built it one milestone at a time. I asked to approve each step, and each commit, before it moved on, so the history is one commit per working step, such as live updates ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)), then persistence ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)).

I focused on creating a very simplistic and basic prototype first that only used 2D designs. I wanted to ensure the real-time interactivity and multi-user was working before improving the design and app. Only then did I ask for a 3D scene like the Forest app ([`e76269e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/e76269e)).

## The harness

The README's list of what can be checked became the specs in `spec/`. The plant, water and compost rules are tested in [`b950090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/b950090), and the rule that a visitor's cookie never reaches anyone else is tested in [`5b4819c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5b4819c). What can't be tested, like usability and whether changes reach other browsers within about a second, I judged by hand, as the README says. `CLAUDE.md` is still an empty stub. Writing down the rules I have been giving the agent, such as approving each step before it moves on, is still to do.

## Why this stack

The agent proposed the stack and I approved it. It is plain Node with no framework, because the app has only a handful of routes. For live updates I used Server-Sent Events instead of WebSockets. Every update goes from the server to the browsers, so SSE needs no extra dependency, and the browser is designed to reconnect on its own after a dropped connection, which should suit Fly stopping idle machines. The cost is that actions travel separately as POST requests ([`8a69c4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/8a69c4c)).

State lives in SQLite on the Fly volume. I used Node's built-in `node:sqlite` rather than `better-sqlite3`, so the Docker image has no native addon. The cost is that `node:sqlite` is still only a release candidate ([`51f617b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/51f617b)). TypeScript runs directly on Node 24 with no build step, and `tsc` only checks the types ([`716ad0c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/716ad0c)). Three.js is served from the repo rather than a CDN, so a live demo does not depend on a third party. To ensure the SSE choice worked, I watched two browsers stay in sync. I also had the agent restart the live Fly machine and confirm that the plants survived, which confirmed the SQLite choice.

## What I got wrong and corrected

**Water looked like it did nothing.** After planting, I clicked Water and nothing on screen changed. Watering only resets the wilt clock, and nothing showed that. I asked for visible feedback, and plots now show when they were last watered ([`7fb60e8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/7fb60e8)).

**The cookie was leaking.** While we were designing the care rings, the agent flagged that each visitor's whole identity, their cookie, was being sent to every other client, so anyone could copy it and act as someone else. I had that fixed before building on it: clients now only see a one-way public id ([`5b4819c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jaz0502/commit/5b4819c)). A spec fails if the cookie ever appears in another visitor's stream. I had the agent confirm the spec works by making the code leak on purpose and watching the test fail.

## Trade-offs I weighed

One trade-off I have made for now, is that I decided to exclude the feature that shows people walking around the gardens. My initial plan was to implement this feature as part of the initial prototype as well, but instead, decided to focus on getting the garden functionality working well before focusing on other areas. If I have capacity and the app has the capability and resources to do so, I still plan to implement this feature later to improve user interactivity with one another.
