// ================= INPUT =================
const nowUnix = parseInt(atob("$$NOWUNIXHERE$$"), 10);

// ================= CONSTANTS =================
const DAY = 86400;
const COUNTDOWN_DAYS = 34.65;
const REMOVE_AFTER_HOURS = 2;
const FUTURE_DAYS = 91; // generate events only within next 30 days

// ================= DURATIONS =================
const DUR = {
  "White Star": 4 * DAY,
  "Blue Star": 3 * DAY,
  "Red Star": 3 * DAY,
  "Credit Asteroid": 3 * DAY
};

// ================= REFERENCE SCHEDULE =================
// Thanks Caprican
const schedule = [
  { name: "Credit Asteroid", start: 1747440000 },
  { name: "Red Star", start: 1748044800 },
  { name: "Blue Star", start: 1748649600 },
  { name: "Credit Asteroid", start: 1749254400 },
  { name: "White Star", start: 1749513600 },
  { name: "Blue Star", start: 1749859200 },
  { name: "Red Star", start: 1750464000 },
  { name: "Credit Asteroid", start: 1751068800 },
  { name: "Blue Star", start: 1751673600 },
  { name: "White Star", start: 1751932800 },
  { name: "Credit Asteroid", start: 1752278400 },
  { name: "Red Star", start: 1752883200 },
  { name: "Blue Star", start: 1753488000 },
  { name: "Credit Asteroid", start: 1754092800 },
  { name: "White Star", start: 1754352000 },
  { name: "Blue Star", start: 1754697600 },
  { name: "Red Star", start: 1755302400 },
  { name: "Credit Asteroid", start: 1755907200 },
  { name: "Blue Star", start: 1756512000 },
  { name: "White Star", start: 1756771200 },
  { name: "Credit Asteroid", start: 1757116800 },
  { name: "Red Star", start: 1757721600 },
  { name: "Blue Star", start: 1758326400 },
  { name: "Credit Asteroid", start: 1758931200 },
  { name: "White Star", start: 1759190400 },
  { name: "Blue Star", start: 1759536000 },
  { name: "Red Star", start: 1760140800 },
  { name: "Credit Asteroid", start: 1760745600 },
  { name: "Blue Star", start: 1761350400 },
  { name: "White Star", start: 1761609600 },
  { name: "Credit Asteroid", start: 1761955200 },
  { name: "Red Star", start: 1762560000 },
  { name: "Blue Star", start: 1763164800 },
  { name: "Credit Asteroid", start: 1763769600 },
  { name: "White Star", start: 1764028800 },
  { name: "Blue Star", start: 1764374400 },
  { name: "Red Star", start: 1764979200 },
  { name: "Credit Asteroid", start: 1765584000 },
  { name: "Blue Star", start: 1766188800 },
  { name: "White Star", start: 1766448000 },
  { name: "Credit Asteroid", start: 1766793600 },
  { name: "Red Star", start: 1767398400 },
  { name: "Blue Star", start: 1768003200 },
  { name: "Credit Asteroid", start: 1768608000 },
  { name: "Blue Star", start: 1769212800 },
  { name: "White Star", start: 1768867200 }
];


// ================= HELPERS =================
function iso(sec) {
  return new Date(sec * 1000).toISOString().replace(".000", "");
}

// ================= BUILD OUTPUT =================
const output = [];
const futureLimit = nowUnix + FUTURE_DAYS * DAY;

for (const ev of schedule) {
  const dur = DUR[ev.name];
  if (!dur) continue;

  const start = ev.start;
  const end = start + dur;
  const removeAfter = end + REMOVE_AFTER_HOURS * 3600;
  const countdownStart = start - COUNTDOWN_DAYS * DAY;

  if (removeAfter < nowUnix) continue; // skip fully past events
  if (countdownStart > futureLimit) continue; // skip events starting too far in future

  // This is countdown
  if (countdownStart <= futureLimit) {
    output.push({
      use: "yes",
      timezone: 0,
      start: iso(countdownStart),
      ends: iso(start),
      display: `Special Event: **${ev.name}** starts in $$left$$`,
      advenced: "{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"
    });
  }

  // This is active
  if (start <= futureLimit) {
    output.push({
      use: "yes",
      timezone: 0,
      start: iso(start),
      ends: iso(end),
      display: `Special Event: **${ev.name}** is now **active**!! Ends in $$left$$`,
      advenced: "{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"
    });
  }
}

output;  // This is output
// Should be: [{"use":"yes","timezone":0,"start":"2025-12-14T00:00:00Z","ends":"2025-12-27T00:00:00Z","display":"Special Event: **Credit Asteroid** starts in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2025-12-27T00:00:00Z","ends":"2025-12-30T00:00:00Z","display":"Special Event: **Credit Asteroid** is now **active**!! Ends in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2025-12-21T00:00:00Z","ends":"2026-01-03T00:00:00Z","display":"Special Event: **Red Star** starts in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-03T00:00:00Z","ends":"2026-01-06T00:00:00Z","display":"Special Event: **Red Star** is now **active**!! Ends in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2025-12-28T00:00:00Z","ends":"2026-01-10T00:00:00Z","display":"Special Event: **Blue Star** starts in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-10T00:00:00Z","ends":"2026-01-13T00:00:00Z","display":"Special Event: **Blue Star** is now **active**!! Ends in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-04T00:00:00Z","ends":"2026-01-17T00:00:00Z","display":"Special Event: **Credit Asteroid** starts in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-17T00:00:00Z","ends":"2026-01-20T00:00:00Z","display":"Special Event: **Credit Asteroid** is now **active**!! Ends in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-11T00:00:00Z","ends":"2026-01-24T00:00:00Z","display":"Special Event: **Blue Star** starts in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-24T00:00:00Z","ends":"2026-01-27T00:00:00Z","display":"Special Event: **Blue Star** is now **active**!! Ends in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-14T00:00:00Z","ends":"2026-01-27T00:00:00Z","display":"Special Event: **White Star** starts in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"},{"use":"yes","timezone":0,"start":"2026-01-27T00:00:00Z","ends":"2026-01-31T00:00:00Z","display":"Special Event: **White Star** is now **active**!! Ends in $$left$$","advenced":"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"}]
// I hope it will work forever
