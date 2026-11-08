# 0003: Rewards that stay private, earned by different kinds of care

## Context

The README says "good" means many people in one shared garden, with no scoring: nothing to win, rank or compare. I wanted some small reward for looking after the garden, but a visible tally would turn caring into a contest. The first version was a decoration for your own garden for every 10 waterings. When I tried it, I found two problems: watering ten plants over and over is repetitive, and it rewards one chore only, so the cows, hens and seeds I had added counted for nothing. The agent built each version, and I judged them by playing them.

## Decision

Looking after the shared garden unlocks things for **your own garden**, which only you can see.

- **Eight decorations in one fixed list** (a bench, a picket fence, a lantern, a scarecrow, a rustic fence, a gnome, a birdbath and a stone wall). Each has one task, the same for everyone and in the same order: water 5 plants, feed 3 cows, pat 4 hens, plant 5 seeds, gather 3 seeds, water 8 plants, feed 5 cows, pat 6 hens. Only the task you are on counts, and finishing it unlocks the next decoration and starts the next task. Nobody chooses an order to chase.
- **A pet after the last decoration** (a cat, dog or rabbit), with a name you give it. It is for your own garden and your cottage only. You can stroke it and feed it.
- **What counts is limited so one thing cannot be repeated.** A watering counts only on a plot nobody has watered in the last 10 minutes. A cow or hen counts again for the same gardener only after a minute. Watering in your own garden never counts.
- **The server decides.** What you have unlocked is kept by public id, never the cookie, and sent only to your own streams as a `decorations` and a `pet` event. They are never broadcast, never put in Recent, and never taken back, even when plants wilt. A request for a decoration you have not unlocked gets 409 and is logged with `reason=locked`.
- **The journal says one thing:** the task you are on and how many are left ("Next decoration: feed 3 more cows"). No totals, no "x of y", no list of what comes later, no timers, no streaks, no rarity.
- **Cows and hens tell the server** (`POST /api/animals/{cow|hen}/{n}`) only so it can count them. The request is validated, counts against the same action limit, is logged (`did=feed-cow` or `did=pat-hen`), changes nothing in the garden and is never broadcast.
- **A pet name is the one piece of text a visitor types.** It is 1 to 12 letters (no digits, spaces or marks), starts with a capital, and is checked on the server (400, `reason=bad-name`). It is never logged, never in Recent and never shown to anyone else, and the page draws it as text on a canvas, never as page markup.

## Options considered

1. **One task per decoration, fixed list, one task shown at a time (chosen).**
2. **Ten waterings per decoration,** as in the first version. Rejected: one chore only, and the animals and seeds did nothing.
3. **A count of progress ("3 of 8").** Rejected: a total is the first step to a score. The number left in the one task you are on is as much as it says. I chose this wording with the agent; I was asked about it and picked "one next task, no totals".
4. **Free-text pet names with spaces and punctuation.** Rejected: a name goes through the server as stranger input, so letters only keeps it from forging a log line or injecting markup, and it is not logged at all.

Two more I considered while writing this record, and did not try: letting people choose which decoration to work towards, which invites chasing, and a decoration shown in the shared garden, which would be compared.

## Cost of this choice

- **The pace is a guess.** The counts and gaps are not measured with real people. `DECORATION_EVERY`, `DECORATION_TASKS`, `DECORATION_GAP_MS` and `ANIMAL_GAP_MS` change them, and specs and a quick look use small values.
- **Keepers are capped.** Only so many gardeners' decorations and pets are kept (`MAX_DECOR_KEEPERS`, `MAX_PET_KEEPERS`), so a stranger minting cookies cannot grow the database without limit. Past it nothing new is kept and nothing already kept is removed.

## How it is checked

- `spec/decorations.test.ts`: the list and order, a request for a locked decoration gets 409 and is logged, a placed one reaches only its owner, placing one only changes your own garden, each unlock is logged without the cookie, and the counting rules for waterings (a plot counts once until it has rested, and a plant just planted or your own garden does not count).
- `spec/tasks.test.ts`: only the task you are on counts, in a fixed order; an animal counts again only after it has rested; an animal there isn't gets 404 and is logged; it is never sent to anyone else, never put in Recent and never carries the cookie; each unlock is logged; and it counts against the action limit.
- `spec/pet.test.ts`: a pet is locked until the last decoration, kinds and names are checked (letters only, capital first, 12 at most), the pet reaches only its owner, the name never appears in the log, it counts against the limit, and the keeper cap holds without taking one back.
- `spec/privacy.test.ts`: the cookie never leaves the server, only the public id.
- Judged by hand, in a real browser (the agent ran the checks in a headless browser and I judged how they looked), because the server is not involved: how the cows, hens and pet look and move (including the pet never passing through stones or lights), the unlock toasts, and the locked look.

## What would change this

If the unlock pace turns out to be too slow or too fast with real visitors, only the counts and gaps change. If rewards ever needed to be seen by others, the README's no-ranking rule would have to change first: that is a different app.
