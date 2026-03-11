import { callModel, MODELS, handleAIError } from "../ai.client.js";

export const PRIORITY = {
  P0: { label: "P0 — Critical", channel: process.env.SLACK_P0_CHANNEL || "#nexus-critical", emoji: "🚨", description: "Executive-level. Outage or high-ACV at-risk. Immediate response required.", sla: "Immediate" },
  P1: { label: "P1 — High", channel: process.env.SLACK_P1_CHANNEL || "#nexus-alerts", emoji: "🔴", description: "Customer-impacting. Action required within 2–4 hours.", sla: "2–4 hours" },
  P2: { label: "P2 — Medium", channel: process.env.SLACK_P2_CHANNEL || "#nexus-triage", emoji: "🟡", description: "Time-sensitive, workaround exists. Action within 24 hours.", sla: "24 hours" },
  P3: { label: "P3 — Low", channel: process.env.SLACK_P3_CHANNEL || "#nexus-triage", emoji: "🟢", description: "Informational / ops. Action within 5 business days.", sla: "5 business days" },
};

export function classifyPriority(signal) {
  const severity = signal.severity || "Low";
  const acv = Number(signal.acv ?? 0);
  if (severity === "High" && acv > 500_000) return "P0";
  if (severity === "High") return "P1";
  if (severity === "Medium" && acv > 200_000) return "P1";
  if (severity === "Medium") return "P2";
  return "P3";
}

async function fetchNewsForCompany(companyName, daysBack = 7) {
  if (!process.env.NEWS_API_KEY) return [];

  const fromDate = new Date(Date.now() - daysBack * 86_400_000)
    .toISOString().slice(0, 10);

  try {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", `"${companyName}"`);
    url.searchParams.set("from", fromDate);
    url.searchParams.set("sortBy", "relevancy");
    url.searchParams.set("language", "en");
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("apiKey", process.env.NEWS_API_KEY);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];

    const json = await res.json();
    if (json.status !== "ok") return [];

    return (json.articles || []).map((a) => ({
      title: a.title,
      description: a.description || "",
      url: a.url,
      publishedAt: a.publishedAt,
      source: a.source?.name || "Unknown",
    }));
  } catch {
    return [];
  }
}

async function fetchBatchNews(queries, daysBack = 7) {

  if (!process.env.NEWS_API_KEY || !queries.length) return [];

  const fromDate = new Date(Date.now() - daysBack * 86_400_000)
    .toISOString().slice(0, 10);

  const q = queries.slice(0, 6).map((q) => `"${q}"`).join(" OR ");

  try {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", q);
    url.searchParams.set("from", fromDate);
    url.searchParams.set("sortBy", "relevancy");
    url.searchParams.set("language", "en");
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("apiKey", process.env.NEWS_API_KEY);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];

    const json = await res.json();
    if (json.status !== "ok") return [];

    return (json.articles || []).map((a) => ({
      title: a.title,
      description: a.description || "",
      url: a.url,
      publishedAt: a.publishedAt,
      source: a.source?.name || "Unknown",
    }));
  } catch {
    return [];
  }
}

const TICKER_MAP = {
  "Microsoft Corporation": "MSFT", "Apple Inc.": "AAPL", "Alphabet Inc. (Google)": "GOOGL",
  "IBM Corporation": "IBM", "Intel Corporation": "INTC", "Oracle Corporation": "ORCL",
  "Cisco Systems": "CSCO", "Salesforce Inc.": "CRM", "Hewlett Packard Enterprise": "HPE",
  "Lockheed Martin Corporation": "LMT", "Raytheon Technologies (RTX)": "RTX",
  "Northrop Grumman": "NOC", "General Dynamics": "GD", "Boeing Company": "BA",
  "L3Harris Technologies": "LHX", "UnitedHealth Group": "UNH",
  "Johnson & Johnson": "JNJ", "Pfizer Inc.": "PFE", "Merck & Co.": "MRK",
  "HCA Healthcare": "HCA", "Abbott Laboratories": "ABT", "ExxonMobil": "XOM",
  "Chevron Corporation": "CVX", "JPMorgan Chase": "JPM", "Bank of America": "BAC",
  "Goldman Sachs": "GS", "Caterpillar Inc.": "CAT", "Honeywell International": "HON",
  "FedEx Corporation": "FDX", "Delta Air Lines": "DAL", "Walmart Inc.": "WMT",
};

