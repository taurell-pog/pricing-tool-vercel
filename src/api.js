// ─────────────────────────────────────────────────────────────────────────────
//  RESEARCH PIPELINE - Two-agent architecture
//
//  Agent 1: Sonnet (competitive map builder)
//    - Builds the list of 7-10 real competitors for a LORGAR SKU
//    - Verifies each candidate is available at >=1 of the 4 top retailers
//    - Returns: [{vendor, product_name, retailer_url, aggregator_url, features, brand_strength}]
//
//  Agent 2: Haiku (price scout) - runs in parallel for each item
//    - Takes a single retailer URL + product name
//    - Tries web_fetch on the URL first; falls back to web_search if blocked/missing
//    - Returns: {price, currency, observed_at}
//
//  Orchestrator (researchSku):
//    - LORGAR price (Haiku, 1 call)
//    - Competitor map (Sonnet, 1 call)
//    - Competitor prices (Haiku, N parallel calls)
//    - JS post-processing: scoring, filtering, WIN/LOSE classification
// ─────────────────────────────────────────────────────────────────────────────

import { MARKETS, COMPETITOR_BRANDS, BRAND_PRESENCE } from "./data.js";

const ENDPOINT = "/api/claude";
const MODEL_SONNET = "claude-sonnet-4-20250514";
const MODEL_HAIKU = "claude-haiku-4-5-20251001";

// ── Generic API call with retry on transient errors ─────────────────────────
async function callClaude(body, attempt = 0) {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (resp.ok) return resp.json();
  const txt = await resp.text();
  let msg = `HTTP ${resp.status}`;
  try { const j = JSON.parse(txt); if (j.error?.message) msg = j.error.message; } catch {}
  // Retry only transient errors (rate limit, timeout, overloaded)
  if ([429, 504, 529].includes(resp.status) && attempt < 2) {
    const wait = resp.status === 429 ? 30000 : 5000;
    await new Promise(r => setTimeout(r, wait));
    return callClaude(body, attempt + 1);
  }
  throw new Error(msg);
}

// ── Robust JSON extraction (handles preamble, code fences, trailing notes) ──
function extractJSON(text) {
  if (!text) throw new Error("Empty response");
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  // Find { or [ start
  let start = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  if (arrStart !== -1 && (start === -1 || arrStart < start)) start = arrStart;
  if (start === -1) throw new Error("No JSON in: " + text.slice(0, 200));
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) {
      const slice = cleaned.slice(start, i + 1);
      try { return JSON.parse(slice); } catch (e) {
        throw new Error(`JSON parse failed: ${e.message}\nPreview: ${slice.slice(0, 300)}`);
      }
    }}
  }
  throw new Error("Incomplete JSON in response");
}

