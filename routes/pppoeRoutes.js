const express = require('express');
const router = express.Router();
const pppoeController = require('../controllers/pppoeController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/:id', pppoeController.getOne);
router.post('/:id/suspend', pppoeController.suspend);
router.post('/:id/reactivate', pppoeController.reactivate);

module.exports = router;
