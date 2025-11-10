// /api/contact.js  (Vercel Serverless Function)
const { Resend } = require('resend');
const querystring = require('querystring');

// parse form-encoded (and JSON) bodies — Vercel functions don't auto-parse for static sites
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
  return {}; // fallback
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const body = await parseBody(req);
  const { name, email, phone, city, message, _redirect } = body || {};

  if (!name || !email || !message) {
    return res.status(400).send('Missing required fields: name, email, message');
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'Lafayette Homes <inbox@buildwithlafayette.com>', // must be a verified sender in Resend
      to: ['hello@buildwithlafayette.com'],
      reply_to: email,
      subject: `New inquiry from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || ''}`,
        `City: ${city || ''}`,
        '',
        'Message:',
        message
      ].join('\n')
    });

    // redirect user to thank-you (303 = GET redirect)
    const redirectUrl = _redirect || 'https://buildwithlafayette.com/thank-you.html';
    res.setHeader('Location', redirectUrl);
    return res.status(303).end();
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).send('Email send failed. Try again later.');
  }
};
