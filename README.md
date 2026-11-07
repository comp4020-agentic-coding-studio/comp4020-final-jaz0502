# Community Garden

## What "good" means

Many people can be online at the same time, working on one shared garden. When someone plants something, it shows up for everyone without a reload. You see other people as small figures, and each bed has a name and a theme. The garden goes through four seasons and changing weather. It should be just as easy to play on a phone as on a laptop.

The garden is cooperative, and nobody owns anything: anyone can plant an empty plot or water any plot. Plants nobody waters wilt. The garden only stays alive because people look after it. There is no scoring or ranking. Caring for the garden is rewarded privately, by unlocking decorations for your own garden, then a pet.

There are no accounts. A visitor is a cookie, so one browser is one gardener. What people do shows up where it happens: an icon floats over a plot, and a short "Recent" list shows the last few actions.

Each gardener also has a private record of their gardening history, a private album of up to 24 photos kept in their own browser, and a private garden nobody else can touch. To plant there, they gather seeds from fully grown plants in the shared garden.

## What I left out

There are no names or profiles, because there are no accounts. The one exception is a pet's name, which only its owner sees. Gardeners are told apart by colour alone.

There is no shared photo gallery. Where a figure stands has no effect on what anyone can do to a plot.

Who is here is not remembered: after a restart nobody is listed and the Recent list starts empty. The plants and each gardener's record are kept.

My first version left out figures, because I expected live movement would cost too much on one small machine. I added them later with limits: one move per gardener every 100 ms, checked messages and a cap of 200 figures (`docs/decisions/0001-show-who-is-here.md`).

## What can be checked

Some of "good" is checked by automated tests in `spec/`:

- Only an empty plot can be planted, and two people planting the same plot at the same moment cannot both succeed.
- Anyone can water any plot, and watering resets the wilt clock.
- Four beds of 25 plots each take only their own plants.
- A wilted plot cannot be watered or replanted until composted.
- Everyone who joins is told who is here.
- A gardener's record, decorations, seeds and pet go only to them.
- Each gardener's actions are rate-limited: past the limit the server turns them away.
- The Recent list holds only the last few entries.
- The log names who did what and never contains a cookie.

## What is judged

The rest can only be judged by a person:

- **Design and usability:** the garden should be easy to work out without reading anything.
- **Persistence:** no test can restart the machine mid-run, so I had the agent restart the live Fly machine and check the plants were still there.
- **Real-time updates:** a change should reach other browsers within about a second. That needs real browsers, so I watched two side by side.
- **Camera, album, barn, cottage, animals and phone layout:** these live in the visitor's browser, so I judged them by using them.
- **No scoring:** nothing keeps score. That is a design choice, not something a test can show.

## What I looked at

- Forest, the focus app (https://forestapp.cc/): my visual reference for plants growing in a small 3D scene.
- The final project brief and the crit 8 page, for what this README must cover.
- The crit 9 page, for what to decide about several people using the app at once. My decision is in `docs/decisions/0001-show-who-is-here.md`.
