/**
 * Safaricom Daraja API — STK Push (Lipa na M-Pesa Online).
 */
const axios = require('axios');

const BASE_URL = () =>
  process.env.DARAJA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

let cachedToken = null;
let tokenExpiresAt = 0;

/** Fetch (and cache) an OAuth access token from Daraja. */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const key = process.env.DARAJA_CONSUMER_KEY;
  const secret = process.env.DARAJA_CONSUMER_SECRET;
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const { data } = await axios.get(
    `${BASE_URL()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  cachedToken = data.access_token;
  // Daraja tokens are valid ~1hr; refresh a minute early
  tokenExpiresAt = Date.now() + (Number(data.expires_in || 3599) - 60) * 1000;
  return cachedToken;
}

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function buildPassword(timestamp) {
  const shortcode = process.env.DARAJA_SHORTCODE;
  const passkey = process.env.DARAJA_PASSKEY;
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/** Normalize a Kenyan phone number to Daraja's expected 2547XXXXXXXX format. */
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = `254${p.slice(1)}`;
  if (p.startsWith('7') || p.startsWith('1')) p = `254${p}`;
  return p;
}

/**
 * Initiate an STK Push prompt on the customer's phone.
 * `accountReference` and `transactionDesc` show up on the customer's prompt.
 */
async function stkPush({ phone, amount, accountReference, transactionDesc }) {
  const token = await getAccessToken();
  const timestamp = timestampNow();
  const password = buildPassword(timestamp);
  const normalizedPhone = normalizePhone(phone);

  const payload = {
    BusinessShortCode: process.env.DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: process.env.DARAJA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: normalizedPhone,
    PartyB: process.env.DARAJA_SHORTCODE,
    PhoneNumber: normalizedPhone,
    CallBackURL: process.env.DARAJA_CALLBACK_URL,
    AccountReference: accountReference || 'NetlinkBilling',
    TransactionDesc: transactionDesc || 'Internet subscription',
  };

  const { data } = await axios.post(
    `${BASE_URL()}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // data: { MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription, CustomerMessage }
  return data;
}

/** Query the status of a previously-initiated STK push (fallback if callback is delayed/lost). */
async function stkQuery({ checkoutRequestId }) {
  const token = await getAccessToken();
  const timestamp = timestampNow();
  const password = buildPassword(timestamp);

  const payload = {
    BusinessShortCode: process.env.DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const { data } = await axios.post(
    `${BASE_URL()}/mpesa/stkpushquery/v1/query`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

/**
 * Parse the Daraja STK callback payload into a flat, useful shape.
 * Handles both success (with CallbackMetadata) and failure (ResultCode != 0).
 */
function parseCallback(body) {
  const stk = body?.Body?.stkCallback;
  if (!stk) return null;

  const result = {
    merchantRequestId: stk.MerchantRequestID,
    checkoutRequestId: stk.CheckoutRequestID,
    resultCode: stk.ResultCode,
    resultDesc: stk.ResultDesc,
    success: stk.ResultCode === 0,
    amount: null,
    mpesaReceipt: null,
    phone: null,
    transactionDate: null,
  };

  if (result.success && Array.isArray(stk.CallbackMetadata?.Item)) {
    for (const item of stk.CallbackMetadata.Item) {
      if (item.Name === 'Amount') result.amount = item.Value;
      if (item.Name === 'MpesaReceiptNumber') result.mpesaReceipt = item.Value;
      if (item.Name === 'PhoneNumber') result.phone = String(item.Value);
      if (item.Name === 'TransactionDate') result.transactionDate = item.Value;
    }
  }

  return result;
}

module.exports = { stkPush, stkQuery, parseCallback, normalizePhone };
