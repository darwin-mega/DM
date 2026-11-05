export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).end();
  }
  const { MPP_EXPORT_URL, MPP_EXPORT_TOKEN, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!MPP_EXPORT_URL || !MPP_EXPORT_TOKEN || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return response.status(503).end();
  }
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return response.status(401).end();
  const xml = request.body;
  if (typeof xml !== 'string' || !xml.trim()) return response.status(400).end();
  if (Buffer.byteLength(xml) > 1024 * 1024) return response.status(413).end();
  try {
    const user = await fetch(new URL('/rest/v1/rpc/dm_pilot_is_editor', SUPABASE_URL), {
      method: 'POST',
      headers: { authorization, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
    if (!user.ok) return response.status(user.status >= 500 ? 502 : 401).end();
    if (await user.json() !== true) return response.status(403).end();
    const file = await fetch(MPP_EXPORT_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${MPP_EXPORT_TOKEN}`, 'content-type': 'application/xml' },
      body: xml,
      signal: AbortSignal.timeout(20000),
    });
    if (!file.ok) return response.status(502).end();
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) {
      return response.status(502).end();
    }
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Disposition', 'attachment; filename="proyecto.mpp"');
    return response.status(200).send(bytes);
  } catch {
    return response.status(502).end();
  }
}