async function fetchYahooQuote(ticker) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=30d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prevClose = meta.previousClose || meta.chartPreviousClose;
    const price = meta.regularMarketPrice;
    const dayChange = prevClose && price ? ((price - prevClose) / prevClose) * 100 : 0;

    const prices = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(Boolean) || [];
    const priceStart = prices[0];
    const priceEnd = prices[prices.length - 1];
    const monthChange = priceStart && priceEnd ? ((priceEnd - priceStart) / priceStart) * 100 : 0;

    return {
      ticker,
      price,
      dayChange: parseFloat(dayChange.toFixed(2)),
      monthChange: parseFloat(monthChange.toFixed(2)),
      fiftyTwoWeekHigh: meta["52WeekHigh"] || meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta["52WeekLow"] || meta.fiftyTwoWeekLow,
    };
  } catch {
    return null;
  }
}

export async function generateRiskSignals(accounts, timeRangeHours = 168) {

  const crmAlerts = buildCRMAlerts(accounts, timeRangeHours);

  const atRiskAccounts = accounts
    .filter((a) => ["at_risk", "dormant"].includes(a.health_archetype))
    .sort((a, b) => Number(b.annual_contract_value) - Number(a.annual_contract_value))
    .slice(0, 6);

  const topByACV = accounts
    .sort((a, b) => Number(b.annual_contract_value) - Number(a.annual_contract_value))
    .slice(0, 4);

  const searchCompanies = [...new Set([...atRiskAccounts, ...topByACV].map((a) => a.account_name))];

  let newsAlerts = [];
  if (process.env.NEWS_API_KEY && searchCompanies.length > 0) {
    const daysBack = Math.ceil(timeRangeHours / 24) + 1;
    const articles = await fetchBatchNews(searchCompanies, daysBack);

    if (articles.length > 0) {
      newsAlerts = await classifyNewsArticles(articles, accounts);
    }
  } else {

    const extraSignals = await generateCRMPatternSignals(accounts);
    newsAlerts = extraSignals;
  }

  const severityOrder = { High: 0, Medium: 1, Low: 2 };
  const allAlerts = [...crmAlerts, ...newsAlerts]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return allAlerts;
}

function buildCRMAlerts(accounts, timeRangeHours) {
  return accounts.flatMap(account => [
    checkEngagementRisk(account, timeRangeHours),
    checkDormancyRisk(account, timeRangeHours),
    checkRenewalRisk(account, timeRangeHours)
  ].filter(Boolean));
}

