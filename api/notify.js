// POST /api/notify -- sends a Telegram message securely (token stays server-side)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ error: 'Telegram not configured' });

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const data = await tgRes.json();
    return res.status(200).json({ ok: data.ok });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
