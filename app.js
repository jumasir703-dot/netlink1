const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const planRoutes = require('./routes/planRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const mpesaRoutes = require('./routes/mpesaRoutes');
const pppoeRoutes = require('./routes/pppoeRoutes');
const routerRoutes = require('./routes/routerRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'style-src': ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      'font-src': ["'self'", 'fonts.gstatic.com'],
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Generous overall limiter; the STK push endpoint gets a tighter one below
// since it costs real money/SMS-like prompts per call.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

const stkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many payment attempts, please wait a minute and try again.' },
});
app.use('/api/mpesa/stkpush', stkLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Customer-facing payment page (public/index.html) — served at the root,
// separate from the /api routes below.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/pppoe', pppoeRoutes);
app.use('/api/routers', routerRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
