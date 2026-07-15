const voucherModel = require('../models/voucherModel');
const planModel = require('../models/planModel');
const routerModel = require('../models/routerModel');
const mikrotik = require('../services/mikrotikService');
const { generateVoucherCode } = require('../utils/generateVoucher');
const { toRouterOsDuration } = require('../services/billingService');
const logger = require('../utils/logger');

/**
 * Batch-generate vouchers ahead of time (e.g. to print for a shop counter).
 * These are created 'unused' — not yet pushed to the router or activated.
 * Activation (pushing to the router + starting the expiry clock) happens
 * when a customer actually redeems one, via `redeem`.
 */
async function generateBatch(req, res, next) {
  try {
    const { planId, routerId, quantity = 1 } = req.body;
    if (!planId) return res.status(400).json({ error: 'planId is required' });
    if (quantity < 1 || quantity > 500) {
      return res.status(400).json({ error: 'quantity must be between 1 and 500' });
    }

    const plan = await planModel.findById(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.plan_type !== 'prepaid' || plan.connection_type !== 'hotspot') {
      return res.status(400).json({ error: 'Vouchers can only be generated for prepaid hotspot plans' });
    }

    const vouchers = [];
    for (let i = 0; i < quantity; i++) {
      const code = generateVoucherCode();
      const voucher = await voucherModel.create({ code, planId, routerId });
      vouchers.push(voucher);
    }

    res.status(201).json({ vouchers });
  } catch (err) { next(err); }
}

/** Look up a voucher by code (e.g. for a self-service redemption page). */
async function lookup(req, res, next) {
  try {
    const voucher = await voucherModel.findByCode(req.params.code);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ voucher });
  } catch (err) { next(err); }
}

/**
 * Redeem a pre-generated voucher: push a hotspot user to the router
 * and start its expiry clock now.
 */
async function redeem(req, res, next) {
  try {
    const { code } = req.params;
    const voucher = await voucherModel.findByCode(code);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'unused') {
      return res.status(409).json({ error: `Voucher already ${voucher.status}` });
    }

    const plan = await planModel.findById(voucher.plan_id);
    const router = voucher.router_id
      ? await routerModel.findById(voucher.router_id)
      : (await routerModel.findAll({ activeOnly: true }))[0];
    if (!router) return res.status(500).json({ error: 'No active router configured' });

    const password = voucher.code; // username = password = code, standard hotspot voucher UX
    const expiresAt = new Date(Date.now() + planModel.durationToMs(plan));

    await mikrotik.createHotspotUser(router, {
      username: voucher.code,
      password,
      profile: plan.mikrotik_profile,
      limitUptime: toRouterOsDuration(plan),
      limitBytesTotal: plan.data_cap_mb ? plan.data_cap_mb * 1024 * 1024 : undefined,
      comment: `voucher:${voucher.code}`,
    });

    const activated = await voucherModel.activate(voucher.id, { expiresAt });
    logger.info('Voucher redeemed', { code: voucher.code });

    res.json({ voucher: activated, credentials: { username: voucher.code, password } });
  } catch (err) { next(err); }
}

module.exports = { generateBatch, lookup, redeem };
