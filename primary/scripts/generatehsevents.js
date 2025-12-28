// ================= CONFIG =================
const FUTURE_DAYS_RANGE = 60;
const EVENT_DURATION_DAYS = 3;
const COUNTDOWN_DAYS = 13;
const DISPLAY_BEFORE_DAYS = 14;
const REMOVE_AFTER_HOURS = 24;
const EVENT_INTERVAL_DAYS = 7;

// Event rotation order
const EVENT_ROTATION = [
  "Blue Star",
  "White Star",
  "Credit Asteroid",
  "Red Star"
];

// Known reference event start (UTC, seconds)
// Blue Star
const REFERENCE_EVENT_START = 1769212800;

// =========================================

// Decode base64 unix timestamp (seconds)
const nowUnix = parseInt(atob($input.now_base64), 10);
const nowMs = nowUnix * 1000;

const DAY_MS = 86400000;

// Format ISO UTC without milliseconds
function isoUTC(ms) {
  return new Date(ms).toISOString().replace(".000", "");
}

// Calculate where we are in the rotation
const intervalsSinceRef = Math.floor(
  (nowUnix - REFERENCE_EVENT_START) / (EVENT_INTERVAL_DAYS * 86400)
);

// Start a little earlier to catch countdown windows
let cursorIndex = intervalsSinceRef - 2;
const futureLimitMs = nowMs + FUTURE_DAYS_RANGE * DAY_MS;

const output = [];

while (true) {
  const eventStartUnix =
    REFERENCE_EVENT_START +
    cursorIndex * EVENT_INTERVAL_DAYS * 86400;

  const eventStartMs = eventStartUnix * 1000;
  if (eventStartMs > futureLimitMs) break;

  const eventEndMs = eventStartMs + EVENT_DURATION_DAYS * DAY_MS;
  const removeAfterMs = eventEndMs + REMOVE_AFTER_HOURS * 3600000;

  const countdownStartMs =
    eventStartMs - COUNTDOWN_DAYS * DAY_MS;
  const displayStartMs =
    eventStartMs - DISPLAY_BEFORE_DAYS * DAY_MS;

  const eventName =
    EVENT_ROTATION[
      ((cursorIndex % EVENT_ROTATION.length) +
        EVENT_ROTATION.length) %
        EVENT_ROTATION.length
    ];

  // Countdown entry
  if (nowMs >= displayStartMs && nowMs < eventStartMs) {
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
  if (nowMs >= eventStartMs && nowMs <= removeAfterMs) {
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

// Return result to Xano
return output;
