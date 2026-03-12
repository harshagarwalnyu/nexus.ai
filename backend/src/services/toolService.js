const NIA_BASE = process.env.NIA_BASE_URL || "https://apigcp.trynia.ai/v2";
const NIA_KEY = process.env.NIA_API_KEY;
const NEWS_KEY = process.env.NEWSDATA_API_KEY;

async function withRetry(fn, maxAttempts = 3, baseDelayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[tools] Attempt ${attempt} failed — retrying in ${delay}ms. Error: ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function niaCrawl(task) {
  if (!NIA_KEY) {
    console.warn("[tools:niaCrawl] NIA_API_KEY not configured — skipping task", task.task_id);
    return { task_id: task.task_id, tool: task.tool, error: "NIA_API_KEY not configured — skipping web search" };
  }

  const payload = { query: task.query };

  const res = await fetch(`${NIA_BASE}/web-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NIA_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nia web-search error ${res.status}: ${text}`);
  }

  const data = await res.json();

  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "Nia Web Search",
    result: data,
  };
}

async function niaOracle(task) {
  if (!NIA_KEY) {
    console.warn("[tools:niaOracle] NIA_API_KEY not configured — skipping task", task.task_id);
    return { task_id: task.task_id, tool: task.tool, error: "NIA_API_KEY not configured — skipping oracle research" };
  }

  const payload = {
    query: task.query,
    output_format: "Structured summary with key findings, sources, and bullet points",
  };

  const res = await fetch(`${NIA_BASE}/oracle`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NIA_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),

  });

  if (!res.ok) {

    console.warn(`[tools:niaOracle] /oracle returned ${res.status} — falling back to /deep-research`);
    return deepResearchFallback(task);
  }

  const data = await res.json();

  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "Nia Oracle Research Agent",
    result: data,
  };
}

async function deepResearchFallback(task) {
  if (!NIA_KEY) {
    return { task_id: task.task_id, tool: task.tool, error: "NIA_API_KEY not configured — skipping deep research" };
  }
  const payload = { query: task.query };

  const res = await fetch(`${NIA_BASE}/deep-research`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NIA_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nia deep-research error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "Nia Deep Research",
    result: data,
  };
}

async function newsApi(task) {
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey && !NEWS_KEY) {
    console.warn("[tools:newsApi] NEWSDATA_API_KEY not configured — skipping task", task.task_id);
    return { task_id: task.task_id, tool: task.tool, error: "NEWSDATA_API_KEY not configured — skipping news lookup" };
  }

  const finalApiKey = apiKey || NEWS_KEY;

  const query = encodeURIComponent(task.query);

  const url = `https://newsdata.io/api/1/news?apikey=${finalApiKey}&q=${query}&language=en`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();

    throw new Error(`NewsData.io error ${res.status}: ${text}`);
  }

  const data = await res.json();

  if (data.status !== "success") {
    throw new Error(`NewsData.io API returned status: ${data.status}`);
  }

  const articles = (data.results || []).slice(0, 5).map((a) => ({
    title: a.title,
    source: a.source_id || "Unknown Source",
    publishedAt: a.pubDate,
    url: a.link,
    description: a.description,
  }));

  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "NewsData.io",
    result: { totalResults: data.totalResults, articles },
  };
}

