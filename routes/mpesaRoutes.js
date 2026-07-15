const express = require('express');
const router = express.Router();
const mpesaController = require('../controllers/mpesaController');

router.post('/stkpush', mpesaController.initiate);
router.post('/callback', mpesaController.callback);
router.get('/status/:checkoutRequestId', mpesaController.status);

module.exports = router;
