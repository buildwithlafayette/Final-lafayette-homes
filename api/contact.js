// /api/contact.js  (Node runtime)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    res.status(500).send("Server not configured");
    return;
  }

  // Parse x-www-form-urlencoded body
  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => (body += chunk));
    req.on("end", resolve);
  });
  const p = new URLSearchParams(body);
  const get = (k) => (p.get(k) || "").trim();

  const data = {
    name: get("name"),
    email: get("email"),
    phone: get("phone"),
    location: get("location"),
    notes: get("notes"),
    gotcha: get("_gotcha"),
  };

  if (data.gotcha) {
    res.status(200).send("OK");
    return;
  }
  if (!data.name || !data.email) {
    res.status(400).send("Missing fields");
    return;
  }

  const subject = `New inquiry — ${data.name}`;
  const to = "info@buildwithlafayette.com";
  const from = "Lafayette Homes <info@buildwithlafayette.com>";
  const html = `
    <div style="font:16px system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#111">
      <h2>New website inquiry</h2>
      <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
      <p><strong>Build location:</strong> ${escapeHtml(data.location)}</p>
      <p><strong>Notes:</strong><br>${escapeHtml(data.notes).replace(/\n/g, "<br>")}</p>
    </div>
  `;

  const payload = {
    from,
    to,
    subject,
    html,
    reply_to: data.email,
    text: [
      `New website inquiry`,
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone}`,
      `Build location: ${data.location}`,
      ``,
      `Notes:`,
      data.notes || "",
    ].join("\n"),
  };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (r.ok) {
    const url = new URL("/thank-you.html", `https://${req.headers.host}`);
    if (data.name) url.searchParams.set("name", data.name);
    res.writeHead(303, { Location: url.toString() });
    res.end();
    return;
  }

  const errText = await r.text();
  res.status(500).send(`Email send failed: ${errText}`);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
