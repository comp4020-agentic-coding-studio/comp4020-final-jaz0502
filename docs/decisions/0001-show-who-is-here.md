# 0001: Show who is here as figures on a path, with a short list of what they do

## Context

The README says "good" means that several people can be online at once, working on one shared garden, and that there are no accounts: a visitor is a cookie. In the crit 8 version, the only sign that anyone else was working on the garden was a colour ring on a plant, showing who watered it last. You could see the garden change, but not whether anyone was there. The first README left figures out because I expected live movement to cost too much server effort on one small machine.

## Decision

Each gardener is a small figure in their own colour, and the colour comes from their public id. Figures walk only along the flagstone path round the bed. The server is told where a figure is and where it is walking to, not every step, and the browser animates in between. A "Who's here" list in the side panel shows one dot per gardener, and a short "Recent" list shows the last four actions. A "You" panel gives each gardener a private record of what they have planted, watered and composted. Gardeners can also wave to each other. A figure is only for show, so where it stands never limits what anyone can do to a plot.

## Options considered

1. **Figures on the path, a who's-here list and a recent activity list (chosen).**
2. **A count only (e.g. "3 online").** Cheapest to build, but it says nothing about what anyone is doing, which was the gap.
3. **Colour rings only, as in crit 8.** Shows who watered, but nothing about who is present.
4. **Remember who was here, with "last seen" times.** This needs storage that outlives a restart, and Fly stops the machine when it is idle, so most of it would be stale.

## Cost of this choice

- **Gardeners are told apart by colour alone.** Two gardeners can get similar colours, and the Recent list can only say "a gardener".
- **Presence is not remembered.** After a restart, or if you return the next day, nobody is listed and the Recent list is empty. The plants and your own record survive, but the sense of who was around does not.
- **It is capped.** At 200 gardeners, further newcomers are not shown, though they can still act.
- **More messages for the server,** which was the original reason to leave this out. Moves are limited to one per 100 ms per gardener, and the table is capped, because a stranger's browser is a source of messages.

## How it is checked

- `spec/presence.test.ts`: who is listed, one figure for two tabs, moves validated and rate-limited, and the cap.
- `spec/wave.test.ts` and `spec/feed.test.ts`: waves and the recent list reach other gardeners and never carry the cookie.
- `spec/stats.test.ts`: your record goes only to you.
- `spec/privacy.test.ts`: only public ids leave the server.
- Judged by hand: that a figure and its icons appear in another browser within about a second, and whether it feels like other people are there.
- Not tested: colour clashes between two gardeners.

## What would change this

More than a few dozen gardeners at once, where a list of dots and one path would get crowded; or accounts, which would make names possible.
