// GET /api/scrape-jobs -- scrapes jobs from multiple sources
// Sources: Berlin Startup Jobs, EnglishJobs.de, LinkedIn, Indeed
import * as cheerio from 'cheerio';

const CATEGORIES = {
  csm: [
    'Customer Success Manager', 'Onboarding Specialist',
    'Implementation Manager', 'Implementation Consultant'
  ],
  am: [
    'Account Manager', 'Account Executive', 'Partnership Manager',
    'Channel Manager', 'Business Development', 'Revenue Operations',
    'Sales Enablement'
  ],
  marketing: [
    'Marketing Manager', 'Marketing Automation', 'Lifecycle Marketing',
    'Growth Marketing', 'Content Marketing'
  ]
};

function categorize(title) {
  const t = title.toLowerCase();
  if (t.includes('customer success') || t.includes('onboarding') || t.includes('implementation') || t.includes('client success'))
    return 'csm';
  if (t.includes('account') || t.includes('partnership') || t.includes('channel') || t.includes('business development') || t.includes('revenue') || t.includes('sales enablement') || t.includes('bd '))
    return 'am';
  if (t.includes('marketing') || t.includes('growth') || t.includes('content') || t.includes('lifecycle') || t.includes('brand'))
    return 'marketing';
  return 'csm'; // default
}

function fitScore(title) {
  const t = title.toLowerCase();
  if (t.includes('senior') || t.includes('head of') || t.includes('director')) return 6;
  if (t.includes('junior') || t.includes('intern')) return 5;
  if (t.includes('manager') || t.includes('lead')) return 8;
  return 7;
}

// ---- BERLIN STARTUP JOBS ----
async function scrapeBerlinStartupJobs() {
  const jobs = [];
  const pages = [
    'https://berlinstartupjobs.com/skill-areas/customer-success/',
    'https://berlinstartupjobs.com/skill-areas/marketing/',
    'https://berlinstartupjobs.com/skill-areas/sales/',
    'https://berlinstartupjobs.com/skill-areas/account-management/',
    'https://berlinstartupjobs.com/skill-areas/business-development/'
  ];

  for (const url of pages) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      // BSJ uses <ul class="jobs-list-items"> with <li> entries
      $('ul.jobs-list-items li, .bsj-jb, .job-listing, article.listing').each((_, el) => {
        const titleEl = $(el).find('h4 a, h3 a, .bsj-jb__title a, .job-title a, a.job-title').first();
        const title = titleEl.text().trim();
        const link = titleEl.attr('href') || '';
        const company = $(el).find('.bsj-jb__company, .company, .job-company').first().text().trim()
          || $(el).find('a[href*="/company/"]').first().text().trim();
        const tags = $(el).find('.bsj-jb__tag, .tag, .badge').map((_, t) => $(t).text().trim()).get();

        if (title && link) {
          jobs.push({
            title, co: company || 'Unknown',
            loc: 'Berlin', ty: 'Full-time',
            url: link.startsWith('http') ? link : 'https://berlinstartupjobs.com' + link,
            source: 'berlinstartupjobs',
            cat: categorize(title), fit: fitScore(title),
            posted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          });
        }
      });
    } catch (e) {
      console.warn('BSJ scrape error:', url, e.message);
    }
  }
  return jobs;
}

// ---- ENGLISHJOBS.DE ----
async function scrapeEnglishJobs() {
  const jobs = [];
  const queries = [
    'customer+success+manager', 'account+manager', 'marketing+manager',
    'business+development', 'partnership+manager', 'growth+marketing'
  ];

  for (const q of queries) {
    try {
      const url = `https://www.englishjobs.de/en/job-search?query=${q}&location=Berlin`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      // EnglishJobs.de uses job card elements
      $('.job-card, .job-listing, .job-item, article, .search-result').each((_, el) => {
        const titleEl = $(el).find('h2 a, h3 a, .job-title a, a.title').first();
        const title = titleEl.text().trim();
        const link = titleEl.attr('href') || '';
        const company = $(el).find('.company-name, .employer, .company').first().text().trim();
        const location = $(el).find('.location, .job-location').first().text().trim() || 'Berlin';

        if (title && link) {
          jobs.push({
            title, co: company || 'Unknown',
            loc: location, ty: 'Full-time',
            url: link.startsWith('http') ? link : 'https://www.englishjobs.de' + link,
            source: 'englishjobs',
            cat: categorize(title), fit: fitScore(title),
            posted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          });
        }
      });
    } catch (e) {
      console.warn('EnglishJobs scrape error:', e.message);
    }
  }
  return jobs;
}

