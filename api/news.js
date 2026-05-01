// /api/news.js — Vercel Serverless Function
// Fetches news from NewsAPI + RSS feeds, analyzes with Gemini AI
// Runs on cron (3x daily) or on-demand via GET /api/news

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

// ===== RSS PARSER (lightweight, no dependencies) =====
function parseRSSItems(xml, maxItems = 10) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/) || [])[1] || (itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    const desc = (itemXml.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/) || [])[1] || '';
    if (title.trim()) {
      items.push({ title: title.trim(), link, pubDate, description: desc.trim() });
    }
  }
  return items;
}

// ===== FETCH NEWS FROM ALL SOURCES =====
async function fetchAllNews() {
  const headlines = [];
  const errors = [];

  // 1. NewsAPI — Business headlines
  if (NEWS_API_KEY) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`
      );
      const data = await res.json();
      if (data.articles) {
        data.articles.forEach(a => {
          if (a.title && !a.title.includes('[Removed]')) {
            headlines.push({
              headline: a.title,
              source: a.source?.name || 'NewsAPI',
              url: a.url,
              publishedAt: a.publishedAt,
              origin: 'newsapi'
            });
          }
        });
      }
    } catch (e) {
      errors.push(`NewsAPI error: ${e.message}`);
    }
  }

  // 2. Economic Times RSS — Indian market news
  try {
    const res = await fetch('https://economictimes.indiatimes.com/rssfeedsdefault.cms', {
      headers: { 'User-Agent': 'MarketIntel/1.0' }
    });
    const xml = await res.text();
    const items = parseRSSItems(xml, 8);
    items.forEach(item => {
      headlines.push({
        headline: item.title,
        source: 'Economic Times',
        url: item.link,
        publishedAt: item.pubDate,
        origin: 'et_rss'
      });
    });
  } catch (e) {
    errors.push(`ET RSS error: ${e.message}`);
  }

  // 3. Moneycontrol RSS
  try {
    const res = await fetch('https://www.moneycontrol.com/rss/latestnews.xml', {
      headers: { 'User-Agent': 'MarketIntel/1.0' }
    });
    const xml = await res.text();
    const items = parseRSSItems(xml, 5);
    items.forEach(item => {
      headlines.push({
        headline: item.title,
        source: 'Moneycontrol',
        url: item.link,
        publishedAt: item.pubDate,
        origin: 'moneycontrol_rss'
      });
    });
  } catch (e) {
    errors.push(`Moneycontrol RSS error: ${e.message}`);
  }

  // Deduplicate by headline similarity
  const unique = [];
  const seen = new Set();
  for (const h of headlines) {
    const key = h.headline.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(h);
    }
  }

  return { headlines: unique.slice(0, 15), errors };
}

// ===== GEMINI AI ANALYSIS =====
async function analyzeWithGemini(headlines) {
  if (!GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY not configured', analyzed: [] };
  }

  const headlineList = headlines.map((h, i) => `${i + 1}. "${h.headline}" — ${h.source}`).join('\n');

  const prompt = `You are a Global Markets Intelligence Analyst at a top investment bank. Analyze these news headlines and return a JSON array. For EACH headline, return an object with:

HEADLINES:
${headlineList}

For each headline, return this exact JSON structure:
{
  "id": (number, sequential),
  "headline": "the headline text",
  "source": "source name",
  "type": "Monetary Policy | Geopolitical | Earnings | Regulatory | Commodity Shock | Trade Policy | Currency | Tech Disruption",
  "timestamp": "ISO date string",
  "impacts": {
    "markets": { "US": score, "India": score, "China": score, "EU": score, "Japan": score, "UK": score, "EM": score, "Middle_East": score },
    "sectors": { "Banking": score, "Technology": score, "Pharma": score, "Energy": score, "Metals": score, "Real_Estate": score, "FMCG": score, "Auto": score, "Telecom": score, "Infrastructure": score },
    "assets": { "Equities": score, "Bonds": score, "Gold": score, "Crude_Oil": score, "USD_Index": score, "Crypto": score, "INR_USD": score, "VIX": score }
  },
  "analysis": "2-3 sentences covering first, second, and third-order effects. Name specific companies (Indian: RELIANCE, TCS, HDFC Bank, etc.)",
  "analyst_brief": "5 numbered specific action items an analyst should do, like: 1) Issue BUY on XYZ 2) Downgrade ABC..."
}

SCORING RULES:
- Scale: -5 (severe negative) to +5 (strong positive), 0 = no impact
- India-specific lens: always consider INR, FPI flows, RBI policy
- Name specific Indian companies in analysis (NSE tickers)
- Be precise with scores — don't default to 0

Return ONLY a valid JSON array, no markdown, no backticks, no explanation. Just the raw JSON array.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return { error: 'Empty Gemini response', analyzed: [], raw: data };
    }

    // Parse JSON (handle potential markdown wrapping)
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    const analyzed = JSON.parse(cleaned);
    return { analyzed, error: null };

  } catch (e) {
    return { error: `Gemini error: ${e.message}`, analyzed: [] };
  }
}

