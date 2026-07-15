const planModel = require('../models/planModel');

async function list(req, res, next) {
  try {
    const { connectionType, planType, all } = req.query;
    const plans = await planModel.findAll({
      activeOnly: all !== 'true',
      connectionType,
      planType,
    });
    res.json({ plans });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const plan = await planModel.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const {
      name, planType, connectionType, price, durationValue, durationUnit,
      dataCapMb, downloadSpeed, uploadSpeed, rateLimit, mikrotikProfile,
    } = req.body;

    if (!name || !planType || !connectionType || price == null || !mikrotikProfile) {
      return res.status(400).json({
        error: 'name, planType, connectionType, price, and mikrotikProfile are required',
      });
    }
    if (!['prepaid', 'postpaid'].includes(planType)) {
      return res.status(400).json({ error: 'planType must be prepaid or postpaid' });
    }
    if (!['hotspot', 'pppoe'].includes(connectionType)) {
      return res.status(400).json({ error: 'connectionType must be hotspot or pppoe' });
    }

    const plan = await planModel.create({
      name, planType, connectionType, price, durationValue, durationUnit,
      dataCapMb, downloadSpeed, uploadSpeed, rateLimit, mikrotikProfile,
    });
    res.status(201).json({ plan });
  } catch (err) { next(err); }
}

async function setActive(req, res, next) {
  try {
    const { isActive } = req.body;
    const plan = await planModel.setActive(req.params.id, !!isActive);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, setActive };
