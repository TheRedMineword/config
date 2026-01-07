// ================= INPUT =================
const nowUnix = parseInt(atob("$$NOWUNIXHERE$$"), 10);

// ================= CONSTANTS =================
const DAY = 86400;
const COUNTDOWN_DAYS = 94.65;
const REMOVE_AFTER_HOURS = 2;
const FUTURE_DAYS = 191; // generate events only within next 30 days

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

// ================= ANALYZE PATTERN =================
const diffs = [];

for (let i = 0; i < schedule.length - 1; i++) {
  diffs.push({
    name: schedule[i].name,
    deltaDays: (schedule[i + 1].start - schedule[i].start) / DAY
  });
}

// Log differences
console.log("=== Event deltas (days) ===");
diffs.forEach(d =>
  console.log(`${d.name} → next in ${d.deltaDays} days`)
);

// Detect repeating cycle (simple rolling match)
function detectCycle(arr) {
  for (let size = 2; size <= arr.length / 2; size++) {
    let ok = true;
    for (let i = 0; i < arr.length - size; i++) {
      if (
        arr[i].name !== arr[i + size].name ||
        arr[i].deltaDays !== arr[i + size].deltaDays
      ) {
        ok = false;
        break;
      }
    }
    if (ok) return arr.slice(0, size);
  }
  return null;
}

const cycle = detectCycle(diffs);

console.log("=== Detected cycle ===");
console.log(cycle);

// ================= GENERATE FUTURE EVENTS =================
const generated = [...schedule];
let last = generated[generated.length - 1];
const futureLimit = nowUnix + FUTURE_DAYS * DAY;

if (cycle) {
  let i = 0;
  while (last.start < futureLimit) {
    const step = cycle[i % cycle.length];
    const nextStart = last.start + step.deltaDays * DAY;

    generated.push({
      name: step.name,
      start: nextStart
    });

    last = generated[generated.length - 1];
    i++;
  }
}

// ================= BUILD OUTPUT =================
const output = [];

for (const ev of generated) {
  const dur = DUR[ev.name];
  if (!dur) continue;

  const start = ev.start;
  const end = start + dur;
  const removeAfter = end + REMOVE_AFTER_HOURS * 3600;
  const countdownStart = start - COUNTDOWN_DAYS * DAY;

  if (removeAfter < nowUnix) continue;
  if (countdownStart > futureLimit) continue;

  output.push({
    use: "yes",
    timezone: 0,
    start: iso(countdownStart),
    ends: iso(start),
    display: `Special Event: **${ev.name}** starts in $$left$$`,
    advenced: "{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"
  });

  output.push({
    use: "yes",
    timezone: 0,
    start: iso(start),
    ends: iso(end),
    display: `Special Event: **${ev.name}** is now **active**!! Ends in $$left$$`,
    advenced: "{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"
  });
}

output;

