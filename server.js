require('dotenv').config();
const app = require('./app');
const expiryChecker = require('./jobs/expiryChecker');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  logger.info(`Netlink Billing API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  expiryChecker.start();
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled promise rejection:', err);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  process.exit(0);
});
