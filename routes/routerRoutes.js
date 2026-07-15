const express = require('express');
const router = express.Router();
const routerController = require('../controllers/routerController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', routerController.list);
router.post('/', routerController.create);

module.exports = router;
