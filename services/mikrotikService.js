/**
 * MikroTik RouterOS API service.
 *
 * Wraps `node-routeros` to manage hotspot users and PPPoE secrets.
 * Each call opens a short-lived connection to the target router, runs
 * the command, and closes — fine for billing-triggered actions which
 * are infrequent relative to normal traffic.
 */
const { RouterOSAPI } = require('node-routeros');

/**
 * Open a connection to a router record (from the `routers` table)
 * or fall back to env-configured defaults.
 */
function buildConnection(router) {
  const host = router?.host || process.env.MIKROTIK_HOST;
  const user = router?.api_user || process.env.MIKROTIK_USER;
  const password = router?.api_password || process.env.MIKROTIK_PASSWORD;
  const port = router?.api_port || Number(process.env.MIKROTIK_PORT) || 8728;
  const tls = router?.use_tls ?? (process.env.MIKROTIK_USE_TLS === 'true');

  if (!host || !user || !password) {
    throw new Error('MikroTik connection details missing (host/user/password)');
  }

  return new RouterOSAPI({
    host,
    user,
    password,
    port,
    tls: tls ? {} : undefined,
    timeout: 8,
  });
}

async function withConnection(router, fn) {
  const conn = buildConnection(router);
  await conn.connect();
  try {
    return await fn(conn);
  } finally {
    conn.close();
  }
}

/**
 * Create a hotspot user (voucher redemption).
 * `profile` maps to the RouterOS hotspot user-profile (defines speed/limits).
 * `limitUptime` is RouterOS duration format, e.g. "1d", "24h", "30m".
 */
async function createHotspotUser(router, { username, password, profile, limitUptime, limitBytesTotal, comment }) {
  return withConnection(router, async (conn) => {
    const params = [
      `=name=${username}`,
      `=password=${password}`,
      `=profile=${profile}`,
    ];
    if (limitUptime) params.push(`=limit-uptime=${limitUptime}`);
    if (limitBytesTotal) params.push(`=limit-bytes-total=${limitBytesTotal}`);
    if (comment) params.push(`=comment=${comment}`);

    return conn.write('/ip/hotspot/user/add', params);
  });
}

async function removeHotspotUser(router, username) {
  return withConnection(router, async (conn) => {
    const found = await conn.write('/ip/hotspot/user/print', [`?name=${username}`]);
    if (!found.length) return null;
    return conn.write('/ip/hotspot/user/remove', [`=.id=${found[0]['.id']}`]);
  });
}

/** Kick an active hotspot session (force disconnect), e.g. on expiry. */
async function disconnectHotspotUser(router, username) {
  return withConnection(router, async (conn) => {
    const active = await conn.write('/ip/hotspot/active/print', [`?user=${username}`]);
    if (!active.length) return null;
    return conn.write('/ip/hotspot/active/remove', [`=.id=${active[0]['.id']}`]);
  });
}

/**
 * Create a PPPoE secret (postpaid provisioning).
 */
async function createPppoeSecret(router, { username, password, profile, service = 'pppoe', comment }) {
  return withConnection(router, async (conn) => {
    const params = [
      `=name=${username}`,
      `=password=${password}`,
      `=profile=${profile}`,
      `=service=${service}`,
    ];
    if (comment) params.push(`=comment=${comment}`);
    return conn.write('/ppp/secret/add', params);
  });
}

async function updatePppoeSecretProfile(router, username, profile) {
  return withConnection(router, async (conn) => {
    const found = await conn.write('/ppp/secret/print', [`?name=${username}`]);
    if (!found.length) throw new Error(`PPPoE secret ${username} not found on router`);
    return conn.write('/ppp/secret/set', [`=.id=${found[0]['.id']}`, `=profile=${profile}`]);
  });
}

async function disablePppoeSecret(router, username) {
  return withConnection(router, async (conn) => {
    const found = await conn.write('/ppp/secret/print', [`?name=${username}`]);
    if (!found.length) return null;
    return conn.write('/ppp/secret/set', [`=.id=${found[0]['.id']}`, '=disabled=yes']);
  });
}

async function enablePppoeSecret(router, username) {
  return withConnection(router, async (conn) => {
    const found = await conn.write('/ppp/secret/print', [`?name=${username}`]);
    if (!found.length) return null;
    return conn.write('/ppp/secret/set', [`=.id=${found[0]['.id']}`, '=disabled=no']);
  });
}

/** Disconnect an active PPPoE session (force re-auth after profile change). */
async function disconnectPppoeSession(router, username) {
  return withConnection(router, async (conn) => {
    const active = await conn.write('/ppp/active/print', [`?name=${username}`]);
    if (!active.length) return null;
    return conn.write('/ppp/active/remove', [`=.id=${active[0]['.id']}`]);
  });
}

/** Pull current active hotspot sessions, for session sync jobs. */
async function listActiveHotspotSessions(router) {
  return withConnection(router, (conn) => conn.write('/ip/hotspot/active/print'));
}

async function listActivePppoeSessions(router) {
  return withConnection(router, (conn) => conn.write('/ppp/active/print'));
}

module.exports = {
  createHotspotUser,
  removeHotspotUser,
  disconnectHotspotUser,
  createPppoeSecret,
  updatePppoeSecretProfile,
  disablePppoeSecret,
  enablePppoeSecret,
  disconnectPppoeSession,
  listActiveHotspotSessions,
  listActivePppoeSessions,
};