// ===== GENERATE STOCK PREDICTIONS =====
async function generatePredictions(analyzedNews) {
  if (!GEMINI_API_KEY || !analyzedNews.length) {
    return { predictions: [], error: 'No API key or no analyzed news' };
  }

  const newsContext = analyzedNews.map(n =>
    `- "${n.headline}" (${n.type}) — India impact: ${n.impacts?.markets?.India || 0}, Key sectors: ${
      Object.entries(n.impacts?.sectors || {}).filter(([,v]) => v !== 0).map(([k,v]) => `${k}:${v}`).join(', ')
    }`
  ).join('\n');

  const prompt = `Based on these analyzed market-moving news stories, generate Indian stock purchase/sell predictions.

NEWS CONTEXT:
${newsContext}

Generate 12-17 specific Indian stock predictions (NSE-listed). Return a JSON array where each object has:
{
  "id": number,
  "ticker": "NSE ticker symbol (e.g., ONGC, RELIANCE, TCS)",
  "name": "Full company name",
  "exchange": "NSE",
  "sector": "sector name",
  "recommendation": "STRONG BUY | BUY | HOLD | SELL | AVOID",
  "confidence": number (50-95),
  "targetRange": [low_target, high_target] (realistic INR prices),
  "stopLoss": number (INR),
  "timeframe": "Immediate | 2-4 weeks | 4-6 weeks | 4-8 weeks | Monitor",
  "linkedHeadlines": [array of headline id numbers that drive this prediction],
  "reasoning": "2-3 sentences explaining why, referencing the specific news impact",
  "catalysts": ["catalyst 1", "catalyst 2"],
  "risks": ["risk 1", "risk 2"]
}

RULES:
- Include a mix: at least 4 BUY, 2 HOLD, 4 SELL/AVOID
- Use realistic CMP (Current Market Price) values for Indian stocks
- Link each prediction to specific headline IDs
- Include upstream energy, IT exporters, OMCs, banks, FMCG, auto, fintech, real estate
- Consider: INR/USD impact, RBI policy, FPI flows, oil prices, global risk appetite

Return ONLY a valid JSON array, no markdown, no backticks.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return { predictions: [], error: 'Empty Gemini response' };
    }

    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    const predictions = JSON.parse(cleaned);
    return { predictions, error: null };

  } catch (e) {
    return { predictions: [], error: `Gemini predictions error: ${e.message}` };
  }
}

// ===== MAIN HANDLER =====
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

  try {
    console.log('[MarketIntel] Starting news fetch...');

    // Step 1: Fetch all headlines
    const { headlines, errors: fetchErrors } = await fetchAllNews();
    console.log(`[MarketIntel] Fetched ${headlines.length} headlines, ${fetchErrors.length} errors`);

    if (headlines.length === 0) {
      return res.status(200).json({
        success: false,
        error: 'No headlines fetched',
        fetchErrors,
        timestamp: new Date().toISOString(),
        news: [],
        predictions: []
      });
    }

    // Step 2: Analyze with Gemini
    const { analyzed, error: analysisError } = await analyzeWithGemini(headlines);
    console.log(`[MarketIntel] Analyzed ${analyzed.length} headlines${analysisError ? `, error: ${analysisError}` : ''}`);

    // Step 3: Generate stock predictions
    const { predictions, error: predError } = await generatePredictions(analyzed);
    console.log(`[MarketIntel] Generated ${predictions.length} predictions${predError ? `, error: ${predError}` : ''}`);

    // Step 4: Compute aggregate data
    const sentiment = computeSentiment(analyzed);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: {
        newsapi: headlines.filter(h => h.origin === 'newsapi').length,
        et_rss: headlines.filter(h => h.origin === 'et_rss').length,
        moneycontrol_rss: headlines.filter(h => h.origin === 'moneycontrol_rss').length,
      },
      news: analyzed,
      predictions,
      sentiment,
      errors: [...fetchErrors, analysisError, predError].filter(Boolean)
    });

  } catch (e) {
    console.error('[MarketIntel] Fatal error:', e);
    return res.status(500).json({
      success: false,
      error: e.message,
      timestamp: new Date().toISOString(),
      news: [],
      predictions: []
    });
  }
}

function computeSentiment(stories) {
  if (!stories.length) return { score: 0, average: '0', label: 'NEUTRAL', severity: 'mixed' };

  let totalScore = 0;
  let totalCells = 0;
  stories.forEach(story => {
    if (story.impacts) {
      Object.values(story.impacts).forEach(category => {
        Object.values(category).forEach(score => {
          totalScore += score;
          totalCells++;
        });
      });
    }
  });

  return {
    score: totalScore,
    average: totalCells > 0 ? (totalScore / totalCells).toFixed(2) : '0',
    label: totalScore < -10 ? 'RISK-OFF' : totalScore > 10 ? 'RISK-ON' : 'NEUTRAL',
    severity: totalScore < -30 ? 'severe' : totalScore < -10 ? 'moderate' : totalScore > 10 ? 'bullish' : 'mixed'
  };
}
