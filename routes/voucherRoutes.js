const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const { requireAuth } = require('../middleware/auth');

router.post('/generate', requireAuth, voucherController.generateBatch);
router.get('/:code', requireAuth, voucherController.lookup);
router.post('/:code/redeem', voucherController.redeem);

module.exports = router;
