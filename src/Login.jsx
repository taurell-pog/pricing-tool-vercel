import { useState, useEffect, useRef } from "react";

function getSavedNicks() {
  try {
    const nicks = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("nick__")) nicks.push(localStorage.getItem(k));
    }
    return nicks;
  } catch { return []; }
}

export default function Login({ onLogin }) {
  const [nick, setNick] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [savedNicks, setSavedNicks] = useState([]);
  const pinRef = useRef(null);

  useEffect(() => { setSavedNicks(getSavedNicks()); }, []);

  function pickNick(n) {
    setNick(n);
    setPin("");
    setError("");
    setTimeout(() => pinRef.current?.focus(), 50);
  }

  function submit(e) {
    e.preventDefault();
    const n = nick.trim();
    if (!n) return setError("Enter a nick.");
    if (pin.length !== 8 || !/^\d{8}$/.test(pin)) return setError("PIN must be 8 digits.");
    try { localStorage.setItem(`nick__${n}`, n); } catch {}
    onLogin({ nick: n, pin });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "linear-gradient(135deg,#e85d04,#f4a261)", borderRadius: 10, padding: "10px 14px", fontSize: 20, fontWeight: 900, color: "#fff" }}>L</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6fc" }}>LORGAR Pricing Tool</div>
              <div style={{ fontSize: 11, color: "#6e7681" }}>by ASBIS · v2</div>
            </div>
          </div>
        </div>

        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6fc", marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 12, color: "#6e7681", marginBottom: 20, lineHeight: 1.5 }}>
            Your nick + PIN create a private profile. Data is stored locally per account.
          </div>

          {savedNicks.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: "#6e7681", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>Saved profiles</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {savedNicks.map(n => (
                  <button key={n} onClick={() => pickNick(n)} style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${nick === n ? "#e85d04" : "#30363d"}`, background: nick === n ? "#e85d0422" : "#21262d", color: nick === n ? "#e85d04" : "#c9d1d9", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{n}</button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Nick</label>
              <input autoFocus value={nick} onChange={e => { setNick(e.target.value); setError(""); }} placeholder="e.g. tau" maxLength={20}
                style={{ width: "100%", padding: "10px 12px", background: "#0d1117", border: "1px solid #30363d", borderRadius: 7, color: "#e6edf3", fontSize: 14, outline: "none" }} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>PIN (8 digits)</label>
              <div style={{ position: "relative" }}>
                <input ref={pinRef} type={showPin ? "text" : "password"} inputMode="numeric" value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                  placeholder="••••••••" maxLength={8}
                  style={{ width: "100%", padding: "10px 40px 10px 12px", background: "#0d1117", border: "1px solid #30363d", borderRadius: 7, color: "#e6edf3", fontSize: 14, outline: "none", fontFamily: "monospace", letterSpacing: 3 }} />
                <button type="button" onClick={() => setShowPin(p => !p)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 11 }}>{showPin ? "hide" : "show"}</button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                {[...Array(8)].map((_, i) => (<div key={i} style={{ width: 7, height: 3, borderRadius: 2, background: i < pin.length ? "#e85d04" : "#21262d", marginLeft: 2 }} />))}
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: "#f85149", marginBottom: 12, padding: "6px 10px", background: "#2a161644", borderRadius: 6, border: "1px solid #f8514933" }}>{error}</div>}

            <button type="submit" disabled={!nick.trim() || pin.length !== 8} style={{ width: "100%", padding: 11, marginTop: 8, background: nick.trim() && pin.length === 8 ? "#e85d04" : "#21262d", color: nick.trim() && pin.length === 8 ? "#fff" : "#484f58", border: "none", borderRadius: 8, cursor: nick.trim() && pin.length === 8 ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700 }}>Enter</button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#484f58", lineHeight: 1.6 }}>
          New here? Just enter a nick + PIN to create your account.<br />Data is stored in your browser per nick+PIN.
        </div>
      </div>
    </div>
  );
}
