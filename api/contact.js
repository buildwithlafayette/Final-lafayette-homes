// /api/contact.js  (Vercel Serverless Function)
const { Resend } = require('resend');
const querystring = require('querystring');

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const ct = (req.headers['content-type'] || '').split(';')[0].trim();

  if (ct === 'application/json') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (ct === 'application/x-www-form-urlencoded') {
    return querystring.parse(raw);
  }
  return {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const body = await parseBody(req);
  const { name, email, phone, city, message, form_source, property, listing_id, listing_url, _redirect } = body || {};

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
    lines.push('', 'Message:', (message || '').toString());

    await resend.emails.send({
      from: 'Lafayette Homes <inbox@buildwithlafayette.com>',
      to: ['hello@buildwithlafayette.com'],
      reply_to: email,
      subject: `New inquiry (${form_source || 'Website'}) — ${name}`,
      text: lines.join('\n')
    });

    const redirectUrl = _redirect || 'https://buildwithlafayette.com/thank-you.html';
    res.setHeader('Location', redirectUrl);
    return res.status(303).end();
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).send('Email send failed. Try again later.');
  }
};
