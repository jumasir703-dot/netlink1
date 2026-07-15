const cron = require('node-cron');
const voucherModel = require('../models/voucherModel');
const pppoeModel = require('../models/pppoeModel');
const routerModel = require('../models/routerModel');
const mikrotik = require('../services/mikrotikService');
const logger = require('../utils/logger');

async function expireVouchers() {
  const expired = await voucherModel.findExpiredActive();
  for (const voucher of expired) {
    try {
      const router = voucher.router_id
        ? await routerModel.findById(voucher.router_id)
        : (await routerModel.findAll({ activeOnly: true }))[0];

      if (router) {
        await mikrotik.disconnectHotspotUser(router, voucher.code);
        await mikrotik.removeHotspotUser(router, voucher.code);
      }
      await voucherModel.markExpired(voucher.id);
      logger.info('Voucher expired and removed from router', { code: voucher.code });
    } catch (err) {
      logger.error('Failed to expire voucher', { code: voucher.code, error: err.message });
    }
  }
}

async function suspendOverduePppoe() {
  const overdue = await pppoeModel.findDueForSuspension();
  for (const account of overdue) {
    try {
      const router = await routerModel.findById(account.router_id);
      if (router) {
        await mikrotik.disablePppoeSecret(router, account.username);
        await mikrotik.disconnectPppoeSession(router, account.username);
      }
      await pppoeModel.updateStatus(account.id, 'suspended');
      logger.info('PPPoE account suspended for non-payment', { username: account.username });
    } catch (err) {
      logger.error('Failed to suspend PPPoE account', { username: account.username, error: err.message });
    }
  }
}

async function runExpiryCheck() {
  logger.info('Running expiry check...');
  await Promise.allSettled([expireVouchers(), suspendOverduePppoe()]);
}

function start() {
  const schedule = process.env.EXPIRY_CHECK_CRON || '*/5 * * * *';
  cron.schedule(schedule, runExpiryCheck);
  logger.info(`Expiry checker scheduled: ${schedule}`);
}

module.exports = { start, runExpiryCheck };