// ---- LINKEDIN (public guest job search API) ----
async function scrapeLinkedIn() {
  const jobs = [];
  const queries = [
    'Customer Success Manager', 'Account Manager',
    'Marketing Manager', 'Business Development Manager'
  ];

  for (const q of queries) {
    try {
      // LinkedIn's public job search page (no auth needed)
      const url = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(q)}&location=Berlin%2C%20Germany&f_TPR=r604800&position=1&pageNum=0`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      // LinkedIn guest pages use specific card structures
      $('.base-card, .job-search-card, .result-card').each((_, el) => {
        const title = $(el).find('.base-search-card__title, .result-card__title, h3').first().text().trim();
        const company = $(el).find('.base-search-card__subtitle, .result-card__subtitle, h4').first().text().trim();
        const location = $(el).find('.job-search-card__location, .result-card__meta').first().text().trim() || 'Berlin';
        const link = $(el).find('a.base-card__full-link, a.result-card__full-link, a').first().attr('href') || '';

        if (title && link) {
          jobs.push({
            title, co: company || 'Unknown',
            loc: location, ty: 'Full-time',
            url: link.split('?')[0], // clean tracking params
            source: 'linkedin',
            cat: categorize(title), fit: fitScore(title),
            posted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          });
        }
      });
    } catch (e) {
      console.warn('LinkedIn scrape error:', e.message);
    }
  }
  return jobs;
}

// ---- INDEED (public search) ----
async function scrapeIndeed() {
  const jobs = [];
  const queries = [
    'Customer Success Manager', 'Account Manager',
    'Marketing Manager', 'Business Development'
  ];

  for (const q of queries) {
    try {
      const url = `https://de.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Berlin&lang=en&fromage=7`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      $('.job_seen_beacon, .jobsearch-ResultsList .result, .tapItem').each((_, el) => {
        const titleEl = $(el).find('h2.jobTitle a, .jobTitle > a, a[data-jk]').first();
        const title = titleEl.find('span').first().text().trim() || titleEl.text().trim();
        const jk = titleEl.attr('data-jk') || $(el).attr('data-jk') || '';
        const company = $(el).find('.companyName, [data-testid="company-name"], .company').first().text().trim();
        const location = $(el).find('.companyLocation, [data-testid="text-location"]').first().text().trim() || 'Berlin';

        if (title) {
          jobs.push({
            title, co: company || 'Unknown',
            loc: location, ty: 'Full-time',
            url: jk ? `https://de.indeed.com/viewjob?jk=${jk}` : `https://de.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Berlin`,
            source: 'indeed',
            cat: categorize(title), fit: fitScore(title),
            posted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          });
        }
      });
    } catch (e) {
      console.warn('Indeed scrape error:', e.message);
    }
  }
  return jobs;
}

// ---- MAIN HANDLER ----
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    // Run all scrapers in parallel
    const [bsj, ej, li, ind] = await Promise.allSettled([
      scrapeBerlinStartupJobs(),
      scrapeEnglishJobs(),
      scrapeLinkedIn(),
      scrapeIndeed()
    ]);

    const allJobs = [
      ...(bsj.status === 'fulfilled' ? bsj.value : []),
      ...(ej.status === 'fulfilled' ? ej.value : []),
      ...(li.status === 'fulfilled' ? li.value : []),
      ...(ind.status === 'fulfilled' ? ind.value : [])
    ];

    // Deduplicate by normalized title + company
    const seen = new Set();
    const unique = allJobs.filter(j => {
      const key = (j.title + '@' + j.co).toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Generate IDs
    unique.forEach((j, i) => {
      j.id = j.source + '_' + i;
      j.sal = j.sal || '';
      j.de = false;
    });

    const sources = {
      berlinstartupjobs: (bsj.status === 'fulfilled' ? bsj.value : []).length,
      englishjobs: (ej.status === 'fulfilled' ? ej.value : []).length,
      linkedin: (li.status === 'fulfilled' ? li.value : []).length,
      indeed: (ind.status === 'fulfilled' ? ind.value : []).length
    };

    return res.status(200).json({
      jobs: unique,
      total: unique.length,
      sources,
      scraped_at: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, jobs: [] });
  }
}
