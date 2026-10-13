# Community Garden

## What "good" means

For this app, "good" means that many people can be online at the same time, all working on the same shared garden. When someone plants something, it shows up in the garden for everyone, without a reload. You can also see that other people are there: each gardener is a small figure that walks the path round the garden bed, and a "Who's here" list shows how many people are online.

The garden is cooperative. Anyone can plant an empty plot and anyone can water any plot, so nobody owns anything. Plants that nobody waters for some time wilt, and someone has to compost a wilted plot before anything new can grow there. The garden only stays alive because people look after it. It should not have a scoring system, a ranking, or any win or lose situation. The goal is a shared, collaborative space.

There are no accounts. A visitor is a cookie, so one browser is one gardener. Each gardener gets a colour, which colours their figure and a ring around each plant they watered last. The ring fades and pulses as the plant gets thirsty. What people do shows up where it happens: a small icon floats over a plot when someone plants, waters or composts it, and a short "Recent" list shows the last few actions.

Each gardener also has a private record of what they have planted, watered and composted. It is only a record: nobody else sees it, it is never compared between gardeners, and it has no goals or levels, so it cannot become a score.

## What I left out

There are no names or profiles chosen by gardeners, because there are no accounts and I did not want free text from strangers. Gardeners are told apart by colour alone, so two can end up with similar colours.

Figures only walk along the path and never stand on a plot. Where a figure is has no effect on what anyone can do to a plot.

Who is here is not remembered: after a restart nobody is listed and the Recent list starts empty. The plants and each gardener's record are kept.

In the first version I left out figures and a count of who was online, because I expected live movement to cost too much server effort on one small machine. I added them later and answered that worry with limits: one move per gardener every 100 ms, messages that are checked, and a cap of 200 figures. The options I weighed are in `docs/decisions/0001-show-who-is-here.md`.

## What can be checked

Some of "good" is checked by automated tests in `spec/`:

- Only an empty plot can be planted. A user cannot plant in a spot where there is already a plant, and two people planting the same plot at the same moment cannot both succeed.
- Anyone can water anyone's plot, and watering resets how long a plant has before it wilts.
- A wilted plot cannot be watered or replanted until someone composts it.
- A visitor's cookie is never sent to anyone else. Other people only ever see a one-way public id, and the colours come from that id.
- Everyone who joins is told who is already here, a gardener's move reaches the others within a second, and two tabs from one browser are one gardener. Moves are checked and limited, so invalid ones, ones from someone not connected, and ones sent too fast are refused.
- A gardener's record counts only what succeeds, goes only to that gardener, and survives a restart.
- The Recent list shows what others did, holds only the last few entries, and never includes a refused action.
- The server's log names who did what, including refused actions, and never contains a cookie.

## What is judged

The rest can only be judged by a person:

- The overall design and usability: It should be easy to work out how the garden works without reading anything, and the panels should fit on a laptop screen without scrolling.
- Persistence: Plants must survive a restart or a redeployment, but the container in CI cannot restart in the middle of a test run, so no test can prove it. I judged it by having the agent restart the live machine on Fly and check that the planted plots were still there.
- Real-time updates to plots: A change in one browser should appear in the others within about a second. There is no test for this, because proving that a change reaches two independent browsers needs real browsers. I judged it by watching two browsers side by side.
- Whether it feels like other people are there: how the figures and icons look and read is a matter for a person.
- The absence of scoring: Nothing in the app keeps score, and that is a design choice rather than something a test can show.

## What I looked at

- The Forest app, which I used as the visual reference for the garden: plants that grow in a small 3D scene.
- The course's final project brief and the crit 8 page, for what this README has to cover. The brief's line that some of "good" can be checked and some can only be judged is how I organised the two sections above.
- The crit 9 page, for what to decide about several people using the app at once. My decision is in `docs/decisions/0001-show-who-is-here.md`.
