/**
 * Xano Lambda (Deno) — Advanced Discord Member Risk Scorer
 *
 * Inputs expected:
 *   $input.members           -> Array of member objects (discord member objects)
 *   $input.members_config    -> members_config (advanced config JSON)
 *
 * Output:
 *   { results: [ { user_id, username, ... , risk_score, action, action_label, reasons, triggers } ] }
 *
 * Trigger flags are strings "0" or "1".
 */

const DISCORD_EPOCH = 1420070400000n;

// Helper: safe get
const g = (obj, path, def = null) => {
  try {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj) ?? def;
  } catch (e) {
    return def;
  }
};

// Snowflake -> creation ISO
function snowflakeToDate(snowflake) {
  try {
    // Accept string or number
    const id = BigInt(String(snowflake));
    const timestamp = Number((id >> 22n) + DISCORD_EPOCH);
    return new Date(timestamp).toISOString();
  } catch (e) {
    return null;
  }
}

// Days between now and iso timestamp
function daysSince(iso) {
  if (!iso) return null;
  const now = new Date();
  const then = new Date(iso);
  if (isNaN(then)) return null;
  const diffMs = now - then;
  return diffMs / (1000 * 60 * 60 * 24);
}

// Parse config with defaults
const cfg = (() => {
  const defaultConfig = {
    account_checks: {
      min_account_age_days: 7,
      max_account_age_days_for_auto_ban: 3,
      auto_ban_young_account: true,
      check_discord_creation_time: true
    },
    server_join_checks: {
      min_server_age_days: 2,
      auto_ban_no_roles: {
        enabled: true,
        min_server_days: 1
      }
    },
    profile_checks: {
      require_avatar: true,
      require_banner: false,
      require_global_name: true,
      empty_name_is_suspicious: true
    },
    unusual_activity_checks: {
      auto_action_on_unusual_dm: true,
      auto_action_on_communication_disabled: true,
      unusual_dm_action: 4,
      communication_disabled_action: 3
    },
    username_spam_detection: {
      enabled: true,
      patterns: [
        "^[a-z]{8,12}\\d{3,5}$",
        "^(?:discord|nitro|boost)[^a-z]*$",
        "^[\\w]{16,}$"
      ],
      case_insensitive: true
    },
    role_checks: {
      check_for_no_roles: true,
      treat_no_roles_as_suspicious: true
    },
    risk_weights: {
      account_new: 25,
      server_join_new: 20,
      missing_avatar: 10,
      missing_banner: 5,
      suspicious_name: 30,
      no_roles: 15,
      unusual_dm: 50,
      communication_disabled: 40
    },
    action_map: {
      "0_20": 0,
      "21_40": 1,
      "41_60": 2,
      "61_80": 3,
      "81_999": 4
    }
  };
  const incoming = $input.members_config ?? {};
  // deep merge minimal: override only top-level fields that exist in incoming
  function merge(a, b) {
    for (const k of Object.keys(b)) {
      if (b[k] !== null && typeof b[k] === 'object' && !Array.isArray(b[k])) {
        a[k] = a[k] || {};
        merge(a[k], b[k]);
      } else {
        a[k] = b[k];
      }
    }
    return a;
  }
  return merge(defaultConfig, incoming);
})();

// Compile spam regexes
const spamRegexes = (cfg.username_spam_detection.enabled && Array.isArray(cfg.username_spam_detection.patterns))
  ? cfg.username_spam_detection.patterns.map(p => {
      try {
        return new RegExp(p, cfg.username_spam_detection.case_insensitive ? 'i' : '');
      } catch (e) {
        // invalid regex — ignore
        return null;
      }
    }).filter(Boolean)
  : [];

// Map numeric action to label
function actionLabel(n) {
  switch (n) {
    case 0: return 'ignore';
    case 1: return 'warn';
    case 2: return 'moderate';
    case 3: return 'kick';
    case 4: return 'ban';
    case 5: return 'hard-ban';
    default: return 'unknown';
  }
}

// Map risk score to action using action_map from config
function mapScoreToAction(score, actionMap) {
  const entries = Object.keys(actionMap).map(r => {
    const [min, max] = r.split('_').map(Number);
    return { min, max, action: actionMap[r] };
  });
  // find matching range
  for (const e of entries) {
    if (score >= e.min && score <= e.max) return e.action;
  }
  // fallback
  if (score > 999) return 5;
  if (score >= 81) return 4;
  if (score >= 61) return 3;
  if (score >= 41) return 2;
  if (score >= 21) return 1;
  return 0;
}

