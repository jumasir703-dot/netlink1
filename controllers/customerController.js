const customerModel = require('../models/customerModel');
const pppoeModel = require('../models/pppoeModel');

async function list(req, res, next) {
  try {
    const { status, connectionType, limit, offset } = req.query;
    const customers = await customerModel.findAll({
      status,
      connectionType,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json({ customers });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const customer = await customerModel.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const pppoeAccounts = await pppoeModel.findByCustomer(customer.id);
    res.json({ customer, pppoeAccounts });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { fullName, phone, email, address, connectionType, routerId } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ error: 'fullName and phone are required' });
    }
    const existing = await customerModel.findByPhone(phone);
    if (existing) return res.status(409).json({ error: 'Customer with this phone already exists' });

    const customer = await customerModel.create({ fullName, phone, email, address, connectionType, routerId });
    res.status(201).json({ customer });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const customer = await customerModel.update(req.params.id, req.body);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer });
  } catch (err) { next(err); }
}

async function setStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'status must be active, suspended, or disabled' });
    }
    const customer = await customerModel.updateStatus(req.params.id, status);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, setStatus };
