// /api/news.js — Vercel Serverless Function
// Fetches news from NewsAPI + RSS feeds
// Analyzes with Gemini AI (if available) or rule-based fallback

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

// ===== RSS PARSER =====
function parseRSSItems(xml, maxItems = 10) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const itemXml = match[1];
    const getText = (tag) => {
      // Try CDATA first
      const cdataMatch = itemXml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'));
      if (cdataMatch) return cdataMatch[1].trim();
      // Plain text
      const plainMatch = itemXml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'i'));
      return plainMatch ? plainMatch[1].trim() : '';
    };
    let title = getText('title');
    // Clean any remaining CDATA artifacts
    title = title.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&amp;/g, '&').trim();
    if (title) {
      items.push({ title, link: getText('link'), pubDate: getText('pubDate'), description: getText('description') });
    }
  }
  return items;
}

// ===== FETCH NEWS FROM ALL SOURCES =====
async function fetchAllNews() {
  const headlines = [];
  const errors = [];

  // 1. NewsAPI
  if (NEWS_API_KEY) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`
      );
      const data = await res.json();
      if (data.status === 'error') {
        errors.push(`NewsAPI: ${data.message}`);
      } else if (data.articles) {
        data.articles.forEach(a => {
          if (a.title && !a.title.includes('[Removed]')) {
            headlines.push({ headline: a.title, source: a.source?.name || 'NewsAPI', url: a.url, publishedAt: a.publishedAt, origin: 'newsapi' });
          }
        });
      }
    } catch (e) { errors.push(`NewsAPI: ${e.message}`); }
  } else {
    errors.push('NEWS_API_KEY not set');
  }

  // 2. Economic Times RSS
  try {
    const res = await fetch('https://economictimes.indiatimes.com/rssfeedsdefault.cms', {
      headers: { 'User-Agent': 'MarketIntel/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    const xml = await res.text();
    parseRSSItems(xml, 8).forEach(item => {
      headlines.push({ headline: item.title, source: 'Economic Times', url: item.link, publishedAt: item.pubDate, origin: 'et_rss' });
    });
  } catch (e) { errors.push(`ET RSS: ${e.message}`); }

  // 3. Moneycontrol RSS
  try {
    const res = await fetch('https://www.moneycontrol.com/rss/latestnews.xml', {
      headers: { 'User-Agent': 'MarketIntel/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    const xml = await res.text();
    parseRSSItems(xml, 5).forEach(item => {
      headlines.push({ headline: item.title, source: 'Moneycontrol', url: item.link, publishedAt: item.pubDate, origin: 'moneycontrol_rss' });
    });
  } catch (e) { errors.push(`MC RSS: ${e.message}`); }

  // Deduplicate
  const unique = [];
  const seen = new Set();
  for (const h of headlines) {
    const key = h.headline.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
    if (!seen.has(key)) { seen.add(key); unique.push(h); }
  }
  return { headlines: unique.slice(0, 15), errors };
}

// ===== RULE-BASED SCORING (no AI needed) =====
const KEYWORD_RULES = [
  // Geopolitical / Commodity
  { pattern: /oil|crude|brent|opec|hormuz|iran|iraq|saudi|gulf|energy crisis/i, type: 'Geopolitical | Commodity Shock', impacts: { markets: { US: -2, India: -4, China: -2, EU: -2, Japan: -2, UK: -1, EM: -3, Middle_East: -4 }, sectors: { Banking: -1, Technology: 0, Pharma: 0, Energy: 4, Metals: 1, Real_Estate: -1, FMCG: -2, Auto: -2, Telecom: 0, Infrastructure: -1 }, assets: { Equities: -2, Bonds: 2, Gold: 3, Crude_Oil: 4, USD_Index: 2, Crypto: -1, INR_USD: -3, VIX: 3 } } },
  // Monetary Policy
  { pattern: /fed|rate cut|rate hike|rbi|repo rate|monetary policy|interest rate|inflation|cpi|unemployment|jobs|labor|nonfarm/i, type: 'Monetary Policy', impacts: { markets: { US: -1, India: -1, China: 0, EU: 0, Japan: 0, UK: 0, EM: -1, Middle_East: 0 }, sectors: { Banking: -2, Technology: -1, Pharma: 0, Energy: 0, Metals: 0, Real_Estate: -2, FMCG: 0, Auto: -1, Telecom: 0, Infrastructure: -1 }, assets: { Equities: -1, Bonds: -2, Gold: 1, Crude_Oil: 0, USD_Index: 1, Crypto: 0, INR_USD: -1, VIX: 1 } } },
  // Tech
  { pattern: /ai|artificial intelligence|tech|nasdaq|magnificent|nvidia|google|apple|microsoft|meta|amazon|semiconductor|chip/i, type: 'Tech Disruption', impacts: { markets: { US: -2, India: -1, China: -1, EU: 0, Japan: 1, UK: 0, EM: 0, Middle_East: 0 }, sectors: { Banking: 0, Technology: -3, Pharma: 0, Energy: 0, Metals: 0, Real_Estate: 0, FMCG: 0, Auto: 0, Telecom: -1, Infrastructure: 0 }, assets: { Equities: -2, Bonds: 1, Gold: 0, Crude_Oil: 0, USD_Index: 0, Crypto: -1, INR_USD: 0, VIX: 2 } } },
  // Earnings
  { pattern: /earnings|revenue|profit|quarter|results|beats|misses|guidance|eps|revenue miss|q[1-4]/i, type: 'Earnings', impacts: { markets: { US: -1, India: 0, China: 0, EU: 0, Japan: 0, UK: 0, EM: 0, Middle_East: 0 }, sectors: { Banking: 0, Technology: -1, Pharma: 0, Energy: 0, Metals: 0, Real_Estate: 0, FMCG: 0, Auto: 0, Telecom: 0, Infrastructure: 0 }, assets: { Equities: -1, Bonds: 0, Gold: 0, Crude_Oil: 0, USD_Index: 0, Crypto: 0, INR_USD: 0, VIX: 1 } } },
  // Regulatory / India
  { pattern: /sebi|rbi|regulation|compliance|penalty|licence|ban|fintech|paytm|basel|npa|bank fraud/i, type: 'Regulatory', impacts: { markets: { US: 0, India: -2, China: 0, EU: 0, Japan: 0, UK: 0, EM: 0, Middle_East: 0 }, sectors: { Banking: -2, Technology: -1, Pharma: 0, Energy: 0, Metals: 0, Real_Estate: -1, FMCG: 0, Auto: 0, Telecom: 0, Infrastructure: 0 }, assets: { Equities: -1, Bonds: 0, Gold: 0, Crude_Oil: 0, USD_Index: 0, Crypto: 0, INR_USD: 0, VIX: 1 } } },
  // Trade / Tariff
  { pattern: /tariff|trade war|sanctions|export|import ban|china trade|us-china|wto/i, type: 'Trade Policy', impacts: { markets: { US: -2, India: -1, China: -3, EU: -1, Japan: -1, UK: 0, EM: -2, Middle_East: 0 }, sectors: { Banking: 0, Technology: -2, Pharma: -1, Energy: 0, Metals: -1, Real_Estate: 0, FMCG: -1, Auto: -2, Telecom: 0, Infrastructure: 0 }, assets: { Equities: -2, Bonds: 1, Gold: 2, Crude_Oil: 0, USD_Index: 1, Crypto: 0, INR_USD: -1, VIX: 2 } } },
  // Currency
  { pattern: /rupee|dollar|forex|currency|yen|euro|inr|fx reserve|devaluation/i, type: 'Currency', impacts: { markets: { US: 0, India: -2, China: -1, EU: 0, Japan: 0, UK: 0, EM: -1, Middle_East: 0 }, sectors: { Banking: -1, Technology: 1, Pharma: 1, Energy: -1, Metals: 0, Real_Estate: 0, FMCG: -1, Auto: -1, Telecom: 0, Infrastructure: 0 }, assets: { Equities: -1, Bonds: 0, Gold: 1, Crude_Oil: 0, USD_Index: 1, Crypto: 0, INR_USD: -2, VIX: 1 } } },
  // Positive / Market rally
  { pattern: /rally|surge|record high|bull|upgrade|boom|stimulus|growth|recovery/i, type: 'Earnings', impacts: { markets: { US: 2, India: 1, China: 1, EU: 1, Japan: 1, UK: 1, EM: 1, Middle_East: 0 }, sectors: { Banking: 1, Technology: 2, Pharma: 0, Energy: 0, Metals: 1, Real_Estate: 1, FMCG: 1, Auto: 1, Telecom: 0, Infrastructure: 1 }, assets: { Equities: 2, Bonds: -1, Gold: -1, Crude_Oil: 0, USD_Index: 0, Crypto: 1, INR_USD: 1, VIX: -2 } } },
  // Gold
  { pattern: /gold|silver|precious metal|safe haven|gold etf/i, type: 'Commodity Shock', impacts: { markets: { US: 0, India: 0, China: 0, EU: 0, Japan: 0, UK: 0, EM: 0, Middle_East: 0 }, sectors: { Banking: 0, Technology: 0, Pharma: 0, Energy: 0, Metals: 3, Real_Estate: 0, FMCG: 0, Auto: 0, Telecom: 0, Infrastructure: 0 }, assets: { Equities: 0, Bonds: 0, Gold: 3, Crude_Oil: 0, USD_Index: -1, Crypto: 0, INR_USD: 0, VIX: 0 } } },
];

const DEFAULT_IMPACTS = { markets: { US: 0, India: 0, China: 0, EU: 0, Japan: 0, UK: 0, EM: 0, Middle_East: 0 }, sectors: { Banking: 0, Technology: 0, Pharma: 0, Energy: 0, Metals: 0, Real_Estate: 0, FMCG: 0, Auto: 0, Telecom: 0, Infrastructure: 0 }, assets: { Equities: 0, Bonds: 0, Gold: 0, Crude_Oil: 0, USD_Index: 0, Crypto: 0, INR_USD: 0, VIX: 0 } };

function analyzeWithRules(headlines) {
  return headlines.map((h, i) => {
    let matched = null;
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(h.headline)) { matched = rule; break; }
    }
    return {
      id: i + 1,
      headline: h.headline,
      source: h.source,
      type: matched ? matched.type : 'Earnings',
      timestamp: h.publishedAt || new Date().toISOString(),
      impacts: matched ? JSON.parse(JSON.stringify(matched.impacts)) : JSON.parse(JSON.stringify(DEFAULT_IMPACTS)),
      analysis: `Headline from ${h.source}. ${matched ? `Classified as ${matched.type} based on keyword matching.` : 'No strong keyword signal detected.'} Further analysis requires Gemini AI integration — add GEMINI_API_KEY in Vercel environment variables for full 2nd/3rd order effect analysis.`,
      analyst_brief: `1) Monitor this story for further developments. 2) Cross-reference with sector-specific data. 3) Check for follow-up coverage across Indian financial media. 4) Assess portfolio exposure to affected sectors. 5) Enable Gemini AI for detailed action items.`
    };
  });
}

// ===== GEMINI AI ANALYSIS =====
async function analyzeWithGemini(headlines) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'placeholder') {
    return { analyzed: null, error: 'GEMINI_API_KEY not configured' };
  }

  const headlineList = headlines.map((h, i) => `${i + 1}. "${h.headline}" — ${h.source}`).join('\n');

  const prompt = `You are a Global Markets Intelligence Analyst at Goldman Sachs. Analyze these ${headlines.length} news headlines. Return a JSON array with one object per headline.

