const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { requireAuth } = require('../middleware/auth');

router.get('/', planController.list);
router.get('/:id', planController.getOne);
router.post('/', requireAuth, planController.create);
router.patch('/:id/active', requireAuth, planController.setActive);

module.exports = router;
