# 0004: The barn and the cottage as private rooms you can walk into

## Context

The barn and the cottage were solid buildings with painted doors, and the cows and the pet lived outside them. A garden you can only look at from above feels like a diagram, and the pet had nowhere to be. The README says no figure may stand on a plot, and that where a figure stands never limits or depends on what anyone can do. A room is a new kind of place, so it needed its own rules.

## Decision

Clicking the barn or the cottage (or the sign over it) fades you into a room built far from the garden, and clicking its door, or **Back outside**, brings you out.

- **It is a private view, like the camera and your own garden.** Nothing is sent to the server: there is no endpoint, no log line, nothing stored or counted. Going in or out never depends on where your figure stands, and nothing in either garden depends on whether you are inside.
- **You walk with W A S D and the arrow keys, drag to turn, or use an on-screen stick on a touch screen.** You cannot leave the room, and furniture and walls stop you.
- **You see your own figure from behind,** in your own colour, as in the garden. It is drawn only in your own page and never sent. Nobody else's figure is drawn in a room. The rule that figures walk only on flagstones is about the shared garden. The camera follows you and stays out of walls and furniture.
- **In the barn you give the cows hay.** It counts towards a decoration through the same animal request as outside.
- **In the cottage your pet is with you** and can be stroked or fed, and nobody else sees it. It is drawn smaller than outside so it sits in proportion beside your figure, and you cannot walk through it.
- **Photo mode still works inside.** It is a way of looking.

## Options considered

1. **A separate room far from the garden, shown only while you are inside (chosen).**
2. **A first-person view,** with no figure. The agent built this first. I replaced it after using it, because I wanted to see my own figure walking, and I asked for a third-person view. Its opening angle was then too steep, nearly a bird's-eye view, so it was lowered and the rooms made taller.
3. **Show other gardeners inside too.** Rejected: it would need the server to know where everyone is in each room, which means new messages, a cap and a rate limit, and the rooms are meant to be quiet and yours. I didn't try it.

Two more I considered while writing this record, and did not try: opening the building's front and looking in from outside, and a flat picture of the inside.

## Cost of this choice

- **No spec can check it.** The server is not involved, so how it looks and feels is judged in a real browser, and the README lists it as judged.
- **Walking by hand takes care.** At first setting off looked like a slide, so the agent made speed ease up and down, and the camera comes in close in a corner. The phone stick was not tried on a real phone: the agent tested it in a phone-sized headless browser with touch input, where pushing it walked you forward and dragging turned the view, and the camera was brought in closer on a tall, narrow screen.
- **More to draw.** The rooms are built once and hidden when you are outside, but each adds objects for the visitor's browser to draw while you are in it. I did not measure this, so a weak phone may be slow.
- **The rooms and the buildings can drift apart.** I asked for the two windows by the cottage door so the inside would match the outside, and the agent built them to match. Nobody compared them side by side, and nothing keeps the two the same.
- **Your pet is not shared.** A friend cannot see it in your cottage.

## How it is checked

- Judged by hand, in a real browser on a laptop-sized window (the agent drove it with a headless browser and I looked at the results): going in and out, walking into corners and furniture, the camera never going through a wall, the pet staying in proportion and out of your way, and the signs following the buildings on screen.
- `spec/tasks.test.ts` covers the one thing that does reach the server from a room, a cow fed in the barn: the same animal request as outside, validated, logged and limited.
- Not tested: the rooms on a phone (a phone-sized screen was only checked for the opening view and the cottage sign), the touch stick, and a slow device.

## What would change this

If gardeners needed to meet in a room, it would need the server to know who is where, and a new set of limits, which is a different decision. A weak phone that struggles with the extra drawing would call for a simpler room.