HEADLINES:
${headlineList}

Each object must have these exact fields:
- "id": sequential number starting from 1
- "headline": the headline text
- "source": source name
- "type": one of "Monetary Policy", "Geopolitical", "Earnings", "Regulatory", "Commodity Shock", "Trade Policy", "Currency", "Tech Disruption"
- "timestamp": "${new Date().toISOString()}"
- "impacts": object with "markets" (US, India, China, EU, Japan, UK, EM, Middle_East), "sectors" (Banking, Technology, Pharma, Energy, Metals, Real_Estate, FMCG, Auto, Telecom, Infrastructure), "assets" (Equities, Bonds, Gold, Crude_Oil, USD_Index, Crypto, INR_USD, VIX) - all scores from -5 to +5
- "analysis": 2-3 sentences covering 1st, 2nd, 3rd order effects. Name specific Indian companies (Reliance, TCS, HDFC Bank, SBI, etc.)
- "analyst_brief": "1) Action item 2) Action item 3) Action item 4) Action item 5) Action item"

Important: Score with India-centric lens. Consider INR/USD, FPI flows, RBI policy implications.

Respond with ONLY the JSON array. No explanation, no markdown.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { analyzed: null, error: `Gemini HTTP ${res.status}: ${errText.substring(0, 200)}` };
    }

    const data = await res.json();

    // Check for API-level errors
    if (data.error) {
      return { analyzed: null, error: `Gemini API: ${data.error.message || JSON.stringify(data.error)}` };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const blockReason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'unknown';
      return { analyzed: null, error: `Gemini empty response (reason: ${blockReason})` };
    }

    // Extract JSON from response (handle markdown wrapping)
    let cleaned = text.trim();
    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    // Find the JSON array
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1) {
      cleaned = cleaned.substring(arrayStart, arrayEnd + 1);
    }

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { analyzed: parsed, error: null };
    }
    return { analyzed: null, error: 'Gemini returned non-array or empty array' };
  } catch (e) {
    return { analyzed: null, error: `Gemini parse: ${e.message}` };
  }
}