// Process single member
function processMember(m) {
  // Normalize: support either top-level 'member' object or already a member object
  const member = m.member ?? m;
  const user = member.user ?? {};

  const userId = String(g(user, 'id') ?? g(member, 'id') ?? '');
  const username = g(user, 'username') ?? '';
  const globalName = g(user, 'global_name') ?? '';
  const avatar = g(user, 'avatar') ?? g(member, 'avatar') ?? null;
  const banner = g(user, 'banner') ?? null;
  const joinedAt = g(member, 'joined_at') ?? null;
  const communication_disabled_until = g(member, 'communication_disabled_until') ?? null;
  const unusual_dm_activity_until = g(member, 'unusual_dm_activity_until') ?? null;
  const roles = Array.isArray(g(member, 'roles')) ? member.roles : (Array.isArray(g(user, 'roles')) ? user.roles : []);

  // Derived
  const account_created_at = cfg.account_checks.check_discord_creation_time ? snowflakeToDate(userId) : null;
  const account_age_days = account_created_at ? daysSince(account_created_at) : null;
  const server_age_days = joinedAt ? daysSince(joinedAt) : null;

  // triggers start at "0"
  const triggers = {
    account_new: "0",
    server_new: "0",
    missing_avatar: "0",
    missing_banner: "0",
    suspicious_name: "0",
    unusual_dm: "0",
    communication_disabled: "0",
    no_roles: "0",
    auto_banned_by_config: "0"
  };

  const reasons = [];
  let risk = 0;

  // 1) Account age checks
  if (account_age_days !== null) {
    if (account_age_days < cfg.account_checks.min_account_age_days) {
      triggers.account_new = "1";
      reasons.push(`Account age ${account_age_days.toFixed(2)}d < min_account_age_days (${cfg.account_checks.min_account_age_days}d)`);
      risk += (cfg.risk_weights.account_new ?? 25);
    }
    // auto ban young account override
    if (cfg.account_checks.auto_ban_young_account && typeof cfg.account_checks.max_account_age_days_for_auto_ban === 'number') {
      if (account_age_days <= cfg.account_checks.max_account_age_days_for_auto_ban) {
        triggers.auto_banned_by_config = "1";
        reasons.push(`Account is younger than or equal to max_account_age_days_for_auto_ban (${cfg.account_checks.max_account_age_days_for_auto_ban}d)`);
        risk += (cfg.risk_weights.account_new ?? 25);
      }
    }
  }

  // 2) Server join checks
  if (server_age_days !== null) {
    if (server_age_days < cfg.server_join_checks.min_server_age_days) {
      triggers.server_new = "1";
      reasons.push(`Joined server ${server_age_days.toFixed(2)}d < min_server_age_days (${cfg.server_join_checks.min_server_age_days}d)`);
      risk += (cfg.risk_weights.server_join_new ?? 20);
    }
  }

  // 3) Profile checks
  if (cfg.profile_checks.require_avatar && !avatar) {
    triggers.missing_avatar = "1";
    reasons.push('Avatar missing');
    risk += (cfg.risk_weights.missing_avatar ?? 10);
  }
  if (cfg.profile_checks.require_banner && !banner) {
    triggers.missing_banner = "1";
    reasons.push('Banner missing');
    risk += (cfg.risk_weights.missing_banner ?? 5);
  }
  if (cfg.profile_checks.empty_name_is_suspicious) {
    const nameEmpty = (!username || username.trim() === '') && (!globalName || globalName.trim() === '');
    if (nameEmpty) {
      triggers.suspicious_name = "1";
      reasons.push('Username/global_name empty');
      risk += (cfg.risk_weights.suspicious_name ?? 30);
    }
  }

  // 4) Username spam detection
  if (cfg.username_spam_detection.enabled && Array.isArray(spamRegexes) && spamRegexes.length) {
    const fullToTest = (globalName || username || '').toString();
    for (const rx of spamRegexes) {
      try {
        if (rx.test(fullToTest)) {
          triggers.suspicious_name = "1";
          reasons.push(`Username/global_name matched spam pattern: ${rx.source}`);
          risk += (cfg.risk_weights.suspicious_name ?? 30);
          break;
        }
      } catch (e) {
        // ignore regex errors per pattern
      }
    }
  }

  // 5) Roles check
  const rolesCount = Array.isArray(roles) ? roles.length : 0;
  if (cfg.role_checks.check_for_no_roles && rolesCount === 0) {
    triggers.no_roles = "1";
    reasons.push('No roles assigned');
    risk += (cfg.risk_weights.no_roles ?? 15);

    // auto ban no_roles if configured
    const arb = cfg.server_join_checks.auto_ban_no_roles;
    if (arb && arb.enabled && (typeof arb.min_server_days === 'number') && server_age_days !== null && server_age_days <= arb.min_server_days) {
      triggers.auto_banned_by_config = "1";
      reasons.push(`No roles and server age ${server_age_days.toFixed(2)}d <= auto_ban_no_roles.min_server_days (${arb.min_server_days}d)`);
      // escalate risk
      risk += 30;
    }
  }

  // 6) Unusual DM / communication disabled checks
  if (unusual_dm_activity_until) {
    triggers.unusual_dm = "1";
    reasons.push(`Unusual DM activity until ${unusual_dm_activity_until}`);
    risk += (cfg.risk_weights.unusual_dm ?? 50);

    if (cfg.unusual_activity_checks.auto_action_on_unusual_dm) {
      triggers.auto_banned_by_config = "1";
      reasons.push(`Config forces action on unusual DM activity (action ${cfg.unusual_activity_checks.unusual_dm_action})`);
    }
  }
  if (communication_disabled_until) {
    triggers.communication_disabled = "1";
    reasons.push(`Communication disabled until ${communication_disabled_until}`);
    risk += (cfg.risk_weights.communication_disabled ?? 40);

    if (cfg.unusual_activity_checks.auto_action_on_communication_disabled) {
      triggers.auto_banned_by_config = "1";
      reasons.push(`Config forces action on communication disabled (action ${cfg.unusual_activity_checks.communication_disabled_action})`);
    }
  }

  // Ensure risk is capped 0..100
  if (risk < 0) risk = 0;
  if (risk > 100) risk = 100;

  // Base action from score
  let action = mapScoreToAction(Math.round(risk), cfg.action_map);
  let action_reason_source = 'score_map';

  // Config-driven overrides (auto actions)
  //  - If unusual DM and config says to auto act: use that action
  if (triggers.unusual_dm === "1" && cfg.unusual_activity_checks.auto_action_on_unusual_dm) {
    action = cfg.unusual_activity_checks.unusual_dm_action ?? action;
    action_reason_source = 'unusual_dm_config';
  }

  if (triggers.communication_disabled === "1" && cfg.unusual_activity_checks.auto_action_on_communication_disabled) {
    action = cfg.unusual_activity_checks.communication_disabled_action ?? action;
    action_reason_source = 'communication_disabled_config';
  }

  // auto_ban_young_account override
  if (triggers.auto_banned_by_config === "1" && cfg.account_checks.auto_ban_young_account && typeof cfg.account_checks.max_account_age_days_for_auto_ban === 'number') {
    // set to ban (4) unless config defines otherwise (we'll set to 4)
    action = 4;
    action_reason_source = 'auto_ban_young_account';
  }

  // auto ban no roles -> prefer ban
  if (triggers.auto_banned_by_config === "1" && cfg.server_join_checks.auto_ban_no_roles && cfg.server_join_checks.auto_ban_no_roles.enabled) {
    action = 4;
    action_reason_source = 'auto_ban_no_roles';
  }

  // Final action label
  const action_label = actionLabel(action);

  // If risk low but explicit triggers flagged auto_banned, ensure action respects that (we've adjusted above)
  // Build final result
  const out = {
    user_id: userId,
    username: username,
    global_name: globalName,
    account_created_at: account_created_at,
    joined_server_at: joinedAt,
    account_age_days: account_age_days === null ? null : Number(account_age_days.toFixed(4)),
    server_age_days: server_age_days === null ? null : Number(server_age_days.toFixed(4)),
    roles_count: rolesCount,
    risk_score: Math.round(risk),
    action: action,
    action_label: action_label,
    action_reason_source: action_reason_source,
    reasons: reasons,
    triggers: triggers
  };

  return out;
}

// MAIN
const members = Array.isArray($input.members) ? $input.members : [];
const results = members.map(processMember);

// Sort results by risk desc
results.sort((a, b) => b.risk_score - a.risk_score);

// Return
return { results };
