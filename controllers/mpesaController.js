const mpesaService = require('../services/mpesaService');
const paymentModel = require('../models/paymentModel');
const planModel = require('../models/planModel');
const customerModel = require('../models/customerModel');
const billingService = require('../services/billingService');
const logger = require('../utils/logger');

/**
 * Public endpoint: customer requests a plan, we trigger an STK push
 * to their phone. A `payments` row is created in 'pending' state and
 * finalized asynchronously by `callback` once Safaricom confirms.
 */
async function initiate(req, res, next) {
  try {
    const { phone, planId, fullName } = req.body;
    if (!phone || !planId) {
      return res.status(400).json({ error: 'phone and planId are required' });
    }

    const plan = await planModel.findById(planId);
    if (!plan || !plan.is_active) return res.status(404).json({ error: 'Plan not found or inactive' });

    const customer = await customerModel.findOrCreateByPhone({
      phone: mpesaService.normalizePhone(phone),
      fullName,
      connectionType: plan.connection_type,
    });

    const stkResponse = await mpesaService.stkPush({
      phone,
      amount: plan.price,
      accountReference: customer.phone,
      transactionDesc: `${plan.name} subscription`,
    });

    if (stkResponse.ResponseCode !== '0') {
      return res.status(502).json({ error: 'STK push failed', details: stkResponse });
    }

    const payment = await paymentModel.create({
      customerId: customer.id,
      planId: plan.id,
      phone: customer.phone,
      amount: plan.price,
      merchantRequestId: stkResponse.MerchantRequestID,
      checkoutRequestId: stkResponse.CheckoutRequestID,
    });

    res.status(202).json({
      message: 'STK push sent. Ask the customer to enter their M-Pesa PIN.',
      payment,
      customerMessage: stkResponse.CustomerMessage,
    });
  } catch (err) { next(err); }
}

/**
 * Daraja calls this URL with the outcome of the STK push.
 * MUST respond 200 quickly regardless of outcome, or Safaricom will retry
 * aggressively — so we ack first-class errors internally rather than
 * propagating a non-200 back to Safaricom.
 */
async function callback(req, res) {
  try {
    const parsed = mpesaService.parseCallback(req.body);
    if (!parsed) {
      logger.warn('Received malformed M-Pesa callback', req.body);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const payment = await paymentModel.findByCheckoutId(parsed.checkoutRequestId);
    if (!payment) {
      logger.warn('Callback for unknown checkoutRequestId', parsed.checkoutRequestId);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (!parsed.success) {
      await paymentModel.markFailed(parsed.checkoutRequestId, {
        resultDesc: parsed.resultDesc,
        rawCallback: req.body,
      });
      logger.info('Payment failed/cancelled', { checkoutRequestId: parsed.checkoutRequestId, reason: parsed.resultDesc });
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const updated = await paymentModel.markSuccess(parsed.checkoutRequestId, {
      mpesaReceipt: parsed.mpesaReceipt,
      resultDesc: parsed.resultDesc,
      rawCallback: req.body,
    });

    // Provision access on the router. If this throws, the payment stays
    // marked 'success' but unfulfilled — surfaced via GET /api/payments
    // for manual admin follow-up rather than silently losing the payment.
    try {
      await billingService.fulfillPayment(updated);
    } catch (fulfillErr) {
      logger.error('Payment succeeded but fulfillment failed', {
        paymentId: updated.id,
        error: fulfillErr.message,
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    logger.error('Callback handler error', err);
    // Still ack 200 so Safaricom doesn't hammer retries; error is logged for follow-up.
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}

/**
 * Public: lets the payment page poll for confirmation without admin auth.
 * Deliberately returns only what a paying customer needs to see —
 * never the full payment row (no internal ids beyond what they already have).
 */
async function status(req, res, next) {
  try {
    const payment = await paymentModel.findWithFulfillment(req.params.checkoutRequestId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({
      status: payment.status,
      amount: payment.amount,
      mpesaReceipt: payment.status === 'success' ? payment.mpesa_receipt : undefined,
      resultDesc: payment.status === 'failed' ? payment.result_desc : undefined,
      voucherCode: payment.voucher_code || undefined,
      voucherExpiresAt: payment.voucher_expires_at || undefined,
      pppoeUsername: payment.pppoe_username || undefined,
      pppoeNextDueDate: payment.pppoe_next_due_date || undefined,
    });
  } catch (err) { next(err); }
}

module.exports = { initiate, callback, status };
