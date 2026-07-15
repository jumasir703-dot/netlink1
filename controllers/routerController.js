const routerModel = require('../models/routerModel');

async function list(req, res, next) {
  try {
    const routers = await routerModel.findAll();
    // never expose api_password over the wire
    res.json({ routers: routers.map(({ api_password, ...r }) => r) });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, host, apiPort, apiUser, apiPassword, useTls, siteLabel } = req.body;
    if (!name || !host || !apiUser || !apiPassword) {
      return res.status(400).json({ error: 'name, host, apiUser, and apiPassword are required' });
    }
    const router = await routerModel.create({ name, host, apiPort, apiUser, apiPassword, useTls, siteLabel });
    const { api_password, ...safe } = router;
    res.status(201).json({ router: safe });
  } catch (err) { next(err); }
}

module.exports = { list, create };
