const crypto = require('crypto');

// Excludes ambiguous chars (0/O, 1/I/L) for easier manual entry on hotspot login pages.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateVoucherCode(length = Number(process.env.VOUCHER_CODE_LENGTH) || 8) {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

function generatePassword(length = 6) {
  let pwd = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    pwd += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return pwd;
}

module.exports = { generateVoucherCode, generatePassword };
