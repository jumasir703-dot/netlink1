const pppoeModel = require('../models/pppoeModel');
const routerModel = require('../models/routerModel');
const mikrotik = require('../services/mikrotikService');
const logger = require('../utils/logger');

async function getOne(req, res, next) {
  try {
    const account = await pppoeModel.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'PPPoE account not found' });
    res.json({ account });
  } catch (err) { next(err); }
}

async function suspend(req, res, next) {
  try {
    const account = await pppoeModel.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'PPPoE account not found' });

    const router = await routerModel.findById(account.router_id);
    await mikrotik.disablePppoeSecret(router, account.username);
    await mikrotik.disconnectPppoeSession(router, account.username);
    const updated = await pppoeModel.updateStatus(account.id, 'suspended');

    logger.info('PPPoE account suspended', { username: account.username });
    res.json({ account: updated });
  } catch (err) { next(err); }
}

async function reactivate(req, res, next) {
  try {
    const account = await pppoeModel.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'PPPoE account not found' });

    const router = await routerModel.findById(account.router_id);
    await mikrotik.enablePppoeSecret(router, account.username);
    const updated = await pppoeModel.updateStatus(account.id, 'active');

    logger.info('PPPoE account reactivated', { username: account.username });
    res.json({ account: updated });
  } catch (err) { next(err); }
}

module.exports = { getOne, suspend, reactivate };