async function yahooFinance(task) {

  const ticker = task.ticker;
  if (!ticker) {
    return {
      task_id: task.task_id,
      tool: task.tool,
      source: "Yahoo Finance",
      result: { note: "No ticker symbol provided — skipping financial lookup", query: task.query },
    };
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance error ${res.status} for ${ticker}`);
  }

  const data = await res.json();
  const meta = data.chart?.result?.[0]?.meta;

  if (!meta) throw new Error(`Yahoo Finance: no data for ${ticker}`);

  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "Yahoo Finance",
    result: {
      ticker,
      currency: meta.currency,
      regularMarketPrice: meta.regularMarketPrice,
      previousClose: meta.previousClose,
      marketCap: meta.marketCap,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      exchangeName: meta.exchangeName,
      longName: meta.longName,
      query: task.query,
    },
  };
}

async function secEdgarFiling(task) {
  const companyName = task.company_name || task.query;
  const encoded = encodeURIComponent(companyName);

  const url =
    `https://efts.sec.gov/LATEST/search-index?q=%22${encoded}%22&forms=D&dateRange=custom` +
    `&startdt=2020-01-01&enddt=${new Date().toISOString().slice(0, 10)}&_source=period_of_report,display_names,file_date,period_of_report,biz_location,form_type` +
    `&hits.hits.total.value=true&hits.hits._source.period_of_report=true`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Nexus/1.0 research@omnisight.ai" },
  });

  if (!res.ok) {
    throw new Error(`SEC EDGAR error ${res.status} for "${companyName}"`);
  }

  const data = await res.json();
  const hits = data.hits?.hits ?? [];

  const filings = await Promise.all(
    hits.slice(0, 5).map(async (hit) => {
      const cik = hit._source?.entity_id || hit._id?.split(":")?.[0];
      const entityName = hit._source?.display_names?.[0] || companyName;
      const fileDate = hit._source?.file_date || hit._source?.period_of_report || "Unknown";

      let offeringAmount = null;
      let investors = [];
      let filingUrl = null;

      if (cik) {
        try {
          const paddedCik = String(cik).padStart(10, "0");

          const subRes = await fetch(
            `https://data.sec.gov/submissions/CIK${paddedCik}.json`,
            { headers: { "User-Agent": "Nexus/1.0 research@omnisight.ai" } }
          );

          if (subRes.ok) {
            const subData = await subRes.json();
            const recentFilings = subData.filings?.recent;
            const formDIdx = recentFilings?.form?.findIndex((f) => f === "D" || f === "D/A");

            if (formDIdx !== undefined && formDIdx >= 0) {
              const accessionRaw = recentFilings.accessionNumber?.[formDIdx]?.replace(/-/g, "");
              if (accessionRaw) {

                filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionRaw}/`;

                const formRes = await fetch(
                  `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionRaw}/primary_doc.xml`,
                  { headers: { "User-Agent": "Nexus/1.0 research@omnisight.ai" } }
                );
                if (formRes.ok) {
                  const xml = await formRes.text();
                  const amountMatch = xml.match(/<totalOfferingAmount>([^<]+)</);
                  if (amountMatch) offeringAmount = parseFloat(amountMatch[1]);
                  const investorMatches = [...xml.matchAll(/<investorName>([^<]+)</g)];
                  investors = investorMatches.map((m) => m[1]).slice(0, 5);
                }
              }
            }
          }
        } catch (_) {

        }
      }

      return {
        entityName,
        fileDate,
        formType: hit._source?.form_type || "D",
        totalOfferingAmount: offeringAmount,
        investors,
        location: hit._source?.biz_location || null,
        filingUrl:
          filingUrl ||
          `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(companyName)}&type=D&action=getcompany`,
      };
    })
  );

  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "SEC EDGAR (Form D Filings — public)",
    result: {
      company: companyName,
      totalFilingsFound: data.hits?.total?.value ?? hits.length,
      filings,
    },
  };
}

async function clearbitDomain(task) {
  const companyName = task.company_name || task.query;
  const encoded = encodeURIComponent(companyName);

  const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encoded}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Nexus/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Clearbit autocomplete error ${res.status} for "${companyName}"`);
  }

  const suggestions = await res.json();

  if (!suggestions || suggestions.length === 0) {
    return {
      task_id: task.task_id,
      tool: task.tool,
      source: "Clearbit Autocomplete (free)",
      result: { note: `No Clearbit match found for "${companyName}"`, company: companyName },
    };
  }

  const best = suggestions[0];

  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "Clearbit Autocomplete (free)",
    result: {
      company: best.name,
      domain: best.domain,
      logo: best.logo,

      alternatives: suggestions.slice(1, 4).map((s) => ({ name: s.name, domain: s.domain })),
    },
  };
}

async function openVcInvestors(task) {

  const sector = task.sector || extractSectorFromQuery(task.query);
  const stage = task.stage || extractStageFromQuery(task.query);
  const geo = task.geo || "";

  const params = new URLSearchParams();
  if (sector) params.set("sectors", sector);
  if (stage) params.set("stages", stage);
  if (geo) params.set("geography", geo);
  params.set("limit", "20");

  const url = `https://openvc.app/api/vcs?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Nexus/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`[tools:openvc] Direct API returned ${res.status} (Cloudflare). Falling back to dynamic Nia Oracle discovery...`);

    const oracleResult = await niaOracle({
      task_id: task.task_id,
      tool: "competitor_intel",
      query: `Identify 5 active Venture Capital firms investing in ${stage || "early-stage"} ${sector || "startups"} ${geo ? "in " + geo : ""}. Return their names, check sizes, and investment thesis.`
    });

    return {
      task_id: task.task_id,
      tool: task.tool,
      source: "OpenVC (via Nia AI Discovery)",
      result: {
        note: "OpenVC live API unreachable (403). Investors sourced dynamically via Nia.",
        sector,
        stage,
        investors: [
          { name: "Dynamic AI Discovery", thesis: "See preview of unstructured AI report below for investor list", checkSize: "Varies" }
        ],
        raw_ai_report: oracleResult.result
      }
    };
  }

  const data = await res.json();
  const investors = (Array.isArray(data) ? data : data.results ?? data.vcs ?? []).slice(0, 20);

  return {
    task_id: task.task_id,
    tool: task.tool,
    source: "OpenVC (public VC database)",
    result: {
      sector,
      stage,
      totalFound: investors.length,
      investors: investors.map((vc) => ({
        name: vc.name || vc.firm_name,
        website: vc.website || vc.url,
        thesis: vc.thesis || vc.description,
        checkSize: vc.check_size || vc.typical_check,
        stages: vc.stages || vc.investment_stages,
        sectors: vc.sectors || vc.focus_sectors,
        geography: vc.geography || vc.geo,
      })),
    },
  };
}

function extractSectorFromQuery(query = "") {
  const q = query.toLowerCase();
  if (q.includes("fintech") || q.includes("financial")) return "fintech";
  if (q.includes("health") || q.includes("medtech") || q.includes("biotech")) return "healthtech";
  if (q.includes("saas") || q.includes("software")) return "saas";
  if (q.includes("ai") || q.includes("artificial intelligence") || q.includes("machine learning")) return "ai";
  if (q.includes("climate") || q.includes("clean") || q.includes("energy")) return "cleantech";
  if (q.includes("crypto") || q.includes("web3") || q.includes("blockchain")) return "web3";
  if (q.includes("ecommerce") || q.includes("retail")) return "ecommerce";
  return "";
}

function extractStageFromQuery(query = "") {
  const q = query.toLowerCase();
  if (q.includes("pre-seed") || q.includes("preseed")) return "pre-seed";
  if (q.includes("seed")) return "seed";
  if (q.includes("series a")) return "series_a";
  if (q.includes("series b")) return "series_b";
  if (q.includes("series c") || q.includes("growth")) return "growth";
  return "";
}

const TOOL_REGISTRY = {
  web_search: niaCrawl,
  social_listening: niaCrawl,
  news_api: newsApi,
  financial_api: yahooFinance,
  competitor_intel: niaOracle,
  hiring_trends: niaOracle,

  sec_edgar: secEdgarFiling,
  clearbit: clearbitDomain,
  openvc: openVcInvestors,
  crunchbase: secEdgarFiling,
};

async function executeOneTask(task) {
  const handler = TOOL_REGISTRY[task.tool];

  if (!handler) {
    console.warn(`[tools] Unknown tool "${task.tool}" for task ${task.task_id} — falling back to Nia`);
    return withRetry(() => niaCrawl(task));
  }

  try {
    return await withRetry(() => handler(task));
  } catch (err) {
    console.error(`[tools] Task ${task.task_id} (${task.tool}) failed after retries:`, err.message);
    return {
      task_id: task.task_id,
      tool: task.tool,
      error: err.message,
    };
  }
}

export async function executeTasks(taskList) {
  console.log(`[tools] Executing ${taskList.length} tasks in parallel...`);
  const results = await Promise.all(taskList.map(executeOneTask));
  const successes = results.filter((r) => !r.error).length;
  const failures = results.filter((r) => r.error).length;
  console.log(`[tools] Done — ${successes} succeeded, ${failures} failed`);
  return results;
}