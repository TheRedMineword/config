// Ver.2.0.1½ - Unofficial
// CONTENT WILL BE STILL UPDATED

// ================= INPUT =================
const nowUnix = parseInt(atob("$$NOWUNIXHERE$$"), 10);

// ================= CONSTANTS =================
const DAY = 86400;
const COUNTDOWN_DAYS = 13.65;
const REMOVE_AFTER_HOURS = 2;
const FUTURE_DAYS = 41; // generate events only within next 30 days

// ================= DURATIONS =================
const DUR = {
  "White Star": 4 * DAY,
  "Blue Star": 3 * DAY,
  "Red Star": 3 * DAY,
  "Credit Asteroid": 3 * DAY,
  "Yellow Star": 99 * DAY
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
  { name: "White Star", start: 1768867200 },
  // By DrMineword:
  { name: "Yellow Star", start: 1772668800 }
];

// ================= HELPERS =================
function iso(sec) {
  return new Date(sec * 1000).toISOString().replace(".000", "");
}
// ================= SPLIT SCHEDULE BY EVENT TYPE =================
const byType = {};
for (const ev of schedule) {
  byType[ev.name] ??= [];
  byType[ev.name].push(ev.start);
}

// ================= LEARN CADENCE PER TYPE =================
const cadence = {};
for (const type in byType) {
  const times = byType[type];
  const gaps = [];

  for (let i = 1; i < times.length; i++) {
    gaps.push(times[i] - times[i - 1]);
  }

  cadence[type] = gaps.length
    ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    : null;
}

console.log("=== Learned cadence per event (seconds) ===");
console.log(cadence);

// ================= GENERATE FUTURE EVENTS PER TYPE =================
const futureLimit = nowUnix + FUTURE_DAYS * DAY;
const generated = [];

for (const type in byType) {
  const times = byType[type];
  const step = cadence[type];
  if (!step) continue;

  let last = times[times.length - 1];

  while (last < futureLimit) {
    last += step;
    generated.push({ name: type, start: last });
  }
}

// ================= MERGE + SORT =================
const merged = [...schedule, ...generated]
  .filter(ev => ev.start + (DUR[ev.name] || 0) > nowUnix)
  .sort((a, b) => a.start - b.start);

console.log("=== Merged future schedule (sorted) ===");
console.log(merged);

// ================= BUILD OUTPUT =================
const output = [];

for (const ev of merged) {
  const dur = DUR[ev.name];
  if (!dur) continue;

  const start = ev.start;
  const end = start + dur;
  const dura = dur;
  const removeAfter = end + REMOVE_AFTER_HOURS * 3600;
  const countdownStart = start - COUNTDOWN_DAYS * DAY;

  if (removeAfter < nowUnix) continue;
  if (countdownStart > futureLimit) continue;

  // countdown
  output.push({
    use: "yes",
    timezone: 0,
    start: iso(countdownStart),
    ends: iso(start),
    display: `Special Event: **${ev.name}** starts in $$left$$`,
    advenced: `"{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\\n-# Active for ${ev.dura} Days\"}"`
  });

  // active
  output.push({
    use: "yes",
    timezone: 0,
    start: iso(start),
    ends: iso(end),
    display: `Special Event: **${ev.name}** is now **active**!! Ends in $$left$$`,
    advenced: "{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"
  });
}

console.log("=== Final output JSON ===");
console.log(output);

output;
