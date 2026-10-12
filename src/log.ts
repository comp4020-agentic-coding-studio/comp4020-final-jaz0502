// The one place that writes a line about what a gardener did. Anything that goes
// in a log is readable by whoever can read the app's logs, so it takes a public id
// and never a cookie: callers pass `publicId(gid)`, and nothing here accepts
// anything else.

// The hue the page paints this gardener's figure with (colourFor in
// public/app.js), so a line in the log can be matched to a figure on screen.
export function hueOf(id: string): number {
  return parseInt(id.slice(0, 6), 16) % 360;
}

type Field = string | number;

// One `key=value` line, who first, so `flyctl logs` reads like commentary.
export function logEvent(who: string, did: string, fields: Record<string, Field> = {}): void {
  const rest = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
  console.log([`who=${who}`, `hue=${hueOf(who)}`, `did=${did}`, ...rest].join(" "));
}
