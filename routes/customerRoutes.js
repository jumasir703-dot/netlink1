const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', customerController.list);
router.get('/:id', customerController.getOne);
router.post('/', customerController.create);
router.patch('/:id', customerController.update);
router.patch('/:id/status', customerController.setStatus);

module.exports = router;
