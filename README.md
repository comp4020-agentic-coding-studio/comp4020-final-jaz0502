# Community Garden

## What "good" means

For this app, "good" means that many people can be online at the same time, all working on the same shared garden. When someone plants something, it shows up in the garden for everyone, without a reload.

The garden is cooperative. Anyone can plant an empty plot and anyone can water any plot, so nobody owns anything. Plants that nobody waters for some time wilt, and someone has to compost a wilted plot before anything new can grow there. The garden only stays alive because people look after it. It should not have a scoring system, a ranking, or any win or lose situation. The goal is a shared, collaborative space.

There are no accounts. A visitor is a cookie, so one browser is one gardener. Each gardener gets a colour, and a ring around each plant shows who watered it last. The ring fades and pulses as the plant gets thirsty.

## What I left out

For this first prototype I chose not to add figures that people can control to walk around the garden, or a count of how many others are online. I may add these features later to make the app more interactive with multiple users. I left these out of the initial prototype because I expected that keeping every visitor's movement live would cost too much server effort on top of the garden's own real-time updates, and the app runs on one small machine. I also wanted the core function of the app, the shared garden itself, working first. The colour rings are the lighter version of presence that I did build.

## What can be checked

Some of "good" is checked by automated tests in `spec/`:

- Only an empty plot can be planted. A user cannot plant in a spot where there is already a plant, and two people planting the same plot at the same moment cannot both succeed.
- Anyone can water anyone's plot, and watering resets how long a plant has before it wilts.
- A wilted plot cannot be watered or replanted until someone composts it.
- A visitor's cookie is never sent to anyone else. Other people only ever see a one-way public id, and the colours come from that id.

## What is judged

The rest can only be judged by a person:

- The overall design and usability: It should be easy to work out how the garden works without reading anything.
- Persistence: Plants must survive a restart or a redeployment, but the container in CI cannot restart in the middle of a test run, so no test can prove it. I judged it by having the agent restart the live machine on Fly and check that the planted plots were still there.
- Real-time updates: A change in one browser should appear in the others within about a second. There is no test for this, because proving that a change reaches two independent browsers needs real browsers. I judged it by watching two browsers side by side.
- The absence of scoring: Nothing in the app keeps score, and that is a design choice rather than something a test can show.

## What I looked at

- The Forest app, which I used as the visual reference for the garden: plants that grow in a small 3D scene.
- The course's final project brief and the crit 8 page, for what this README has to cover. The brief's line that some of "good" can be checked and some can only be judged is how I organised the two sections above.
