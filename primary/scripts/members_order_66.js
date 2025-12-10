let output = {};
const logs = [];

function timestamp() {
  return new Date().toISOString();
}
function logInfo(msg) {
  const line = `[${timestamp()}] [INFO] ${msg}`;
  console.log(line);
  logs.push(line);
}
function logWarn(msg) {
  const line = `[${timestamp()}] [WARN] ${msg}`;
  console.log(line);
  logs.push(line);
}
function logDebug(msg, obj) {
  const line = obj ? `[${timestamp()}] [DEBUG] ${msg}: ${JSON.stringify(obj)}` : `[${timestamp()}] [DEBUG] ${msg}`;
  console.log(line);
  logs.push(line);
}
function logError(msg) {
  const line = `[${timestamp()}] [ERROR] ${msg}`;
  console.log(line);
  logs.push(line);
}

logInfo("Starting Discord member evaluation");

// ----------------------------
// Decode Base64 JSON inputs
// ----------------------------
let members = [];
let membersConfig = {};

try {
  if ($input.members) {
    const decodedMembers = atob($input.members); // decode base64
    members = JSON.parse(decodedMembers);
    logDebug("Decoded members", members);
  } else {
    logInfo("No members input provided");
  }
} catch (e) {
  logError("Failed to decode members input: " + e.message);
}

try {
  if ($input.members_config) {
    const decodedConfig = atob($input.members_config);
    membersConfig = JSON.parse(decodedConfig);
    logDebug("Decoded members_config", membersConfig);
  } else {
    logInfo("No members_config input provided, using defaults");
  }
} catch (e) {
  logError("Failed to decode members_config input: " + e.message);
}

// ----------------------------
// Your default config & helpers
// ----------------------------
const DISCORD_EPOCH = 1420070400000n;
const g = (obj, path, def = null) => {
  try {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj) ?? def;
  } catch {
    return def;
  }
};
function snowflakeToDate(snowflake) {
  try {
    const id = BigInt(String(snowflake));
    const timestamp = Number((id >> 22n) + DISCORD_EPOCH);
    return new Date(timestamp).toISOString();
  } catch {
    return null;
  }
}
function daysSince(iso) {
  if (!iso) return null;
  const now = new Date();
  const then = new Date(iso);
  if (isNaN(then)) return null;
  return (now - then) / (1000 * 60 * 60 * 24);
}

// Default config
const defaultConfig = {
  account_checks: {
    min_account_age_days: 7,
    max_account_age_days_for_auto_ban: 3,
    auto_ban_young_account: true,
    check_discord_creation_time: true,
  },
  server_join_checks: {
    min_server_age_days: 2,
    auto_ban_no_roles: { enabled: true, min_server_days: 1 },
  },
  profile_checks: {
    require_avatar: true,
    require_banner: false,
    require_global_name: true,
    empty_name_is_suspicious: true,
  },
  unusual_activity_checks: {
    auto_action_on_unusual_dm: true,
    auto_action_on_communication_disabled: true,
    unusual_dm_action: 4,
    communication_disabled_action: 3,
  },
  username_spam_detection: {
    enabled: true,
    patterns: [
      "^[a-z]{8,12}\\d{3,5}$",
      "^(?:discord|nitro|boost)[^a-z]*$",
      "^[\\w]{16,}$",
    ],
    case_insensitive: true,
  },
  role_checks: {
    check_for_no_roles: true,
    treat_no_roles_as_suspicious: true,
  },
  risk_weights: {
    account_new: 25,
    server_join_new: 20,
    missing_avatar: 10,
    missing_banner: 5,
    suspicious_name: 30,
    no_roles: 15,
    unusual_dm: 50,
    communication_disabled: 40,
  },
  action_map: {
    "0_20": 0,
    "21_40": 1,
    "41_60": 2,
    "61_80": 3,
    "81_999": 4,
  },
};

function merge(a, b) {
  for (const k of Object.keys(b)) {
    if (b[k] !== null && typeof b[k] === "object" && !Array.isArray(b[k])) {
      a[k] = a[k] || {};
      merge(a[k], b[k]);
    } else {
      a[k] = b[k];
    }
  }
  return a;
}

const cfg = merge(defaultConfig, membersConfig);
logDebug("Merged config", cfg);

// ----------------------------
// Precompile regex
// ----------------------------
const spamRegexes =
  cfg.username_spam_detection.enabled && Array.isArray(cfg.username_spam_detection.patterns)
    ? cfg.username_spam_detection.patterns
        .map((p) => {
          try {
            return new RegExp(
              p,
              cfg.username_spam_detection.case_insensitive ? "i" : ""
            );
          } catch {
            logWarn(`Invalid regex skipped: ${p}`);
            return null;
          }
        })
        .filter(Boolean)
    : [];

// ----------------------------
// Helpers for action
// ----------------------------
function actionLabel(n) {
  return {
    0: "ignore",
    1: "warn",
    2: "moderate",
    3: "kick",
    4: "ban",
    5: "hard-ban",
  }[n] ?? "unknown";
}
function mapScoreToAction(score, map) {
  for (const key of Object.keys(map)) {
    const [min, max] = key.split("_").map(Number);
    if (score >= min && score <= max) return map[key];
  }
  return 0;
}

