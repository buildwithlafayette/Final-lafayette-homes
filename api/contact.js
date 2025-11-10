// /api/contact.js — Vercel Serverless Function (POST + GET + OPTIONS)
const { Resend } = require('resend');
const querystring = require('querystring');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const ct = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();

  if (ct === 'application/json') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (ct === 'application/x-www-form-urlencoded' || ct === '') {
    return querystring.parse(raw);
  }
  return {};
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, where: '/api/contact', expect: 'POST', time: new Date().toISOString() });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(405).send('Method Not Allowed');
  }

  const body = await parseBody(req);
  const { name, email, phone, city, message, form_source, property, listing_id, listing_url, _redirect } = body || {};

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).send('Server misconfigured: RESEND_API_KEY missing');
  }
  if (!name || !email || !message) {
    return res.status(400).send('Missing required fields: name, email, message');
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const lines = [
      `Source: ${form_source || 'Website Contact'}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || ''}`,
      `City: ${city || ''}`,
    ];
    if (property) lines.push(`Property: ${property}`);
    if (listing_id) lines.push(`Listing ID: ${listing_id}`);
    if (listing_url) lines.push(`Listing URL: ${listing_url}`);
    lines.push('', 'Message:', String(message || ''));

    await resend.emails.send({
      from: 'Lafayette Homes <inbox@buildwithlafayette.com>',
      to: ['hello@buildwithlafayette.com'],
      reply_to: email,
      subject: `New inquiry (${form_source || 'Website'}) — ${name}`,
      text: lines.join('\n'),
    });

    const redirectUrl = _redirect || 'https://buildwithlafayette.com/thank-you.html';
    res.setHeader('Location', redirectUrl);
    return res.status(303).end();
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).send('Email send failed');
  }
};
