const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', paymentController.list);
router.get('/:id', paymentController.getOne);
router.post('/:id/requery', paymentController.requery);

module.exports = router;
