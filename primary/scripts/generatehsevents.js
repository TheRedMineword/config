// CONTENT WILL BE STILL UPDATED
const version = "Ver.2.1.1 - Bug fix: time drift - hotfix: more console logs"
console.log(version);
// ================= INPUT =================
const nowUnix = parseInt(atob("$$NOWUNIXHERE$$"), 10);
console.log(nowUnix);
// ================= CONSTANTS =================
const DAY = 86400;
const COUNTDOWN_DAYS = 13.65;
const REMOVE_AFTER_HOURS = 2;
const FUTURE_DAYS = 41; // generate events only within next 30 days
//const FUTURE_DAYS = 1920; // Few years for TurnamentOfHades!


// ================= DURATIONS =================
const DUR = {
  "White Star": 4 * DAY,
  "Blue Star": 3 * DAY,
  "Red Star": 3 * DAY,
  "Credit Asteroid": 3 * DAY,
  "Yellow Star": 2 * DAY,
  "TurnamentOfHades": 60 * DAY
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
  { name: "Yellow Star", start: 1758153600 }, // By Caprican: Yellow Star Credits event starts <t:1758153600:R>! For 2 days, all delivered Yellow Star shipments will yield 3× the usual credits. Bonus ends <t:1758326400:f> — make them count!
  // By DrMineword:
  { name: "Yellow Star", start: 1772668800 },
  { name: "TurnamentOfHades", start: 1764288000 }, // first
  { name: "TurnamentOfHades", start: 2079648000 }, // Second
];

// ================= HELPERS =================
function iso(sec) {
  return new Date(sec * 1000).toISOString().replace(".000", "");
}

const DEBUG = true;

function debug(fn, msg, data) {
  if (!DEBUG) return;
  const prefix = `[DEBUG!${fn}]`;
  if (data !== undefined) {
    console.log(prefix, msg, data);
  } else {
    console.log(prefix, msg);
  }
}


// ================= SPLIT SCHEDULE BY EVENT TYPE =================
debug("splitByType", "Starting schedule split");

const byType = {};

for (const ev of schedule) {
  byType[ev.name] ??= [];
  byType[ev.name].push(ev.start);
}

for (const type in byType) {
  byType[type].sort((a, b) => a - b);
  debug("splitByType", `Sorted timestamps for ${type}`, byType[type]);
}


// ================= LEARN CADENCE PER TYPE =================
function mode(arr) {
  const freq = {};
  let best = null;
  let max = 0;

  for (const v of arr) {
    freq[v] = (freq[v] || 0) + 1;
    if (freq[v] > max) {
      max = freq[v];
      best = v;
    }
  }

  debug("mode", "Frequency table", freq);
  debug("mode", "Selected mode", best);
  return best;
}

debug("learnCadence", "Learning cadence per event type");

const cadence = {};

for (const type in byType) {
  const times = byType[type];
  const gaps = [];

  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > 0) gaps.push(gap);
  }

  debug("learnCadence", `Gaps for ${type}`, gaps);

  cadence[type] = gaps.length ? mode(gaps) : null;

  debug("learnCadence", `Cadence for ${type}`, cadence[type]);
}


console.log("=== Learned cadence per event (seconds) ===");
console.log(cadence);


// ================= GENERATE FUTURE EVENTS PER TYPE =================

function snapToMidnight(sec) {
  const snapped = Math.floor(sec / DAY) * DAY;
  debug("snapToMidnight", "Snapped time", { before: sec, after: snapped });
  return snapped;
}



debug("generateFuture", "Generating future events");

const futureLimit = nowUnix + FUTURE_DAYS * DAY;
const generated = [];

for (const type in byType) {
  const times = byType[type];
  const step = cadence[type];
  if (!step) {
    debug("generateFuture", `Skipping ${type} (no cadence)`);
    continue;
  }

  let last = times[times.length - 1];
  debug("generateFuture", `Starting from last event for ${type}`, last);

  while (last < futureLimit) {
    last += step;
    last = snapToMidnight(last);

    generated.push({ name: type, start: last });
    debug("generateFuture", `Generated event for ${type}`, last);
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
// const ONE_YEAR = 365 * DAY;
const ONE_YEAR = 1917 * DAY;


function check(name) {
  return name === "Yellow Star" || name === "TurnamentOfHades";
}



for (const ev of merged) {
  try {
    if (!ev || !ev.name || !ev.start) {
      console.log("Skipping invalid event:", JSON.stringify(ev));
      continue;
    }

    const dur = DUR[ev.name];
    if (!dur) {
      console.log("Missing duration for:", ev.name);
      continue;
    }

    const start = ev.start;
    const end = start + dur;
    const removeAfter = end + REMOVE_AFTER_HOURS * 3600;

    let countdownStart;
    if (check(ev.name) === true) {
      countdownStart = start - ONE_YEAR;
      console.log("Rare One");
    } else {
      countdownStart = start - COUNTDOWN_DAYS * DAY;
    }

    if (removeAfter < nowUnix) continue;
    if (countdownStart > futureLimit) continue;

    // Optional: log successful processing
    console.log("Processed event:", JSON.stringify({
      name: ev.name,
      start,
      end,
      countdownStart
    }));

     // countdown
  output.push({
    use: "yes",
    timezone: 0,
    start: iso(countdownStart),
    ends: iso(start),
    display: `Special Event: **${ev.name}** starts in $$left$$`,
    advenced: "{\"use_timestampt\": \"-# (<t:$$unix$$:D> <t:$$unix$$:t>)\"}"
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

  } catch (err) {
    console.log("Error processing event:", JSON.stringify(ev));
    console.log("Error message:", err?.message || err);
  }
}


console.log("=== Final output JSON ===");
console.log(output);

output;