// ----------------------------
// Member processor
// ----------------------------
function processMember(m) {
  const member = m.member ?? m;
  const user = member.user ?? {};
  logDebug("Processing member", user);

  const userId = String(g(user, "id") ?? "");
  const username = g(user, "username") ?? "";
  const globalName = g(user, "global_name") ?? "";
  const avatar = g(user, "avatar");
  const banner = g(user, "banner");
  const joinedAt = g(member, "joined_at");
  const commDisabled = g(member, "communication_disabled_until");
  const unusualDM = g(member, "unusual_dm_activity_until");
  const roles = Array.isArray(member.roles) ? member.roles : [];

  const account_created_at = cfg.account_checks.check_discord_creation_time
    ? snowflakeToDate(userId)
    : null;

  const account_age_days = account_created_at ? daysSince(account_created_at) : null;
  const server_age_days = joinedAt ? daysSince(joinedAt) : null;

  const triggers = {
    account_new: "0",
    server_new: "0",
    missing_avatar: "0",
    missing_banner: "0",
    suspicious_name: "0",
    unusual_dm: "0",
    communication_disabled: "0",
    no_roles: "0",
    auto_banned_by_config: "0",
  };

  const reasons = [];
  let risk = 0;

  // --- Checks ---
  if (account_age_days !== null && account_age_days < cfg.account_checks.min_account_age_days) {
    triggers.account_new = "1";
    reasons.push("Account is new");
    risk += cfg.risk_weights.account_new;
  }
  if (
    cfg.account_checks.auto_ban_young_account &&
    account_age_days !== null &&
    account_age_days <= cfg.account_checks.max_account_age_days_for_auto_ban
  ) {
    triggers.auto_banned_by_config = "1";
    reasons.push("Auto-ban young account");
    risk += 40;
  }
  if (server_age_days !== null && server_age_days < cfg.server_join_checks.min_server_age_days) {
    triggers.server_new = "1";
    reasons.push("Recently joined server");
    risk += cfg.risk_weights.server_join_new;
  }
  if (cfg.profile_checks.require_avatar && !avatar) {
    triggers.missing_avatar = "1";
    reasons.push("Missing avatar");
    risk += cfg.risk_weights.missing_avatar;
  }
  if (cfg.profile_checks.require_banner && !banner) {
    triggers.missing_banner = "1";
    reasons.push("Missing banner");
    risk += cfg.risk_weights.missing_banner;
  }
  const nameTest = globalName || username;
  for (const rx of spamRegexes) {
    if (rx.test(nameTest)) {
      triggers.suspicious_name = "1";
      reasons.push("Suspicious username");
      risk += cfg.risk_weights.suspicious_name;
      break;
    }
  }
  if (cfg.role_checks.check_for_no_roles && roles.length === 0) {
    triggers.no_roles = "1";
    reasons.push("No roles");
    risk += cfg.risk_weights.no_roles;
    if (
      cfg.server_join_checks.auto_ban_no_roles.enabled &&
      server_age_days !== null &&
      server_age_days <= cfg.server_join_checks.auto_ban_no_roles.min_server_days
    ) {
      triggers.auto_banned_by_config = "1";
      reasons.push("Auto-ban: new user with no roles");
      risk += 35;
    }
  }
  if (unusualDM) {
    triggers.unusual_dm = "1";
    reasons.push("Unusual DM activity");
    risk += cfg.risk_weights.unusual_dm;
  }
  if (commDisabled) {
    triggers.communication_disabled = "1";
    reasons.push("Communication disabled");
    risk += cfg.risk_weights.communication_disabled;
  }
  if (risk > 100) risk = 100;
  if (risk < 0) risk = 0;

  let action = mapScoreToAction(risk, cfg.action_map);
  let action_reason_source = "score_map";
  if (triggers.unusual_dm === "1") {
    action = cfg.unusual_activity_checks.unusual_dm_action;
    action_reason_source = "unusual_dm";
  }
  if (triggers.communication_disabled === "1") {
    action = cfg.unusual_activity_checks.communication_disabled_action;
    action_reason_source = "communication_disabled";
  }
  if (triggers.auto_banned_by_config === "1") {
    action = 4;
    action_reason_source = "auto_banned_by_config";
  }

  logDebug(`Member evaluation result for ${username}`, { risk, action, triggers, reasons });

  return {
    user_id: userId,
    username,
    global_name: globalName,
    account_created_at,
    joined_server_at: joinedAt,
    account_age_days,
    server_age_days,
    roles_count: roles.length,
    risk_score: Math.round(risk),
    action,
    action_label: actionLabel(action),
    action_reason_source,
    reasons,
    triggers,
  };
}

// ----------------------------
// Run evaluation
// ----------------------------
logInfo(`Total members to process: ${members.length}`);
const results = members.map(processMember);
results.sort((a, b) => b.risk_score - a.risk_score);

logInfo("Evaluation complete");
// output = { results, logs };
output = { results };
