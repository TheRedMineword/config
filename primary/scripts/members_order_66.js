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



const base64Members = "$$$base64Members$$$";
const base64Config = "$$$base64Config$$$";



// ----------------------------
// Decode Base64 JSON inputs
// ----------------------------
let members = [];
let membersConfig = {};

try {
  if (base64Members && base64Members.trim() !== "") {
    const decodedMembers = atob(base64Members); // decode base64
    members = JSON.parse(decodedMembers);
    logDebug("Decoded members", members);
  } else {
    logInfo("No base64Members provided");
  }
} catch (e) {
  logError("Failed to decode members input: " + e.message);
}

try {
  if (base64Config && base64Config.trim() !== "") {
    const decodedConfig = atob(base64Config);
    membersConfig = JSON.parse(decodedConfig);
    logDebug("Decoded members_config", membersConfig);
  } else {
    logInfo("No base64Config provided, using defaults");
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
const defaultConfig = {};

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

logDebug(`Check bot user ${user.username}`);
if (user?.bot === true) {
  logDebug(`Skipping bot user ${user.username}`);
  return {
    user_id: String(user.id),
    username: user.username,
    action: 0,
    action_label: "ignore",
    reasons: ["Bot account"],
    triggers: {}
  };
}
logDebug(`Unpossible for a bot user ${user.username}`);
  
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

const susNameGraceDays = cfg.server_join_checks.sus_names_warn_gone_days;
const susNameStillApplies =
  susNameGraceDays == null ||
  server_age_days == null ||
  server_age_days < susNameGraceDays;

if (susNameStillApplies) {
  for (const rx of spamRegexes) {
    if (rx.test(nameTest)) {
      triggers.suspicious_name = "1";

      if (susNameGraceDays != null && server_age_days != null) {
        const remainingDays = Math.max(
          0,
          susNameGraceDays - server_age_days
        ).toFixed(2);

        reasons.push(
          `Suspicious username (expires in ${remainingDays} days)`
        );
      } else {
        reasons.push("Suspicious username");
      }

      risk += cfg.risk_weights.suspicious_name;
      break;
    }
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
//  if (unusualDM) {
//    triggers.unusual_dm = "1";
 //   reasons.push("Unusual DM activity");
 //   risk += cfg.risk_weights.unusual_dm;
 // }

// const unusualDM = g(member, "unusual_dm_activity_until"); // Yeah it fuck up script so keep it noted out
if (unusualDM && new Date(unusualDM) > new Date()) {
    triggers.unusual_dm = "1";
    reasons.push("Unusual DM activity");
    risk += cfg.risk_weights.unusual_dm;
}

  
//  if (commDisabled) {
//    triggers.communication_disabled = "1";
 //   reasons.push("Communication disabled");
 //   risk += cfg.risk_weights.communication_disabled;
//  }

  const isCommunicationDisabled =
    member.communication_disabled_until &&
    new Date(member.communication_disabled_until) > new Date();

if (isCommunicationDisabled) {
    triggers.communication_disabled = 1;
    risk += weights.communication_disabled;
    action = config.unusual_activity_checks.communication_disabled_action;
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
  // --- Kick if user has had no roles for X days ---
if (
  roles.length === 0 &&
  cfg.server_join_checks.kick_if_no_roles_after_days &&
  server_age_days !== null &&
  server_age_days >= cfg.server_join_checks.kick_if_no_roles_after_days
) {
  triggers.no_roles = "1";
  reasons.push(
    `No roles for more than ${cfg.server_join_checks.kick_if_no_roles_after_days} days`
  );
  
  action = 3;
  action_reason_source = "no_roles_timeout";
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
// output = { results };


// Remove members with risk=0 and action=0
const filteredResults = results.filter(r => r.action_label !== "ignore");
output = { results: filteredResults };
// Un note two above pls