function getTextFromResponse(resp) {
  return (resp.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
//  AGENT 1: Sonnet — Build competitive map
// ─────────────────────────────────────────────────────────────────────────────
async function buildCompetitiveMap(product, country) {
  const market = MARKETS[country];
  const eligibleBrands = COMPETITOR_BRANDS
    .filter(b => b.cats.includes(product.c))
    .map(b => b.name)
    .join(", ");

  const prompt =
`Build a competitive map for a LORGAR product in ${country}. Find 7-10 real competitors that gamers/buyers in this market would actually compare against LORGAR.

TARGET PRODUCT
  Name: ${product.n}
  SKU: ${product.s}
  Category: ${product.c}

MARKET
  Country: ${country}
  Currency: ${market.currency}
  Top retailers: ${market.retailers.join(", ")}
  Aggregator: ${market.aggregator}

WHAT MAKES A "REAL COMPETITOR"
  1. Same category as LORGAR (${product.c})
  2. Available at AT LEAST 1 of the 4 top retailers above (this is the bar - many brands work exclusively with one retailer chain)
  3. Listed on the aggregator (${market.aggregator}) - this proves real local availability
  4. Same general feature class (wireless competes with wireless, TKL with TKL, etc.)
  5. From a brand listed here: ${eligibleBrands}

PROCESS (use 6-10 web_search calls)
  1. Search ${market.aggregator} for the LORGAR product category. Browse what's actually being sold and at what price range.
  2. Search ${market.aggregator} for specific competing brand+category combos to widen brand variety.
  3. For each candidate, find AT LEAST one specific retailer product page (URL on x-kom.pl, alza.cz, emag.ro, etc).
  4. Skip out-of-stock, discontinued, marketplace 3rd-party-only, or unavailable items.
  5. Aim for brand variety: prefer 7+ different brands over 10 products from 3 brands.

OUTPUT - return ONLY this JSON array, 7-10 items, no markdown, no commentary:
[
  {
    "vendor": "<brand name>",
    "product_name": "<full product name>",
    "retailer_url": "<URL of one specific top-retailer product page where this product can be bought>",
    "aggregator_url": "<URL of the aggregator listing for this product>",
    "features": ["<2-4 short feature tags, e.g. 'wireless', 'RGB', '60g'>"],
    "positioning": "<one short sentence describing how it positions vs LORGAR ${product.n}>"
  }
]

Inside string values, NEVER use unescaped double quotes - rephrase if needed.`;

  const resp = await callClaude({
    model: MODEL_SONNET,
    max_tokens: 4000,
    system: [{
      type: "text",
      text: "You are a senior pricing analyst at ASBIS, distributor of LORGAR gaming peripherals. You build competitive maps by researching what real competitors exist in each market. Respond with ONLY a valid JSON array. No preamble, no markdown, no narration. Inside string values, never use unescaped double quotes.",
      cache_control: { type: "ephemeral" },
    }],
    tools: [{
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 10,
      user_location: { type: "approximate", country: market.code },
    }],
    messages: [{ role: "user", content: prompt }],
  });

  const text = getTextFromResponse(resp);
  const competitors = extractJSON(text);
  if (!Array.isArray(competitors)) throw new Error("Sonnet did not return an array");
  return competitors;
}

// ─────────────────────────────────────────────────────────────────────────────
//  fetchPrice - Aggregator-first price scout
//
//  Why aggregator first?
//    Modern retailer sites (x-kom, alza, emag etc) are React/Next.js SPAs
//    that render prices client-side. Anthropic's web_fetch gets the raw HTML
//    (no JS execution), which often doesn't contain the price.
//    Aggregators (ceneo, heureka, arukereso, compari) have STATIC HTML with
//    prices visible to crawlers — far more reliable.
//
//  Strategy:
//    1. Search the aggregator for the product. Read price from the listing.
//    2. If aggregator has nothing, search the retailer directly via Google.
//    3. If still nothing, return null (genuinely unavailable).
//
//  modelOverride: pass MODEL_SONNET for critical lookups (e.g. LORGAR price);
//                 default is Haiku for cheap/fast competitor lookups.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchPrice(productName, retailerUrl, aggregatorUrl, country, modelOverride) {
  const market = MARKETS[country];
  const model = modelOverride || MODEL_HAIKU;

  const aggregatorLine = aggregatorUrl ? "AGGREGATOR LISTING: " + aggregatorUrl + "\n" : "";
  const retailerLine = retailerUrl ? "RETAILER PAGE: " + retailerUrl + "\n" : "";

  const prompt =
`Find the CURRENT selling price for one product in ${country}.

PRODUCT: ${productName}
${aggregatorLine}${retailerLine}CURRENCY: ${market.currency}

STRATEGY (in order — stop at the first success)
  1. Search ${market.aggregator} for the product. Aggregators have static HTML
     and clearly visible per-retailer prices. This is your PRIMARY source —
     prefer it even when a retailer URL is given. Pick the LOWEST current
     selling price from a trusted retailer (${market.retailers.join(", ")}).
  2. If the aggregator has no result for this product, search Google for
     "<product name> ${market.currency}" and look for prices in snippets from
     the trusted retailers above.
  3. If still nothing, search for "<product name> ${country}" — the product
     might exist somewhere we haven't tried.

  Critical: report only CURRENT selling price (NOT crossed-out RRP, NOT historical,
  NOT a different product variant). Reject 3rd-party marketplace listings.

OUTPUT - return ONLY this JSON, no markdown, no commentary:
{
  "price": <number or null>,
  "currency": "${market.currency}",
  "source_url": "<URL where you confirmed the price>",
  "source_name": "<retailer or aggregator domain>",
  "in_stock": <true or false>,
  "note": "<one short sentence explaining where the price came from, or why it couldn't be found>"
}`;

  const resp = await callClaude({
    model,
    max_tokens: 600,
    system: [{
      type: "text",
      text: "You are a price scout. You find current selling prices on European e-commerce sites. Aggregators (ceneo, heureka, arukereso, compari) are your primary source — their HTML is static and price data is reliable. Respond with ONLY a single valid JSON object. Never use unescaped double quotes inside string values.",
      cache_control: { type: "ephemeral" },
    }],
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: market.code } },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const text = getTextFromResponse(resp);
  return extractJSON(text);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scoring (50% price proximity, 25% brand strength, 25% feature match)
// ─────────────────────────────────────────────────────────────────────────────
function scorePriceProximity(idx) {
  if (idx == null) return 0;
  // Soft filter: 60-160% sweet spot, gradual falloff outside
  if (idx >= 85 && idx <= 115) return 50;
  if (idx >= 75 && idx <= 125) return 40;
  if (idx >= 65 && idx <= 140) return 25;
  if (idx >= 60 && idx <= 160) return 12;
  return 3;
}

function scoreBrandStrength(vendor, country) {
  const code = MARKETS[country]?.code || "PL";
  const presence = BRAND_PRESENCE[vendor]?.[code];
  if (presence == null) return 8;
  // Map presence (0-30) onto 0-25
  return Math.min(25, Math.round((presence / 30) * 25));
}

function scoreFeatureMatch(productCategory, lorgarName, competitorName, competitorTags = []) {
  const ln = lorgarName.toLowerCase();
  const cn = (competitorName || "").toLowerCase();
  const tags = competitorTags.map(t => t.toLowerCase());
  let score = 0;

  // Universal: wireless vs wired alignment
  const lWireless = ln.includes("wireless") || ln.includes("w ") || /\bw\b/.test(ln);
  const cWireless = cn.includes("wireless") || tags.includes("wireless");
  score += lWireless === cWireless ? 10 : 3;

  // Category-specific feature checks
  if (productCategory === "Gaming Mice") {
    const lLight = ln.includes("jetter") || ln.includes("90w");
    const cLight = cn.includes("ultralight") || cn.includes("superlight") || tags.includes("lightweight") || tags.some(t => /\d+g/.test(t));
    score += lLight === cLight ? 8 : 3;
    score += 7;
  } else if (productCategory === "Gaming Keyboards") {
    const lTKL = ln.includes("tkl");
    const l75 = ln.includes("75");
    const cTKL = cn.includes("tkl");
    const c75 = cn.includes("75") || tags.includes("75%");
    if (lTKL === cTKL && l75 === c75) score += 12;
    else if (lTKL || l75 || cTKL || c75) score += 6;
    else score += 9;
    score += 3;
  } else if (productCategory === "Gaming Headsets") {
    const lFlagship = ln.includes("702") || ln.includes("elite");
    const cFlagship = cn.includes("pro") || cn.includes("elite") || cn.includes("nova pro");
    score += lFlagship === cFlagship ? 8 : 4;
    score += 7;
  } else if (productCategory === "Webcams & Mics") {
    const lMic = ln.includes("smp") || ln.includes("microphone");
    const cMic = cn.includes("mic") || cn.includes("yeti") || cn.includes("seiren") || tags.includes("microphone");
    if (lMic !== cMic) return 0; // wrong subcategory
    score += 15;
  } else if (productCategory === "Mousepads") {
    const lRGB = ln.includes("919") || ln.includes("rgb");
    const cRGB = cn.includes("rgb") || tags.includes("rgb");
    score += lRGB === cRGB ? 10 : 3;
    score += 5;
  }
  return Math.min(score, 25);
}

function classifyAndScore(competitor, lorgarPrice, lorgarName, productCategory, country) {
  const c = { ...competitor };
  if (lorgarPrice && c.price) {
    const idx = Math.round((c.price / lorgarPrice) * 1000) / 10;
    c.price_index = idx;
    // WIN/LOSE from LORGAR's perspective: LORGAR cheaper = WIN
    if (idx > 105) c.win_lose = "WIN";
    else if (idx < 95) c.win_lose = "LOSE";
    else c.win_lose = "PARITY";
    if (idx < 95) c.price_band = "GOOD";
    else if (idx <= 130) c.price_band = "BETTER";
    else c.price_band = "BEST";
    if (c.win_lose === "LOSE") {
      c.recommended_price = Math.round(c.price * 0.97 * 100) / 100;
      c.price_move_pct = Math.round(((c.recommended_price - lorgarPrice) / lorgarPrice) * 1000) / 10;
    } else {
      c.recommended_price = null;
      c.price_move_pct = null;
    }
  } else {
    c.price_index = null;
    c.win_lose = null;
    c.price_band = null;
    c.recommended_price = null;
    c.price_move_pct = null;
  }
  // Scoring breakdown
  c._priceScore = scorePriceProximity(c.price_index);
  c._brandScore = scoreBrandStrength(c.vendor, country);
  c._featureScore = scoreFeatureMatch(productCategory, lorgarName, c.product_name, c.features || []);
  c._totalScore = c._priceScore + c._brandScore + c._featureScore;
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ORCHESTRATOR: research one SKU on one market
//  Returns full pricing record ready for storage + display.
// ─────────────────────────────────────────────────────────────────────────────
export async function researchSku(product, country, onProgress) {
  const market = MARKETS[country];
  const observedAt = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  onProgress?.("Building competitive map (Sonnet)...");

  // Step 1: Sonnet builds competitive map (we also pass LORGAR product info for its own price lookup later)
  const competitorMap = await buildCompetitiveMap(product, country);

  onProgress?.(`Found ${competitorMap.length} competitors. Scouting prices...`);

  // Step 2: LORGAR price + each competitor price in parallel via Haiku
  // Build search URL for LORGAR (we don't have its retailer URL beforehand)
  const lorgarAggUrl = market.aggregatorSearch(product.n);
  const lorgarPriceP = fetchPrice(product.n, null, lorgarAggUrl, country, MODEL_SONNET)
    .catch(err => ({ price: null, currency: market.currency, source_url: null, source_name: null, in_stock: false, note: `Error: ${err.message}` }));

  const competitorPriceP = competitorMap.map(c =>
    fetchPrice(c.product_name, c.retailer_url, c.aggregator_url, country)
      .catch(err => ({ price: null, currency: market.currency, source_url: null, source_name: null, in_stock: false, note: `Error: ${err.message}` }))
  );

  const [lorgarPriceData, ...competitorPriceData] = await Promise.all([lorgarPriceP, ...competitorPriceP]);

  onProgress?.("Computing scores...");

  // Step 3: Merge competitor map + price data, compute scores
  const competitors = competitorMap.map((c, i) => {
    const pd = competitorPriceData[i];
    const merged = {
      vendor: c.vendor,
      product_name: c.product_name,
      features: c.features || [],
      positioning: c.positioning || "",
      price: pd.price,
      currency: pd.currency || market.currency,
      retail_link: c.retailer_url,
      comparison_link: c.aggregator_url,
      price_source: pd.source_name,
      price_source_url: pd.source_url,
      in_stock: pd.in_stock,
      price_note: pd.note,
    };
    return classifyAndScore(merged, lorgarPriceData.price, product.n, product.c, country);
  });

  // Drop competitors with no price (Haiku couldn't find a real one)
  const validCompetitors = competitors.filter(c => c.price != null);

  // Sort by total score desc, keep top 10
  validCompetitors.sort((a, b) => b._totalScore - a._totalScore);
  const topCompetitors = validCompetitors.slice(0, 10);

  return {
    sku: product.s,
    product_name: product.n,
    category: product.c,
    country,
    currency: market.currency,
    observed_at: observedAt,
    lorgar_price: lorgarPriceData.price,
    lorgar_retail_link: lorgarPriceData.source_url,
    lorgar_comparison_link: lorgarAggUrl,
    lorgar_in_stock: lorgarPriceData.in_stock,
    availability_note: lorgarPriceData.note,
    competitors: topCompetitors,
  };
}
