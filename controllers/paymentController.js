const paymentModel = require('../models/paymentModel');
const mpesaService = require('../services/mpesaService');

async function list(req, res, next) {
  try {
    const { status, limit, offset } = req.query;
    const payments = await paymentModel.findAll({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json({ payments });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const payment = await paymentModel.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment });
  } catch (err) { next(err); }
}

/**
 * Manually re-query Daraja for a payment's status — useful when a
 * customer says "I paid" but the callback never landed (network blips).
 */
async function requery(req, res, next) {
  try {
    const payment = await paymentModel.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.json({ payment });

    const result = await mpesaService.stkQuery({ checkoutRequestId: payment.checkout_request_id });
    res.json({ payment, darajaStatus: result });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, requery };
