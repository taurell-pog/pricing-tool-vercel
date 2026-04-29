import { useState, useEffect, useMemo, useCallback } from "react";
import Login from "./Login.jsx";
import { PRODUCTS, CATEGORIES, CAT_ICON, CAT_COLOR, MARKETS } from "./data.js";
import { researchSku } from "./api.js";
import { loadHistory, appendSnapshot, clearHistory, exportCSV, exportXLSX, buildFlatRows, loadPricelist, setPriceCell, getPriceCell } from "./storage.js";

const COUNTRIES = Object.keys(MARKETS);

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("research");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("pricing_session_v2");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
  }, []);

  function handleLogin(u) {
    sessionStorage.setItem("pricing_session_v2", JSON.stringify(u));
    setUser(u);
  }
  function handleLogout() {
    sessionStorage.removeItem("pricing_session_v2");
    setUser(null);
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#0d1117" }}>
      <TopBar user={user} tab={tab} onTab={setTab} onLogout={handleLogout} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "research" && <ResearchTab user={user} />}
        {tab === "pricelist" && <PricelistTab user={user} />}
        {tab === "history" && <HistoryTab user={user} />}
      </div>
    </div>
  );
}

// ─── Top bar ────────────────────────────────────────────────────────────────
function TopBar({ user, tab, onTab, onLogout }) {
  return (
    <div style={{ background: "#161b22", borderBottom: "1px solid #30363d", padding: "8px 18px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ background: "linear-gradient(135deg,#e85d04,#f4a261)", borderRadius: 7, padding: "4px 9px", fontSize: 14, fontWeight: 700, color: "#fff" }}>L</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>LORGAR Pricing Tool</div>
          <div style={{ fontSize: 10, color: "#6e7681" }}>{PRODUCTS.length} SKU · {COUNTRIES.length} markets</div>
        </div>
      </div>

      <div style={{ display: "flex", background: "#0d1117", borderRadius: 8, padding: 3, gap: 2, border: "1px solid #30363d", marginLeft: 16 }}>
        {[
          { id: "research",  label: "Research" },
          { id: "pricelist", label: "Pricelist" },
          { id: "history",   label: "History" },
        ].map(t => (
          <button key={t.id} onClick={() => onTab(t.id)}
            style={{ padding: "5px 16px", borderRadius: 6, border: "none", background: tab === t.id ? "#e85d04" : "transparent", color: tab === t.id ? "#fff" : "#8b949e", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#21262d", border: "1px solid #30363d", borderRadius: 20, padding: "4px 10px 4px 6px" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#e85d04,#f4a261)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{user.nick[0].toUpperCase()}</div>
        <span style={{ fontSize: 12, color: "#c9d1d9", fontWeight: 600 }}>{user.nick}</span>
      </div>
      <button onClick={onLogout} style={{ padding: "5px 10px", background: "transparent", border: "1px solid #30363d", borderRadius: 6, color: "#6e7681", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Log out</button>
    </div>
  );
}

// ─── Research tab ───────────────────────────────────────────────────────────
function ResearchTab({ user }) {
  const [country, setCountry] = useState("Poland");
  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [running, setRunning] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0, currentSku: null });
  const [results, setResults] = useState(new Map()); // sku -> {status, data, error}
  const [stopFlag, setStopFlag] = useState(false);
  const [pricelist, setPricelist] = useState({});

  useEffect(() => { setPricelist(loadPricelist(user)); }, [user]);

  // How many of the selected SKUs have a manual price set for the chosen country?
  const skusWithManualPrice = useMemo(() => {
    const set = new Set();
    for (const s of selectedSkus) {
      if (getPriceCell(pricelist, country, s) != null) set.add(s);
    }
    return set;
  }, [pricelist, country, selectedSkus]);

  const numSelected = selectedSkus.size;
  const numWithPrice = skusWithManualPrice.size;
  const numDone = [...results.values()].filter(r => r.status === "done").length;
  const numErr = [...results.values()].filter(r => r.status === "error").length;

  // Cost estimate: ~$0.04 saved per SKU when manual price provided
  // Sonnet competitive map: ~$0.05/SKU. Haiku competitor prices: ~$0.005 each × ~10 = ~$0.05.
  // With manual price: ~$0.10/SKU. Without: ~$0.14/SKU.
  const estimatedCost = (numWithPrice * 0.10 + (numSelected - numWithPrice) * 0.14).toFixed(2);

  function toggleSku(sku) {
    setSelectedSkus(p => { const n = new Set(p); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });
  }
  function toggleCategory(cat) {
    const skus = PRODUCTS.filter(p => p.c === cat).map(p => p.s);
    const allSelected = skus.every(s => selectedSkus.has(s));
    setSelectedSkus(p => {
      const n = new Set(p);
      if (allSelected) skus.forEach(s => n.delete(s));
      else skus.forEach(s => n.add(s));
      return n;
    });
  }

  async function runScan() {
    if (running || numSelected === 0) return;
    const queue = [...selectedSkus];
    setRunning(true);
    setStopFlag(false);
    setProgress({ done: 0, total: queue.length, currentSku: null });
    setResults(p => {
      const n = new Map(p);
      for (const s of queue) n.set(s, { status: "pending", data: null, error: null });
      return n;
    });

    for (let i = 0; i < queue.length; i++) {
      if (stopFlag) break;
      const sku = queue[i];
      const product = PRODUCTS.find(p => p.s === sku);
      const manualPrice = getPriceCell(pricelist, country, sku);
      setProgress(p => ({ ...p, currentSku: sku }));
      setResults(p => new Map(p).set(sku, { status: "running", data: null, error: null }));
      try {
        const data = await researchSku(product, country, msg => setProgressMessage(msg), manualPrice);
        setResults(p => new Map(p).set(sku, { status: "done", data, error: null }));
        appendSnapshot(user, data);
      } catch (err) {
        setResults(p => new Map(p).set(sku, { status: "error", data: null, error: err.message }));
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
      if (i < queue.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    setRunning(false);
    setProgressMessage("");
    setProgress(p => ({ ...p, currentSku: null }));
  }

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 300, minWidth: 300, background: "#161b22", borderRight: "1px solid #30363d", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 0", flexShrink: 0 }}>
          <label style={{ display: "block", fontSize: 10, color: "#8b949e", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>Target Market</label>
          <select value={country} onChange={e => setCountry(e.target.value)} disabled={running}
            style={{ width: "100%", padding: "8px 10px", background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, fontSize: 13, marginBottom: 4 }}>
            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 10, color: "#484f58", marginBottom: 12 }}>{MARKETS[country].currency} · {MARKETS[country].aggregator}</div>

          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            <button onClick={() => setSelectedSkus(new Set(PRODUCTS.map(p => p.s)))} disabled={running}
              style={{ flex: 1, padding: 5, background: "#21262d", color: "#8b949e", border: "1px solid #30363d", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>All</button>
            <button onClick={() => setSelectedSkus(new Set())} disabled={running}
              style={{ flex: 1, padding: 5, background: "#21262d", color: "#8b949e", border: "1px solid #30363d", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>Clear</button>
          </div>

          {!running ? (
            <button onClick={runScan} disabled={numSelected === 0}
              style={{ width: "100%", padding: 11, background: numSelected > 0 ? "#e85d04" : "#21262d", color: numSelected > 0 ? "#fff" : "#484f58", border: "none", borderRadius: 7, cursor: numSelected > 0 ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Run scan ({numSelected} SKU)
            </button>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#e3b341", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {progress.currentSku} · {progressMessage || "..."}
              </div>
              <div style={{ background: "#21262d", borderRadius: 4, height: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "linear-gradient(90deg,#e85d04,#f4a261)", height: "100%", transition: "width 0.3s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10, color: "#8b949e" }}>
                <span>{progress.done}/{progress.total} done</span>
              </div>
              <button onClick={() => setStopFlag(true)} style={{ width: "100%", padding: 7, background: "#da3633", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Stop after current</button>
            </div>
          )}

          {!running && numSelected > 0 && (
            <div style={{ marginBottom: 10, padding: "6px 8px", background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, fontSize: 10, lineHeight: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#8b949e", marginBottom: 2 }}>
                <span>Manual prices in {country}:</span>
                <span style={{ color: numWithPrice === numSelected ? "#3fb950" : numWithPrice > 0 ? "#e3b341" : "#f85149", fontWeight: 600 }}>
                  {numWithPrice}/{numSelected}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#8b949e" }}>
                <span>Est. cost:</span>
                <span style={{ color: "#79c0ff", fontFamily: "monospace", fontWeight: 600 }}>~${estimatedCost}</span>
              </div>
              {numWithPrice < numSelected && (
                <div style={{ marginTop: 4, color: "#6e7681", fontStyle: "italic", fontSize: 9 }}>
                  Tip: enter LORGAR prices in the Pricelist tab for cheaper, more reliable scans.
                </div>
              )}
            </div>
          )}

          <div style={{ height: 1, background: "#21262d", marginBottom: 10 }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
          {CATEGORIES.map(cat => {
            const catProducts = PRODUCTS.filter(p => p.c === cat);
            const numSel = catProducts.filter(p => selectedSkus.has(p.s)).length;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "#0d1117", borderRadius: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: CAT_COLOR[cat], background: `${CAT_COLOR[cat]}22`, padding: "1px 6px", borderRadius: 8 }}>[{CAT_ICON[cat]}]</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#c9d1d9", flex: 1 }}>{cat}</span>
                  <span style={{ fontSize: 9, color: "#484f58" }}>{numSel}/{catProducts.length}</span>
                  <button onClick={() => toggleCategory(cat)} style={{ padding: "2px 6px", background: "#21262d", color: "#8b949e", border: "1px solid #30363d", borderRadius: 4, cursor: "pointer", fontSize: 9, fontWeight: 600 }}>all</button>
                </div>
                {catProducts.map(p => {
                  const isSel = selectedSkus.has(p.s);
                  const r = results.get(p.s);
                  const dot = r?.status === "done" ? "#3fb950" : r?.status === "running" ? "#e3b341" : r?.status === "error" ? "#f85149" : null;
                  const manualPrice = getPriceCell(pricelist, country, p.s);
                  return (
                    <div key={p.s} onClick={() => !running && toggleSku(p.s)}
                      style={{ padding: "5px 8px", cursor: running ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, background: isSel ? "#131a24" : "transparent", borderRadius: 4, marginBottom: 2 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${isSel ? "#3fb950" : "#30363d"}`, background: isSel ? "#3fb950" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSel && <span style={{ color: "#0d1117", fontSize: 8, fontWeight: 900 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 10, color: isSel ? "#e6edf3" : "#8b949e", flex: 1 }}>{p.n.replace("LORGAR ", "")}</span>
                      {manualPrice != null && (
                        <span title={`Manual price: ${manualPrice} ${MARKETS[country].currency}`}
                          style={{ fontSize: 8, color: "#3fb950", background: "#3fb95020", padding: "1px 4px", borderRadius: 3, fontFamily: "monospace", fontWeight: 700 }}>
                          {manualPrice}
                        </span>
                      )}
                      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
                      <code style={{ fontSize: 8, color: "#484f58", flexShrink: 0 }}>{p.s}</code>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "8px 14px", borderTop: "1px solid #21262d", flexShrink: 0, display: "flex", gap: 14, justifyContent: "center" }}>
          {[["Selected", numSelected, "#e85d04"], ["Done", numDone, "#3fb950"], ["Errors", numErr, "#f85149"]].map(([l, n, c]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{n}</div>
              <div style={{ fontSize: 9, color: "#484f58" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      <ResearchResults results={results} country={country} />
    </div>
  );
}

// ─── Research results panel ─────────────────────────────────────────────────
function ResearchResults({ results, country }) {
  const [expanded, setExpanded] = useState(new Set());

  const completedSkus = useMemo(() =>
    PRODUCTS.filter(p => results.has(p.s) && results.get(p.s).status !== "pending"),
    [results]
  );

  if (completedSkus.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 16 }}>
        <div style={{ fontSize: 44 }}>🎯</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#f0f6fc" }}>Pick SKUs and click Run scan</div>
        <div style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.7, maxWidth: 460, textAlign: "center" }}>
          Sonnet builds a competitive map for each LORGAR SKU on the selected market. Haiku verifies current prices at top retailers in parallel.
          Each scan saves to your private history (Date + Country are part of the record).
        </div>
      </div>
    );
  }

  function toggle(sku) {
    setExpanded(p => { const n = new Set(p); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
      {completedSkus.map(prod => {
        const r = results.get(prod.s);
        const isExp = expanded.has(prod.s);
        return (
          <div key={prod.s} style={{ background: "#161b22", border: `1px solid ${isExp ? "#30363d" : "#21262d"}`, borderLeft: `3px solid ${CAT_COLOR[prod.c]}`, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
            <div onClick={() => r.status === "done" && toggle(prod.s)} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, cursor: r.status === "done" ? "pointer" : "default", userSelect: "none" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: CAT_COLOR[prod.c], background: `${CAT_COLOR[prod.c]}22`, padding: "1px 6px", borderRadius: 8 }}>[{CAT_ICON[prod.c]}]</span>
              <code style={{ fontSize: 9, color: "#484f58", width: 90, flexShrink: 0 }}>{prod.s}</code>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3", flex: 1 }}>{prod.n}</span>
              {r.status === "running" && <span style={{ fontSize: 11, color: "#e3b341" }}>researching...</span>}
              {r.status === "error" && (
                <span style={{ fontSize: 11, color: "#f85149", fontWeight: 600 }} title={r.error}>ERROR</span>
              )}
              {r.status === "done" && r.data && (
                <>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#e85d04" }}>
                      {r.data.lorgar_price != null ? `${r.data.lorgar_price} ${r.data.currency}` : "N/A"}
                      {r.data.lorgar_price_source === "manual" && (
                        <span title="Price entered manually in the Pricelist tab" style={{ marginLeft: 5, fontSize: 8, color: "#3fb950", background: "#3fb95020", padding: "1px 4px", borderRadius: 3, fontWeight: 700, fontFamily: "system-ui" }}>manual</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 1 }}>
                      {r.data.lorgar_retail_link && <a href={r.data.lorgar_retail_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: "#58a6ff", textDecoration: "none", padding: "0 4px", background: "#58a6ff18", borderRadius: 4 }}>shop</a>}
                      {r.data.lorgar_comparison_link && <a href={r.data.lorgar_comparison_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: "#79c0ff", textDecoration: "none", padding: "0 4px", background: "#79c0ff18", borderRadius: 4 }}>compare</a>}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#161826", color: "#79c0ff", fontWeight: 600 }}>
                    {r.data.competitors.filter(c => c.win_lose === "WIN").length}W / {r.data.competitors.filter(c => c.win_lose === "LOSE").length}L
                  </span>
                  <span style={{ color: "#484f58", fontSize: 10 }}>{isExp ? "▴" : "▾"}</span>
                </>
              )}
            </div>

            {r.status === "error" && r.error && (
              <div style={{ padding: "8px 12px", background: "#1a0d0d", borderTop: "1px solid #f8514922", fontSize: 11, color: "#f85149", fontFamily: "monospace", lineHeight: 1.5, wordBreak: "break-all" }}>{r.error}</div>
            )}

            {isExp && r.data && <CompetitorTable data={r.data} />}
          </div>
        );
      })}
    </div>
  );
}

function CompetitorTable({ data }) {
  return (
    <div style={{ borderTop: "1px solid #30363d" }}>
      {data.availability_note && (
        <div style={{ padding: "5px 12px", background: "#0d1117", fontSize: 10, color: "#8b949e", borderBottom: "1px solid #21262d" }}>{data.availability_note}</div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#0d1117" }}>
              {["Vendor", "Product", "Price", "Index", "W/L", "Score", "Rec.", "Source", "Note"].map(h => (
                <th key={h} style={{ padding: "5px 9px", textAlign: "left", color: "#6e7681", fontWeight: 600, fontSize: 10, borderBottom: "1px solid #21262d" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.competitors.map((c, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #161b22", background: i % 2 ? "#0d111788" : "transparent" }}>
                <td style={{ padding: "5px 9px", fontWeight: 700, color: "#e6edf3", whiteSpace: "nowrap" }}>{c.vendor}</td>
                <td style={{ padding: "5px 9px", maxWidth: 240, color: "#c9d1d9" }} title={c.product_name}>{c.product_name}</td>
                <td style={{ padding: "5px 9px", whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 600, color: "#e6edf3" }}>
                  <div>{c.price != null ? `${c.price} ${c.currency}` : "—"}</div>
                  <div style={{ display: "flex", gap: 3, marginTop: 1 }}>
                    {c.retail_link && <a href={c.retail_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#58a6ff", textDecoration: "none", padding: "0 4px", background: "#58a6ff18", borderRadius: 4 }}>shop</a>}
                    {c.comparison_link && <a href={c.comparison_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#79c0ff", textDecoration: "none", padding: "0 4px", background: "#79c0ff18", borderRadius: 4 }}>compare</a>}
                  </div>
                </td>
                <td style={{ padding: "5px 9px", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: c.price_index < 95 ? "#f85149" : c.price_index > 130 ? "#3fb950" : "#e3b341" }}>
                  {c.price_index != null ? c.price_index.toFixed(1) : "—"}
                </td>
                <td style={{ padding: "5px 9px" }}>{c.win_lose && <Pill kind={c.win_lose} />}</td>
                <td style={{ padding: "5px 9px" }}>
                  <span title={`Price ${c._priceScore}/50, Brand ${c._brandScore}/25, Features ${c._featureScore}/25`}
                    style={{ fontSize: 10, fontWeight: 700, color: c._totalScore >= 70 ? "#3fb950" : c._totalScore >= 55 ? "#e3b341" : "#79c0ff", cursor: "help" }}>
                    {c._totalScore}pts
                  </span>
                </td>
                <td style={{ padding: "5px 9px", fontFamily: "monospace", color: "#e85d04", fontSize: 10, whiteSpace: "nowrap" }}>
                  {c.recommended_price != null ? `${c.recommended_price} ${c.currency}` : "—"}
                </td>
                <td style={{ padding: "5px 9px", fontSize: 10, color: "#8b949e" }}>{c.price_source || "—"}</td>
                <td style={{ padding: "5px 9px", fontSize: 10, color: "#8b949e", maxWidth: 280 }}>{c.positioning || c.price_note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ kind }) {
  const map = {
    WIN: { bg: "#162a1a", fg: "#3fb950" },
    LOSE: { bg: "#2a1616", fg: "#f85149" },
    PARITY: { bg: "#161826", fg: "#79c0ff" },
  };
  const c = map[kind] || map.PARITY;
  return <span style={{ padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: c.bg, color: c.fg }}>{kind}</span>;
}

// ─── Pricelist tab ──────────────────────────────────────────────────────────
function PricelistTab({ user }) {
  const [pricelist, setPricelist] = useState({});
  const [filterCategory, setFilterCategory] = useState("All");
  const [editing, setEditing] = useState({}); // sku::country -> string value being typed

  useEffect(() => { setPricelist(loadPricelist(user)); }, [user]);

  const filteredProducts = useMemo(() => {
    if (filterCategory === "All") return PRODUCTS;
    return PRODUCTS.filter(p => p.c === filterCategory);
  }, [filterCategory]);

  function commitCell(sku, country, raw) {
    const next = setPriceCell(user, country, sku, raw);
    setPricelist(next);
    setEditing(e => { const n = { ...e }; delete n[`${sku}::${country}`]; return n; });
  }

  function handleChange(sku, country, raw) {
    setEditing(e => ({ ...e, [`${sku}::${country}`]: raw }));
  }

  function handleBlur(sku, country) {
    const k = `${sku}::${country}`;
    if (k in editing) commitCell(sku, country, editing[k]);
  }

  function handleKey(e, sku, country) {
    if (e.key === "Enter") { e.target.blur(); }
    if (e.key === "Escape") {
      setEditing(prev => { const n = { ...prev }; delete n[`${sku}::${country}`]; return n; });
      e.target.blur();
    }
  }

  function clearAllPrices() {
    if (!confirm("Clear all manual prices for all countries? This cannot be undone.")) return;
    try { localStorage.removeItem(`u__${user.nick}_${user.pin}__pricelist`); } catch {}
    setPricelist({});
  }

  // Coverage statistics
  const totalCells = PRODUCTS.length * COUNTRIES.length;
  const filledCells = COUNTRIES.reduce((sum, c) => sum + Object.keys(pricelist[c] || {}).length, 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 18px", overflow: "hidden" }}>
      <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>LORGAR Pricelist</div>
        <div style={{ fontSize: 11, color: "#8b949e" }}>
          Manual prices per country. Used during scans instead of auto-search — faster, cheaper, more accurate.
        </div>
        <div style={{ flex: 1 }} />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: "5px 10px", background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}>
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "#8b949e" }}>
          Coverage: <span style={{ color: filledCells > 0 ? "#3fb950" : "#6e7681", fontWeight: 600 }}>{filledCells}/{totalCells}</span>
        </span>
        {filledCells > 0 && (
          <button onClick={clearAllPrices} style={{ padding: "5px 10px", background: "#21262d", color: "#f85149", border: "1px solid #f8514944", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Clear all</button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", border: "1px solid #21262d", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: "#0d1117" }}>
              <th style={{ padding: "7px 10px", textAlign: "left", color: "#6e7681", fontWeight: 600, fontSize: 10, borderBottom: "2px solid #30363d", borderRight: "1px solid #21262d", position: "sticky", left: 0, background: "#0d1117", minWidth: 90 }}>SKU</th>
              <th style={{ padding: "7px 10px", textAlign: "left", color: "#6e7681", fontWeight: 600, fontSize: 10, borderBottom: "2px solid #30363d", borderRight: "1px solid #21262d", position: "sticky", left: 90, background: "#0d1117", minWidth: 220 }}>Product</th>
              {COUNTRIES.map(country => (
                <th key={country} style={{ padding: "7px 10px", textAlign: "left", color: "#c9d1d9", fontWeight: 600, fontSize: 10, borderBottom: "2px solid #30363d", whiteSpace: "nowrap" }}>
                  {country}
                  <div style={{ fontSize: 9, color: "#484f58", fontWeight: 400 }}>{MARKETS[country].currency}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p, idx) => (
              <tr key={p.s} style={{ borderBottom: "1px solid #161b22", background: idx % 2 ? "#0d111788" : "transparent" }}>
                <td style={{ padding: "4px 10px", color: "#484f58", fontFamily: "monospace", fontSize: 10, borderRight: "1px solid #21262d", position: "sticky", left: 0, background: idx % 2 ? "#0d111788" : "#0d1117" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: CAT_COLOR[p.c], background: `${CAT_COLOR[p.c]}22`, padding: "1px 5px", borderRadius: 6, marginRight: 5 }}>[{CAT_ICON[p.c]}]</span>
                  {p.s}
                </td>
                <td style={{ padding: "4px 10px", color: "#c9d1d9", borderRight: "1px solid #21262d", position: "sticky", left: 90, background: idx % 2 ? "#0d111788" : "#0d1117", whiteSpace: "nowrap" }}>{p.n.replace("LORGAR ", "")}</td>
                {COUNTRIES.map(country => {
                  const k = `${p.s}::${country}`;
                  const stored = getPriceCell(pricelist, country, p.s);
                  const value = k in editing ? editing[k] : (stored != null ? String(stored) : "");
                  return (
                    <td key={country} style={{ padding: "2px 4px" }}>
                      <input type="text" inputMode="decimal" value={value}
                        placeholder="—"
                        onChange={e => handleChange(p.s, country, e.target.value)}
                        onBlur={() => handleBlur(p.s, country)}
                        onKeyDown={e => handleKey(e, p.s, country)}
                        style={{ width: 80, padding: "4px 6px", background: stored != null ? "#0d1f12" : "#0d1117", border: `1px solid ${stored != null ? "#3fb95044" : "#21262d"}`, borderRadius: 4, color: stored != null ? "#3fb950" : "#c9d1d9", fontSize: 11, fontFamily: "monospace", outline: "none", textAlign: "right" }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: "#6e7681", lineHeight: 1.5 }}>
        Auto-saved per cell. Tab/Enter to confirm, Esc to cancel. Values are in the country's local currency.
      </div>
    </div>
  );
}


// ─── History tab ────────────────────────────────────────────────────────────
function HistoryTab({ user }) {
  const [history, setHistory] = useState([]);
  const [filterCountry, setFilterCountry] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => { setHistory(loadHistory(user)); }, [user]);

  const filtered = useMemo(() => {
    return history.filter(s => {
      if (filterCountry !== "All" && s.country !== filterCountry) return false;
      if (filterCategory !== "All" && s.category !== filterCategory) return false;
      return true;
    });
  }, [history, filterCountry, filterCategory]);

  const flatRows = useMemo(() => buildFlatRows(filtered), [filtered]);

  function clearAll() {
    if (!confirm(`Clear all history for "${user.nick}"? This cannot be undone.`)) return;
    clearHistory(user);
    setHistory([]);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 18px", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
          style={{ padding: "5px 10px", background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}>
          <option>All</option>
          {COUNTRIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: "5px 10px", background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}>
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>

        <span style={{ fontSize: 11, color: "#8b949e", marginLeft: 8 }}>
          {filtered.length} snapshot{filtered.length === 1 ? "" : "s"} · {flatRows.rows.length} rows
        </span>

        <div style={{ flex: 1 }} />

        <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
          style={{ padding: "6px 14px", background: filtered.length ? "#238636" : "#21262d", color: filtered.length ? "#fff" : "#484f58", border: "none", borderRadius: 6, cursor: filtered.length ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>
          Export CSV
        </button>
        <button onClick={() => exportXLSX(filtered)} disabled={filtered.length === 0}
          style={{ padding: "6px 14px", background: filtered.length ? "#1f6feb" : "#21262d", color: filtered.length ? "#fff" : "#484f58", border: "none", borderRadius: 6, cursor: filtered.length ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>
          Export XLSX
        </button>
        {history.length > 0 && (
          <button onClick={clearAll} style={{ padding: "6px 10px", background: "#21262d", color: "#f85149", border: "1px solid #f8514944", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Clear all</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6e7681", gap: 10 }}>
          <div style={{ fontSize: 44 }}>📊</div>
          <div style={{ fontSize: 14 }}>No history yet — run a scan from the Research tab.</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", border: "1px solid #21262d", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background: "#0d1117" }}>
                {flatRows.headers.map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#6e7681", fontWeight: 600, fontSize: 10, borderBottom: "2px solid #30363d", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatRows.rows.map((row, i) => {
                const isLorgar = row["Brand"] === "LORGAR";
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #161b22", background: isLorgar ? "#1a120a" : (i % 2 ? "#0d111788" : "transparent") }}>
                    {flatRows.headers.map(h => {
                      const v = row[h];
                      const isLink = h.includes("Link") && v;
                      const isWinLose = h === "Win/Lose" && v;
                      return (
                        <td key={h} style={{ padding: "4px 10px", whiteSpace: "nowrap", color: isLorgar ? "#e85d04" : "#c9d1d9", fontWeight: isLorgar && h === "Brand" ? 700 : 400, maxWidth: h === "Product" || h === "Note" ? 280 : "none", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {isLink ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ color: "#58a6ff", textDecoration: "none" }}>open</a>
                            : isWinLose ? <Pill kind={v} />
                            : (v == null || v === "" ? "—" : String(v))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
