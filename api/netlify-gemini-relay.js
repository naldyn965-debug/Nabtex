/* Netlify Function — Gemini relay (backend #2)
   المسار: netlify/functions/gemini-relay.js → https://<site>.netlify.app/.netlify/functions/gemini-relay
   Environment variables: GEMINI_API_KEY (مفتاح صاحبه)، RELAY_SECRET (نفس GEMINI_RELAY_SECRET على Vercel) */
exports.handler = async function (event) {
  const J = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'method_not_allowed' };
  const secret = process.env.RELAY_SECRET || '';
  if (!secret || (event.headers || {})['x-relay-secret'] !== secret) return { statusCode: 403, body: 'forbidden' };
  let p;
  try { p = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch (e) { return { statusCode: 400, body: 'bad_json' }; }
  const model = String((p && p.model) || '');
  if (!/^[a-z0-9.\-]+$/i.test(model) || !p.body || typeof p.body !== 'object') return { statusCode: 400, body: 'bad_request' };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(p.body)
  });
  return { statusCode: r.status, headers: J, body: await r.text() };
};
