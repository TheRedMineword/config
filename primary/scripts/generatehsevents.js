// ================= CONFIG =================
const FUTURE_DAYS_RANGE = 60; // how far ahead to generate
const EVENT_DURATION_DAYS = 3;
const COUNTDOWN_DAYS = 13;
const DISPLAY_BEFORE_DAYS = 14;
const REMOVE_AFTER_HOURS = 24;
const EVENT_INTERVAL_DAYS = 7;

// Base64-encoded unix timestamp (seconds)
const NOW_UNIX_BASE64 = "$$NOWUNIXHERE$$";

// Rotation order
const EVENT_ROTATION = [
  "Blue Star",
  "White Star",
  "Credit Asteroid",
  "Red Star"
];

// Known reference event start (must be correct)
const REFERENCE_EVENT_START = 1769212800; // Blue Star start (UTC)

// =========================================

// Decode base64 unix time
const nowUnix = parseInt(
  Buffer.from(NOW_UNIX_BASE64, "base64").toString("utf8"),
  10
);

const nowMs = nowUnix * 1000;
const dayMs = 86400000;

// Helper: format ISO UTC
function isoUTC(ms) {
  return new Date(ms).toISOString().replace(".000", "");
}

// Determine how many intervals since reference
const intervalsSinceRef = Math.floor(
  (nowUnix - REFERENCE_EVENT_START) / (EVENT_INTERVAL_DAYS * 86400)
);

// Start generation slightly in the past to catch countdowns
let cursorIndex = intervalsSinceRef - 2;

// End time
const futureLimitMs = nowMs + FUTURE_DAYS_RANGE * dayMs;

const output = [];

while (true) {
  const eventStartUnix =
    REFERENCE_EVENT_START +
    cursorIndex * EVENT_INTERVAL_DAYS * 86400;

  const eventStartMs = eventStartUnix * 1000;
  if (eventStartMs > futureLimitMs) break;

  const eventEndMs = eventStartMs + EVENT_DURATION_DAYS * dayMs;
  const removeAfterMs = eventEndMs + REMOVE_AFTER_HOURS * 3600000;

  const countdownStartMs =
    eventStartMs - COUNTDOWN_DAYS * dayMs;
  const displayStartMs =
    eventStartMs - DISPLAY_BEFORE_DAYS * dayMs;

  const eventName =
    EVENT_ROTATION[
      ((cursorIndex % EVENT_ROTATION.length) +
        EVENT_ROTATION.length) %
        EVENT_ROTATION.length
    ];

  // Countdown entry
  if (
    nowMs <= eventStartMs &&
    nowMs >= displayStartMs
  ) {
    output.push({
      use: "yes",
      timezone: 0,
      start: isoUTC(countdownStartMs),
      ends: isoUTC(eventStartMs),
      display: `Special Event: **${eventName}** starts in $$left$$`,
      advenced: "{\"use_timestampt\": \"value_will_be_later_edited\"}"
    });
  }

  // Active entry
  if (
    nowMs >= eventStartMs &&
    nowMs <= removeAfterMs
  ) {
    output.push({
      use: "yes",
      timezone: 0,
      start: isoUTC(eventStartMs),
      ends: isoUTC(eventEndMs),
      display: `Special Event: **${eventName}** is now **active**!! Ends in $$left$$`,
      advenced: "{\"use_timestampt\": \"value_will_be_later_edited\"}"
    });
  }

  cursorIndex++;
}

// Final result
console.log(JSON.stringify(output, null, 2));
