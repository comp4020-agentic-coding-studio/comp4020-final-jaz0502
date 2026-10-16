# 0002: Who may see and change what, checked on the server

## Context

The README says "good" means many people in one shared garden, with no accounts and no scoring: a visitor is a cookie, so one browser is one gardener. Crit 10 asks the app to tell people apart and to check, on the server, what each person may see and change. That check cannot live in the page, because a stranger's browser sends whatever it likes to the server.

## Decision

A person is an anonymous browser: a random id in a `gid` cookie, set on the first visit, kept for a year, and marked `HttpOnly` and `SameSite=Lax` so page scripts cannot read it. The server treats that cookie as the person on every request. Nothing is believed from the page about who is asking.

What each person may **see**:
- The garden's plots, and who tended them, only as a one-way public id (the first 8 hex digits of a hash of the cookie). The cookie itself is never sent to anyone, and a spec fails if it appears in any other visitor's stream.
- Who is in the garden and where their figure is, by public id only.
- A short list of what others just did, by public id only.
- **Their own record** of what they have planted, watered and composted. It is sent only to that gardener's own streams and never broadcast.

What each person may **change**, all decided by the server from the plot's stored state, not by anything the page says:
- Plant only an empty plot. Compost only a wilted one. Water any plot that is neither empty nor wilted. So nobody can overwrite or remove another gardener's healthy plant, and two people acting at once cannot both win.
- Nobody owns a plot. Anyone may water anyone's plot. That is the point of the garden, and it is a rule, not an oversight.
- Act on plots only so often: a budget of 15 plants, waterings and compostings in any 10 seconds, counted per person on the server, with refused attempts counted too. Past it the server answers 429 with `Retry-After` and changes nothing.
- Move their own figure and wave. Both are validated and rate-limited, and a gardener must have the event stream open to do either.

What is logged: every plant, water, compost and wave, including refused ones with the reason, and every arrival and departure, each with the public id. Never the cookie. A flood past the limit is logged once for the window, so it cannot flood the log.

## Options considered

1. **Anonymous cookie, server checks the state of the plot, and a budget on plot actions (chosen).**
2. **Accounts with a login.** Rejected: it adds passwords or an identity provider and a sign-up step before anyone can try the garden, and the README says there are no accounts. A classmate opening a URL should be gardening in seconds.
3. **A signed cookie,** one the server can tell has not been made up. Rejected for now, but it is the obvious next step. See the cost below.
4. **Per-plot ownership,** so only the planter may water or compost it. Rejected: it contradicts the README's cooperative idea, and a plant whose owner has left would simply die.
5. **Trust the page,** hiding buttons the person should not have. Rejected outright: the server must not depend on what a browser says it may do.

For how often someone may act on plots, three options:

6. **No limit.** This was the first version. I tried it: one visitor looping over every plot planted all 100 in a moment. That fits "anyone can plant an empty plot", but one script could fill the whole garden and flood the log.
7. **A fixed gap between actions,** as moves and waves have. Rejected: it would stop someone planting a quick row, which is normal play.
8. **A budget in a window of time (chosen).** A burst is allowed and a loop is not: the same script now plants 15 and is turned away for the other 85.

## Cost of this choice

- **The cookie is unsigned.** The server trusts whatever `gid` it is sent. The cookie is random and never leaves the server, so nobody can guess or learn someone else's, but anyone who could read a person's cookie from their own machine could act as them. Signing it would stop a made-up cookie but not a stolen one. It is also not marked `Secure`, although the deployment forces HTTPS.
- **A person is a browser, not a human.** Clearing cookies or opening a private window makes a new gardener, and their record starts again. Two browsers of one human are two gardeners.
- **The limit is per cookie.** Someone who mints a fresh cookie for every request gets a fresh budget each time, so it stops a careless loop and not a determined one. Stopping that would need a limit by address as well, which would punish a whole classroom behind one connection.
- **The numbers are a guess.** 15 in 10 seconds is more than a person clicks, but it is not measured. Each is one setting (`ACTION_LIMIT`, `ACTION_WINDOW_MS`).
- **The page only helps.** After a 429 the page waits for `Retry-After` instead of sending clicks, but a few requests already on their way still get through and show as errors in the browser's console. Only the server's limit counts.
- **Figures are capped at 200, records and the limiter's table at 5,000 gardeners,** so a stranger minting cookies cannot grow memory or the database without limit. Past the cap newcomers are not shown or counted, though they can still act.
- **A public id is short.** Eight hex digits is enough to tell a pod apart and to colour a figure. It is not meant to be secret.

## How it is checked

- `spec/privacy.test.ts`: the cookie never reaches another visitor, only the public id, and the public id is stable per person and differs between people.
- `spec/plots.test.ts`: only an empty plot can be planted, a wilted plot cannot be watered, composting needs a wilted plot, two simultaneous plants cannot both win.
- `spec/limits.test.ts`: a person can act up to the budget and no further, the 429 changes nothing and says when to try again, refused attempts count, the budget comes back after the window, and one person's flood never stops another.
- `spec/stats.test.ts`: your record goes to you and nobody else.
- `spec/presence.test.ts` and `spec/wave.test.ts`: moves and waves are validated and rate-limited, and refused from someone not connected.
- `spec/logging.test.ts`: the log names who did what, with the public id, and never contains a cookie. `spec/limits.test.ts` also checks a flood is logged once.
- Not tested: that the cookie is `HttpOnly`, and that someone cannot act with a made-up cookie (they can, by design).

## What would change this

Real accounts, or anything that a stranger holding a cookie must not be able to change: that would call for a signed cookie at least, and a limit by address as well as by cookie. A longer-lived or more public deployment would too.
