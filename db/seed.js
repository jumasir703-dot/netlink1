require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');
const adminModel = require('../models/adminModel');
const planModel = require('../models/planModel');

async function seed() {
  console.log('[seed] creating default admin ...');
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@netlink.local';
  const existing = await adminModel.findByEmail(email);
  if (!existing) {
    const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!', 12);
    await adminModel.create({ name: 'Netlink Admin', email, passwordHash, role: 'superadmin' });
    console.log(`[seed] admin created: ${email} / ${process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'} (CHANGE THIS PASSWORD)`);
  } else {
    console.log('[seed] admin already exists, skipping');
  }

  console.log('[seed] creating example plans ...');
  const examplePlans = [
    {
      name: '1 Hour Hotspot', planType: 'prepaid', connectionType: 'hotspot',
      price: 10, durationValue: 1, durationUnit: 'hours',
      dataCapMb: null, mikrotikProfile: 'hotspot-1hr',
    },
    {
      name: '24 Hour Hotspot', planType: 'prepaid', connectionType: 'hotspot',
      price: 50, durationValue: 24, durationUnit: 'hours',
      dataCapMb: null, mikrotikProfile: 'hotspot-24hr',
    },
    {
      name: '7 Day Hotspot', planType: 'prepaid', connectionType: 'hotspot',
      price: 250, durationValue: 7, durationUnit: 'days',
      dataCapMb: null, mikrotikProfile: 'hotspot-7day',
    },
    {
      name: 'Home 5Mbps Monthly', planType: 'postpaid', connectionType: 'pppoe',
      price: 2000, durationValue: 1, durationUnit: 'months',
      downloadSpeed: '5M', uploadSpeed: '5M', mikrotikProfile: 'pppoe-5mbps',
    },
    {
      name: 'Home 10Mbps Monthly', planType: 'postpaid', connectionType: 'pppoe',
      price: 3500, durationValue: 1, durationUnit: 'months',
      downloadSpeed: '10M', uploadSpeed: '10M', mikrotikProfile: 'pppoe-10mbps',
    },
  ];

  for (const p of examplePlans) {
    await planModel.create(p);
  }
  console.log(`[seed] ${examplePlans.length} example plans created`);

  await pool.end();
  console.log('[seed] done ✔');
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
