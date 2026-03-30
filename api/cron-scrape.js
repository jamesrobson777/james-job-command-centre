// GET /api/cron-scrape -- Vercel cron job that scrapes + sends Telegram digest
// Triggered by vercel.json cron schedule (6am + 6pm UTC = 8am + 8pm Berlin)

export default async function handler(req, res) {
  // Verify cron authorization in production
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}` && process.env.VERCEL) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Call our own scraper endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const scrapeRes = await fetch(`${baseUrl}/api/scrape-jobs`);
    const data = await scrapeRes.json();

    if (!data.jobs || data.jobs.length === 0) {
      // Send "no jobs" notification
      await sendTelegram(`No new job listings found.\n\nScraped at ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Berlin' })}`);
      return res.status(200).json({ sent: true, jobs: 0 });
    }

    // Build Telegram digest grouped by category
    const cats = { csm: [], am: [], marketing: [] };
    data.jobs.forEach(j => {
      if (cats[j.cat]) cats[j.cat].push(j);
    });

    let msg = `<b>Job Search Update</b>\n`;
    msg += `${data.total} listings from ${Object.entries(data.sources).filter(([,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join(', ')}\n\n`;

    const labels = { csm: 'Customer Success', am: 'Account Manager', marketing: 'Marketing' };
    for (const [cat, jobs] of Object.entries(cats)) {
      if (jobs.length === 0) continue;
      msg += `<b>${labels[cat]}</b> (${jobs.length})\n`;
      jobs.slice(0, 5).forEach(j => {
        msg += `\u2022 <a href="${j.url}">${j.title}</a> at ${j.co}\n`;
      });
      if (jobs.length > 5) msg += `  ...and ${jobs.length - 5} more\n`;
      msg += '\n';
    }

    msg += `Scraped: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Berlin' })}`;
    await sendTelegram(msg);

    return res.status(200).json({ sent: true, jobs: data.total });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function sendTelegram(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
}