// ===== STOCK PREDICTIONS (rule-based fallback) =====
function generateRulePredictions(analyzedNews) {
  // Compute aggregate sector scores
  const sectorScores = {};
  analyzedNews.forEach(n => {
    if (n.impacts?.sectors) {
      Object.entries(n.impacts.sectors).forEach(([k, v]) => {
        sectorScores[k] = (sectorScores[k] || 0) + v;
      });
    }
  });

  const STOCK_MAP = [
    { ticker: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy', cmp: 278, linkedSectors: ['Energy'] },
    { ticker: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy / Conglomerate', cmp: 1285, linkedSectors: ['Energy', 'Technology'] },
    { ticker: 'TCS', name: 'Tata Consultancy Services', sector: 'IT Services', cmp: 3580, linkedSectors: ['Technology'] },
    { ticker: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', cmp: 1620, linkedSectors: ['Banking'] },
    { ticker: 'ITC', name: 'ITC Limited', sector: 'FMCG', cmp: 435, linkedSectors: ['FMCG'] },
    { ticker: 'SBIN', name: 'State Bank of India', sector: 'Banking', cmp: 785, linkedSectors: ['Banking'] },
    { ticker: 'IOC', name: 'Indian Oil Corporation', sector: 'Energy (Downstream)', cmp: 128, linkedSectors: ['Energy'] },
    { ticker: 'BPCL', name: 'Bharat Petroleum', sector: 'Energy (Downstream)', cmp: 295, linkedSectors: ['Energy'] },
    { ticker: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Auto', cmp: 12400, linkedSectors: ['Auto'] },
    { ticker: 'DLF', name: 'DLF Limited', sector: 'Real Estate', cmp: 720, linkedSectors: ['Real_Estate'] },
    { ticker: 'TITAN', name: 'Titan Company', sector: 'Consumer', cmp: 3250, linkedSectors: ['FMCG', 'Metals'] },
    { ticker: 'COALINDIA', name: 'Coal India Ltd', sector: 'Mining', cmp: 395, linkedSectors: ['Energy', 'Metals'] },
    { ticker: 'GOLDBEES', name: 'Nippon India Gold ETF', sector: 'Gold / Commodity', cmp: 62, linkedSectors: ['Metals'] },
    { ticker: 'INFY', name: 'Infosys Limited', sector: 'IT Services', cmp: 1480, linkedSectors: ['Technology'] },
    { ticker: 'ASIANPAINT', name: 'Asian Paints Ltd', sector: 'Consumer', cmp: 2680, linkedSectors: ['FMCG', 'Real_Estate'] },
  ];

  return STOCK_MAP.map((stock, i) => {
    const avgScore = stock.linkedSectors.reduce((sum, s) => sum + (sectorScores[s] || 0), 0) / stock.linkedSectors.length;
    const isOMC = ['IOC', 'BPCL'].includes(stock.ticker);
    const effectiveScore = isOMC ? -Math.abs(avgScore) : avgScore; // OMCs hurt by high oil

    let rec, conf, targetPct;
    if (effectiveScore >= 3) { rec = 'STRONG BUY'; conf = 85; targetPct = 0.12; }
    else if (effectiveScore >= 1) { rec = 'BUY'; conf = 75; targetPct = 0.08; }
    else if (effectiveScore >= -1) { rec = 'HOLD'; conf = 60; targetPct = 0.02; }
    else if (effectiveScore >= -3) { rec = 'AVOID'; conf = 70; targetPct = -0.08; }
    else { rec = 'SELL'; conf = 80; targetPct = -0.12; }

    const t1 = Math.round(stock.cmp * (1 + targetPct * 0.8));
    const t2 = Math.round(stock.cmp * (1 + targetPct * 1.2));
    const sl = Math.round(stock.cmp * (1 + (rec.includes('BUY') ? -0.08 : 0.08)));

    return {
      id: i + 1, ticker: stock.ticker, name: stock.name, exchange: 'NSE',
      sector: stock.sector, cmp: stock.cmp, recommendation: rec, confidence: conf,
      targetRange: [Math.min(t1, t2), Math.max(t1, t2)],
      stopLoss: sl,
      timeframe: rec === 'SELL' ? 'Immediate' : rec === 'STRONG BUY' ? '2-4 weeks' : '4-8 weeks',
      linkedHeadlines: analyzedNews.filter(n =>
        stock.linkedSectors.some(s => Math.abs(n.impacts?.sectors?.[s] || 0) >= 1)
      ).map(n => n.id).slice(0, 3),
      reasoning: `Based on aggregate sector analysis: ${stock.linkedSectors.map(s => `${s} (${sectorScores[s] || 0})`).join(', ')}. ${rec.includes('BUY') ? 'Positive sector tailwinds support upside.' : rec === 'HOLD' ? 'Mixed signals warrant caution.' : 'Negative sector headwinds create downside risk.'}`,
      catalysts: rec.includes('BUY') ? ['Sector momentum', 'Favorable macro shift'] : ['Sector recovery', 'Policy intervention'],
      risks: rec.includes('BUY') ? ['Global risk-off event', 'Earnings miss'] : ['Continued sector weakness', 'INR depreciation']
    };
  });
}

async function generateGeminiPredictions(analyzedNews) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'placeholder' || !analyzedNews.length) {
    return null;
  }
  const newsContext = analyzedNews.map(n =>
    `- "${n.headline}" (${n.type}) — India: ${n.impacts?.markets?.India || 0}`
  ).join('\n');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate 15 Indian stock (NSE) predictions based on these news:\n${newsContext}\n\nReturn a JSON array where each object has: id, ticker, name, exchange:"NSE", sector, cmp (realistic current INR price), recommendation ("STRONG BUY"|"BUY"|"HOLD"|"SELL"|"AVOID"), confidence (50-95), targetRange [low,high], stopLoss, timeframe, linkedHeadlines [headline id numbers], reasoning (2-3 sentences), catalysts (array of strings), risks (array of strings). Include a mix: 4+ BUY, 2 HOLD, 4+ SELL/AVOID. Respond with ONLY the JSON array.` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
        })
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    let cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1) cleaned = cleaned.substring(arrStart, arrEnd + 1);
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch { return null; }
}

// ===== SENTIMENT =====
function computeSentiment(stories) {
  if (!stories.length) return { score: 0, average: '0', label: 'NEUTRAL', severity: 'mixed' };
  let totalScore = 0, totalCells = 0;
  stories.forEach(s => {
    if (s.impacts) Object.values(s.impacts).forEach(cat => Object.values(cat).forEach(v => { totalScore += v; totalCells++; }));
  });
  return {
    score: totalScore,
    average: totalCells > 0 ? (totalScore / totalCells).toFixed(2) : '0',
    label: totalScore < -10 ? 'RISK-OFF' : totalScore > 10 ? 'RISK-ON' : 'NEUTRAL',
    severity: totalScore < -30 ? 'severe' : totalScore < -10 ? 'moderate' : totalScore > 10 ? 'bullish' : 'mixed'
  };
}

// ===== MAIN HANDLER =====
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

  try {
    // Step 1: Fetch headlines
    const { headlines, errors: fetchErrors } = await fetchAllNews();

    if (headlines.length === 0) {
      return res.status(200).json({
        success: false, error: 'No headlines fetched',
        fetchErrors, timestamp: new Date().toISOString(),
        news: [], predictions: [], sentiment: computeSentiment([]),
        analysisMode: 'none'
      });
    }

    // Step 2: Try Gemini, fall back to rules
    let analyzed;
    let analysisMode = 'rules';
    const { analyzed: geminiResult, error: geminiError } = await analyzeWithGemini(headlines);

    if (geminiResult && geminiResult.length > 0) {
      analyzed = geminiResult;
      analysisMode = 'gemini';
    } else {
      analyzed = analyzeWithRules(headlines);
      if (geminiError) fetchErrors.push(geminiError);
    }

    // Step 3: Generate predictions
    let predictions;
    if (analysisMode === 'gemini') {
      const geminiPreds = await generateGeminiPredictions(analyzed);
      predictions = geminiPreds || generateRulePredictions(analyzed);
    } else {
      predictions = generateRulePredictions(analyzed);
    }

    // Step 4: Return
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      analysisMode,
      sources: {
        newsapi: headlines.filter(h => h.origin === 'newsapi').length,
        et_rss: headlines.filter(h => h.origin === 'et_rss').length,
        moneycontrol_rss: headlines.filter(h => h.origin === 'moneycontrol_rss').length,
      },
      news: analyzed,
      predictions,
      sentiment: computeSentiment(analyzed),
      errors: fetchErrors.filter(Boolean)
    });

  } catch (e) {
    return res.status(500).json({
      success: false, error: e.message, timestamp: new Date().toISOString(),
      news: [], predictions: [], sentiment: computeSentiment([])
    });
  }
}