function checkEngagementRisk(account, timeRangeHours) {
  const days = Number(account.days_since_last_contact) || 0;
  const acv = Number(account.annual_contract_value) || 0;
  if (account.health_archetype === "at_risk" && days > 30) {
    return {
      ticker: TICKER_MAP[account.account_name] || account.account_name.slice(0, 4).toUpperCase(),
      company: account.account_name,
      account_id: account.account_id,
      severity: acv > 2_000_000 ? "High" : "Medium",
      category: "crm_signal",
      description: `Account flagged as at_risk with ${days} days without contact. ACV: $${(acv / 1e6).toFixed(2)}M. Renewal risk elevated.`,
      confidence: Math.min(95, 60 + Math.floor(days / 10)),
      time: days <= 1 ? "Today" : days <= 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`,
      hoursAgo: Math.min(days * 24, timeRangeHours),
      source: "Databricks CRM",
      acv,
    };
  }
  return null;
}

function checkDormancyRisk(account, timeRangeHours) {
  const days = Number(account.days_since_last_contact) || 0;
  const acv = Number(account.annual_contract_value) || 0;
  if (account.health_archetype === "dormant" && days > 60 && acv > 1_000_000) {
    return {
      ticker: TICKER_MAP[account.account_name] || account.account_name.slice(0, 4).toUpperCase(),
      company: account.account_name,
      account_id: account.account_id,
      severity: "Medium",
      category: "crm_signal",
      description: `Dormant account — ${days} days of silence on a $${(acv / 1e6).toFixed(2)}M contract. Churn risk increasing without re-engagement.`,
      confidence: 75,
      time: `${Math.floor(days / 7)}w silent`,
      hoursAgo: Math.min(days * 24, timeRangeHours - 1),
      source: "Databricks CRM",
      acv,
    };
  }
  return null;
}

function checkRenewalRisk(account, timeRangeHours) {
  if (!account.contract_renewal_date) return null;
  const acv = Number(account.annual_contract_value) || 0;
  const renewalDate = new Date(account.contract_renewal_date);
  const daysToRenewal = Math.ceil((renewalDate.getTime() - Date.now()) / 86_400_000);
  if (daysToRenewal > 0 && daysToRenewal <= 90 && (account.health_archetype === "at_risk" || account.health_archetype === "dormant")) {
    return {
      ticker: TICKER_MAP[account.account_name] || account.account_name.slice(0, 4).toUpperCase(),
      company: account.account_name,
      account_id: account.account_id,
      severity: daysToRenewal <= 30 ? "High" : "Medium",
      category: "earnings",
      description: `Contract renewal in ${daysToRenewal} days — account currently ${account.health_archetype}. ACV at risk: $${(acv / 1e6).toFixed(2)}M.`,
      confidence: 88,
      time: daysToRenewal <= 1 ? "Today" : `In ${daysToRenewal}d`,
      hoursAgo: 2,
      source: "Databricks CRM",
      acv,
    };
  }
  return null;
}

async function classifyNewsArticles(client, articles, accounts) {
  const accountNames = accounts.map((a) => a.account_name).join(", ");

  try {
    const response = await client.messages.create({
      model: MODELS.REASONING_MODEL,
      max_tokens: 1500,
      system: `You are a financial risk analyst. Classify news articles as investment risk signals.
For each relevant article, output a structured alert. Output ONLY a JSON array.`,
      messages: [{
        role: "user",
        content: `Portfolio companies: ${accountNames}

  News articles to analyze:
  ${articles.slice(0, 15).map((a, i) => `${i + 1}. [${a.source}] ${a.title}\n   ${a.description}\n   Published: ${a.publishedAt}\n   URL: ${a.url}`).join("\n\n")}

  For each article that represents a material risk or opportunity for a portfolio company, create an alert:
  {
    "company": "<exact company name from the portfolio list>",
    "ticker": "<stock ticker if publicly traded, or 4-char abbreviation>",
    "severity": "<High|Medium|Low>",
    "category": "<regulatory|earnings|insider|general|competitive|executive>",
    "description": "<1-2 sentence investment-relevant summary>",
    "confidence": <50-95>,
    "hoursAgo": <estimated hours since event>,
    "time": "<human readable: 2 hours ago, Yesterday, 3 days ago>",
    "source": "<news source name>",
    "url": "<article URL>"
  }

  Only include articles that are MATERIAL to investment decisions. Skip generic/PR articles.
  Return ONLY a JSON array (empty array if nothing material).`,
      }],
    });

    const raw = response.content[0].text.trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    const alerts = JSON.parse(cleaned);
    if (!Array.isArray(alerts)) return [];

    return alerts.map((alert) => {
      const account = accounts.find((a) => a.account_name === alert.company ||
        a.account_name.includes(alert.company) || alert.company.includes(a.account_name));
      return {
        ...alert,
        account_id: account?.account_id || null,
        acv: account ? Number(account.annual_contract_value) || 0 : 0,
      };
    });
  } catch (err) {
    handleAIError(err, "signals:classifyNewsArticles");
    return [];
  }
}

async function generateCRMPatternSignals(client, accounts) {
  const archetypeGroups = accounts.reduce((acc, a) => {
    acc[a.health_archetype] = (acc[a.health_archetype] || []);
    acc[a.health_archetype].push({
      name: a.account_name,
      acv: Number(a.annual_contract_value) || 0,
      days: Number(a.days_since_last_contact) || 0,
      industry: a.industry,
    });
    return acc;
  }, {});

  try {
    const response = await client.messages.create({
      model: MODELS.REASONING_MODEL,
      max_tokens: 1000,
      system: `You are a risk analyst generating investment risk signals from CRM pattern analysis. Output ONLY a JSON array.`,
      messages: [{
        role: "user",
        content: `CRM account health distribution:
${Object.entries(archetypeGroups).map(([arch, accs]) =>
          `${arch.toUpperCase()} (${accs.length} accounts): ${accs.slice(0, 3).map((a) => `${a.name} ($${(a.acv / 1e6).toFixed(1)}M, ${a.days}d silent)`).join(", ")}`
        ).join("\n")}

  Generate 3-5 investment risk signals based on these CRM patterns. Each signal should be analytically interesting and actionable.

  Format each as:
  {
    "company": "<most affected company or 'Portfolio-wide'>",
    "ticker": "<ticker or abbreviation>",
    "severity": "<High|Medium|Low>",
    "category": "<crm_signal|regulatory|earnings|general>",
    "description": "<specific, analytical 1-2 sentence risk insight>",
    "confidence": <60-85>,
    "hoursAgo": <1-168>,
    "time": "<human readable time>",
    "source": "CRM Pattern Analysis",
    "account_id": null
  }

  Return ONLY a JSON array.`,
      }],
    });

    const raw = response.content[0].text.trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    return JSON.parse(cleaned) || [];
  } catch (err) {
    handleAIError(err, "signals:generateCRMPatternSignals");
    return [];
  }
}

export async function generateMarketEvents(accounts) {

  const sectors = [...new Set(accounts.map((a) => a.industry))];
  const topCompanies = accounts
    .sort((a, b) => Number(b.annual_contract_value) - Number(a.annual_contract_value))
    .slice(0, 8)
    .map((a) => a.account_name);

  let articles = [];
  if (process.env.NEWS_API_KEY) {
    articles = await fetchBatchNews(topCompanies, 30);
  }

  try {
    const response = await callModel({
      system: `You are Nexus's event intelligence engine. Analyze market events and reason about their impact on a portfolio.
Output ONLY valid JSON. Be concise — each field max 1 sentence.`,
      messages: [{
        role: "user",
        content: `Portfolio companies: ${topCompanies.join(", ")}
Sectors: ${sectors.join(", ")}

  ${articles.length > 0 ? `Recent news:\n${articles.slice(0, 8).map((a) => `- ${a.title}`).join("\n")}` : "No external news — reason from sector knowledge."}

  Generate 5 event-driven investment signals (keep each field under 20 words):
  [{"event_title":"","event_type":"<bankruptcy|merger_acquisition|executive_change|regulatory|funding|earnings|macro>","affected_company":"","is_competitor_event":false,"impact_on_portfolio":"","opportunity_or_threat":"<opportunity|threat|neutral>","affected_accounts":[],"confidence_score":0.8,"action_recommendation":"","time_sensitivity":"<immediate|within_week|within_month|monitor>","supporting_evidence":""}]

  Return ONLY a JSON array.`,
      }],
    });

    const raw = response.content.trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    const events = JSON.parse(cleaned) || [];

    return events.map((event) => ({
      ...event,
      affected_account_ids: (event.affected_accounts || [])
        .map((name) => accounts.find((a) => a.account_name === name || a.account_name.includes(name))?.account_id)
        .filter(Boolean),
      generated_at: new Date().toISOString(),
    }));
  } catch (err) {
    handleAIError(err, "signals:generateMarketEvents");
    return [];
  }
}

export async function generatePortfolioSignals(accounts) {
  const topAccounts = accounts
    .sort((a, b) => Number(b.annual_contract_value) - Number(a.annual_contract_value))
    .slice(0, 15);

  const marketDataMap = {};
  const tickerAccounts = topAccounts.filter((a) => TICKER_MAP[a.account_name]);

  await Promise.all(
    tickerAccounts.slice(0, 8).map(async (a) => {
      const ticker = TICKER_MAP[a.account_name];
      const data = await fetchYahooQuote(ticker);
      if (data) marketDataMap[a.account_id] = data;
    })
  );

  let newsMap = {};
  if (process.env.NEWS_API_KEY) {
    const companyNames = topAccounts.slice(0, 5).map((a) => a.account_name);
    const articles = await fetchBatchNews(companyNames, 14);

    topAccounts.forEach((account) => {
      newsMap[account.account_id] = articles.filter(
        (a) =>
          a.title.includes(account.account_name) ||
          a.description?.includes(account.account_name)
      );
    });
  }

  const signals = await Promise.all(
    accounts.map(async (account) => {
      const marketData = marketDataMap[account.account_id];
      const news = newsMap[account.account_id] || [];
      const archetype = account.health_archetype;
      const days = Number(account.days_since_last_contact) || 0;
      const acv = Number(account.annual_contract_value) || 0;

      const { sentimentScore, riskScore } = computeAccountScores(account, marketData);
      const { signalType, explanation } = determineAccountSignal(account, sentimentScore, riskScore, news);

      return {
        account_id: account.account_id,
        account_name: account.account_name,
        ticker: TICKER_MAP[account.account_name] || null,
        sentiment_score: sentimentScore,
        risk_score: riskScore,
        signal_type: signalType,
        explanation: explanation,
        market_data: marketData || null,
        news_count: news.length,
        archetype,
        days_since_contact: days,
      };
    })
  );

  return signals;
}

function computeAccountScores(account, marketData) {
  const archetype = account.health_archetype;
  const days = Number(account.days_since_last_contact) || 0;
  const archetypeScores = {
    healthy: { sentiment: 0.6, risk: 15 },
    expanding: { sentiment: 0.8, risk: 10 },
    dormant: { sentiment: 0.2, risk: 55 },
    at_risk: { sentiment: -0.1, risk: 75 },
  };
  const baseline = archetypeScores[archetype] || { sentiment: 0.3, risk: 30 };

  let sentimentAdj = 0;
  let riskAdj = 0;
  if (marketData) {
    sentimentAdj = marketData.monthChange > 0 ? 0.1 : -0.1;
    riskAdj = Math.abs(marketData.dayChange) > 3 ? 10 : 0;
  }

  const daysPenalty = Math.min(days / 100, 0.3);
  const sentimentScore = parseFloat(Math.max(-1, Math.min(1, baseline.sentiment - daysPenalty + sentimentAdj)).toFixed(2));
  const riskScore = parseFloat(Math.min(100, baseline.risk + daysPenalty * 30 + riskAdj).toFixed(1));

  return { sentimentScore, riskScore };
}

function determineAccountSignal(account, sentimentScore, riskScore, news) {
  const archetype = account.health_archetype;
  const days = Number(account.days_since_last_contact) || 0;
  let type = "hold";
  let expl = `CRM archetype: ${archetype}`;

  if (archetype === "expanding" && sentimentScore > 0.5) {
    type = "outperform";
    expl = `Expanding account with positive trend`;
  } else if (archetype === "at_risk" || riskScore > 70) {
    type = "underperform";
    expl = `At-risk classification with ${days}d silence`;
  } else if (archetype === "healthy" && days < 30) {
    type = "buy";
    expl = `Healthy engagement, recent contact`;
  } else if (archetype === "dormant") {
    type = "sell";
    expl = `Dormant — ${days} days without contact`;
  }

  if (news.length > 0) {
    expl += ` | Recent news: ${news[0].title.slice(0, 60)}`;
  }

  return { signalType: type, explanation: expl };
}

export async function generateSentimentHistory(accounts) {

  const totalAccounts = accounts.length;
  const archetypeDist = accounts.reduce((acc, a) => {
    acc[a.health_archetype] = (acc[a.health_archetype] || 0) + 1;
    return acc;
  }, {});

  const avgDaysSilent = accounts.reduce((s, a) => s + Number(a.days_since_last_contact || 0), 0) / totalAccounts;
  const atRiskPct = ((archetypeDist.at_risk || 0) + (archetypeDist.dormant || 0)) / totalAccounts;
  const healthyPct = ((archetypeDist.healthy || 0) + (archetypeDist.expanding || 0)) / totalAccounts;

  let recentNews = [];
  if (process.env.NEWS_API_KEY) {
    const topCompanies = accounts
      .sort((a, b) => Number(b.annual_contract_value) - Number(a.annual_contract_value))
      .slice(0, 4)
      .map((a) => a.account_name);
    recentNews = await fetchBatchNews(topCompanies, 30);
  }

  try {
    const response = await callModel({
      system: `You generate realistic historical time-series data for portfolio risk analytics dashboards.
Given current portfolio metrics, extrapolate plausible historical trends.
Output ONLY valid JSON array.`,
      messages: [{
        role: "user",
        content: `Current portfolio state (as of today):
  - Total accounts: ${totalAccounts}
  - At-risk/Dormant: ${(atRiskPct * 100).toFixed(0)}% of portfolio
  - Healthy/Expanding: ${(healthyPct * 100).toFixed(0)}% of portfolio
  - Average days since last contact: ${avgDaysSilent.toFixed(0)}
  - Archetype distribution: ${JSON.stringify(archetypeDist)}
  ${recentNews.length > 0 ? `- Recent news events: ${recentNews.slice(0, 5).map((a) => a.title).join("; ")}` : ""}

  Generate 12 months of plausible portfolio-level risk and sentiment data leading to today's state.
  The trend should be consistent with the current health distribution.

  Return array of 12 objects (oldest to newest, last entry = current month):
  {
    "date": "<Month abbreviation: Jan, Feb, etc.>",
    "sentiment": <-1.0 to 1.0 — portfolio sentiment score>,
    "risk": <0-100 — portfolio risk score>,
    "anomaly": <0-10 — number of anomalous signals detected>
  }

  Make the trend realistic — slight variations, no sudden jumps unless a major event.
  Current sentiment should be approximately ${(healthyPct - atRiskPct).toFixed(2)}.
  Current risk should be approximately ${(atRiskPct * 80 + 20).toFixed(0)}.

  Return ONLY the JSON array.`,
      }],
    });

    const raw = response.content.trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    const history = JSON.parse(cleaned);
    if (!Array.isArray(history) || history.length === 0) throw new Error("Empty history");

    return history.map((h) => ({
      date: h.date,
      sentiment: parseFloat(Number(h.sentiment).toFixed(2)),
      risk: parseFloat(Number(h.risk).toFixed(1)),
      anomaly: Math.round(Number(h.anomaly) || 0),
    }));
  } catch (err) {
    handleAIError(err, "signals:generateSentimentHistory");
    return generateFallbackHistory(atRiskPct, healthyPct);
  }
}

function generateFallbackHistory(atRiskPct, healthyPct) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentSentiment = healthyPct - atRiskPct;
  const currentRisk = atRiskPct * 80 + 20;

  return months.map((date, i) => {
    const progress = i / 11;
    const noise = (Math.sin(i * 1.5) * 0.05);
    return {
      date,
      sentiment: parseFloat((currentSentiment * progress + 0.1 * (1 - progress) + noise).toFixed(2)),
      risk: parseFloat((currentRisk * progress + 25 * (1 - progress) + noise * 10).toFixed(1)),
      anomaly: Math.round(1 + Math.abs(Math.sin(i)) * 4),
    };
  });
}

export function buildHeatmapData(accounts) {
  const archetypeRisk = {
    healthy: "Low", expanding: "Low", dormant: "Medium", at_risk: "High",
  };

  return accounts
    .filter((a) => TICKER_MAP[a.account_name] || Number(a.annual_contract_value) > 500_000)
    .sort((a, b) => Number(b.annual_contract_value) - Number(a.annual_contract_value))
    .slice(0, 12)
    .map((a) => {
      const days = Number(a.days_since_last_contact) || 0;
      let level = archetypeRisk[a.health_archetype] || "Medium";

      if (level === "Low" && days > 90) level = "Medium";

      if (a.health_archetype === "at_risk" && Number(a.annual_contract_value) > 2_000_000) level = "High";

      return {
        ticker: TICKER_MAP[a.account_name] || a.account_name.slice(0, 4).toUpperCase(),
        company: a.account_name,
        level,
        account_id: a.account_id,
        acv: Number(a.annual_contract_value) || 0,
      };
    });
}

export function buildSectorRiskTrends(accounts) {
  const sectorStats = {};

  accounts.forEach((a) => {
    const sector = a.industry || "Unknown";
    if (!sectorStats[sector]) {
      sectorStats[sector] = { total: 0, atRisk: 0, dormant: 0, totalACV: 0 };
    }
    sectorStats[sector].total++;
    sectorStats[sector].totalACV += Number(a.annual_contract_value) || 0;
    if (a.health_archetype === "at_risk") sectorStats[sector].atRisk++;
    if (a.health_archetype === "dormant") sectorStats[sector].dormant++;
  });

  const sorted = Object.entries(sectorStats)
    .map(([sector, stats]) => ({
      sector,
      riskPct: ((stats.atRisk + stats.dormant) / stats.total) * 100,
      totalACV: stats.totalACV,
    }))
    .sort((a, b) => b.riskPct - a.riskPct)
    .slice(0, 5);

  const ranges = {};
  ["24H", "7D", "30D"].forEach((range) => {
    const factor = range === "24H" ? 0.2 : range === "7D" ? 0.6 : 1.0;
    ranges[range] = sorted.map((s) => ({
      sector: s.sector,
      change: parseFloat((s.riskPct * factor).toFixed(1)),
    }));
  });

  return ranges;
}