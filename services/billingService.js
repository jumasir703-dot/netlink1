/**
 * Billing orchestration.
 *
 * Called once a payment is confirmed successful (M-Pesa callback, or
 * an admin manually marking cash payment as paid). Decides whether to:
 *   - issue + activate a prepaid hotspot voucher, or
 *   - provision/renew a PPPoE account
 * and pushes the corresponding change to the MikroTik router.
 */
const planModel = require('../models/planModel');
const voucherModel = require('../models/voucherModel');
const pppoeModel = require('../models/pppoeModel');
const customerModel = require('../models/customerModel');
const routerModel = require('../models/routerModel');
const paymentModel = require('../models/paymentModel');
const mikrotik = require('./mikrotikService');
const { generateVoucherCode, generatePassword } = require('../utils/generateVoucher');
const logger = require('../utils/logger');

/** Convert plan duration to RouterOS limit-uptime format, e.g. "1d", "24h". */
function toRouterOsDuration(plan) {
  const unitMap = { minutes: 'm', hours: 'h', days: 'd', months: 'd' };
  const value = plan.duration_unit === 'months' ? plan.duration_value * 30 : plan.duration_value;
  return `${value}${unitMap[plan.duration_unit] || 'h'}`;
}

async function fulfillPrepaidHotspot({ payment, plan, customer, router }) {
  const code = generateVoucherCode();
  // Standard hotspot voucher UX: the printed/displayed code IS the password —
  // one code to read out or type, no separate secret to track or lose.
  const password = code;

  const voucher = await voucherModel.create({ code, planId: plan.id, routerId: router?.id });

  const expiresAt = new Date(Date.now() + planModel.durationToMs(plan));

  // Push the hotspot user to the router
  await mikrotik.createHotspotUser(router, {
    username: code,
    password,
    profile: plan.mikrotik_profile,
    limitUptime: toRouterOsDuration(plan),
    limitBytesTotal: plan.data_cap_mb ? plan.data_cap_mb * 1024 * 1024 : undefined,
    comment: `voucher:${code} customer:${customer?.id || 'guest'}`,
  });

  const activated = await voucherModel.activate(voucher.id, { customerId: customer?.id, expiresAt });
  await paymentModel.attachVoucher(payment.id, voucher.id);

  logger.info('Prepaid hotspot voucher activated', { code, plan: plan.name, customer: customer?.phone });

  return { type: 'voucher', voucher: activated, credentials: { username: code, password } };
}

async function fulfillPostpaidPppoe({ payment, plan, customer, router }) {
  let account = (await pppoeModel.findByCustomer(customer.id))[0];

  const nextDueDate = new Date(Date.now() + planModel.durationToMs(plan));
  const nextDueDateStr = nextDueDate.toISOString().slice(0, 10);

  if (account) {
    // Renewal: update profile on router (in case plan changed) and extend due date
    await mikrotik.updatePppoeSecretProfile(router, account.username, plan.mikrotik_profile);
    await mikrotik.enablePppoeSecret(router, account.username);
    account = await pppoeModel.renew(account.id, { nextDueDate: nextDueDateStr, planId: plan.id });
  } else {
    // New provisioning
    const username = `${customer.phone.replace(/\D/g, '').slice(-9)}`;
    const password = generatePassword(8);

    await mikrotik.createPppoeSecret(router, {
      username,
      password,
      profile: plan.mikrotik_profile,
      comment: `customer:${customer.id}`,
    });

    account = await pppoeModel.create({
      customerId: customer.id,
      routerId: router?.id,
      planId: plan.id,
      username,
      password,
      profile: plan.mikrotik_profile,
      nextDueDate: nextDueDateStr,
    });
  }

  await paymentModel.attachPppoeAccount(payment.id, account.id);
  logger.info('PPPoE account provisioned/renewed', { username: account.username, plan: plan.name });

  return { type: 'pppoe', account };
}

/**
 * Main entry point: fulfil a successful payment by provisioning access.
 */
async function fulfillPayment(payment) {
  const plan = await planModel.findById(payment.plan_id);
  if (!plan) throw new Error(`Plan ${payment.plan_id} not found for payment ${payment.id}`);

  const customer = payment.customer_id ? await customerModel.findById(payment.customer_id) : null;
  const router = customer?.router_id
    ? await routerModel.findById(customer.router_id)
    : (await routerModel.findAll({ activeOnly: true }))[0];

  if (!router) throw new Error('No active router configured to provision access');

  if (plan.plan_type === 'prepaid' && plan.connection_type === 'hotspot') {
    return fulfillPrepaidHotspot({ payment, plan, customer, router });
  }

  if (plan.connection_type === 'pppoe') {
    if (!customer) throw new Error('PPPoE provisioning requires a linked customer');
    return fulfillPostpaidPppoe({ payment, plan, customer, router });
  }

  throw new Error(`Unsupported plan configuration: ${plan.plan_type}/${plan.connection_type}`);
}

module.exports = { fulfillPayment, toRouterOsDuration };
