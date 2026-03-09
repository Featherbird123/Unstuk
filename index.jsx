import React, { useState, useEffect, useRef } from "react";

const APP_VERSION = "1.5.0";

// ─── Lightweight analytics (stored locally, exportable) ───
const _evtLog = [];
function trackEvent(name, data = {}) {
  try {
    const evt = { t: Date.now(), e: name, ...data };
    _evtLog.push(evt);
    if (_evtLog.length > 200) _evtLog.shift();
    window.storage?.set("unstuk_analytics", JSON.stringify(_evtLog.slice(-50))).catch(() => {});
  } catch(e) {}
}

// ─── Error boundary (catches render crashes gracefully) ───
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    trackEvent("crash", { msg: (error?.message || "").substring(0, 100) });
  }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", {
        style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", padding: 40, textAlign: "center" }
      },
        React.createElement("p", { style: { fontSize: 14, color: "#78716C", marginBottom: 16 } }, "Something went wrong. Your data is safe."),
        React.createElement("button", {
          onClick: () => this.setState({ hasError: false }),
          style: { fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "10px 20px", borderRadius: 8, border: "1px solid #D6D3D1", background: "#fff", cursor: "pointer" }
        }, "Reload")
      );
    }
    return this.props.children;
  }
}

// ─── Preset suggestion chips — themed, multi-category ───
async function fetchAiChipSuggestions({ step, picked, context, count = 6 }) {
  try {
    const decisionCtx = context.dName ? `Decision: ${context.dName}` : "";
    const optsCtx = context.opts && context.opts.length ? `\nOptions so far: ${context.opts.map(o => o.name).join(", ")}` : "";
    const critsCtx = context.crits && context.crits.length ? `\nCriteria so far: ${context.crits.map(cr => cr.name).join(", ")}` : "";
    const alreadyPicked = picked && picked.length ? `\nAlready chosen: ${picked.join(", ")}` : "";
    const typedCtx = context.typed && context.typed.trim() ? `\nUser is currently typing: "${context.typed.trim()}" — suggestions should complete or complement this` : "";
    const typeHint = step === "name"
      ? "decision names (3-5 words, e.g. 'CRM Migration', 'Head of Growth Hire')"
      : step === "opt"
      ? "concrete mutually-exclusive options tailored to this decision"
      : step === "qv-name"
      ? "short poll questions as full sentences (e.g. 'Which launch date works best for the team?', 'What day should we hold the team offsite?', 'Which vendor should we move forward with?')"
      : step === "qv-opt"
      ? "short poll answer options (2-4 words, mutually exclusive)"
      : "distinct evaluation criteria for this decision (not overlapping with existing)";
    const prompt = `Business decision tool. Generate exactly ${count} ${typeHint}.\n${decisionCtx}${optsCtx}${critsCtx}${alreadyPicked}${typedCtx}\nRules: specific to context, 2-5 words, Title Case, no years unless user wrote one, professional.\nJSON only: {"chips":["item1","item2",...]}`;
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 150, messages: [{ role: "user", content: prompt }] })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed.chips) ? parsed.chips.slice(0, count) : [];
  } catch(e) { return []; }
}

function ChipPicker({ onPick, usedNames = [], storageKey, aiContext }) {
  const [chips, setChips] = useState([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const debounceRef = useRef(null);
  const lastContextRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = async (pickedSoFar = []) => {
    if (!mountedRef.current) return;
    setLoading(true);
    const suggestions = await fetchAiChipSuggestions({
      step: storageKey,
      picked: [...(usedNames || []), ...pickedSoFar],
      context: aiContext || { dName: "", opts: [], crits: [] },
      count: 12,
    });
    if (mountedRef.current) { setChips(suggestions); setLoading(false); }
  };

  // Debounced reactive reload whenever aiContext changes meaningfully
  useEffect(() => {
    const ctxKey = JSON.stringify({
      dName: aiContext?.dName || "",
      opts: (aiContext?.opts || []).map(o => o.name || o).join(","),
      crits: (aiContext?.crits || []).map(cr => cr.name || cr).join(","),
      typed: aiContext?.typed || "",
    });
    if (ctxKey === lastContextRef.current) return;
    lastContextRef.current = ctxKey;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Immediate load on first mount, debounce subsequent changes
    const isFirst = chips.length === 0 && !loading;
    debounceRef.current = setTimeout(() => { load(); }, isFirst ? 0 : 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [aiContext?.dName, aiContext?.typed, (aiContext?.opts||[]).length, (aiContext?.crits||[]).length]);

  const handlePick = (name) => {
    onPick(name);
    load([name]);
  };

  if (loading) return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {[80, 110, 90, 120, 70, 100].map((w, i) => (
        <div key={i} style={{ height: 34, width: w, borderRadius: 22, background: `linear-gradient(90deg, ${C.accentLt}, ${C.bg}, ${C.accentLt})`, backgroundSize: "200% 100%", animation: "ustk-shimmer 1.2s infinite", border: `1px solid ${C.border}20` }} />
      ))}
      <style>{`@keyframes ustk-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );

  return (
    <div style={{ marginTop: 10, marginBottom: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {chips.filter(ch => !usedNames.map(n => n.toLowerCase()).includes(ch.toLowerCase())).map((chip) => (
          <button key={chip} onClick={() => handlePick(chip)} className="ustk-touch"
            style={{ fontFamily: F.b, fontSize: 12, padding: "9px 14px", borderRadius: 22, border: `1.5px solid ${C.border}60`, background: C.card, color: C.text, cursor: "pointer", transition: "all 0.15s", lineHeight: 1.2 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.sage; e.currentTarget.style.background = C.sageSoft; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border + "60"; e.currentTarget.style.background = C.card; }}>
            {chip}
          </button>
        ))}
        {chips.length > 0 && (
          <button onClick={() => load()} title="Refresh suggestions"
            style={{ fontFamily: F.b, fontSize: 11, padding: "9px 12px", borderRadius: 22, border: `1.5px solid ${C.border}40`, background: "#fff", color: C.muted, cursor: "pointer", transition: "all 0.15s" }}>
            ↻
          </button>
        )}
      </div>
    </div>
  );
}
// ─── Helpers ───
const uid = () => Math.random().toString(36).slice(2, 10);
const pct = (v, t) => { const r = t === 0 ? 0 : Math.round((v / t) * 100); return Number.isFinite(r) ? r : 0; };

const IMPORTANCE = [
  { label: "Low", value: 1 },
  { label: "Moderate", value: 2 },
  { label: "High", value: 3 },
];
const BIN_ADV = [
  { label: "Slight", value: 1 },
  { label: "Moderate", value: 2 },
  { label: "Strong", value: 3 },
];
const MULTI_ADV = [
  { label: "Major disadvantage", value: -3 },
  { label: "Moderate disadvantage", value: -2 },
  { label: "Minor disadvantage", value: -1 },
  { label: "Same", value: 0 },
  { label: "Minor advantage", value: 1 },
  { label: "Moderate advantage", value: 2 },
  { label: "Major advantage", value: 3 },
];

// ─── Content safety filter ───
const BLOCKED_TERMS = [
  "murder", "rape", "molest", "terrorist attack", "child abuse",
  "sex trafficking", "genocide", "ethnic cleansing",
];

function isBlockedContent(text) {
  const lower = text.toLowerCase();
  return BLOCKED_TERMS.some((t) => lower.includes(t));
}

// ─── Colour palette: warm stone, ink, sage ───
const C = {
  bg: "#F5F3EE",        // warm linen
  card: "#FFFFFF",
  text: "#1C1917",       // warm ink
  muted: "#78716C",      // stone
  accent: "#292524",     // dark stone
  accentLt: "#E7E5E4",  // light stone
  border: "#D6D3D1",    // stone border
  sage: "#4A6741",       // muted sage green
  sageSoft: "#ECF0EB",
  taupe: "#A3937B",      // warm taupe
  taupeSoft: "#F5F0EA",
  error: "#9A3412",
  errorSoft: "#FFF7ED",
};

const F = {
  d: "'Cormorant Garamond', Georgia, serif",
  b: "'DM Sans', 'Helvetica Neue', sans-serif",
};

// ─── Persistent storage ───
async function loadHistory() {
  try {
    const r = await window.storage.get("unstuk_history");
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) {}
  return [];
}

async function saveHistory(list) {
  try {
    const cutoff = Date.now() - 60 * 86400000;
    const cleaned = list.filter((x) => x.timestamp > cutoff);
    await window.storage.set("unstuk_history", JSON.stringify(cleaned));
    return cleaned;
  } catch (e) {
    return list;
  }
}

// ─── Components ───

function FadeIn({ children, delay = 0 }) {
  const [v, setV] = useState(false);
  useEffect(() => { const t = setTimeout(() => setV(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(10px)", transition: "opacity 0.45s ease, transform 0.45s ease" }}>{children}</div>;
}

function Btn({ children, onClick, v = "primary", disabled, style = {}, ariaLabel }) {
  const base = { fontFamily: F.b, fontSize: 14, fontWeight: 500, letterSpacing: "0.015em", border: "none", borderRadius: 8, cursor: disabled ? "default" : "pointer", padding: "12px 28px", transition: "opacity 0.15s", opacity: disabled ? 0.35 : 1 };
  const vs = {
    primary: { background: C.accent, color: "#fff" },
    secondary: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.muted, padding: "8px 12px", fontSize: 13 },
    sage: { background: C.sage, color: "#fff" },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...vs[v], ...style }}>{children}</button>;
}

function Card({ children, style = {} }) {
  return <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "28px 28px", ...style }}>{children}</div>;
}

// Micro-reward — inline progress element with gentle completion feedback
// Shows step count, and the number briefly glows sage on each advance
function InlineReward({ show }) {
  if (!show) return null;
  return (
    <span style={{
      fontFamily: "'DM Sans'", fontSize: 11,
      color: "#9a8a72", marginLeft: 6, verticalAlign: "middle",
    }}>{"\u2713"}</span>
  );
}

function MicroReward({ tick, current, total }) {
  const [flash, setFlash] = useState(false);
  const prevTick = useRef(0);
  useEffect(() => {
    if (tick > 0 && tick !== prevTick.current) {
      prevTick.current = tick;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [tick]);
  if (total <= 0) return null;
  const done = current;
  const nearEnd = done >= total - 1;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, gap: 8 }}>
      {/* Thin progress track */}
      <div style={{ flex: 1, maxWidth: 120, height: 2, borderRadius: 1, background: C.accentLt, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 1,
          width: `${Math.min((done / total) * 100, 100)}%`,
          background: C.sage,
          transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      {/* Step counter */}
      <span style={{
        fontFamily: F.b, fontSize: 11, fontWeight: 600,
        color: flash ? C.sage : C.border,
        transition: "all 0.3s ease",
        letterSpacing: "0.02em",
        textShadow: flash ? `0 0 8px ${C.sage}50` : "none",
        transform: flash ? "scale(1.15)" : "scale(1)",
        display: "inline-block",
      }}>
        {done}/{total} {flash && "\u2713"}
      </span>
      {/* Near-completion encouragement — appears at last 2 steps */}
      {nearEnd && done > 0 && done < total && (
        <span style={{
          fontFamily: F.b, fontSize: 10, color: C.sage,
          opacity: flash ? 1 : 0.6,
          transition: "opacity 0.3s ease",
        }}>
          {done === total - 1 ? "Last one" : "Almost there"}
        </span>
      )}
    </div>
  );
}

function Lbl({ children }) {
  return <div style={{ fontFamily: F.b, fontSize: 11, fontWeight: 500, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{children}</div>;
}

function H({ children, size = "lg" }) {
  const s = { xl: { fontSize: 32, lineHeight: 1.2 }, lg: { fontSize: 22, lineHeight: 1.3 }, md: { fontSize: 17, lineHeight: 1.4 } };
  return <h2 style={{ fontFamily: F.d, fontWeight: 600, color: C.text, margin: 0, ...s[size] }}>{children}</h2>;
}

function Sub({ children }) {
  return <p style={{ fontFamily: F.b, fontSize: 13, color: C.muted, margin: "6px 0 18px", lineHeight: 1.5 }}>{children}</p>;
}

function sanitize(v) { return v.replace(/<[^>]*>/g, "").replace(/[<>]/g, ""); }
function TxtIn({ value, onChange, onSubmit, onFocus, placeholder, autoFocus = true, maxLen = null, inputId = null }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus && ref.current) {
      const t = setTimeout(() => ref.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  });
  const handleChange = (e) => {
    const v = sanitize(e.target.value);
    if (maxLen && v.length > maxLen) return;
    onChange(v);
  };
  return (
    <div style={{ position: "relative" }}>
      <input ref={ref} id={inputId || undefined} type="text" value={value} onChange={handleChange}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit?.(); }}
        placeholder={placeholder}
        maxLength={maxLen || undefined}
        style={{ width: "100%", boxSizing: "border-box", fontFamily: F.b, fontSize: 13, padding: "13px 16px", paddingRight: maxLen ? 48 : 16, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", background: "#ffffff", color: C.text, transition: "border-color 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        onFocus={(e) => { e.target.style.borderColor = C.accent; onFocus?.(); }}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
      />
      {maxLen && value.length > 0 && (
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontFamily: F.b, fontSize: 10, color: value.length >= maxLen ? C.taupe : C.border }}>
          {maxLen - value.length}
        </span>
      )}
    </div>
  );
}

function ImportancePills({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {IMPORTANCE.map((o) => {
        const sel = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{ fontFamily: F.b, fontSize: 13, fontWeight: sel ? 600 : 400, padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${sel ? C.accent : C.border}`, background: sel ? C.accent : "transparent", color: sel ? "#fff" : C.text, cursor: "pointer", transition: "all 0.15s" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Completely flat — no hover, no highlight, no selected state
function FlatBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{ fontFamily: F.b, fontSize: 14, padding: "14px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.text, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box" }}>
      {label}
    </button>
  );
}

function FlatGrid({ options, onSelect, cols = null }) {
  const c = cols || Math.min(options.length, 3);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${c}, 1fr)`, gap: 8 }}>
      {options.map((o) => (
        <button key={o.value ?? o.label} onClick={() => onSelect(o.value)}
          style={{ fontFamily: F.b, fontSize: 13, padding: "13px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.text, cursor: "pointer" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Dots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{
            width: active ? 20 : 6, height: 6, borderRadius: 3,
            background: done ? C.sage : active ? C.accent : C.accentLt,
            boxShadow: done ? `0 0 5px ${C.sage}35` : "none",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
          }} />
        );
      })}
    </div>
  );
}

function Tip({ text }) {
  const [s, setS] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <span onClick={() => setS(!s)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", border: `1px solid ${C.border}`, fontSize: 10, fontFamily: F.b, color: C.muted, cursor: "pointer", userSelect: "none" }}>?</span>
      {s && (
        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.accent, color: "#fff", fontFamily: F.b, fontSize: 12, lineHeight: 1.5, padding: "10px 14px", borderRadius: 8, width: 240, zIndex: 100, boxShadow: "0 6px 24px rgba(0,0,0,0.12)" }}>
          {text}
        </div>
      )}
    </span>
  );
}

function BackBtn({ onClick, label = "Back" }) {
  return (
    <button onClick={onClick} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 5, letterSpacing: "0.01em", opacity: 0.75, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = 1}
      onMouseLeave={e => e.currentTarget.style.opacity = 0.75}>
      <span style={{ fontSize: 15, lineHeight: 1, marginTop: -1 }}>‹</span>{label}
    </button>
  );
}
function HomeBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 5, letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.55, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = 1}
      onMouseLeave={e => e.currentTarget.style.opacity = 0.55}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>⌂</span> Home
    </button>
  );
}

function CritRows({ items, onRemove, lastAddedId }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((cr) => (
        <div key={cr.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: lastAddedId === cr.id ? C.sageSoft + "60" : C.bg, border: `1px solid ${lastAddedId === cr.id ? C.sage + "30" : C.border}`, fontFamily: F.b, fontSize: 13, transition: "all 0.3s ease" }}>
          <span>{cr.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastAddedId === cr.id && <span style={{ fontSize: 11, color: "#9a8a72" }}>{"\u2713"}</span>}
            <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
              color: cr.importance === 3 ? C.sage : cr.importance === 2 ? C.taupe : C.muted }}>
              {IMPORTANCE.find((x) => x.value === cr.importance)?.label}
            </span>
            {onRemove && <button onClick={() => onRemove(cr.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412", fontSize: 11, padding: "2px 8px", lineHeight: 1, opacity: 0.6, transition: "opacity 0.2s", letterSpacing: "0.02em", fontWeight: 500 }} onMouseEnter={(e) => e.target.style.opacity="1"} onMouseLeave={(e) => e.target.style.opacity="0.6"}>remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function OptRows({ items, onRemove, lastAddedId }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((o, i) => (
        <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: lastAddedId === o.id ? C.sageSoft + "60" : C.bg, border: `1px solid ${lastAddedId === o.id ? C.sage + "30" : C.border}`, fontFamily: F.b, fontSize: 13, transition: "all 0.3s ease" }}>
          <span><span style={{ color: C.muted, marginRight: 6 }}>{i + 1}.</span>{o.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {lastAddedId === o.id && <span style={{ fontSize: 11, color: "#9a8a72" }}>{"\u2713"}</span>}
            {onRemove && <button onClick={() => onRemove(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412", fontSize: 11, padding: "2px 8px", lineHeight: 1, opacity: 0.6, transition: "opacity 0.2s", letterSpacing: "0.02em", fontWeight: 500 }} onMouseEnter={(e) => e.target.style.opacity="1"} onMouseLeave={(e) => e.target.style.opacity="0.6"}>remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Animated Logo for Results ───
function UnstukAnim({ tie, skip }) {
  // Timing: hold 0.8s → gap opens over 1.2s → pause 0.3s → ball rises over 1s
  const [gapDeg, setGapDeg] = useState(0);
  const [ballUp, setBallUp] = useState(false);
  const startRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (skip && !tie) {
      setGapDeg(30);
      setBallUp(true);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [skip, tie]);

  useEffect(() => {
    if (tie || skip) return;

    const holdTimer = setTimeout(() => {
      startRef.current = performance.now();
      const animate = (now) => {
        const elapsed = now - startRef.current;
        const progress = Math.min(elapsed / 1200, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setGapDeg(eased * 30);
        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      animRef.current = requestAnimationFrame(animate);
    }, 800);

    const ballTimer = setTimeout(() => setBallUp(true), 2300);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(ballTimer);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [tie]);

  const cx = 30, cy = 30, r = 22;
  const toRad = (d) => (d * Math.PI) / 180;

  // Arc endpoints from exact 12 o'clock
  const rAngle = toRad(-90 + gapDeg);
  const lAngle = toRad(-90 - gapDeg);
  const px = (a) => (cx + r * Math.cos(a)).toFixed(3);
  const py = (a) => (cy + r * Math.sin(a)).toFixed(3);

  const arcD = gapDeg > 0.5
    ? `M ${px(rAngle)} ${py(rAngle)} A ${r} ${r} 0 1 1 ${px(lAngle)} ${py(lAngle)}`
    : `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${(cx - 0.001).toFixed(3)} ${cy - r}`;

  // Ball: centre of circle → centre of open space above gap
  // Open space above: from top of circle (cy-r=8) to top of viewbox (0), middle = 4
  // Offset from centre: cy - 4 = 26px up
  const ballOffset = (tie || !ballUp) ? 0 : -(cy - 4);

  return (
    <div style={{ width: 60, height: 60, margin: "0 auto 18px" }}>
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
        <path
          d={arcD}
          stroke={C.accent}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <g style={{
          transform: `translateY(${ballOffset}px)`,
          transition: ballUp ? "transform 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)" : "none",
        }}>
          <circle cx={cx} cy={cy} r="4" fill={C.sage} />
        </g>
      </svg>
    </div>
  );
}

// ─── Results ───
function ResultsView({ results, dName, critCount, onDone, onBack, onImmediate, onGroup, groupErr, setGroupExpiry, groupExpiryVal, setGroupHideIndiv, groupHideIndivVal, groupRequireCode, setGroupRequireCode, onOpenShareSheet, gutDoneExternal, setGutDoneExternal, groupCreatedExternal, setGroupCreatedExternal }) {
  const [showGroupSetup, setShowGroupSetup] = useState(false);
  const groupCreated = groupCreatedExternal || false;
  const setGroupCreated = setGroupCreatedExternal || (() => {});
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [ph, setPh] = useState(0);
  const [copied, setCopied] = useState(false);
  const gutDone = gutDoneExternal || false;
  const setGutDone = setGutDoneExternal || (() => {});
  const [gutVisible, setGutVisible] = useState(false);
  const [gutPicked, setGutPicked] = useState(null);
  const timersRef = useRef([]);
  const skipAnim = () => { timersRef.current.forEach(clearTimeout); setPh(2); };
  useEffect(() => {
    const a = setTimeout(() => setPh(1), 200);
    const b = setTimeout(() => setPh(2), 3500);
    timersRef.current = [a, b];
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  // Gut section appears immediately with results
  useEffect(() => {
    if (ph >= 1 && !gutDone) setGutVisible(true);
  }, [ph, gutDone]);
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score;

  // Strength of result
  const gap = tie ? 0 : sorted[0].pct - sorted[1].pct;
  const strength = tie ? "tie" : gap >= 30 ? "clear" : gap >= 10 ? "moderate" : "close";
  const strengthMsg = { clear: "This is a clear result.", moderate: "A meaningful difference, though not overwhelming.", close: "This is a close call \u2014 see the strategies below.", tie: null };

  // Shareable summary — two versions
  const bar = (pct) => {
    const filled = Math.round(pct / 5);
    return "\u2593".repeat(filled) + "\u2591".repeat(20 - filled);
  };
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const shareText = [
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "  Unstuk \u00b7 Decision Analysis",
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "",
    "  " + (dName || "Decision"),
    "  " + (critCount || 0) + " criteria compared \u00b7 " + dateStr,
    "",
    ...sorted.map((r, i) =>
      "  " + (i === 0 && !tie ? "\u25b6 " : "  ") + r.name + "  " + r.pct + "%\n  " + "  " + bar(r.pct)
    ),
    "",
    tie
      ? "  Result: Too close to call"
      : strength === "close"
        ? "  Result: Close call \u2014 " + sorted[0].name + " edges ahead"
        : strength === "moderate"
          ? "  Result: " + sorted[0].name + " is the stronger choice"
          : "  Result: " + sorted[0].name + " is the clear winner",
    "",
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "  Stuck on a decision? Try Unstuk free.",
    "  https://unstuk.app",
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  ].join("\n");

  const saveText = [
    (dName || "Decision") + " \u2014 Unstuk Analysis",
    dateStr,
    "",
    ...sorted.map((r) => r.name + ": " + r.pct + "%"),
    "",
    "Based on " + (critCount || 0) + " criteria.",
    tie ? "Result: Tie." : "Result: " + sorted[0].name + " (" + sorted[0].pct + "%).",
  ].join("\n");

  const [shareMode, setShareMode] = useState(null); // null | "share" | "save"
  const copyText = (text) => {
    const doFallback = () => { try { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch(e) {} };
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(doFallback); } else { doFallback(); }
  };

  return (
    <FadeIn>
      <div style={{ textAlign: "center", padding: "16px 0" }} onClick={ph < 2 ? skipAnim : undefined}>
        <div style={{ textAlign: "left" }}><BackBtn onClick={onBack} /></div>
        <div style={{ opacity: ph >= 1 ? 1 : 0, transform: ph >= 1 ? "scale(1)" : "scale(0.6)", transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <UnstukAnim tie={tie} skip={ph >= 2} />
        </div>
        {ph < 2 && <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, margin: "0 0 12px", cursor: "pointer" }}>tap to skip</p>}
        <H size="xl">{tie ? "It\u2019s a tie" : sorted[0].name}</H>
        {!tie && <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, marginTop: 6 }}>is the stronger choice</p>}

        {strengthMsg[strength] && (
          <p style={{ fontFamily: F.b, fontSize: 12, color: strength === "clear" ? C.sage : C.taupe, marginTop: 10, fontStyle: "italic" }}>
            {strengthMsg[strength]}
          </p>
        )}

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((r, i) => (
            <FadeIn key={r.name} delay={200 + i * 120}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 10, background: i === 0 && !tie ? C.sageSoft : C.bg, border: `1px solid ${i === 0 && !tie ? C.sage + "30" : C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 26, fontWeight: 700, color: i === 0 && !tie ? C.sage : C.text, minWidth: 56, textAlign: "right" }}>{r.pct}%</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.b, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 5 }}>{r.name}</div>
                  <div style={{ height: 5, borderRadius: 3, background: C.accentLt, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: ph >= 2 ? `${Math.max(r.pct, 6)}%` : "0%", borderRadius: 3, background: i === 0 && !tie ? C.sage : C.muted, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {ph >= 2 && (
          <p style={{ fontFamily: F.b, fontSize: 10, fontStyle: "italic", color: C.taupe, lineHeight: 1.5, margin: "16px 0 0", textAlign: "center" }}>
            {tie ? "A tie means your criteria weighted both options equally — your instinct or a casting vote may be the tiebreaker."
              : gap <= 10 ? "A narrow margin means this is genuinely close. Small changes in criteria or weighting could flip the result."
              : gap <= 30 ? "A moderate margin suggests a real difference, but consider whether any missing criteria could change things."
              : "A strong margin. This result is robust across your criteria."}
          </p>
        )}

        {/* ── Gut check — seamless part of the results page ── */}
        {!gutDone && gutVisible && !groupCreated && (
          <div style={{
            opacity: 1,
            marginTop: 28,
            transition: "opacity 0.6s ease",
          }}>
            <div style={{ width: 40, height: 2, background: `linear-gradient(90deg, transparent, ${C.sage}40, transparent)`, margin: "0 auto 20px", borderRadius: 1 }} />
            <p style={{ fontFamily: F.d, fontSize: 17, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>
              {"\u{1F4CB}"} Record your initial read
            </p>
            <p style={{ fontFamily: F.b, fontSize: 11, color: C.text, margin: "0 0 4px", lineHeight: 1.6 }}>
              Research shows people who track their initial intuition against outcomes become measurably better decision-makers over time. This is the basis of calibration training used in fields like medicine and intelligence analysis.
            </p>
            <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "0 0 14px" }}>One tap. In <strong>3 days</strong> we'll check how it played out.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {[
                { label: "Confident", emoji: "\u2714", value: "confident", bg: "#e8f5e9", color: "#2e7d32" },
                { label: "Uncertain", emoji: "\u2022", value: "uncertain", bg: "#fff8e1", color: "#f57f17" },
                { label: "Uneasy", emoji: "\u2716", value: "uneasy", bg: "#fce4ec", color: "#c62828" },
              ].map((o) => (
                <button key={o.value} onClick={() => {
                  setGutPicked(o.value);
                  setTimeout(() => { setGutDone(true); onImmediate && onImmediate(o.value); trackEvent("gut", { v: o.value }); }, 1200);
                }}
                  className="ustk-touch" style={{
                    fontFamily: F.b, fontSize: 12, fontWeight: 500, padding: "12px 20px", cursor: "pointer", textAlign: "center",
                    border: `2px solid ${gutPicked === o.value ? o.color : C.border}40`,
                    borderRadius: 12,
                    background: gutPicked === o.value ? o.bg : C.card,
                    color: o.color,
                    transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)",
                    transform: gutPicked === o.value ? "scale(1.06)" : gutPicked && gutPicked !== o.value ? "scale(0.94)" : "scale(1)",
                    opacity: gutPicked && gutPicked !== o.value ? 0.3 : 1,
                    boxShadow: gutPicked === o.value ? `0 2px 12px ${o.color}20` : "none",
                    flex: 1,
                  }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{o.emoji}</div>
                  {o.label}
                  {gutPicked === o.value && <div style={{ marginTop: 4, fontSize: 10, color: "#9a8a72" }}>{"\u2713"}</div>}
                </button>
              ))}
            </div>
            {gutPicked && (
              <p style={{
                fontFamily: F.b, fontSize: 10, color: C.sage, margin: "12px 0 0",
                opacity: 1, transition: "opacity 0.3s ease",
              }}>
                \u2713 Recorded — come back in 3 days to see how your instinct measured up.
              </p>
            )}
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "8px 0 0", lineHeight: 1.5, textAlign: "center" }}>
              Kahneman & Klein (2009) found that structured reflection on predictions is the single most effective way to improve intuitive judgment.
            </p>
          </div>
        )}

        {gutDone && !emailSaved && !groupCreated && (
          <FadeIn>
            <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 4px" }}>Get reminded to reflect</p>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
                Optional — we'll email you in 3 days when your reflection is ready.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="email" value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} placeholder="your@email.com"
                  style={{ flex: 1, fontFamily: F.b, fontSize: 12, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, outline: "none" }} />
                <button onClick={() => { if (emailAddr.includes("@") && emailAddr.includes(".")) { try { window.storage.set("unstuk_email", emailAddr); } catch(e) {} setEmailSaved(true); } }}
                  disabled={!emailAddr.includes("@")}
                  style={{ fontFamily: F.b, fontSize: 11, padding: "8px 14px", borderRadius: 6, border: "none", background: emailAddr.includes("@") ? C.sage : C.accentLt, color: emailAddr.includes("@") ? "#fff" : C.muted, cursor: emailAddr.includes("@") ? "pointer" : "default" }}>
                  Remind me
                </button>
              </div>
              <button onClick={() => setEmailSaved(true)} style={{ fontFamily: F.b, fontSize: 10, color: C.border, background: "none", border: "none", cursor: "pointer", marginTop: 6 }}>Skip</button>
            </div>
          </FadeIn>
        )}
        {emailSaved && emailAddr && (
          <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, margin: "10px 0 0", textAlign: "center" }}>
            {"\u2713"} We'll email {emailAddr} when your reflection is ready.
          </p>
        )}


        {!groupCreated && <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => { setShareMode(shareMode === "share" ? null : "share"); setCopied(false); }} style={{ fontFamily: F.b, fontSize: 11, color: shareMode === "share" ? C.sage : C.muted, background: shareMode === "share" ? C.sageSoft : C.bg, border: `1px solid ${shareMode === "share" ? C.sage + "40" : C.border}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", transition: "all 0.2s" }}>
            Share result
          </button>
          <button onClick={() => { setShareMode(shareMode === "save" ? null : "save"); setCopied(false); }} style={{ fontFamily: F.b, fontSize: 11, color: shareMode === "save" ? C.sage : C.muted, background: shareMode === "save" ? C.sageSoft : C.bg, border: `1px solid ${shareMode === "save" ? C.sage + "40" : C.border}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", transition: "all 0.2s" }}>
            Save for myself
          </button>
        </div>}

        {shareMode && !groupCreated && (
          <FadeIn>
            <Card style={{ marginTop: 14, textAlign: "left", padding: 16 }}>
              <pre style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 11, color: C.text, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", background: C.bg, padding: 12, borderRadius: 6, border: `1px solid ${C.border}` }}>{shareMode === "share" ? shareText : saveText}</pre>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={() => copyText(shareMode === "share" ? shareText : saveText)} style={{ fontFamily: F.b, fontSize: 12, color: "#fff", background: C.sage, border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", flex: 1 }}>
                  {copied ? "\u2713 Copied" : "Copy to clipboard"}
                </button>
              </div>

            </Card>
          </FadeIn>
        )}

        {(tie || strength === "close") && <TieBox />}

        <div style={{ marginTop: 24 }}>

          {onGroup && (
            <div style={{ marginTop: 30, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <Btn v="sage" onClick={() => setShowGroupSetup(s => !s)} style={{ width: "100%", padding: "13px 28px", fontSize: 13 }}>
                {"\uD83D\uDC65"} Make this a Team Decision
              </Btn>
              {showGroupSetup && (
                <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: C.sageSoft + "40", border: `1px solid ${C.sage}30` }}>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "0 0 4px" }}>Time limit:</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[{ label: "15m", val: 0.25 }, { label: "30m", val: 0.5 }, { label: "1h", val: 1 }, { label: "6h", val: 6 }, { label: "24h", val: 24 }, { label: "3d", val: 72 }, { label: "1w", val: 168 }].map((t) => (
                        <button key={t.val} onClick={() => setGroupExpiry(groupExpiryVal === t.val ? null : t.val)} style={{
                          fontFamily: F.b, fontSize: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                          border: `1px solid ${groupExpiryVal === t.val ? C.sage : C.border}`,
                          background: groupExpiryVal === t.val ? C.sageSoft : "#fff",
                          color: groupExpiryVal === t.val ? C.sage : C.text,
                          fontWeight: groupExpiryVal === t.val ? 600 : 400,
                        }}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
                    onClick={() => { if (setGroupRequireCode) setGroupRequireCode(r => !r); }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, position: "relative", flexShrink: 0,
                      background: groupRequireCode ? C.sage : C.accentLt, transition: "background 0.2s" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2,
                        left: groupRequireCode ? 16 : 2, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                    </div>
                    <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted }}>Require join code (optional)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}
                    onClick={() => { if (setGroupHideIndiv) setGroupHideIndiv(h => !h); }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, position: "relative", flexShrink: 0,
                      background: groupHideIndivVal ? C.sage : C.accentLt, transition: "background 0.2s" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2,
                        left: groupHideIndivVal ? 16 : 2, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                    </div>
                    <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted }}>Hide individual scores</span>
                  </div>
                  <Btn v="sage" onClick={async () => { if (onGroup) { await onGroup(); setGroupCreated(true); setGutDone(true); setShowGroupSetup(false); } }} style={{ width: "100%", padding: "11px 20px", fontSize: 12 }}>
                    Create & share
                  </Btn>
                </div>
              )}
              {groupErr && <p style={{ fontFamily: F.b, fontSize: 11, color: C.error, margin: "8px 0 0" }}>{groupErr}</p>}
            </div>
          )}
          <Btn onClick={onDone} style={{ width: "100%", padding: "15px 28px", fontSize: 15, fontWeight: 600, marginTop: 8 }}>Done</Btn>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button onClick={onDone} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
              ⌂ &nbsp;Home
            </button>
          </div>
        </div>

        {/* How it works + Decision principles — minimal, barely visible */}
        <HowItWorks />
      </div>
    </FadeIn>
  );
}

function HowItWorks() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${C.border}40` }}>
      <button onClick={() => setShow(!show)} style={{ fontFamily: F.b, fontSize: 10, color: C.border, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.03em", textTransform: "uppercase" }}>
        {show ? "Hide" : "How Unstuk works"}
      </button>
      {show && (
        <FadeIn>
          <div style={{ textAlign: "left", marginTop: 14, fontFamily: F.b, fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
            <p style={{ margin: "0 0 12px", fontWeight: 600, color: C.text, fontSize: 12 }}>How scores are calculated</p>
            <p style={{ margin: "0 0 10px" }}>Unstuk uses a weighted scoring method. Each criterion you add carries an importance level you set. When you compare options, your choices are multiplied by these weights, then normalised into percentages. Options that perform well on the things you said matter most score higher.</p>
            <p style={{ margin: "0 0 10px" }}>This approach is used in decision science, consulting, and strategic planning. Unstuk makes it accessible without spreadsheets.</p>

            <p style={{ margin: "20px 0 12px", fontWeight: 600, color: C.text, fontSize: 12 }}>Principles of good decisions</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Separate the decision from the outcome. A good decision can still lead to a bad result. Judge your process, not the luck.</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Name what matters before you compare. Choosing criteria first prevents you from retrofitting reasons to justify an instinctive preference.</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Weight honestly. If salary matters more than commute, say so. Pretending everything is equally important produces useless results.</p>
            <p style={{ margin: "0 0 10px" }}><span style={{ color: C.sage }}>&#9679;</span> Close calls are information. If two options score within 10%, the data is telling you both are viable. Use other signals — reversibility, timing, energy — to break it.</p>
            <p style={{ margin: "0 0 0" }}><span style={{ color: C.sage }}>&#9679;</span> Decide, then commit. Research shows that people who commit fully to a choice report higher satisfaction than those who keep second-guessing, even when the choices are identical.</p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function TieBox() {
  const [s, setS] = useState(false);
  return (
    <FadeIn delay={500}>
      <div style={{ marginTop: 20 }}>
        <button onClick={() => setS(!s)} style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, background: C.taupeSoft, border: `1px solid ${C.taupe}30`, borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
          {s ? "Hide advice" : "What to do when it's a tie"}
        </button>
        {s && (
          <Card style={{ marginTop: 12, textAlign: "left", padding: 20 }}>
            <div style={{ fontFamily: F.b, fontSize: 13, color: C.text, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 14px" }}><strong>Pre-mortem test.</strong> Imagine you chose Option A and it went badly. Why did it fail? Repeat for Option B. The option whose failure scenario feels more avoidable is often the better bet. (Research by Gary Klein shows pre-mortems uncover risks that standard analysis misses.)</p>
              <p style={{ margin: "0 0 14px" }}><strong>Reversibility test.</strong> When two options score equally, lean toward the one that is harder to undo. Reversible choices can be corrected later, but irreversible ones deserve the benefit of the doubt now. (Based on the asymmetry principle in decision theory.)</p>
              <p style={{ margin: "0 0 14px" }}><strong>Scout mindset.</strong> Ask yourself: am I looking for reasons to confirm what I already want, or am I genuinely trying to find the truth? A tie often means one option feels emotionally right but can't justify itself on the criteria. Name that feeling. Then decide whether to trust it or override it. (From Julia Galef's work on epistemic rationality.)</p>
              <p style={{ margin: "0 0 14px" }}><strong>Expected value under uncertainty.</strong> For each option, estimate the best realistic outcome and the worst realistic outcome. Multiply each by its rough probability. The option with the higher expected value across scenarios is the more rational choice, even when criteria scores are equal. (Core principle of rational decision-making.)</p>
              <p style={{ margin: "0" }}><strong>Sleep on it — but set a deadline.</strong> Unconscious processing genuinely helps with complex decisions (research by Ap Dijksterhuis). Give yourself 48 hours, not longer. Unlimited time breeds overthinking, not clarity.</p>
            </div>
          </Card>
        )}
      </div>
    </FadeIn>
  );
}

// ─── Universal Share Sheet (WhatsApp, SMS, Email, Teams, Facebook, Copy) ───
function ShareSheet({ text, title, onClose }) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(text);
  const hasNative = typeof navigator !== "undefined" && !!navigator.share;
  const nativeShare = async () => {
    try { await navigator.share({ text, title: title || "Unstuk" }); onClose(); } catch(e) {}
  };
  const channels = [
    { label: "WhatsApp", icon: "\uD83D\uDCAC", href: `https://wa.me/?text=${encoded}`, bg: "#25D36612" },
    { label: "SMS", icon: "\uD83D\uDCF1", href: `sms:?&body=${encoded}`, bg: "#5B8DEF12" },
    { label: "Email", icon: "\u2709\uFE0F", href: `mailto:?subject=${encodeURIComponent(title || "Unstuk")}&body=${encoded}%0A%0AGet%20Unstuk%20Now%20%E2%86%92%20https%3A%2F%2Funstuk.app`, bg: "#EA433512" },
    { label: "Teams", icon: "\uD83D\uDCBC", href: `https://teams.microsoft.com/share?msgText=${encoded}`, bg: "#6264A712" },
    { label: "Telegram", icon: "\u2708", href: `https://t.me/share/url?text=${encoded}`, bg: "#229ED912" },
    { label: "X", icon: "\uD835\uDD4F", href: `https://twitter.com/intent/tweet?text=${encoded}`, bg: "#14171A12" },
    { label: "Facebook", icon: "\uD83D\uDC4D", href: `https://www.facebook.com/sharer/sharer.php?quote=${encoded}`, bg: "#1877F212" },
    { label: "LinkedIn", icon: "\uD83D\uDCE2", href: `https://www.linkedin.com/sharing/share-offsite/?url=https://unstuk.app&summary=${encoded}`, bg: "#0A66C212" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", maxWidth: 440, width: "100%", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", animation: "ustk-sheet-up 0.25s ease" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px", opacity: 0.5 }} />
        <p style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.text, margin: "0 0 14px", textAlign: "center" }}>{title || "Share"}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {channels.map(ch => (
            <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 4px", borderRadius: 12, border: `1px solid ${C.border}20`, background: ch.bg, textDecoration: "none", cursor: "pointer", transition: "all 0.15s" }}>
              <span style={{ fontSize: 20 }}>{ch.icon}</span>
              <span style={{ fontFamily: F.b, fontSize: 9, color: C.muted }}>{ch.label}</span>
            </a>
          ))}
        </div>
        <button onClick={() => { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;"; document.body.appendChild(ta); ta.focus(); ta.select(); try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch(e) {} document.body.removeChild(ta); }}
          style={{ fontFamily: F.b, fontSize: 13, padding: "13px 20px", borderRadius: 10, border: `1.5px solid ${copied ? C.sage : C.border}`, background: copied ? C.sageSoft : "#fff", color: copied ? C.sage : C.text, cursor: "pointer", width: "100%", fontWeight: 500, transition: "all 0.2s" }}>
          {copied ? "\u2713 Copied to clipboard" : "Copy to clipboard"}
        </button>
        <button onClick={onClose} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", marginTop: 10, width: "100%", padding: 6 }}>Cancel</button>
      </div>
      <style>{`@keyframes ustk-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

// ─── Privacy Modal ───
function PrivacyModal({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 420, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}>
        <H size="md">Terms & Information</H>
        <div style={{ fontFamily: F.b, fontSize: 13, color: C.text, lineHeight: 1.7, marginTop: 16 }}>

          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>1. How Your Data Is Handled</p>
          <p style={{ margin: "0 0 10px" }}>Unstuk is designed to store decision data on your device. We do not intentionally collect or transmit personal data to external servers. However, we cannot guarantee absolute security or that data will never be exposed through device vulnerabilities, operating system behaviour, or circumstances beyond our control. We do not knowingly use cookies, analytics, or tracking technologies, though third-party platforms (such as app stores or operating systems) may collect their own data independently of Unstuk.</p>

          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>2. Data Retention</p>
          <p style={{ margin: "0 0 10px" }}>Decision history is intended to be automatically removed after 60 days. You may delete individual decisions at any time. Uninstalling the app should remove locally stored data, though residual data may persist depending on your device and operating system. We do not maintain backups or cloud copies of your data.</p>

          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>3. Acceptable Use</p>
          <p style={{ margin: "0 0 10px" }}>By using Unstuk you agree to the following: (a) You will use Unstuk solely for lawful, personal decision-making purposes. (b) You will not use Unstuk to plan, facilitate, organise, or evaluate any activity that is illegal, harmful, violent, abusive, discriminatory, or that may cause harm to any person, animal, property, or entity. (c) Prohibited uses include but are not limited to decisions involving violence, criminal activity, harassment, exploitation, self-harm, abuse, fraud, or any activity that violates applicable local, national, or international law. (d) We reserve the right to implement content filtering to enforce these terms. (e) Violation of these terms may result in termination of your access to Unstuk.</p>

          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>4. Disclaimer</p>
          <p style={{ margin: "0 0 10px" }}>UNSTUK IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. Unstuk is a general-purpose thinking tool only. It does not provide and must not be relied upon as professional, legal, financial, medical, psychological, or any other form of expert advice. It is not a substitute for independent professional judgement. You are solely responsible for your decisions and their consequences, regardless of any output provided by this application. By using Unstuk, you agree to indemnify and hold harmless its creators, developers, and distributors from any and all claims, liabilities, damages, costs, and expenses (including legal fees) arising from or in connection with your use of this application. The creators accept no responsibility or liability for any loss, damage, injury, or adverse outcome of any kind, to the maximum extent permitted by applicable law in your jurisdiction.</p>

          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>5. Intellectual Property</p>
          <p style={{ margin: "0 0 10px" }}>Unstuk, its name, design, and methodology are the property of their respective owners. You may not copy, modify, distribute, reverse-engineer, or create derivative works without prior written consent.</p>

          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>6. General</p>
          <p style={{ margin: "0 0 10px" }}>These terms are governed by applicable law in your jurisdiction. We may update these terms at any time. Continued use constitutes acceptance of any changes. If any provision is found unenforceable, the remainder continues in effect. Nothing in these terms creates any guarantee, warranty, or assurance beyond what is explicitly stated.</p>

          <p style={{ margin: 0, color: C.muted, fontSize: 11 }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · © {new Date().getFullYear()} Unstuk.</p>
        </div>
        <div style={{ marginTop: 20 }}><Btn v="secondary" onClick={onClose}>Close</Btn></div>
      </div>
    </div>
  );
}

// ─── Content blocked message ───
function BlockedMsg({ onBack }) {
  return (
    <FadeIn>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <H size="md">This isn't what Unstuk is for</H>
        <p style={{ fontFamily: F.b, fontSize: 13, color: C.muted, margin: "12px 0 24px", lineHeight: 1.6 }}>
          Unstuk helps with everyday decisions — career choices, purchases, planning, and similar matters. It cannot be used for decisions involving harm, violence, or illegal activity.
        </p>
        <Btn onClick={onBack}>Start over</Btn>
      </div>
    </FadeIn>
  );
}

// ─── App ───

function UnstukInner() {
  const [history, setHistory] = useState([]);
  const [histLoaded, setHistLoaded] = useState(false);
  // Paywall verification — hash-based so not trivially bypassed via console
  // In production, replace with StoreKit/Google Play receipt validation
  const UNLOCK_SALT = "unstuk_v3_" + (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 20) : "x");
  const makeUnlockToken = () => {
    let h = 0;
    for (let i = 0; i < UNLOCK_SALT.length; i++) { h = ((h << 5) - h) + UNLOCK_SALT.charCodeAt(i); h |= 0; }
    return "utk_" + Math.abs(h).toString(36) + "_paid";
  };
  const verifyUnlock = (token) => token === makeUnlockToken();
  const [unlocked, setUnlocked] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [weeklyDay, setWeeklyDay] = useState(null); // 0=Sun..6=Sat
  const [weeklyTime, setWeeklyTime] = useState(null); // "morning"/"afternoon"/"evening"
  const [weeklyGoal, setWeeklyGoal] = useState(1); // decisions per week target
  const [showSchedule, setShowSchedule] = useState(false);
  const [weeklyTitle, setWeeklyTitle] = useState("");
  const [tempDay, setTempDay] = useState(1);
  const [tempTime, setTempTime] = useState("Morning");
  const [tempGoal, setTempGoal] = useState(1);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [seenOnboard, setSeenOnboard] = useState(true);
  const [seenWhatsNew, setSeenWhatsNew] = useState(true);
  const [onboardPage, setOnboardPage] = useState(0);
  const [tutSlide, setTutSlide] = useState(0);
  const [reflectId, setReflectId] = useState(null);
  const [reflectStep, setReflectStep] = useState(0);
  const [reflectAnswers, setReflectAnswers] = useState({});
  const [expandedDec, setExpandedDec] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [groupCode, setGroupCode] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupData, setGroupData] = useState(null);
  const [joinErr, setJoinErr] = useState(null);
  const [joinNameInput, setJoinNameInput] = useState("");
  const [groupCopied, setGroupCopied] = useState(false);

  const copyToClipboard = (text, setFlag) => {
    const doFallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setFlag(true); setTimeout(() => setFlag(false), 2000);
      } catch(e) {}
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => { setFlag(true); setTimeout(() => setFlag(false), 2000); }).catch(doFallback);
    } else { doFallback(); }
  };
  const [groupExpiry, setGroupExpiry] = useState(24);
  const [groupHideIndiv, setGroupHideIndiv] = useState(false);
  const [groupSubmitErr, setGroupSubmitErr] = useState(null);
  const [resultsGutDone, setResultsGutDone] = useState(false);
  const [resultsGroupCreated, setResultsGroupCreated] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false); // true when user started via "Team Decision" button
  const [isParticipant, setIsParticipant] = useState(false);
  const [gsCreating, setGsCreating] = useState(false); // true when joined someone else's group/poll
  const [groupRequireCode, setGroupRequireCode] = useState(false); // optional code for group decisions
  const [shareSheetData, setShareSheetData] = useState(null); // { text, title }

  // Load history, onboarding flag, and unlock status from persistent storage on mount
  useEffect(() => {
    loadHistory().then((h) => { setHistory(h); setHistLoaded(true); });
    (async () => {
      try {
        const r = await window.storage.get("unstuk_onboarded");
        if (!r || !r.value) setSeenOnboard(false);
      } catch (e) { setSeenOnboard(false); }
      try {
        const w = await window.storage.get("unstuk_whatsnew_v2");
        if (!w || !w.value) setSeenWhatsNew(false);
      } catch (e) { setSeenWhatsNew(false); }
      try {
        const gc = await window.storage.get("unstuk_active_groupCode");
        if (gc && gc.value) setGroupCode(gc.value);
      } catch(e) {}
      try {
        const qc = await window.storage.get("unstuk_active_qvCode");
        if (qc && qc.value) setQvCode(qc.value);
      } catch(e) {}
      try {
        const u = await window.storage.get("unstuk_unlocked");
        try { const wd = await window.storage.get("unstuk_weekly"); if (wd) { const wp = JSON.parse(wd.value); setWeeklyDay(wp.day); setWeeklyTime(wp.time); setWeeklyGoal(wp.goal || 1); } } catch(e) {}
        try { const al = await window.storage.get("unstuk_analytics"); if (al) { const parsed = JSON.parse(al.value); if (Array.isArray(parsed)) parsed.forEach(e => _evtLog.push(e)); } } catch(e) {}
        if (u && verifyUnlock(u.value)) setUnlocked(true);
      } catch (e) { /* not unlocked */ }
    })();
  }, []);

  const saveDec = (d) => {
    setHistory((prev) => {
      const next = [d, ...prev.filter((x) => x.id !== d.id)];
      saveHistory(next); // persist
      return next;
    });
  };

  const [screen, setScreen] = useState("home");
  const [dName, setDName] = useState("");
  const [dType, setDType] = useState(null);
  const [opts, setOpts] = useState([]);
  const [newOpt, setNewOpt] = useState("");
  const [crits, setCrits] = useState([]);
  const [newCrit, setNewCrit] = useState("");
  const [newImp, setNewImp] = useState(null);

  const [bo1, setBo1] = useState("");
  const [bo2, setBo2] = useState("");
  const [bIdx, setBIdx] = useState(0);
  const [bCh, setBCh] = useState([]);
  const [bPick, setBPick] = useState(null);
  const [advPicked, setAdvPicked] = useState(null);
  const [mAdvPicked, setMAdvPicked] = useState(null);

  const [baseOpt, setBaseOpt] = useState(null);
  const [mIdx, setMIdx] = useState(0);
  const [mCo, setMCo] = useState([]);
  const [mPairs, setMPairs] = useState([]);

  const [step, setStep] = useState("name");
  const [res, setRes] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [rewardTick, setRewardTick] = useState(0);
  const [selPulse, setSelPulse] = useState(false);
  const [lastReward, setLastReward] = useState(null);
  const [lastAddedOpt, setLastAddedOpt] = useState(null);
  const [lastAddedCrit, setLastAddedCrit] = useState(null);
  const triggerPulse = () => { setSelPulse(true); setTimeout(() => setSelPulse(false), 400); };
  const showReward = (t) => { setLastReward(t); setTimeout(() => setLastReward(null), 1200); };
  const [addFlash, setAddFlash] = useState(null); // brief feedback on add: "option" | "criteria" | null // increments on each comparison completion to trigger MicroReward

  // ─── Quick Poll / Pulse Survey ───
  // qvScreen merged into main screen state: qv_create, qv_share, qv_vote, qv_results
  const [qvQuestion, setQvQuestion] = useState("");
  const [qvFocusArea, setQvFocusArea] = useState("question"); // "question" | "options"
  const [qvOptions, setQvOptions] = useState(["", ""]);
  const [qvCode, setQvCode] = useState(null);
  const [qvJoinCode, setQvJoinCode] = useState("");
  const [qvVoted, setQvVoted] = useState(null);
  const [qvResults, setQvResults] = useState(null);
  const [qvCopied, setQvCopied] = useState(false);
  const [qvErr, setQvErr] = useState(null);
  const [qvLoading, setQvLoading] = useState(false);
  const [qvExpiry, setQvExpiry] = useState(24); // hours, 0 = no limit
  const [qvRequireCode, setQvRequireCode] = useState(false); // optional code security

  const createQuickVote = async () => {
    const opts = qvOptions.map(o => o.trim()).filter(Boolean);
    if (!qvQuestion.trim() || opts.length < 2) return;
    if (isBlockedContent(qvQuestion) || opts.some(isBlockedContent)) { setBlocked(true); return; }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const qv = { question: sanitize(qvQuestion.trim()), options: opts.map(sanitize), votes: {}, created: Date.now(), expiry: qvExpiry, requireCode: qvRequireCode };
    try { await window.storage.set("unstuk_qv_" + code, JSON.stringify(qv)); } catch(e) {}
    setQvCode(code);
    try { await window.storage.set("unstuk_active_qvCode", code); } catch(e) {}
    trackEvent("quickvote_create");
    const exL = qvExpiry === 0 ? "No time limit" : qvExpiry < 1 ? `${Math.round(qvExpiry * 60)} mins` : qvExpiry <= 1 ? "1 hour" : qvExpiry <= 24 ? `${qvExpiry} hours` : `${Math.round(qvExpiry / 24)} days`;
    const qvShareText = `📊 Quick Poll: ${sanitize(qvQuestion.trim())}\n\nOptions:\n${opts.map((o, i) => `${i + 1}. ${o}`).join("\n")}${qvRequireCode ? `\n\nCode: ${code}` : ""}\n\nRespond at unstuk.app${qvExpiry > 0 ? `\n\nCloses in: ${exL}` : ""}`;
    setShareSheetData({ text: qvShareText, title: "Share Quick Poll", afterClose: () => setScreen("home") });
    setScreen("qv_share");
  };

  const joinQuickVote = async (code) => {
    try {
      const d = await window.storage.get("unstuk_qv_" + String(code).toUpperCase());
      if (!d) { setQvErr("Vote not found. Check the code."); return null; }
      return JSON.parse(d.value);
    } catch(e) { setQvErr("Could not load vote."); return null; }
  };

  const submitQuickVote = async (code, optionIdx) => {
    try {
      const d = await window.storage.get("unstuk_qv_" + code);
      if (!d) return;
      const qv = JSON.parse(d.value);
      const voterId = "v_" + Math.random().toString(36).substring(2, 8);
      qv.votes[voterId] = optionIdx;
      await window.storage.set("unstuk_qv_" + code, JSON.stringify(qv));
      setQvVoted(optionIdx);
      setQvResults(qv);
      trackEvent("quickvote_vote");
    } catch(e) {}
  };

  const loadQuickVoteResults = async (code) => {
    if (!code) return null;
    const upperCode = String(code).toUpperCase();
    try {
      const d = await window.storage.get("unstuk_qv_" + upperCode);
      if (!d || !d.value) return null;
      const parsed = JSON.parse(d.value);
      return { ...parsed, code: upperCode };
    } catch(e) { return null; }
  };

  useEffect(() => {
    if (res && !savedId && !savingRef.current) {
      savingRef.current = true;
      const id = uid();
      saveDec({
        id, name: dName, type: dType,
        ...(dType === "binary" ? { binaryOption1: bo1, binaryOption2: bo2, comparisons: bCh } : { options: opts, baseOption: baseOpt, comparisons: mCo }),
        criteria: crits, results: res, timestamp: Date.now(), groupCode: groupCode || undefined,
      });
      setSavedId(id);
      trackEvent("complete", { type: dType, crits: crits.length });
      savingRef.current = false;
      // Auto-submit to group if active
      if (groupCode && groupName) {
        setIsParticipant(false);
        submitToGroup(groupCode, groupName || "Creator", res).then((ok) => {
          if (!ok) setGroupSubmitErr("Couldn't submit to group. Your name may already be taken, or the group is full. Your results are saved locally.");
        });
      }
    }
  }, [res, savedId]);

  const saveImmediate = async (feeling) => {
    if (!savedId) return;
    const updated = history.map((d) =>
      d.id === savedId ? { ...d, immediate: { feeling, timestamp: Date.now() } } : d
    );
    setHistory(updated);
    saveHistory(updated);
    // No navigation — user stays on results page and uses Done button to proceed
  };

  // ─── Team Decision Helpers ───
  // Architecture: each participant writes to their OWN shared key.
  // No read-modify-write cycle = no race conditions = no backend needed.
  //   grp:{code}:meta  → decision definition (created once by creator)
  //   grp:{code}:p:{name} → individual participant results (one key per person)
  // Reading: list all keys with prefix grp:{code}:p: to aggregate.

  const genCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const createGroup = async (decisionData, results, userName, expiryHours) => {
    const code = genCode();
    const name = userName || "Creator";
    const meta = {
      decision: { name: decisionData.name, type: decisionData.type, criteria: decisionData.criteria,
        ...(decisionData.type === "binary" ? { binaryOption1: decisionData.binaryOption1, binaryOption2: decisionData.binaryOption2 } : { options: decisionData.options, baseOption: decisionData.baseOption }) },
      created: Date.now(), maxParticipants: 8, expiresAt: Date.now() + (expiryHours || 24) * 3600000, hideIndividual: groupHideIndiv,
    };
    try {
      await window.storage.set("grp:" + code + ":meta", JSON.stringify(meta));
      await window.storage.set("grp:" + code + ":p:" + name, JSON.stringify({ name, results, timestamp: Date.now() }));
    } catch (e) { return null; }
    return code;
  };

  const joinGroup = async (code) => {
    try {
      const r = await window.storage.get("grp:" + code.toUpperCase() + ":meta");
      if (r && r.value) {
        const meta = JSON.parse(r.value);
        if (meta.expiresAt && Date.now() > meta.expiresAt) return { ...meta, expired: true, participantCount: 0 };
        const keys = await window.storage.list("grp:" + code.toUpperCase() + ":p:");
        const count = keys && keys.keys ? keys.keys.length : 0;
        return { ...meta, participantCount: count, hideIndividual: meta.hideIndividual || false };
      }
    } catch (e) {}
    return null;
  };

  const cancelGroup = async (code) => {
    try {
      await window.storage.delete("grp:" + code + ":meta");
      const keys = await window.storage.list("grp:" + code + ":p:");
      if (keys && keys.keys) { for (const k of keys.keys) await window.storage.delete(k); }
      return true;
    } catch (e) { return false; }
  };

  const submitToGroup = async (code, userName, results) => {
    try {
      const keys = await window.storage.list("grp:" + code + ":p:");
      const count = keys && keys.keys ? keys.keys.length : 0;
      if (count >= 8) return false;
      try {
        await window.storage.get("grp:" + code + ":p:" + userName);
        return false;
      } catch (e) { /* key doesn't exist = good */ }
      const safeResults = results.map(r => ({ name: r.name, score: r.score, pct: r.pct }));
      await window.storage.set("grp:" + code + ":p:" + userName, JSON.stringify({ name: userName, results: safeResults, timestamp: Date.now() }));
      return true;
    } catch (e) { return false; }
  };

  // Prevent double-click on save
  const savingRef = useRef(false);

  const loadGroupResults = async (code) => {
    try {
      const metaR = await window.storage.get("grp:" + code + ":meta");
      if (!metaR || !metaR.value) return null;
      const meta = JSON.parse(metaR.value);
      const participants = [];
      try {
        const keys = await window.storage.list("grp:" + code + ":p:");
        if (keys && keys.keys && keys.keys.length > 0) {
          for (const key of keys.keys) {
            try {
              const pr = await window.storage.get(key);
              if (pr && pr.value) participants.push(JSON.parse(pr.value));
            } catch (e) { /* skip */ }
          }
        }
      } catch(listErr) { /* no participants yet — still return meta */ }
      return { ...meta, participants, code };
    } catch (e) {}
    return null;
  };


  const prevStep = useRef([]);
  const goStep = (s) => { prevStep.current.push(step); setStep(s); };
  const goBack = () => {
    if (prevStep.current.length > 0) {
      setStep(prevStep.current.pop());
    } else {
      setScreen("home");
    }
  };

  const resetFull = (p = null) => {
    setDName(p?.name || ""); setDType(p?.type || null);
    setOpts(p?.options || []); setNewOpt("");
    setCrits(p?.criteria || []); setNewCrit(""); setNewImp(null);
    setBo1(p?.binaryOption1 || ""); setBo2(p?.binaryOption2 || "");
    setBIdx(0); setBCh([]); setBPick(null);
    setBaseOpt(p?.baseOption || null); setMIdx(0); setMCo([]); setMPairs([]);
    setRes(null); setSavedId(null); setBlocked(false);
    if (p?.groupCode) setGroupCode(p.groupCode);
    // Note: groupCode and qvCode are NOT cleared here — they persist until
    // the user explicitly ends/cancels that session from results or home screen
    setRewardTick(0);
    prevStep.current = [];
    setResultsGutDone(false); setResultsGroupCreated(false);
  };

  const scoreBin = () => {
    if (crits.length === 0) return [{ name: bo1, score: 0, pct: 50 }, { name: bo2, score: 0, pct: 50 }];
    const maxBase = crits.reduce((sum, cr) => sum + cr.importance * 3, 0);
    let sa = maxBase, sb = maxBase;
    bCh.forEach((c) => {
      const cr = crits.find((x) => x.id === c.cId);
      if (!cr) return;
      const w = cr.importance * c.adv;
      if (c.opt === 1) { sa += w; sb -= w; }
      else if (c.opt === 2) { sb += w; sa -= w; }
    });
    sa = Math.max(0, sa); sb = Math.max(0, sb);
    const t = sa + sb || 1;
    let pa = pct(sa, t), pb = pct(sb, t);
    // Ensure minimum 5% — a total shutout feels wrong and discourages trust
    if (pa > 0 && pa < 5) { pa = 5; pb = 95; }
    if (pb > 0 && pb < 5) { pb = 5; pa = 95; }
    if (pa === 0 && pb > 0) { pa = 3; pb = 97; }
    if (pb === 0 && pa > 0) { pb = 3; pa = 97; }
    return [{ name: bo1, score: sa, pct: pa }, { name: bo2, score: sb, pct: pb }];
  };

  const scoreMul = () => {
    if (crits.length === 0 || opts.length === 0) return opts.map((o) => ({ name: o.name, score: 0, pct: Math.round(100 / (opts.length || 1)) }));
    const maxBase = crits.reduce((sum, cr) => sum + cr.importance * 3, 0);
    const scores = {}; opts.forEach((o) => (scores[o.id] = maxBase));
    mCo.forEach((mc) => { const cr = crits.find((x) => x.id === mc.cId); if (!cr) return; scores[mc.oId] += cr.importance * mc.adv; });
    opts.forEach((o) => (scores[o.id] = Math.max(0, scores[o.id])));
    const t = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    let results = opts.map((o) => ({ name: o.name, score: scores[o.id], pct: pct(scores[o.id], t) })).sort((a, b) => b.pct - a.pct);
    results = results.map((r) => ({ ...r, pct: Math.max(2, r.pct) }));
    const pctTotal = results.reduce((s, r) => s + r.pct, 0);
    if (pctTotal !== 100 && results.length > 0) { results[0].pct -= (pctTotal - 100); }
    return results;
  };

  const addCrit = () => {
    if (newCrit.trim() && newImp !== null) {
      if (isBlockedContent(newCrit)) { setBlocked(true); return false; }
      const cid = uid();
      setCrits((p) => [...p, { id: cid, name: newCrit.trim(), importance: newImp }]);
      setNewCrit(""); setNewImp(null); setRewardTick((t) => t + 1);
      setAddFlash("criteria"); setTimeout(() => setAddFlash(null), 800);
      setLastAddedCrit(cid); setTimeout(() => setLastAddedCrit(null), 1500);
      return true;
    }
    return false;
  };

  const goFromCrits = (pendingCount = 0) => {
    if (crits.length + pendingCount === 0) return;
    if (newCrit.trim() !== "" && newImp === null && pendingCount === 0) return;
    if (isGroupMode) { goStep("groupsetup"); return; }
    if (dType === "binary") { setBIdx(0); setBCh([]); setBPick(null); goStep("compare"); }
    else goStep("base");
  };

  // ─── GLOBAL STYLES for touch feedback ───
  const touchStyle = `
    .ustk-touch { transition: background 0.15s ease, transform 0.1s ease; }
    .ustk-touch:active { background: ${C.sageSoft} !important; transform: scale(0.97); }
    @keyframes ustk-sel-flash {
      0% { box-shadow: 0 0 0 0 ${C.sage}40; }
      50% { box-shadow: 0 0 12px 4px ${C.sage}25; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    .ustk-sel-active { animation: ustk-sel-flash 0.4s ease-out; }
    @keyframes ustk-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.9; }
    }
  `;

  // ─── ONBOARDING ───
  const onboardPages = [
    { title: "Better business decisions, faster", body: "Unstuk brings the rigour of weighted criteria, pairwise comparison, and calibrated analysis to every business decision — in under two minutes. The kind of thinking that usually takes a workshop, done before your next meeting." },
    { title: "Build a track record", body: "After each decision, capture your initial read. A few days later, reflect on how it played out. Over time, you'll see exactly when to trust the analysis and when instinct leads." },
    { title: "Align your team faster", body: "Invite colleagues to weigh in on the same business decision. Everyone scores independently — then you see where the team aligns, where it diverges, and what's driving the gap. Faster alignment, better outcomes." },
  ];

  // ─── QUICK VOTE / PULSE SURVEY (renders above all other screens) ───
  // ─── QUICK VOTE: CREATE ───
  if (screen === "qv_create") {
      const validOpts = qvOptions.filter(o => o.trim()).length;
      const qvChipsDone = validOpts >= 2;
      return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <style>{touchStyle}</style>
          <Card>
          <FadeIn>
            <BackBtn onClick={() => setScreen("home")} />
            <H size="md">Quick Poll</H>
            <Sub>Ask a question. Share it anywhere. Get instant votes.</Sub>

            {/* Question */}
            <div style={{ marginTop: 16 }}>
              <Lbl>Your question</Lbl>
              <TxtIn value={qvQuestion} onChange={setQvQuestion} placeholder="e.g. Which vendor should we shortlist?" maxLen={100} autoFocus={false} />
              {/* Chip area — always reactive while question not done */}
              {!qvChipsDone && (
                <div style={{ minHeight: 52 }}>
                  <ChipPicker storageKey="qv-name" usedNames={qvQuestion ? [qvQuestion] : []} onPick={(name) => setQvQuestion(name)} aiContext={{ dName: "quick poll question", opts: [], crits: [], typed: qvQuestion }} />
                </div>
              )}
            </div>

            {/* Options */}
            <div style={{ marginTop: 8 }}>
              <Lbl>Options {validOpts > 0 && <span style={{ color: C.sage, fontWeight: 600 }}>{validOpts}</span>}</Lbl>
              {qvOptions.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <span style={{ fontFamily: F.b, fontSize: 11, color: C.muted, width: 20, textAlign: "center", flexShrink: 0 }}>{i + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <TxtIn value={opt} onChange={(v) => { const n = [...qvOptions]; n[i] = v; setQvOptions(n); }} autoFocus={false} placeholder={i < 2 ? "Required" : "Optional"} maxLen={30} />
                  </div>
                  {i >= 2 && <button onClick={() => setQvOptions(qvOptions.filter((_, j) => j !== i))} style={{ fontFamily: F.b, fontSize: 14, color: C.border, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>{"\u00D7"}</button>}
                </div>
              ))}
              {qvOptions.length < 6 && (
                <button onClick={() => setQvOptions([...qvOptions, ""])} style={{ fontFamily: F.b, fontSize: 11, color: C.sage, background: "none", border: `1px dashed ${C.sage}40`, borderRadius: 8, cursor: "pointer", padding: "7px 14px", width: "100%", marginTop: 2 }}>+ Add option</button>
              )}
              {/* Chip area — reactive to question + options */}
              {!qvChipsDone && (
                <div style={{ minHeight: 52 }}>
                  <ChipPicker storageKey="qv-opt" usedNames={qvOptions.filter(Boolean)} onPick={(name) => {
                    const emptyIdx = qvOptions.findIndex(o => !o.trim());
                    if (emptyIdx >= 0) { const n = [...qvOptions]; n[emptyIdx] = name; setQvOptions(n); }
                    else if (qvOptions.length < 6) setQvOptions([...qvOptions, name]);
                  }} aiContext={{ dName: qvQuestion, opts: qvOptions.filter(Boolean).map(o => ({ name: o })), crits: [], typed: qvOptions.filter(Boolean).slice(-1)[0] || "" }} />
                </div>
              )}
            </div>

            <div style={{ marginTop: 4 }}>
              <Btn onClick={createQuickVote} disabled={!qvQuestion.trim() || validOpts < 2} style={{ width: "100%", padding: "13px 28px", fontSize: 14 }}>Create Vote</Btn>
            </div>

            {/* Time limit */}
            <div style={{ marginTop: 16 }}>
              <Lbl>Time limit <span style={{ fontWeight: 400, color: C.muted }}>(optional)</span></Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[{ label: "15 min", val: 0.25 }, { label: "1 hour", val: 1 }, { label: "6 hours", val: 6 }, { label: "24 hours", val: 24 }, { label: "3 days", val: 72 }, { label: "1 week", val: 168 }, { label: "No limit", val: 0 }].map((t) => (
                  <button key={t.val} onClick={() => setQvExpiry(qvExpiry === t.val ? 0 : t.val)}
                    style={{ fontFamily: F.b, fontSize: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${qvExpiry === t.val ? C.sage : C.border}`, background: qvExpiry === t.val ? C.sageSoft : "#fff", color: qvExpiry === t.val ? C.sage : C.text, fontWeight: qvExpiry === t.val ? 600 : 400, transition: "all 0.15s" }}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Security — code required toggle */}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setQvRequireCode(r => !r)}>
              <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0, background: qvRequireCode ? C.sage : C.accentLt, transition: "background 0.2s" }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: qvRequireCode ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
              <span style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>Require code to join</span>
            </div>
          </FadeIn>
          </Card>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── QUICK VOTE: SHARE ───
  if (screen === "qv_share") {
      const expiryLabel = qvExpiry === 0 ? "No time limit" : qvExpiry < 1 ? `${Math.round(qvExpiry * 60)} mins` : qvExpiry <= 1 ? "1 hour" : qvExpiry <= 24 ? `${qvExpiry} hours` : `${Math.round(qvExpiry / 24)} days`;
      return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <style>{touchStyle}</style>
          <Card>
          <FadeIn>
            <HomeBtn onClick={() => { setScreen("home"); setQvQuestion(""); setQvOptions(["", ""]); }} />
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u2705"}</div>
              <H size="md">Vote Created</H>
              <Sub>Share this with anyone — they can vote instantly</Sub>
              <div style={{ margin: "20px 0", padding: "18px 24px", background: C.taupeSoft, borderRadius: 12, border: `1px solid ${C.taupe}20`, cursor: "pointer" }}
                onClick={() => copyToClipboard(qvCode, setQvCopied)}>
                <p style={{ fontFamily: F.b, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Poll code — tap to copy</p>
                <p style={{ fontFamily: F.d, fontSize: 36, fontWeight: 700, color: qvCopied ? C.sage : C.text, letterSpacing: "0.15em", margin: 0, transition: "color 0.2s" }}>{qvCode}</p>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, margin: "6px 0 0", opacity: qvCopied ? 1 : 0, transition: "opacity 0.2s" }}>{"✓"} Copied!</p>
              </div>
              {qvExpiry > 0 && <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "8px 0" }}>Closes in {expiryLabel}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Btn v="sage" onClick={() => {
                  const text = `\u{1F4CA} Quick Poll: ${qvQuestion}\n\nOptions:\n${qvOptions.filter(Boolean).map((o, i) => `${i + 1}. ${o}`).join("\n")}${qvRequireCode ? `\n\nCode: ${qvCode}` : ""}\n\nRespond at unstuk.app`;
                  setShareSheetData({ text, title: "Share Quick Poll" });
                }} style={{ flex: 1 }}>Share vote</Btn>
                <Btn onClick={async () => {
                  const data = await loadQuickVoteResults(qvCode);
                  if (data) { setQvResults(data); setTimeout(() => setScreen("qv_results"), 0); }
                }} style={{ flex: 1 }}>See results</Btn>
              </div>
              <button onClick={() => { setScreen("home"); setQvQuestion(""); setQvOptions(["", ""]); }} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", marginTop: 16 }}>Done</button>
            </div>
          </FadeIn>
          </Card>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── QUICK VOTE: JOIN/VOTE ───
  if (screen === "qv_vote") {
      return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <style>{touchStyle}</style>
          <Card>
          <FadeIn>
            <BackBtn onClick={() => { setScreen("home"); setQvResults(null); setQvVoted(null); setQvErr(null); }} />
            {!qvResults ? (
              <>
                <H size="md">Join a Quick Poll</H>
                <Sub>Enter the code you were given</Sub>
                <div style={{ marginTop: 16 }}>
                  <TxtIn value={qvJoinCode} onChange={(v) => { setQvJoinCode(v.toUpperCase()); setQvErr(null); }} placeholder="6-letter code" maxLen={6} />
                </div>
                {qvErr && <p style={{ fontFamily: F.b, fontSize: 11, color: C.error, margin: "8px 0 0" }}>{qvErr}</p>}
                <div style={{ marginTop: 14 }}>
                  <Btn onClick={async () => {
                    const data = await joinQuickVote(qvJoinCode);
                  if (data) { setIsParticipant(true); try { await window.storage.set("unstuk_active_qvCode", qvJoinCode); } catch(e) {} }
                    if (data) { setQvResults(data); }
                  }} disabled={qvJoinCode.length < 6} style={{ width: "100%", padding: "14px 28px", fontSize: 14 }}>Join</Btn>
                </div>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, margin: "14px 0 0", textAlign: "center", lineHeight: 1.5 }}>You can only see and vote on this question. No other content is accessible.</p>
              </>
            ) : qvVoted === null ? (
              <>
                <H size="md">{qvResults.question}</H>
                <Sub>Tap your choice</Sub>
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {qvResults.options.map((opt, i) => (
                    <button key={i} onClick={() => submitQuickVote(qvJoinCode || qvCode, i)} className="ustk-touch"
                      style={{ fontFamily: F.b, fontSize: 14, padding: "16px 20px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { e.target.style.borderColor = C.sage; e.target.style.background = C.sageSoft; }}
                      onMouseLeave={(e) => { e.target.style.borderColor = C.border; e.target.style.background = C.card; }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <H size="md">Results</H>
                <Sub>{qvResults.question}</Sub>
                <div style={{ marginTop: 16 }}>
                  {qvResults.options.map((opt, i) => {
                    const total = Object.keys(qvResults.votes).length;
                    const count = Object.values(qvResults.votes).filter(v => v === i).length;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isWinner = pct === Math.max(...qvResults.options.map((_, j) => { const c2 = Object.values(qvResults.votes).filter(v => v === j).length; return total > 0 ? Math.round((c2 / total) * 100) : 0; }));
                    const isYours = i === qvVoted;
                    return (
                      <div key={i} style={{ marginBottom: 12, padding: "14px 16px", borderRadius: 10, border: `1.5px solid ${isYours ? C.sage : C.border}40`, background: isYours ? C.sageSoft : C.card }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: isWinner ? 600 : 400 }}>{opt}{isYours ? " (you)" : ""}</span>
                          <span style={{ fontFamily: F.b, fontSize: 13, color: isWinner ? C.sage : C.muted, fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: pct + "%", background: isWinner ? C.sage : C.taupe, borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "4px 0 0" }}>{count} vote{count !== 1 ? "s" : ""}</p>
                      </div>
                    );
                  })}
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, textAlign: "center", margin: "8px 0 0" }}>{Object.keys(qvResults.votes).length} total vote{Object.keys(qvResults.votes).length !== 1 ? "s" : ""}</p>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <Btn v="sage" onClick={async () => {
                    const data = await loadQuickVoteResults(qvJoinCode || qvCode);
                    if (data) setQvResults(data);
                  }} style={{ flex: 1 }}>Refresh</Btn>
                  <Btn onClick={() => { setIsParticipant(false); setScreen("home"); setQvResults(null); setQvVoted(null); setQvJoinCode(""); setQvQuestion(""); setQvOptions(["", ""]); }} style={{ flex: 1 }}>Done</Btn>
                </div>
              </>
            )}
          </FadeIn>
          </Card>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── QUICK VOTE: RESULTS ───
  if (screen === "qv_results" && qvResults) {
      const total = Object.keys(qvResults.votes).length;
      return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <style>{touchStyle}</style>
          <Card>
          <FadeIn>
            <HomeBtn onClick={() => { setScreen("home"); setQvResults(null); setQvCode(null); try { window.storage.delete("unstuk_active_qvCode"); } catch(e) {} setQvQuestion(""); setQvOptions(["", ""]); }} />
            <H size="md">Vote Results</H>
            <Sub>{qvResults.question}</Sub>
            <div style={{ marginTop: 16 }}>
              {qvResults.options.map((opt, i) => {
                const count = Object.values(qvResults.votes).filter(v => v === i).length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const isWinner = pct === Math.max(...qvResults.options.map((_, j) => { const c2 = Object.values(qvResults.votes).filter(v => v === j).length; return total > 0 ? Math.round((c2 / total) * 100) : 0; }));
                return (
                  <div key={i} style={{ marginBottom: 12, padding: "14px 16px", borderRadius: 10, border: `1.5px solid ${isWinner ? C.sage : C.border}40`, background: isWinner ? C.sageSoft : C.card }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: isWinner ? 600 : 400 }}>{opt}</span>
                      <span style={{ fontFamily: F.b, fontSize: 13, color: isWinner ? C.sage : C.muted, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: isWinner ? C.sage : C.taupe, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                    <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, margin: "4px 0 0" }}>{count} vote{count !== 1 ? "s" : ""}</p>
                  </div>
                );
              })}
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, textAlign: "center", margin: "8px 0 0" }}>{total} total vote{total !== 1 ? "s" : ""}</p>
            </div>
            <Lbl style={{ marginTop: 8 }}>Analytics</Lbl>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 100, padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: C.sage }}>{total}</div>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>Total votes</div>
              </div>
              {(() => { const winIdx = qvResults.options.reduce((wi, _, i) => { const cnt = Object.values(qvResults.votes).filter(v => v === i).length; return cnt > Object.values(qvResults.votes).filter(v => v === wi).length ? i : wi; }, 0); const winPct = total > 0 ? Math.round((Object.values(qvResults.votes).filter(v => v === winIdx).length / total) * 100) : 0; const wLabel = qvResults.options[winIdx]; return (
                <div style={{ flex: 2, minWidth: 140, padding: "12px 14px", borderRadius: 10, background: C.sageSoft, border: `1px solid ${C.sage}30` }}>
                  <div style={{ fontFamily: F.d, fontSize: 18, fontWeight: 700, color: C.sage, lineHeight: 1.2 }}>{wLabel.length > 18 ? wLabel.slice(0,17)+"…" : wLabel}</div>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.sage, marginTop: 2 }}>{total > 0 ? `Leading at ${winPct}%` : "No votes yet"}</div>
                </div>
              ); })()}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn v="secondary" onClick={async () => {
                const data = await loadQuickVoteResults(qvResults.code || qvCode);
                if (data) setQvResults(data);
              }} style={{ flex: 1 }}>Refresh</Btn>
              <Btn v="sage" onClick={() => {
                const total = Object.keys(qvResults.votes).length;
                const lines = qvResults.options.map((opt, i) => {
                  const count = Object.values(qvResults.votes).filter(v => v === i).length;
                  const p = total > 0 ? Math.round((count / total) * 100) : 0;
                  return `${opt}: ${p}% (${count} vote${count !== 1 ? "s" : ""})`;
                }).join("\n");
                setShareSheetData({ text: `Quick Poll: ${qvResults.question}\n\n${lines}\n\n${total} total vote${total !== 1 ? "s" : ""}\n\nunstuk.app`, title: "Share Poll Results" });
              }} style={{ flex: 1 }}>Share results</Btn>
              <Btn onClick={() => { setScreen("home"); setQvResults(null); setQvCode(null); try { window.storage.delete("unstuk_active_qvCode"); } catch(e) {} setQvQuestion(""); setQvOptions(["", ""]); }} style={{ flex: 1 }}>Done</Btn>
            </div>
          </FadeIn>
          </Card>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  if (!seenOnboard) {
    const pg = onboardPages[onboardPage];
    const isLast = onboardPage === onboardPages.length - 1;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <FadeIn key={onboardPage}>
            <Dots current={onboardPage} total={onboardPages.length} />
            <Card style={{ marginTop: 20 }}>
              <H size="md">{pg.title}</H>
              <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>{pg.body}</p>
            </Card>
          </FadeIn>
          <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
            {onboardPage > 0 && <Btn v="secondary" onClick={() => setOnboardPage(onboardPage - 1)}>Back</Btn>}
            <Btn onClick={() => {
              if (isLast) {
                setSeenOnboard(true);
                try { window.storage.set("unstuk_onboarded", "1"); } catch (e) {}
              } else {
                setOnboardPage(onboardPage + 1);
              }
            }} style={{ minWidth: 100 }}>{isLast ? "Get started" : "Next"}</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ─── HOME ───
  // Participants should never see the home screen
  if (screen === "home" && isParticipant) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 380, padding: 32, textAlign: "center" }}>
          <p style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 12 }}>You're participating in a decision</p>
          <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>Return to your comparison to finish scoring, then submit your results.</p>
          <Btn onClick={() => setScreen("flow")}>Return to comparison</Btn>
        </div>
      </div>
    );
  }

  if (screen === "home") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <style>{touchStyle}</style>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              {/* ── The Opening ── */}
              <svg width="16" height="16" viewBox="0 0 1024 1024" fill="none" style={{ marginBottom: 10, opacity: 0.3 }}>
                <path d="M 476 248 A 272 272 0 1 0 548 248" stroke={C.accent} strokeWidth="16" fill="none" strokeLinecap="round" />
                <circle cx="512" cy="240" r="14" fill={C.sage} />
              </svg>
              <div style={{ fontFamily: F.d, fontSize: 42, fontWeight: 600, color: C.text, letterSpacing: "-0.01em", marginBottom: 10 }}>Unstuk</div>
              <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, fontWeight: 300, lineHeight: 1.6 }}>
                Better business decisions.<br />Faster alignment.
              </p>
            </div>
          </FadeIn>

          {/* What's new — dismissible */}
          {!seenWhatsNew && (
            <FadeIn delay={100}>
              <div style={{ background: C.card, border: `1px solid ${C.sage}20`, borderRadius: 12, padding: "16px 18px", marginBottom: 24, position: "relative" }}>
                <button onClick={() => { setSeenWhatsNew(true); try { window.storage.set("unstuk_whatsnew_v2", "1"); } catch(e) {} }}
                  style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", cursor: "pointer", fontFamily: F.b, fontSize: 14, color: C.border, lineHeight: 1 }}>{"\u00D7"}</button>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", fontWeight: 600 }}>What's new</p>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.6, margin: "0 0 6px" }}>
                  <strong>Business decisions, done right.</strong> Weighted criteria, pairwise comparison, structured analysis — in under two minutes.
                </p>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.6, margin: "0 0 6px" }}>
                  <strong>Quick Poll.</strong> Ask a question. Share a code. Get instant results. Perfect for fast group polls.
                </p>
                <p style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.6, margin: "0 0 6px" }}>
                  <strong>Team Decisions.</strong> Everyone scores the same options independently. See where the team aligns — and where it doesn't.
                </p>
                <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                  The more you use it, the sharper your judgment gets.
                </p>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={150}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* ── Pillar 1: Individual Decision ── */}
              <Btn onClick={() => {
                resetFull(); setIsGroupMode(false); setStep("name"); setScreen("flow"); trackEvent("start");
              }} style={{ width: "100%", padding: "16px 28px", fontSize: 15 }}>New Decision</Btn>

              {/* ── Pillar 2: Team Decision ── */}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="sage" onClick={() => {
                  resetFull(); setIsGroupMode(true); setStep("name"); setScreen("flow"); trackEvent("start_group");
                }} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>
                  {"\uD83D\uDC65"} Team Decision
                </Btn>
                <Btn v="sage" onClick={() => setScreen("joingroup")} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>Join with Code</Btn>
              </div>

              {/* ── Pillar 3: Quick Poll ── */}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="secondary" onClick={() => { setScreen("qv_create"); trackEvent("qv_start"); }} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>
                  {"\u26A1"} Quick Poll
                </Btn>
                <Btn v="secondary" onClick={() => { setScreen("qv_vote"); }} style={{ flex: 1, padding: "13px 12px", fontSize: 13 }}>
                  Join Vote
                </Btn>
              </div>

              {/* Team Decision Results — always shown, enabled only when active */}
              <Btn v={groupCode ? "sage" : "secondary"}
                onClick={async () => {
                  // If state lost (e.g. after reload), try restoring from storage
                  let activeCode = groupCode;
                  if (!activeCode) {
                    try { const s = await window.storage.get("unstuk_active_groupCode"); if (s?.value) { activeCode = s.value; setGroupCode(s.value); } } catch(e) {}
                  }
                  if (!activeCode) return;
                  const data = await loadGroupResults(activeCode);
                  if (data) { setGroupData(data); setScreen("groupresults"); }
                  else setScreen("groupcreated");
                }}
                style={{ width: "100%", padding: "13px 12px", fontSize: 13, opacity: groupCode ? 1 : 0.6 }}>
                👥 {groupCode ? "View Team Decision Results" : "Team Decision Results"}
              </Btn>
              {/* Quick Poll Results — always shown, enabled only when active */}
              <Btn v={qvCode ? "secondary" : "secondary"}
                onClick={async () => {
                  if (qvLoading) return;
                  setQvLoading(true);
                  // If state lost (e.g. after reload), try restoring from storage
                  let activeCode = qvCode;
                  if (!activeCode) {
                    try { const s = await window.storage.get("unstuk_active_qvCode"); if (s?.value) { activeCode = s.value; setQvCode(s.value); } } catch(e) {}
                  }
                  if (!activeCode) { setQvLoading(false); return; }
                  const data = await loadQuickVoteResults(activeCode);
                  setQvLoading(false);
                  if (data) { setQvResults(data); setTimeout(() => setScreen("qv_results"), 0); }
                  else { setQvCode(null); try { window.storage.delete("unstuk_active_qvCode"); } catch(e) {} }
                }}
                style={{ width: "100%", padding: "13px 12px", fontSize: 13, opacity: qvCode ? 1 : 0.6 }}>
                {qvLoading ? "Loading…" : qvCode ? "⚡ View Quick Poll Results" : "⚡ Quick Poll Results"}
              </Btn>

              {history.length > 0 && (
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn v="secondary" onClick={() => setScreen("history")} style={{ flex: 1, padding: "15px 16px", fontSize: 14 }}>History</Btn>
                  <Btn v="secondary" onClick={() => setScreen("growth")} style={{ flex: 1, padding: "15px 16px", fontSize: 14 }}>Growth</Btn>
                </div>
              )}
            </div>

          </FadeIn>

          {/* Weekly decision time */}
          {weeklyDay === null && !showSchedule && history.length >= 2 && (
            <FadeIn delay={200}>
              <button onClick={() => setShowSchedule(true)} style={{ background: "none", border: "none", cursor: "pointer", marginTop: 16, padding: 0, display: "block", width: "100%" }}>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, textAlign: "center" }}>Set a weekly decision time {"›"}</p>
              </button>
            </FadeIn>
          )}
          {weeklyDay === null && showSchedule && (
            <FadeIn delay={100}>
              <Card style={{ marginTop: 20, padding: "18px 20px" }}>
                <H size="sm">Your weekly decision time</H>
                <Sub style={{ marginBottom: 10 }}>Pick a regular time. Consistency builds the habit.</Sub>
                <div style={{ marginBottom: 12 }}>
                  <Lbl>Day</Lbl>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <button key={d} onClick={() => setTempDay(i)} className="ustk-touch"
                        style={{ fontFamily: F.b, fontSize: 11, padding: "8px 12px", borderRadius: 20, border: tempDay === i ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: tempDay === i ? C.sageSoft : "#fff", color: tempDay === i ? C.sage : C.text, cursor: "pointer", transition: "all 0.15s", fontWeight: tempDay === i ? 600 : 400 }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Lbl>Time of day</Lbl>
                  <div style={{ display: "flex", gap: 10 }}>
                    {["Morning", "Afternoon", "Evening"].map((t) => (
                      <button key={t} onClick={() => setTempTime(t)} className="ustk-touch"
                        style={{ fontFamily: F.b, fontSize: 11, padding: "10px 14px", borderRadius: 20, border: tempTime === t ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: tempTime === t ? C.sageSoft : "#fff", color: tempTime === t ? C.sage : C.text, cursor: "pointer", flex: 1, transition: "all 0.15s", fontWeight: tempTime === t ? 600 : 400 }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <Lbl>Weekly goal</Lbl>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[1, 2, 3].map((n) => (
                      <button key={n} onClick={() => setTempGoal(n)} className="ustk-touch"
                        style={{ fontFamily: F.b, fontSize: 11, padding: "10px 14px", borderRadius: 20, border: tempGoal === n ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: tempGoal === n ? C.sageSoft : "#fff", color: tempGoal === n ? C.sage : C.text, cursor: "pointer", flex: 1, transition: "all 0.15s", fontWeight: tempGoal === n ? 600 : 400 }}>
                        {n} decision{n > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => {
                    setWeeklyDay(tempDay); setWeeklyTime(tempTime); setWeeklyGoal(tempGoal);
                    try { window.storage.set("unstuk_weekly", JSON.stringify({ day: tempDay, time: tempTime, goal: tempGoal })); } catch(e) {}
                    trackEvent("weekly_set", { day: tempDay });
                    setShowSchedule(false);
                  }} style={{ flex: 1 }}>Set schedule</Btn>
                  <Btn v="ghost" onClick={() => setShowSchedule(false)}>Cancel</Btn>
                </div>
              </Card>
            </FadeIn>
          )}
          {weeklyDay !== null && (() => {
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const todayNum = new Date().getDay();
            const isDecisionDay = todayNum === weeklyDay;
            const wkStart = new Date(); wkStart.setDate(wkStart.getDate() - ((wkStart.getDay() + 6) % 7)); wkStart.setHours(0, 0, 0, 0);
            const thisWeekCount = history.filter((d) => d.timestamp >= wkStart.getTime()).length;
            const goalMet = thisWeekCount >= weeklyGoal;
            return (
              <FadeIn delay={200}>
                <div style={{ background: isDecisionDay ? C.sageSoft : C.card, border: `1px solid ${isDecisionDay ? C.sage + "30" : C.border}`, borderRadius: 12, padding: "14px 18px", marginTop: 20 }}>
                  {isDecisionDay && !goalMet ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text }}>{"\u2728"} Decision time — {thisWeekCount}/{weeklyGoal} this week</div>
                          <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>{dayNames[weeklyDay]} {weeklyTime.toLowerCase()}</div>
                        </div>
                        <Btn v="sage" onClick={() => { resetFull(); setStep("name"); setScreen("flow"); }} style={{ padding: "8px 14px", fontSize: 11, flexShrink: 0 }}>Go</Btn>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontFamily: F.b, fontSize: 11, color: goalMet ? C.sage : C.muted, fontWeight: 500 }}>
                          {goalMet ? "\u2713 Goal met — " + thisWeekCount + " this week" : thisWeekCount + "/" + weeklyGoal + " decisions this week"}
                        </div>
                        <div style={{ fontFamily: F.b, fontSize: 10, color: C.border, marginTop: 2 }}>Next: {dayNames[weeklyDay]} {weeklyTime.toLowerCase()}</div>
                      </div>
                      <button onClick={() => { setTempDay(weeklyDay); setTempTime(weeklyTime); setTempGoal(weeklyGoal); setWeeklyDay(null); setShowSchedule(true); }}
                        style={{ fontFamily: F.b, fontSize: 9, color: C.sage, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", opacity: 0.6 }}>edit</button>
                    </div>
                  )}
                </div>
              </FadeIn>
            );
          })()}


          {/* Reflection nudge — shows when decisions are ready to reflect */}
          {(() => {
            const now = Date.now();
            const readyToReflect = history.filter((d) => !d.reflection && (now - d.timestamp) > 3 * 86400000);

            const reflected = history.filter((d) => d.reflection);

            if (readyToReflect.length > 0) {
              const d = readyToReflect[0];
              return (
                <FadeIn delay={250}>
                  <button onClick={() => { setReflectId(d.id); setReflectStep(0); setReflectAnswers({}); setScreen("reflect"); trackEvent("reflect"); }}
                    style={{ width: "100%", background: C.sageSoft, border: `1px solid ${C.sage}25`, borderRadius: 12, padding: "16px 18px", cursor: "pointer", marginTop: 20, textAlign: "left", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1px solid ${C.sage}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 16 }}>{"\u25C6"}</span>
                    </div>
                    <div>
                      <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.text }}>Your 3-day reflection is ready</div>
                      <div style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginTop: 2 }}>{d.name}</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.sage, marginTop: 3 }}>
                        {readyToReflect.length === 1 ? "Takes 30 seconds — builds real decision skill" : `${readyToReflect.length} reflections ready — takes 30 seconds each`}
                      </div>
                    </div>
                  </button>
                </FadeIn>
              );
            }
            if (reflected.length > 0) {
              return (
                <FadeIn delay={250}>
                  <button onClick={() => setScreen("growth")}
                    style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", cursor: "pointer", marginTop: 20, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text }}>{reflected.length} insight{reflected.length === 1 ? "" : "s"} earned</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 2 }}>See how your decisions are going</div>
                    </div>
                    <span style={{ fontFamily: F.b, fontSize: 18, color: C.sage }}>{"\u203A"}</span>
                  </button>
                </FadeIn>
              );
            }
            return null;
          })()}

          <FadeIn delay={300}>
            <button onClick={() => setShowShare(true)} style={{
              width: "100%", marginTop: 36, padding: "16px 18px", borderRadius: 12,
              background: `linear-gradient(135deg, ${C.sageSoft}, ${C.card})`,
              border: `1px solid ${C.sage}25`, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{"\uD83C\uDF81"}</span>
              <div>
                <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>Gift Unstuk to a friend</div>
                <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>Know someone stuck? Share the app free — it might be exactly what they need.</div>
              </div>
              <span style={{ fontFamily: F.b, fontSize: 18, color: C.sage, flexShrink: 0 }}>{"›"}</span>
            </button>
          </FadeIn>
          <FadeIn delay={400}>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 12 }}>
              <button onClick={() => { setTutSlide(0); setScreen("tutorial"); }} style={{ fontFamily: F.b, fontSize: 10, color: C.border, background: "none", border: "none", cursor: "pointer" }}>How it works</button>
              <span style={{ color: C.border, fontSize: 8 }}>·</span>
              <button onClick={() => setShowPrivacy(true)} style={{ fontFamily: F.b, fontSize: 10, color: C.border, background: "none", border: "none", cursor: "pointer" }}>Terms</button>
            </div>
          </FadeIn>
        </div>
        {showShare && <ShareSheet text={"I\u2019ve been using Unstuk for better business decisions \u2014 weighted analysis in 2 minutes, team alignment built in.\n\nTry it free: unstuk.app"} title="Share Unstuk" onClose={() => setShowShare(false)} />}
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      </div>
    );
  }

  // ─── TUTORIAL ───
  if (screen === "tutorial") {
    const slides = [
      { icon: "\u270F\uFE0F", title: "Name your decision", body: "Unstuk gives your business decisions the rigour of structured analysis at the speed of an instinct call. Start by naming what you're deciding.\n\n\"CRM platform choice\" works better than \"software stuff\"." },
      { icon: "\u2696\uFE0F", title: "Choose your type", body: "Binary is for two options. Multi is for three or more.\n\nMost real decisions are binary \u2014 even if it doesn't feel that way at first." },
      { icon: "\uD83C\uDFAF", title: "Add what matters", body: "Criteria are the things that matter to you in this decision. Salary, location, growth, risk \u2014 whatever is relevant.\n\nRate each one's importance: Low, Moderate, or High. Be honest about your priorities." },
      { icon: "\uD83D\uDD0D", title: "Compare step by step", body: "For each criterion, you'll compare your options.\n\nInstead of weighing everything at once, you focus on one factor at a time. This prevents the loudest concern from drowning out everything else." },
      { icon: "\uD83D\uDCCA", title: "See your result", body: "Unstuk multiplies your comparisons by your importance ratings, then normalises into percentages.\n\nA clear gap means the data agrees with itself. A close call means both options are genuinely viable \u2014 and that's useful information too." },
      { icon: "\u2728", title: "You're ready", body: "Every decision you complete is saved locally for 60 days.\n\nNo account. No cloud. No one sees your data.\n\nTap below to start your first decision." },
    ];
    const sl = slides[tutSlide];
    const isLast = tutSlide === slides.length - 1;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px", textAlign: "center", userSelect: "none" }}>
          <HomeBtn onClick={() => setScreen("home")} />
          <FadeIn key={tutSlide}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>{sl.icon}</div>
            <H size="lg">{sl.title}</H>
            <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.8, margin: "16px 0 32px", whiteSpace: "pre-line" }}>{sl.body}</p>
          </FadeIn>

          {/* Progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
            {slides.map((_, i) => (
              <div key={i} style={{ width: i === tutSlide ? 18 : 6, height: 6, borderRadius: 3, background: i === tutSlide ? C.sage : C.border, transition: "all 0.3s" }} />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isLast ? (
              <>
                <Btn onClick={() => {
                  setTutSlide(0);
                  resetFull(); setStep("name"); setScreen("flow");
                }}>Start a decision</Btn>
                <Btn v="secondary" onClick={() => { setTutSlide(0); setScreen("home"); }}>Back to home</Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => setTutSlide(tutSlide + 1)}>Next</Btn>
                {tutSlide > 0 && <Btn v="secondary" onClick={() => setTutSlide(tutSlide - 1)}>Back</Btn>}
                {tutSlide === 0 && <Btn v="secondary" onClick={() => { setTutSlide(0); setScreen("home"); }}>Back to home</Btn>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  
  
  
  
  // ─── JOIN GROUP ───
  if (screen === "joingroup") {
    const doJoin = async () => {
      if (joinCode.length !== 6 || !joinNameInput.trim()) return;
      setGroupName(joinNameInput.trim());
      const data = await joinGroup(joinCode);
      if (!data) { setJoinErr("Code not found. Check and try again."); return; }
      if (data.expired) { setJoinErr("This group has closed. The time limit has passed."); return; }
      if (data.participantCount >= (data.maxParticipants || 8)) { setJoinErr("This group is full (max 8 participants)."); return; }
      setGroupData(data); setGroupCode(joinCode); setJoinErr(null); setScreen("groupjoin"); trackEvent("group_join");
      try { await window.storage.set("unstuk_active_groupCode", joinCode); } catch(e) {}
    };
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => { setJoinErr(null); setScreen("home"); }} />
          <FadeIn>
            <H size="lg">Join a team decision</H>
            <Sub>Someone shared a code with you? Enter it below. You'll compare the same options independently, then see how everyone scored.</Sub>
            <Lbl>Your name</Lbl>
            <TxtIn value={joinNameInput} onChange={setJoinNameInput} placeholder="How others will see you" maxLen={20} onSubmit={() => {}} />
            <div style={{ marginTop: 16 }}>
              <Lbl>Decision code</Lbl>
              <TxtIn value={joinCode} onChange={(v) => { setJoinCode(v.toUpperCase()); setJoinErr(null); }} placeholder="e.g. A3K9XP" maxLen={6} onSubmit={doJoin} />
            </div>
            {joinErr && <p style={{ fontFamily: F.b, fontSize: 12, color: C.error, marginTop: 8 }}>{joinErr}</p>}
            <div style={{ marginTop: 20 }}>
              <Btn onClick={doJoin} disabled={joinCode.length !== 6 || !joinNameInput.trim()}>Join</Btn>
            </div>
            <div style={{ marginTop: 32, padding: "16px 18px", background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, lineHeight: 1.6, margin: 0 }}>
                {"\uD83D\uDC65"} Up to 8 people can join. Everyone compares the same options using the same criteria. You'll see how each person scored, plus the group average.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── GROUP JOIN (preview decision then start comparisons) ───
  if (screen === "groupjoin" && groupData) {
    const d = groupData.decision;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen("joingroup")} />
          <FadeIn>
            <Lbl>Team Decision</Lbl>
            <H size="lg">{d.name}</H>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "8px 0 20px" }}>
              {groupData.participantCount || 0} participant{(groupData.participantCount || 0) === 1 ? "" : "s"} so far · Code: {groupCode}
            </p>
            <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
              <Lbl>Options</Lbl>
              {d.type === "binary" ? (
                <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, margin: 0 }}>{d.binaryOption1} vs {d.binaryOption2}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {d.options.map((o, i) => <p key={i} style={{ fontFamily: F.b, fontSize: 13, color: C.text, margin: 0 }}>{i + 1}. {o.name}</p>)}
                </div>
              )}
            </Card>
            <Card style={{ padding: "16px 18px", marginBottom: 24 }}>
              <Lbl>Criteria ({d.criteria.length})</Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {d.criteria.map((c) => (
                  <span key={c.id} style={{ fontFamily: F.b, fontSize: 12, padding: "4px 10px", borderRadius: 6, background: C.accentLt, color: C.text }}>{c.name}</span>
                ))}
              </div>
            </Card>
            <Btn onClick={() => {
              // Load the group decision into the flow
              setDName(d.name); setDType(d.type); setCrits(d.criteria);
              if (d.type === "binary") { setBo1(d.binaryOption1); setBo2(d.binaryOption2); setBIdx(0); setBCh([]); setBPick(null); }
              else { setOpts(d.options); setBaseOpt(d.baseOption);
                const pairs = []; d.options.filter((x) => x.id !== d.baseOption).forEach((op) => { d.criteria.forEach((cr) => { pairs.push({ oId: op.id, cId: cr.id }); }); });
                setMPairs(pairs); setMIdx(0); setMCo([]);
              }
              setRes(null); setSavedId(null); prevStep.current = [];
              setIsParticipant(true);
              setStep("compare"); setScreen("flow");
            }} style={{ width: "100%" }}>Start my comparisons</Btn>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── GROUP CREATED (show code to share) ───
  if (screen === "groupcreated" && groupCode) {
    const expiryLabel = groupExpiry < 1 ? `${Math.round(groupExpiry * 60)} mins` : groupExpiry <= 1 ? "1 hour" : groupExpiry <= 24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry / 24)} days`;
    const shareMsg = groupRequireCode
      ? `Join my Unstuk team decision!\n\nCode: ${groupCode}\n\nOpen Unstuk \u2192 Join with Code \u2192 enter the code.\n\nunstuk.app/invite`
      : `You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\n\nOpen Unstuk and join this decision when prompted.\n\nDeadline: ${expiryLabel}`;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <FadeIn>
            <div style={{ textAlign: "left", marginBottom: 10 }}><BackBtn onClick={() => { setIsGroupMode(false); setScreen("home"); }} /></div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{"\uD83D\uDC65"}</div>
            <H size="lg">Group created</H>
            <Sub>Share the invite and others can weigh in on the same decision independently. You'll see all scores side by side.</Sub>

            {/* Code display */}
            {groupRequireCode && (
              <div style={{ background: C.card, borderRadius: 12, border: `2px solid ${C.sage}40`, padding: "24px 20px", marginBottom: 16, marginTop: 20, cursor: "pointer" }}
                onClick={() => copyToClipboard(groupCode, setGroupCopied)}>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Team code — tap to copy</p>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 36, fontWeight: 700, color: groupCopied ? C.sage : C.text, letterSpacing: "0.15em", transition: "color 0.2s" }}>{groupCode}</div>
                <p style={{ fontFamily: F.b, fontSize: 11, color: groupCopied ? C.sage : C.border, margin: "8px 0 0", transition: "color 0.2s" }}>{groupCopied ? "✓ Copied!" : `Closes in ${expiryLabel}`}</p>
              </div>
            )}
            {!groupRequireCode && (
              <div style={{ background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 16, marginTop: 20 }}>
                <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.6 }}>Closes in <strong>{expiryLabel}</strong>. The invite message contains everything participants need.</p>
              </div>
            )}

            {/* How to share */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 16, textAlign: "left" }}>
              <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, margin: "0 0 10px" }}>Group settings</p>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "0 0 6px" }}>Time limit for responses:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {[{ label: "15 mins", val: 0.25 }, { label: "30 mins", val: 0.5 }, { label: "1 hour", val: 1 }, { label: "6 hours", val: 6 }, { label: "24 hours", val: 24 }, { label: "3 days", val: 72 }, { label: "1 week", val: 168 }].map((t) => (
                  <button key={t.val} onClick={async () => {
                    const newVal = groupExpiry === t.val ? null : t.val;
                    setGroupExpiry(newVal);
                    if (!newVal) return;
                    try { const meta = await window.storage.get("grp:" + groupCode + ":meta");
                      if (meta) { const d = JSON.parse(meta.value); d.expiresAt = Date.now() + newVal * 3600000; await window.storage.set("grp:" + groupCode + ":meta", JSON.stringify(d)); }
                    } catch(e) {}
                  }}
                    style={{
                      fontFamily: F.b, fontSize: 11, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${groupExpiry === t.val ? C.sage : C.border}`,
                      background: groupExpiry === t.val ? C.sageSoft : "#fff",
                      color: groupExpiry === t.val ? C.sage : C.text,
                      fontWeight: groupExpiry === t.val ? 600 : 400,
                      transition: "all 0.2s",
                    }}>{t.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onClick={async () => {
                  setGroupHideIndiv(h => {
                    const nv = !h;
                    (async () => { try { const meta = await window.storage.get("grp:" + groupCode + ":meta");
                      if (meta) { const d = JSON.parse(meta.value); d.hideIndividual = nv; await window.storage.set("grp:" + groupCode + ":meta", JSON.stringify(d)); }
                    } catch(e) {} })();
                    return nv;
                  });
                }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0,
                  background: groupHideIndiv ? C.sage : C.accentLt, transition: "background 0.2s" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2,
                    left: groupHideIndiv ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>Hide individual scores (group average only)</span>
              </div>
            </div>


            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="sage" onClick={() => setShareSheetData({ text: shareMsg, title: "Invite to Team Decision" })} style={{ flex: 1 }}>
                Share invite
              </Btn>
            </div>
            <div style={{ marginTop: 10 }}>
              <Btn v="secondary" onClick={async () => { const data = await loadGroupResults(groupCode); if (data) { setGroupData(data); setScreen("groupresults"); } }} style={{ width: "100%" }}>
                View group results
              </Btn>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
              <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Done</button>
              <button onClick={async () => {
                await cancelGroup(groupCode); setGroupCode(null); setScreen("home");
              }} style={{ fontFamily: F.b, fontSize: 12, color: C.error, background: "none", border: "none", cursor: "pointer" }}>Cancel group</button>
            </div>
          </FadeIn>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── GROUP RESULTS ───
  if (screen === "groupresults" && !groupData) { return (<div style={{minHeight:"100vh",background:C.bg,fontFamily:F.b}}><div style={{maxWidth:440,margin:"0 auto",padding:"36px 24px"}}><BackBtn onClick={() => setScreen("home")} /><p style={{fontFamily:F.b,fontSize:13,color:C.muted}}>Results not available. The session may have expired.</p></div></div>); }
  if (screen === "groupresults" && groupData) {
    const d = groupData.decision;
    const parts = groupData.participants;
    const activeCode = groupData.code || groupCode;
    const optNames = d.type === "binary" ? [d.binaryOption1, d.binaryOption2] : d.options.map((o) => o.name);

    // Compute group average
    const avgScores = {};
    optNames.forEach((name) => {
      const scores = parts.filter(p => p.results && Array.isArray(p.results)).map((p) => { const r = p.results.find((x) => x.name === name); return r ? r.pct : 0; });
      avgScores[name] = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    });
    const sortedAvg = Object.entries(avgScores).sort((a, b) => b[1] - a[1]);

    // Agreement score: how close are all participants
    const maxSpread = optNames.reduce((max, name) => {
      const scores = parts.filter(p => p.results && Array.isArray(p.results)).map((p) => { const r = p.results.find((x) => x.name === name); return r ? r.pct : 0; });
      const spread = Math.max(...scores) - Math.min(...scores);
      return Math.max(max, spread);
    }, 0);
    const agreement = Math.max(0, 100 - maxSpread);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, opacity: 0.75, transition: "opacity 0.15s", padding: "4px 0" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.75}>
              <span style={{ fontSize: 15 }}>‹</span> Home
            </button>
            <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.5 }}>Team Results</span>
          </div>
          <FadeIn>
            <Lbl>Team Decision · {parts.length} participant{parts.length === 1 ? "" : "s"}</Lbl>
            <H size="lg">{d.name}</H>
            <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "6px 0 4px" }}>Code: {groupCode}</p>

            {/* Agreement indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 24px", padding: "12px 16px", borderRadius: 8, background: agreement >= 70 ? C.sageSoft : agreement >= 40 ? C.taupeSoft : C.errorSoft, border: `1px solid ${agreement >= 70 ? C.sage : agreement >= 40 ? C.taupe : C.error}20` }}>
              <div style={{ fontFamily: F.d, fontSize: 24, fontWeight: 700, color: agreement >= 70 ? C.sage : agreement >= 40 ? C.taupe : C.error }}>{agreement}%</div>
              <div style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>
                {agreement >= 70 ? "Strong alignment — the group largely agrees." : agreement >= 40 ? "Partial agreement — some differences in priorities." : "Low alignment — the group sees this differently."}
              </div>
            </div>

            {/* Group average results */}
            <Lbl>Group Average</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {sortedAvg.map(([name, avg], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: i === 0 ? C.sageSoft : C.card, border: `1px solid ${i === 0 ? C.sage + "30" : C.border}` }}>
                  <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: i === 0 ? C.sage : C.text, minWidth: 44, textAlign: "right" }}>{avg}%</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 500, color: C.text }}>{name}</div>
                    <div style={{ height: 4, borderRadius: 2, background: C.accentLt, overflow: "hidden", marginTop: 4 }}>
                      <div style={{ height: "100%", width: `${Math.max(avg, 4)}%`, borderRadius: 2, background: i === 0 ? C.sage : C.muted }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Individual scores */}
            {!(groupData && groupData.hideIndividual) && <Lbl>Individual Scores</Lbl>}
            {!(groupData && groupData.hideIndividual) ? <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {parts.map((p) => {
                if (!p.results || !Array.isArray(p.results)) return null;
                const sorted = [...p.results].sort((a, b) => b.pct - a.pct);
                return (
                  <Card key={p.name} style={{ padding: "14px 16px" }}>
                    <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>{p.name}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {sorted.map((r) => (
                        <span key={r.name} style={{ fontFamily: F.b, fontSize: 11, padding: "3px 8px", borderRadius: 4, background: r === sorted[0] ? C.sageSoft : C.bg, color: r === sorted[0] ? C.sage : C.muted, border: `1px solid ${r === sorted[0] ? C.sage + "30" : C.border}` }}>
                          {r.name} {r.pct}%
                        </span>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div> : <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "0 0 24px", textAlign: "center" }}>Individual scores are hidden for this group.</p>}

            {/* Analytics */}
            <Lbl style={{ marginTop: 8 }}>Analytics</Lbl>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: C.sage }}>{parts.filter(p => p.results && Array.isArray(p.results)).length}</div>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>Responses submitted</div>
              </div>
              <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: agreement >= 70 ? C.sage : agreement >= 40 ? C.taupe : C.error }}>{agreement}%</div>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 2 }}>Team alignment</div>
              </div>
              {sortedAvg[0] && (
                <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", borderRadius: 10, background: C.sageSoft, border: `1px solid ${C.sage}30` }}>
                  <div style={{ fontFamily: F.d, fontSize: 18, fontWeight: 700, color: C.sage, lineHeight: 1.2 }}>{sortedAvg[0][0].length > 14 ? sortedAvg[0][0].slice(0,13)+"…" : sortedAvg[0][0]}</div>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.sage, marginTop: 2 }}>Leading option ({sortedAvg[0][1]}%)</div>
                </div>
              )}
            </div>
            {/* Refresh and share */}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="secondary" onClick={async (e) => {
                const btn = e.currentTarget; btn.textContent = "Refreshing…"; btn.disabled = true;
                try {
                  const data = await loadGroupResults(activeCode);
                  if (data) { setGroupData(data); btn.textContent = "✓ Refreshed"; }
                  else { btn.textContent = "No new data"; }
                } catch(err) { btn.textContent = "Retry"; }
                btn.disabled = false;
                setTimeout(() => { try { btn.textContent = "Refresh"; } catch(e) {} }, 2000);
              }} style={{ flex: 1 }}>Refresh</Btn>
              <Btn v="sage" onClick={() => { const text = `Team Decision: ${d.name}\n\n${sortedAvg.map(([n, a]) => `${n}: ${a}%`).join("\n")}\n\n${parts.length} participant${parts.length !== 1 ? "s" : ""} · ${agreement}% alignment\n\nunstuk.app`; setShareSheetData({ text, title: "Share Team Results" }); }} style={{ flex: 1 }}>Share results</Btn>
            </div>
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", marginTop: 16, padding: "8px 0", letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.5, transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
              <span style={{ fontSize: 13 }}>⌂</span> Home
            </button>
          </FadeIn>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }


  // ─── HISTORY ───
  if (screen === "history") {
    const now = Date.now();
    const reflected = history.filter((d) => d.reflection);
    const readyToReflect = history.filter((d) => !d.reflection && (now - d.timestamp) > 3 * 86400000);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen("home")} />
          <H size="lg">Decision History</H>
          <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, margin: "8px 0 12px" }}>Tap any decision below to see full results and actions.</p>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, margin: "0 0 6px" }}>What you can do:</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "0 0 4px", lineHeight: 1.7 }}><strong style={{ color: C.sage }}>Edit & redo</strong> — Go back and change options or criteria, then re-run the comparison from scratch.</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "0 0 4px", lineHeight: 1.7 }}><strong style={{ color: C.sage }}>Re-compare</strong> — Same setup, but redo all comparisons with fresh eyes.</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.7 }}><strong style={{ color: C.error }}>Delete</strong> — Permanently removes this decision. Cannot be undone.</p>
          </div>
          {history.length > 0 && (
            <button onClick={() => {
              const exp = { decisions: history.map((d) => ({ name: d.name, type: d.type, date: new Date(d.timestamp).toISOString().slice(0, 10),
                results: d.results?.map((r) => ({ option: r.name, score: r.pct + "%" })),
                criteria: d.criteria?.map((cr) => ({ name: cr.name, importance: cr.importance === 3 ? "High" : cr.importance === 2 ? "Moderate" : "Low" })),
                gutFeeling: d.immediate?.feeling || null,
                reflection: d.reflection ? { outcome: d.reflection.outcome, gutAccurate: d.reflection.gutAccurate, lesson: d.reflection.lesson } : null })), analytics: _evtLog.slice(-200), version: APP_VERSION };
              const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "unstuk-decisions.json"; a.click(); URL.revokeObjectURL(url);
            }} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", width: "100%", marginBottom: 20 }}>
              Download my data (JSON)
            </button>
          )}

          {/* Delete all + Analytics */}
          {history.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {!confirmDeleteAll ? (
                <button onClick={() => setConfirmDeleteAll(true)}
                  style={{ fontFamily: F.b, fontSize: 11, color: C.error, background: C.bg, border: `1px solid ${C.error}40`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", flex: 1 }}>
                  Delete all decisions
                </button>
              ) : (
                <div style={{ flex: 1, background: C.errorSoft, border: `1px solid ${C.error}40`, borderRadius: 8, padding: "14px 16px" }}>
                  <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.error, margin: "0 0 6px" }}>Delete all {history.length} decisions?</p>
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.text, margin: "0 0 12px", lineHeight: 1.5 }}>This permanently removes all your decisions, reflections, and instinct tracking data. This cannot be undone.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={async () => {
                      setHistory([]); await saveHistory([]);
                      setConfirmDeleteAll(false); trackEvent("delete_all");
                    }} style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: C.error, color: "#fff", cursor: "pointer", flex: 1 }}>
                      Yes, delete everything
                    </button>
                    <button onClick={() => setConfirmDeleteAll(false)}
                      style={{ fontFamily: F.b, fontSize: 12, padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.text, cursor: "pointer", flex: 1 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => setShowAnalytics(!showAnalytics)}
                style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap" }}>
                {showAnalytics ? "Hide stats" : "Usage stats"}
              </button>
            </div>
          )}

          {/* Analytics panel */}
          {showAnalytics && (
            <FadeIn>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
                <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px", fontWeight: 600 }}>Dashboard</p>
                {(() => {
                  const events = _evtLog;
                  const starts = events.filter(e => e.e === "start").length;
                  const completes = events.filter(e => e.e === "complete").length;
                  const reflects = events.filter(e => e.e === "reflect" || e.e === "reflect_done").length;
                  const guts = events.filter(e => e.e === "gut").length;
                  const groups = events.filter(e => e.e === "group" || e.e === "group_join").length;
                  const qvs = events.filter(e => e.e === "quickvote_create" || e.e === "quickvote_vote").length;
                  const completionRate = starts > 0 ? Math.round((completes / starts) * 100) : 0;
                  const reflectRate = completes > 0 ? Math.round((reflects / completes) * 100) : 0;

                  // Decision pattern analysis from history
                  const gutAccurate = history.filter(d => d.reflection && d.reflection.gutAccurate === true).length;
                  const gutTotal = history.filter(d => d.reflection && d.reflection.gutAccurate != null).length;
                  const gutRate = gutTotal > 0 ? Math.round((gutAccurate / gutTotal) * 100) : null;
                  const binaryCount = history.filter(d => d.type === "binary").length;
                  const multiCount = history.filter(d => d.type === "multi").length;
                  const avgCriteria = history.length > 0 ? (history.reduce((s, d) => s + (d.criteria ? d.criteria.length : 0), 0) / history.length).toFixed(1) : 0;

                  // Streak: consecutive days with a decision
                  const daySet = new Set(history.map(d => new Date(d.timestamp).toDateString()));
                  let streak = 0;
                  const today = new Date();
                  for (let i = 0; i < 365; i++) {
                    const dd = new Date(today); dd.setDate(dd.getDate() - i);
                    if (daySet.has(dd.toDateString())) streak++; else break;
                  }

                  // Time of day pattern
                  const hours = history.map(d => new Date(d.timestamp).getHours());
                  const morning = hours.filter(h => h >= 5 && h < 12).length;
                  const afternoon = hours.filter(h => h >= 12 && h < 17).length;
                  const evening = hours.filter(h => h >= 17 || h < 5).length;
                  const peak = morning >= afternoon && morning >= evening ? "Morning" : afternoon >= evening ? "Afternoon" : "Evening";

                  const Bar = ({ pct, good }) => (
                    <div style={{ height: 5, background: C.bg, borderRadius: 3, overflow: "hidden", marginTop: 3 }}>
                      <div style={{ height: "100%", width: Math.min(pct, 100) + "%", background: good ? C.sage : C.taupe, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                  );

                  return (
                    <>
                      {/* Key metrics row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                        {[
                          { n: history.length, label: "Decisions" },
                          { n: reflects, label: "Reflections" },
                          { n: streak, label: streak === 1 ? "Day streak" : "Day streak" },
                        ].map((s, i) => (
                          <div key={i} style={{ textAlign: "center", padding: "12px 6px", background: C.bg, borderRadius: 10 }}>
                            <div style={{ fontFamily: F.d, fontSize: 26, fontWeight: 700, color: C.sage }}>{s.n}</div>
                            <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progress bars */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                        {[
                          { label: "Completion rate", value: completionRate, good: completionRate >= 70 },
                          { label: "Reflection rate", value: reflectRate, good: reflectRate >= 40 },
                          ...(gutRate !== null ? [{ label: "Instinct accuracy", value: gutRate, good: gutRate >= 60 }] : []),
                        ].map((r, i) => (
                          <div key={i}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.b, fontSize: 11, marginBottom: 1 }}>
                              <span style={{ color: C.muted }}>{r.label}</span>
                              <span style={{ color: r.good ? C.sage : C.text, fontWeight: 600 }}>{r.value}%</span>
                            </div>
                            <Bar pct={r.value} good={r.good} />
                          </div>
                        ))}
                      </div>

                      {/* Insights */}
                      {history.length >= 2 && (
                        <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                          <p style={{ fontFamily: F.b, fontSize: 9, color: C.sage, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", fontWeight: 600 }}>Insights</p>
                          <div style={{ fontFamily: F.b, fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                            {binaryCount > 0 && multiCount > 0 && <p style={{ margin: "0 0 4px" }}>Split: {binaryCount} binary, {multiCount} multi-option.</p>}
                            <p style={{ margin: "0 0 4px" }}>Average criteria: {avgCriteria} per decision.</p>
                            {history.length >= 3 && <p style={{ margin: "0 0 4px" }}>You tend to decide in the {peak.toLowerCase()}.</p>}
                            {gutRate !== null && gutRate >= 70 && <p style={{ margin: 0, color: C.sage }}>Your gut is well-calibrated ({gutRate}% match with data).</p>}
                            {gutRate !== null && gutRate < 50 && gutRate > 0 && <p style={{ margin: 0, color: C.accent }}>Instinct and analysis often disagree ({gutRate}% match). The analysis may catch things instinct misses.</p>}
                          </div>
                        </div>
                      )}

                      {/* Activity counts */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {[
                          { label: "Instinct surveys", value: guts },
                          { label: "Group decisions", value: groups },
                          { label: "Quick votes", value: qvs },
                          { label: "Events this session", value: events.length },
                        ].map((r, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: F.b, fontSize: 11, padding: "3px 0" }}>
                            <span style={{ color: C.muted }}>{r.label}</span>
                            <span style={{ fontWeight: 500 }}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontFamily: F.b, fontSize: 8, color: C.border, margin: "10px 0 0", lineHeight: 1.5 }}>
                        All data stored locally on your device. Included in JSON export.
                      </p>
                    </>
                  );
                })()}
              </div>
            </FadeIn>
          )}

          {/* Growth summary strip */}
          {reflected.length > 0 && (
            <FadeIn>
              <button onClick={() => setScreen("growth")} style={{ width: "100%", background: C.sageSoft, border: `1px solid ${C.sage}25`, borderRadius: 10, padding: "14px 18px", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.sage }}>{reflected.length} insight{reflected.length === 1 ? "" : "s"} earned</div>
                  <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 2 }}>See your growth pattern</div>
                </div>
                <span style={{ fontFamily: F.b, fontSize: 16, color: C.sage }}>›</span>
              </button>
            </FadeIn>
          )}

          {readyToReflect.length > 0 && (
            <FadeIn>
              <div style={{ background: C.taupeSoft, border: `1px solid ${C.taupe}25`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.taupe }}>
                  {readyToReflect.length} decision{readyToReflect.length === 1 ? " is" : "s are"} ready for reflection
                </div>
                <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 3 }}>Reflecting within a week produces the strongest calibration gains.</div>
              </div>
            </FadeIn>
          )}

          {history.filter((d) => d && d.name && d.timestamp).length === 0 ? (
            <Card><p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, textAlign: "center", margin: 0 }}>No decisions yet.</p></Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((d) => {
                const days = Math.floor((now - d.timestamp) / 86400000);
                const when = days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
                const w = d.results ? [...d.results].sort((a, b) => b.score - a.score)[0] : null;
                const canReflect = !d.reflection && days >= 3;
                const hasReflection = !!d.reflection;
                const isExpanded = expandedDec === d.id;
                const sortedR = d.results ? [...d.results].sort((a, b) => b.score - a.score) : [];
                return (
                  <Card key={d.id} style={{ padding: "16px 20px", transition: "all 0.2s ease" }}>
                    <button onClick={() => setExpandedDec(isExpanded ? null : d.id)}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F.b, fontSize: 14, fontWeight: 600, color: C.text }}>{d.name}</div>
                        <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 3 }}>
                          {when} · {d.type === "binary" ? "Binary" : `${d.options?.length || 0} options`}{w ? ` · ${w.name} (${w.pct}%)` : ""}
                          {hasReflection && <span style={{ color: C.sage }}> · Reflected</span>}
                          {d.groupCode && <span style={{ color: C.taupe }}> · Group</span>}
                          
                        </div>
                      </div>
                      <span style={{ fontFamily: F.b, fontSize: 14, color: C.border, transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s ease", flexShrink: 0, marginLeft: 8, marginTop: 2 }}>{"\u203A"}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                        {/* Results summary */}
                        {sortedR.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                            {sortedR.map((r, i) => (
                              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ fontFamily: F.d, fontSize: 16, fontWeight: 700, color: i === 0 ? C.sage : C.muted, minWidth: 36, textAlign: "right" }}>{r.pct}%</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontFamily: F.b, fontSize: 12, color: C.text, marginBottom: 3 }}>{r.name}</div>
                                  <div style={{ height: 3, borderRadius: 2, background: C.accentLt, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.max(r.pct, 4)}%`, borderRadius: 2, background: i === 0 ? C.sage : C.muted }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Criteria summary */}
                        {d.criteria && (
                          <p style={{ fontFamily: F.b, fontSize: 11, color: C.border, margin: "0 0 12px", lineHeight: 1.5 }}>
                            {d.criteria.length} criteria: {d.criteria.map((c) => c.name).join(", ")}
                          </p>
                        )}
                        {/* Comparison choices */}
                        {d.comparisons && d.comparisons.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <p style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Your comparisons</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {d.comparisons.map((comp, ci) => {
                                const criterion = d.criteria?.find((c) => c.id === comp.cId);
                                const cName = criterion?.name || "?";
                                if (d.type === "binary") {
                                  const picked = comp.opt === 1 ? d.binaryOption1 : comp.opt === 2 ? d.binaryOption2 : null;
                                  const advLabel = comp.adv === 0 ? "Same" : comp.adv === 1 ? "Slight" : comp.adv === 2 ? "Moderate" : "Strong";
                                  return (
                                    <div key={ci} style={{ fontFamily: F.b, fontSize: 11, color: C.text, padding: "4px 0", display: "flex", gap: 6 }}>
                                      <span style={{ color: C.muted, minWidth: 70, flexShrink: 0 }}>{cName}</span>
                                      <span>{picked ? `${picked} (${advLabel})` : "No difference"}</span>
                                    </div>
                                  );
                                } else {
                                  const option = d.options?.find((o) => o.id === comp.oId);
                                  const oName = option?.name || "?";
                                  const advLabel = comp.adv === 0 ? "Same" : comp.adv > 0 ? `+${comp.adv}` : `${comp.adv}`;
                                  return (
                                    <div key={ci} style={{ fontFamily: F.b, fontSize: 11, color: C.text, padding: "4px 0", display: "flex", gap: 6 }}>
                                      <span style={{ color: C.muted, minWidth: 70, flexShrink: 0 }}>{cName}</span>
                                      <span>{oName}: {advLabel}</span>
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        )}
                        {/* Action row */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <Btn v="secondary" onClick={() => {
                            const p = { name: d.name, type: d.type, criteria: d.criteria, groupCode: d.groupCode };
                            if (d.type === "binary") { p.binaryOption1 = d.binaryOption1; p.binaryOption2 = d.binaryOption2; }
                            else { p.options = d.options; p.baseOption = d.baseOption; }
                            resetFull(p);
                            setStep("name"); setScreen("flow");
                          }} style={{ fontSize: 11, padding: "7px 14px" }}>Edit & redo</Btn>
                          <Btn v="sage" onClick={() => {
                            const p = { name: d.name, type: d.type, criteria: d.criteria, groupCode: d.groupCode };
                            if (d.type === "binary") { p.binaryOption1 = d.binaryOption1; p.binaryOption2 = d.binaryOption2; }
                            else { p.options = d.options; p.baseOption = d.baseOption; }
                            resetFull(p);
                            if (d.type === "multi" && d.baseOption) {
                              const pairs = [];
                              (d.options || []).filter((x) => x.id !== d.baseOption).forEach((op) => {
                                (d.criteria || []).forEach((cr) => { pairs.push({ oId: op.id, cId: cr.id }); });
                              });
                              setMPairs(pairs); setMIdx(0); setMCo([]);
                              setStep("compare"); setScreen("flow");
                            } else if (d.type === "multi") {
                              setStep("base"); setScreen("flow");
                            } else {
                              setStep("compare"); setScreen("flow");
                            }
                          }} style={{ fontSize: 11, padding: "7px 14px" }}>Re-compare</Btn>
                          {canReflect && (
                            <Btn v="sage" onClick={() => { setReflectId(d.id); setReflectStep(0); setReflectAnswers({}); setScreen("reflect"); }} style={{ fontSize: 11, padding: "7px 14px" }}>Reflect</Btn>
                          )}

                          {hasReflection && (
                            <Btn v="ghost" onClick={() => { setReflectId(d.id); setScreen("insight"); }} style={{ fontSize: 11, color: C.sage, padding: "7px 14px" }}>Insight</Btn>
                          )}

                          {d.groupCode && (
                            <Btn v="ghost" onClick={async () => { const data = await loadGroupResults(d.groupCode); if (data) { setGroupData(data); setGroupCode(d.groupCode); setScreen("groupresults"); } }} style={{ fontSize: 11, color: C.taupe, padding: "7px 14px" }}>{"\uD83D\uDC65"} Group</Btn>
                          )}
                          <Btn v="ghost" onClick={(e) => { e.stopPropagation(); const next = history.filter((x) => x.id !== d.id); setHistory(next); saveHistory(next); setExpandedDec(null); }} style={{ fontSize: 11, color: C.error, padding: "7px 14px" }}>Delete</Btn>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
  // ─── REFLECT ───
  if (screen === "reflect") {
    const dec = history.find((d) => d.id === reflectId);
    if (!dec) { setScreen("history"); return null; }
    const _rc = history.filter((d) => d.reflection).length;
    if (_rc >= 1 && !unlocked) { trackEvent("paywall"); setScreen("upgrade"); return null; }
    const w = dec.results ? [...dec.results].sort((a, b) => b.score - a.score)[0] : null;
    const daysSince = Math.floor((Date.now() - dec.timestamp) / 86400000);

    const questions = [
      { key: "chose", q: "What did you end up choosing?", hint: dec.results ? `Unstuk suggested: ${w?.name}` : null,
        options: dec.type === "binary"
          ? [dec.binaryOption1, dec.binaryOption2, "Something else entirely"]
          : [...(dec.options || []).map((o) => o.name), "Something else entirely"]
      },
      { key: "outcome", q: "How did it turn out?",
        options: ["Better than expected", "About as expected", "Worse than expected", "Too early to tell"]
      },
      { key: "followedApp", q: "Did you follow Unstuk's suggestion?",
        options: ["Yes", "No, I went with my instinct", "Partly — it influenced me"]
      },
      { key: "lesson", q: "If you could go back, what would you do differently?",
        options: ["Nothing — I'd decide the same way", "I'd weigh different criteria", "I'd consider more options", "I'd decide faster", "I'd get more information first"]
      },
    ];

    const answers = reflectAnswers;
    const q = questions[reflectStep];
    const allDone = reflectStep >= questions.length;

    // Generate insight based on answers — expanded with gut cross-reference
    const generateInsight = () => {
      const a = answers;
      const insights = [];
      const tips = [];
      const imm = dec.immediate?.feeling;

      // Core outcome × followedApp matrix (expanded)
      if (a.outcome === "Better than expected" && a.followedApp === "Yes") {
        insights.push("Your analysis aligned with reality. The criteria you chose captured what actually mattered.");
        if (imm === "confident") tips.push("Your instinct agreed with the analysis and both were right. For decisions like this, you can move faster next time.");
        else if (imm === "uneasy") tips.push("Interesting — you felt uneasy despite good results. Sometimes anxiety is about the process, not the outcome.");
        else tips.push("For similar decisions, you can move faster — your instinct for criteria is good.");
      } else if (a.outcome === "Worse than expected" && a.followedApp === "Yes") {
        insights.push("The analysis pointed one way, but reality went another. There were factors your criteria didn't capture.");
        if (imm === "uneasy") tips.push("Your instinct sensed something the analysis missed. Next time that feeling shows up, pause and ask: what am I not measuring?");
        else if (imm === "confident") tips.push("Confidence plus a bad outcome often means a missing criterion. What surprised you? That's your hidden factor.");
        else tips.push("Next time, ask: what could go wrong that I'm not measuring?");
      } else if (a.outcome === "Better than expected" && a.followedApp === "No, I went with my instinct") {
        insights.push("You overrode the analysis and it worked out. Your intuition picked up on something the structured criteria missed.");
        if (imm === "confident") tips.push("Strong instinct + good outcome = real signal. Consider what what your instinct was responding to — it might deserve to be a criterion.");
        else tips.push("Pay attention to what what your instinct was responding to — it might be a criterion worth adding explicitly next time.");
      } else if (a.outcome === "Worse than expected" && a.followedApp === "No, I went with my instinct") {
        insights.push("Your instinct led you away from the analysis, and the outcome was disappointing. The criteria you set might have been wiser than the feeling in the moment.");
        if (imm === "confident") tips.push("You felt confident going against the analysis, but it didn't work out. Overconfidence in instinct decisions is a common pattern — the analysis exists to challenge exactly this.");
        else tips.push("When instinct and analysis disagree, try adding the instinct as an explicit criterion and re-running the comparison.");
      } else if (a.outcome === "About as expected" && a.followedApp === "Yes") {
        insights.push("The outcome matched your expectations and you followed the analysis. Your mental model of this decision was accurate.");
        tips.push("This kind of predictability means your criteria selection was on point.");
      } else if (a.outcome === "About as expected" && a.followedApp === "No, I went with my instinct") {
        insights.push("You went with your instinct and the outcome was about what you expected. The analysis and your intuition may have been closer than you thought.");
        tips.push("Check if the analysis actually agreed with your gut. If it did, you can trust both channels.");
      } else if (a.outcome === "About as expected" && a.followedApp === "Partly \u2014 it influenced me") {
        insights.push("You blended analysis with intuition and got a predictable result. This balanced approach often produces the most consistent outcomes.");
        tips.push("Blending structured and intuitive thinking is a strength. Keep doing it.");
      } else if (a.outcome === "Better than expected" && a.followedApp === "Partly \u2014 it influenced me") {
        insights.push("You took the analysis as input rather than gospel, and it paid off. The best decisions often combine structure with judgement.");
        tips.push("This approach — analysis as input, not answer — is how experts make decisions.");
      } else if (a.outcome === "Worse than expected" && a.followedApp === "Partly \u2014 it influenced me") {
        insights.push("A mixed approach led to a disappointing result. It's worth asking: did you override the right parts or the wrong parts of the analysis?");
        tips.push("Review which criteria you weighed differently in your head vs in the app. That gap is where the lesson lives.");
      } else {
        insights.push("It's still early — outcomes aren't clear yet. That's OK. Revisit this reflection in a few weeks.");
        tips.push("Bookmark this decision mentally. The real lesson often emerges later.");
      }

      // Lesson-specific additions
      if (a.lesson === "I'd weigh different criteria") {
        insights.push("Recognising that you'd weight things differently is one of the most valuable decision skills. Each reflection sharpens your criteria instinct for next time.");
      } else if (a.lesson === "I'd decide faster") {
        insights.push("Analysis paralysis is real. You've identified that your decision process might be too slow for the stakes involved.");
        tips.push("Set a time limit before you start. Match decision speed to decision importance.");
      } else if (a.lesson === "I'd get more information first") {
        insights.push("Information gaps hurt. But perfect information never exists — the skill is knowing when you have enough.");
        tips.push("Before your next decision, list what you'd need to know and how long it would take. If it's under a day, get it. If it's a week, decide without it.");
      } else if (a.lesson === "I'd consider more options") {
        insights.push("Feeling like you missed an option suggests the framing was too narrow. Good decisions start with good option generation.");
        tips.push("Spend 5 minutes brainstorming options before you commit to comparing them. Often the best choice is one you almost didn't consider.");
      }

      return { insights, tips };
    };

    if (allDone) {
      // Don't save during render — trigger save via effect in insight screen
      // Redirect immediately
      if (screen === "reflect") {
        const { insights, tips } = generateInsight();
        const updatedHistory = history.map((d) =>
          d.id === reflectId ? { ...d, reflection: { ...answers, insights, tips, timestamp: Date.now() } } : d
        );
        // Use setTimeout to avoid setting state during render
        setTimeout(() => {
          setHistory(updatedHistory);
          saveHistory(updatedHistory);
          setScreen("insight"); trackEvent("reflect_done", { outcome: answers.outcome });
        }, 0);
        return (
          <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FadeIn><p style={{ fontFamily: F.b, fontSize: 14, color: C.muted }}>Generating your insight...</p></FadeIn>
          </div>
        );
      }
    }

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => reflectStep > 0 ? setReflectStep(reflectStep - 1) : setScreen("history")} />
          <FadeIn key={reflectStep}>
            <Dots current={reflectStep} total={questions.length} />
            <div style={{ marginBottom: 8 }}>
              {reflectStep === 0 && (
                <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "0 0 8px", lineHeight: 1.5 }}>
                  {"\u2022"} This takes about 30 seconds. Research by Philip Tetlock found that people who systematically review their predictions improve accuracy by 20-50% within a year.
                </p>
              )}
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.sage, fontWeight: 500, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Reflecting on</p>
              <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: 600, margin: 0 }}>{dec.name}</p>
            </div>
            <H size="md">{q.q}</H>
            {q.hint && <p style={{ fontFamily: F.b, fontSize: 11, color: C.sage, margin: "6px 0 0", fontStyle: "italic" }}>{q.hint}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 18 }}>
              {q.options.map((opt, i) => {
                const isFirst = i === 0;
                const isLast = i === q.options.length - 1;
                return (
                  <button key={opt} onClick={() => {
                    setReflectAnswers({ ...answers, [q.key]: opt });
                    setReflectStep(reflectStep + 1);
                  }}
                    className="ustk-touch" style={{
                      fontFamily: F.b, fontSize: 13, padding: "14px 18px", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer",
                      border: `1px solid ${C.border}`, borderTop: isFirst ? `1px solid ${C.border}` : "none",
                      borderRadius: isFirst ? "8px 8px 0 0" : isLast ? "0 0 8px 8px" : "0",
                      background: "#fff", color: C.text,
                    }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── INSIGHT (single decision reflection result) ───
  if (screen === "insight") {
    const dec = history.find((d) => d.id === reflectId);
    if (!dec?.reflection) { setScreen("history"); return null; }
    const r = dec.reflection;
    const w = dec.results ? [...dec.results].sort((a, b) => b.score - a.score)[0] : null;
    const reflected = history.filter((d) => d.reflection);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen("home")} />
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.sageSoft, border: `2px solid ${C.sage}30`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>&#9670;</span>
              </div>
              <H size="lg">Insight earned</H>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
                You just closed the loop. Studies in metacognition show this kind of structured follow-up is the primary mechanism behind expert-level judgment.
              </p>
              <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginTop: 6 }}>{dec.name}</p>
            </div>

            {/* What happened */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "12px 14px" }}>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Chose</div>
                <div style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: 500 }}>{r.chose}</div>
              </div>
              <div style={{ flex: 1, background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "12px 14px" }}>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Outcome</div>
                <div style={{ fontFamily: F.b, fontSize: 13, color: r.outcome === "Better than expected" ? C.sage : r.outcome === "Worse than expected" ? C.error : C.text, fontWeight: 500 }}>{r.outcome}</div>
              </div>
            </div>

            {/* Immediate vs Reflected comparison */}
            {dec.immediate && (
              <FadeIn delay={150}>
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Your instinct vs outcome</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{dec.immediate.feeling === "confident" ? "\uD83D\uDFE2" : dec.immediate.feeling === "uncertain" ? "\uD83D\uDFE1" : "\uD83D\uDD34"}</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted }}>Day 0</div>
                      <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text }}>{dec.immediate.feeling.charAt(0).toUpperCase() + dec.immediate.feeling.slice(1)}</div>
                    </div>
                    <div style={{ fontFamily: F.b, fontSize: 18, color: C.border }}>{"\u2192"}</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{r.outcome === "Better than expected" ? "\uD83D\uDFE2" : r.outcome === "Worse than expected" ? "\uD83D\uDD34" : "\uD83D\uDFE1"}</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted }}>Day 3+</div>
                      <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text }}>{r.outcome.split(" ")[0]}</div>
                    </div>
                  </div>
                  {/* Instinct accuracy insight */}
                  {(() => {
                    const gutRight = (dec.immediate.feeling === "confident" && r.outcome === "Better than expected") ||
                      (dec.immediate.feeling === "uneasy" && r.outcome === "Worse than expected");
                    const gutWrong = (dec.immediate.feeling === "confident" && r.outcome === "Worse than expected") ||
                      (dec.immediate.feeling === "uneasy" && r.outcome === "Better than expected");
                    if (gutRight) return <p style={{ fontFamily: F.b, fontSize: 12, color: C.sage, margin: "12px 0 0", textAlign: "center", fontStyle: "italic" }}>Your instinct was right. It picked up on something real.</p>;
                    if (gutWrong) return <p style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, margin: "12px 0 0", textAlign: "center", fontStyle: "italic" }}>Your instinct misread this one. The criteria may have been wiser.</p>;
                    return <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "12px 0 0", textAlign: "center", fontStyle: "italic" }}>Mixed signals — both instinct and outcome were ambiguous here.</p>;
                  })()}
                </div>
              </FadeIn>
            )}

            {/* Insights */}
            {r.insights.map((insight, i) => (
              <FadeIn key={i} delay={200 + i * 150}>
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.sage}20`, padding: "16px 18px", marginBottom: 10 }}>
                  <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{insight}</p>
                </div>
              </FadeIn>
            ))}

            {/* Tips */}
            {r.tips.length > 0 && (
              <FadeIn delay={600}>
                <div style={{ background: C.sageSoft, borderRadius: 10, padding: "16px 18px", marginTop: 10, marginBottom: 24 }}>
                  <p style={{ fontFamily: F.b, fontSize: 10, color: C.sage, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", fontWeight: 600 }}>Next time</p>
                  {r.tips.map((tip, i) => (
                    <p key={i} style={{ fontFamily: F.b, fontSize: 12, color: C.text, lineHeight: 1.7, margin: i < r.tips.length - 1 ? "0 0 8px" : 0 }}>{tip}</p>
                  ))}
                </div>
              </FadeIn>
            )}

            {/* Streak */}
            <FadeIn delay={800}>
              <div style={{ textAlign: "center", padding: "20px 0 10px", borderTop: `1px solid ${C.border}40` }}>
                <div style={{ fontFamily: F.d, fontSize: 32, fontWeight: 700, color: C.sage }}>{reflected.length}</div>
                <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted }}>decision{reflected.length === 1 ? "" : "s"} reflected on</div>
              </div>
            </FadeIn>

            <div style={{ marginTop: 16 }}>
              <Btn onClick={() => setScreen("history")} style={{ width: "100%" }}>Done</Btn>
              {reflected.length >= 2 && <Btn v="secondary" onClick={() => setScreen("growth")} style={{ width: "100%", marginTop: 8 }}>View growth pattern</Btn>}
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── GROWTH ───
  if (screen === "growth") {
    const _rc2 = history.filter((d) => d.reflection).length;
    if (_rc2 >= 1 && !unlocked) { setScreen("upgrade"); return null; }
    // Growth screen renders below
    const reflected = history.filter((d) => d.reflection).sort((a, b) => a.timestamp - b.timestamp);
    const total = reflected.length;
    const followed = reflected.filter((d) => d.reflection.followedApp === "Yes").length;
    const betterThanExpected = reflected.filter((d) => d.reflection.outcome === "Better than expected").length;
    const wouldChangeSomething = reflected.filter((d) => d.reflection.lesson !== "Nothing — I'd decide the same way").length;

    // Instinct accuracy: compare immediate feeling to actual outcome
    const withImmediate = reflected.filter((d) => d.immediate);
    const gutCorrect = withImmediate.filter((d) => {
      const f = d.immediate.feeling;
      const o = d.reflection.outcome;
      return (f === "confident" && o === "Better than expected") || (f === "confident" && o === "About as expected") || (f === "uneasy" && o === "Worse than expected");
    }).length;
    const gutAccuracy = withImmediate.length >= 3 ? Math.round((gutCorrect / withImmediate.length) * 100) : null;

    // Pattern detection — require minimum data to avoid meaningless stats
    const patterns = [];
    if (total >= 3) {
      if (followed / total >= 0.7) patterns.push({ icon: "\u25C6", text: "You tend to follow structured analysis. This correlates with more predictable outcomes.", tone: "sage" });
      else if (followed / total <= 0.3) patterns.push({ icon: "\u2663", text: "You often override the analysis. Your intuition is strong — consider adding instinct as an explicit criterion.", tone: "taupe" });

      if (betterThanExpected / total >= 0.5) patterns.push({ icon: "\u25B2", text: "More than half your decisions exceeded expectations. Your criteria selection is working.", tone: "sage" });
      if (wouldChangeSomething / total >= 0.6) patterns.push({ icon: "\u21BA", text: "You frequently identify room for improvement. This growth mindset is your biggest asset.", tone: "sage" });

      const recentTwo = reflected.slice(-2);
      if (recentTwo.length === 2 && recentTwo[0].reflection.outcome === "Worse than expected" && recentTwo[1].reflection.outcome !== "Worse than expected") {
        patterns.push({ icon: "\u25B4", text: "Your most recent decision went better than the one before. You're learning.", tone: "sage" });
      }
    }

    if (gutAccuracy !== null) {
      if (gutAccuracy >= 70) patterns.push({ icon: "\uD83C\uDFAF", text: `Your instinct has been accurate ${gutAccuracy}% of the time. You read situations well — trust it when the analysis is close.`, tone: "sage" });
      else if (gutAccuracy <= 30) patterns.push({ icon: "\u26A0\uFE0F", text: `Your initial instinct has only matched outcomes ${gutAccuracy}% of the time. The structured analysis may be a better guide for you.`, tone: "taupe" });
      else patterns.push({ icon: "\u25CF", text: `Your instinct accuracy sits at ${gutAccuracy}%. Neither reliable nor unreliable — keep collecting data.`, tone: "muted" });
    }

    if (patterns.length === 0 && total >= 1) {
      patterns.push({ icon: "\u25CF", text: `${total} reflection${total === 1 ? "" : "s"} so far. Patterns emerge after 3 — keep going.`, tone: "muted" });
    }

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => setScreen("home")} />
          <FadeIn>
            <H size="lg">Your growth</H>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, margin: "8px 0 28px" }}>How your decision-making is evolving.</p>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: gutAccuracy !== null ? 10 : 28 }}>
              {[
                { n: total, label: "Reflected" },
                { n: betterThanExpected, label: "Beat expectations" },
                { n: total - wouldChangeSomething, label: "No regrets" },
              ].map((s, i) => (
                <FadeIn key={i} delay={i * 100}>
                  <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: F.d, fontSize: 28, fontWeight: 700, color: C.sage }}>{s.n}</div>
                    <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.3 }}>{s.label}</div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Instinct accuracy trend */}
            {gutAccuracy !== null && (
              <FadeIn delay={350}>
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Instinct accuracy</div>
                    <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: gutAccuracy >= 60 ? C.sage : gutAccuracy <= 40 ? C.taupe : C.muted }}>{gutAccuracy}%</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.accentLt, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${gutAccuracy}%`, borderRadius: 3, background: gutAccuracy >= 60 ? C.sage : gutAccuracy <= 40 ? C.taupe : C.muted, transition: "width 0.8s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    {withImmediate.map((d, i) => {
                      const f = d.immediate.feeling;
                      const o = d.reflection.outcome;
                      const match = (f === "confident" && (o === "Better than expected" || o === "About as expected")) || (f === "uneasy" && o === "Worse than expected");
                      return (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: match ? C.sage : C.error + "80" }} title={d.name} />
                      );
                    })}
                  </div>
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Based on {withImmediate.length} decision{withImmediate.length === 1 ? "" : "s"} where you recorded an immediate reaction.
                  </p>
                </div>
              </FadeIn>
            )}

            {/* Patterns */}
            {patterns.length > 0 && (
              <>
                <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Patterns</div>
                {patterns.map((p, i) => (
                  <FadeIn key={i} delay={300 + i * 150}>
                    <div style={{ background: p.tone === "sage" ? C.sageSoft : p.tone === "taupe" ? C.taupeSoft : C.card, borderRadius: 10, border: `1px solid ${p.tone === "sage" ? C.sage : p.tone === "taupe" ? C.taupe : C.border}20`, padding: "14px 16px", marginBottom: 8 }}>
                      <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>
                        <span style={{ marginRight: 8, color: p.tone === "sage" ? C.sage : p.tone === "taupe" ? C.taupe : C.muted }}>{p.icon}</span>
                        {p.text}
                      </p>
                    </div>
                  </FadeIn>
                ))}
              </>
            )}

            {/* ── Insights & Reports ── */}
            {history.length >= 2 && (
              <FadeIn delay={450}>
                <div style={{ marginTop: 28 }}>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Insights & Reports</div>

                  {/* Decision velocity */}
                  {(() => {
                    const sortedH = [...history].sort((a, b) => a.timestamp - b.timestamp);
                    const gaps = [];
                    for (let i = 1; i < sortedH.length; i++) gaps.push((sortedH[i].timestamp - sortedH[i-1].timestamp) / 86400000);
                    const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length * 10) / 10 : null;
                    const recentGap = gaps.length >= 2 ? gaps[gaps.length - 1] : null;
                    const trend = recentGap !== null && avgGap !== null ? (recentGap < avgGap * 0.7 ? "accelerating" : recentGap > avgGap * 1.5 ? "slowing" : "steady") : null;
                    return avgGap !== null ? (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: 0 }}>Decision velocity</p>
                            <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "3px 0 0" }}>
                              One decision every {avgGap <= 1 ? "day" : `${avgGap} days`} on average
                            </p>
                          </div>
                          <div style={{ fontFamily: F.d, fontSize: 22, fontWeight: 700, color: trend === "accelerating" ? C.sage : trend === "slowing" ? C.taupe : C.muted }}>
                            {trend === "accelerating" ? "\u2191" : trend === "slowing" ? "\u2193" : "\u2192"}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Criteria analysis */}
                  {(() => {
                    const allCrits = {};
                    history.forEach(d => { if (d.criteria) d.criteria.forEach(c => { allCrits[c.name] = (allCrits[c.name] || 0) + 1; }); });
                    const sorted = Object.entries(allCrits).sort((a, b) => b[1] - a[1]).slice(0, 5);
                    return sorted.length > 0 ? (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Your top criteria</p>
                        {sorted.map(([name, count], i) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted, width: 16, textAlign: "right" }}>{i + 1}.</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>{name}</div>
                              <div style={{ height: 4, background: C.accentLt, borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
                                <div style={{ height: "100%", width: `${(count / history.length) * 100}%`, background: C.sage, borderRadius: 2 }} />
                              </div>
                            </div>
                            <span style={{ fontFamily: F.b, fontSize: 10, color: C.muted }}>{count}x</span>
                          </div>
                        ))}
                        <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, margin: "6px 0 0" }}>These are the things that matter most to you across all your decisions.</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Outcome distribution */}
                  {reflected.length >= 2 && (() => {
                    const outcomes = { "Better than expected": 0, "About as expected": 0, "Worse than expected": 0 };
                    reflected.forEach(d => { if (d.reflection?.outcome && outcomes[d.reflection.outcome] !== undefined) outcomes[d.reflection.outcome]++; });
                    return (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Outcome distribution</p>
                        <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden" }}>
                          {Object.entries(outcomes).map(([label, count]) => {
                            const pct = reflected.length > 0 ? (count / reflected.length) * 100 : 0;
                            const color = label === "Better than expected" ? C.sage : label === "Worse than expected" ? C.error + "80" : C.taupe;
                            return pct > 0 ? (
                              <div key={label} style={{ width: `${pct}%`, background: color, display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.6s ease" }}>
                                {pct >= 20 && <span style={{ fontFamily: F.b, fontSize: 9, color: "#fff", fontWeight: 600 }}>{Math.round(pct)}%</span>}
                              </div>
                            ) : null;
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                          {[{ l: "Better", c: C.sage }, { l: "As expected", c: C.taupe }, { l: "Worse", c: C.error + "80" }].map(({ l, c }) => (
                            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                              <span style={{ fontFamily: F.b, fontSize: 9, color: C.muted }}>{l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Analysis vs gut track record */}
                  {reflected.length >= 3 && (() => {
                    const followedData = reflected.filter(d => d.reflection?.followedApp === "Yes");
                    const overrodeData = reflected.filter(d => d.reflection?.followedApp === "No");
                    const followedGood = followedData.filter(d => d.reflection?.outcome !== "Worse than expected").length;
                    const overrodeGood = overrodeData.filter(d => d.reflection?.outcome !== "Worse than expected").length;
                    const fRate = followedData.length > 0 ? Math.round((followedGood / followedData.length) * 100) : null;
                    const oRate = overrodeData.length > 0 ? Math.round((overrodeGood / overrodeData.length) * 100) : null;
                    return fRate !== null || oRate !== null ? (
                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 8 }}>
                        <p style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.text, margin: "0 0 10px" }}>Analysis vs instinct: track record</p>
                        <div style={{ display: "flex", gap: 10 }}>
                          {fRate !== null && (
                            <div style={{ flex: 1, background: C.sageSoft, borderRadius: 8, padding: "12px 10px", textAlign: "center" }}>
                              <div style={{ fontFamily: F.d, fontSize: 24, fontWeight: 700, color: C.sage }}>{fRate}%</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>good outcomes when following analysis</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.border, marginTop: 2 }}>({followedData.length} decisions)</div>
                            </div>
                          )}
                          {oRate !== null && (
                            <div style={{ flex: 1, background: C.taupeSoft, borderRadius: 8, padding: "12px 10px", textAlign: "center" }}>
                              <div style={{ fontFamily: F.d, fontSize: 24, fontWeight: 700, color: C.taupe }}>{oRate}%</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, marginTop: 2 }}>good outcomes when going with gut</div>
                              <div style={{ fontFamily: F.b, fontSize: 9, color: C.border, marginTop: 2 }}>({overrodeData.length} decisions)</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Share your stats */}
                  <div style={{ marginTop: 8 }}>
                    <Btn v="secondary" onClick={() => {
                      const stats = [
                        `\u{1F4CA} My Unstuk Stats`,
                        ``,
                        `${history.length} decisions made`,
                        `${reflected.length} reflected on`,
                        gutAccuracy !== null ? `${gutAccuracy}% instinct accuracy` : null,
                        betterThanExpected > 0 ? `${betterThanExpected} beat expectations` : null,
                        ``,
                        `Track your decisions at unstuk.app`,
                      ].filter(Boolean).join("\n");
                      setShareSheetData({ text: stats, title: "Share My Stats" });
                    }} style={{ width: "100%", fontSize: 12 }}>Share my stats</Btn>
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Timeline */}
            {reflected.length > 0 && (
              <FadeIn delay={500}>
                <div style={{ marginTop: 28 }}>
                  <div style={{ fontFamily: F.b, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Timeline</div>
                  {reflected.map((d, i) => {
                    const r = d.reflection;
                    const outcomeColor = r.outcome === "Better than expected" ? C.sage : r.outcome === "Worse than expected" ? C.error : C.muted;
                    return (
                      <div key={d.id} style={{ display: "flex", gap: 14, marginBottom: i < reflected.length - 1 ? 0 : 0 }}>
                        {/* Vertical line */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: outcomeColor, flexShrink: 0, marginTop: 5 }} />
                          {i < reflected.length - 1 && <div style={{ width: 1, flex: 1, background: C.border, minHeight: 30 }} />}
                        </div>
                        <div style={{ paddingBottom: 16 }}>
                          <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 500, color: C.text }}>{d.name}</div>
                          <div style={{ fontFamily: F.b, fontSize: 11, color: outcomeColor, marginTop: 2 }}>{r.outcome}</div>
                          <div style={{ fontFamily: F.b, fontSize: 11, color: C.muted, marginTop: 2 }}>Chose: {r.chose} · {r.followedApp === "Yes" ? "Followed analysis" : "Went with instinct"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </FadeIn>
            )}

            <div style={{ marginTop: 24 }}>
              <Btn onClick={() => setScreen("home")} style={{ width: "100%" }}>Back to home</Btn>
            </div>
          </FadeIn>
        </div>
        {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
      </div>
    );
  }

  // ─── 30-DAY REVIEW ───
  if (screen === "review30") {
    if (!unlocked) { setScreen("upgrade"); return null; }
    const dec = history.find((d) => d.id === reflectId);
    if (!dec?.reflection) { setScreen("home"); return null; }
    const w = dec.results ? [...dec.results].sort((a, b) => b.score - a.score)[0] : null;
    const r = dec.reflection;

    const reviewQs = [
      { key: "stillGood", q: "Looking back after a month — how do you feel about this decision now?",
        options: ["It was the right call", "Mixed feelings", "I wish I'd chosen differently", "Still too early to say"]
      },
      { key: "whatLearned", q: "What's the biggest thing you've learned from this decision?",
        options: ["Trust the analysis more", "Trust my instinct more", "I need better criteria", "Speed matters more than I thought", "Nothing new — it confirmed what I knew"]
      },
    ];

    const q = reviewQs[reflectStep];
    if (reflectStep >= reviewQs.length) {
      // Save review
      const updatedHistory = history.map((d) =>
        d.id === reflectId ? { ...d, review30: { ...reflectAnswers, timestamp: Date.now() } } : d
      );
      setTimeout(() => {
        setHistory(updatedHistory);
        saveHistory(updatedHistory);
        setScreen("home");
      }, 0);
      return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FadeIn><div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{"✨"}</div>
            <p style={{ fontFamily: F.d, fontSize: 20, fontWeight: 600, color: C.text }}>Review saved</p>
            <p style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginTop: 6 }}>One month wiser.</p>
          </div></FadeIn>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
          <BackBtn onClick={() => reflectStep > 0 ? setReflectStep(reflectStep - 1) : setScreen("home")} /><HomeBtn onClick={() => setScreen("home")} />
          <FadeIn key={reflectStep}>
            <Dots current={reflectStep} total={reviewQs.length} />
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontFamily: F.b, fontSize: 11, color: C.taupe, fontWeight: 500, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>30-day review</p>
              <p style={{ fontFamily: F.b, fontSize: 13, color: C.text, fontWeight: 600, margin: 0 }}>{dec.name}</p>
              {w && <p style={{ fontFamily: F.b, fontSize: 11, color: C.muted, margin: "4px 0 0" }}>Original result: {w.name} ({w.pct}%) · 3-day: {r.outcome}</p>}
            </div>
            <H size="md">{q.q}</H>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 18 }}>
              {q.options.map((opt, i) => {
                const isFirst = i === 0;
                const isLast = i === q.options.length - 1;
                return (
                  <button key={opt} onClick={() => {
                    setReflectAnswers({ ...reflectAnswers, [q.key]: opt });
                    setReflectStep(reflectStep + 1);
                  }} className="ustk-touch" style={{
                      fontFamily: F.b, fontSize: 13, padding: "14px 18px", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer",
                      border: `1px solid ${C.border}`, borderTop: isFirst ? `1px solid ${C.border}` : "none",
                      borderRadius: isFirst ? "8px 8px 0 0" : isLast ? "0 0 8px 8px" : "0",
                      background: "#fff", color: C.text,
                    }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── UPGRADE ───
  if (screen === "upgrade") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <FadeIn>
            <HomeBtn onClick={() => setScreen("home")} />
            <div style={{ fontSize: 40, marginBottom: 20 }}>&#10024;</div>
            <H size="lg">Unlock full reflection access</H>
            <p style={{ fontFamily: F.b, fontSize: 14, color: C.muted, lineHeight: 1.7, margin: "16px 0 32px" }}>
              You've experienced how reflection sharpens decisions. Unlock unlimited reflections, growth tracking, and data export.
            </p>
            <Card style={{ padding: "24px 20px", marginBottom: 24, textAlign: "left" }}>
              <div style={{ fontFamily: F.d, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 12, textAlign: "center" }}>$3.99 / individual</div>
              <div style={{ fontFamily: F.b, fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
                <div style={{ marginBottom: 6 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Unlimited decisions — always free</div>
                <div style={{ marginBottom: 6 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Unlimited reflections & instinct accuracy tracking</div>
                <div style={{ marginBottom: 6 }}><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Growth insights & instinct accuracy tracking</div>
                <div><span style={{ color: C.sage, marginRight: 8 }}>&#10003;</span>Data export & no recurring fees</div>
              </div>
            </Card>
            <Btn onClick={async () => { try { await window.storage.set("unstuk_unlocked", makeUnlockToken()); } catch(e) {} setUnlocked(true); setScreen("home"); trackEvent("unlock"); }} style={{ width: "100%", padding: "15px 28px", fontSize: 15, marginBottom: 12 }}>
              Upgrade to Individual Pro — $3.99
            </Btn>
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "8px 16px" }}>
              Back to home
            </button>
            <p style={{ fontFamily: F.b, fontSize: 10, color: C.border, marginTop: 32, lineHeight: 1.6 }}>
              One-time purchase. No account needed. No data leaves your device.
            </p>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ─── FLOW ───
  const renderStep = () => {
    if (blocked) return <BlockedMsg onBack={() => { resetFull(); setStep("name"); setScreen("flow"); }} />;

    if (step === "name") {
      return (
        <FadeIn key="name">
          <BackBtn onClick={() => setScreen("home")} />
          <Lbl>Your Decision</Lbl>
          <H size="md">What decision are you making?</H>
          <Sub>30 characters max. Pick a suggestion below or type your own.</Sub>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1 }}>
            <TxtIn value={dName} onChange={setDName} placeholder="" maxLen={30}
            onSubmit={() => {
              if (!dName.trim()) return;
              if (isBlockedContent(dName)) { setBlocked(true); return; }
              goStep("type");
            }} />
            </div>
            <Btn onClick={() => {
              if (!dName.trim()) return;
              if (isBlockedContent(dName)) { setBlocked(true); return; }
              goStep("type");
            }} disabled={!dName.trim()} style={{ padding: "12px 20px", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>Next</Btn>
          </div>
          <ChipPicker storageKey="name" usedNames={dName ? [dName] : []} aiContext={{ dName, opts: [], crits: [], typed: dName }} onPick={(name) => setDName(name)}
            aiContext={{ dName, opts, crits, typed: dName }}
            onAiSuggestText={(txt) => { if (!dName.trim()) setDName(txt); }} />
        </FadeIn>
      );
    }

    if (step === "type") {
      return (
        <FadeIn key="type">
          <BackBtn onClick={goBack} />
          <Lbl>Decision Type</Lbl>
          <H size="md">How many options?</H>
          <Sub>Binary has two options. Otherwise, three or more.</Sub>
          <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "2px 0 6px" }}>
            {"\u2022"} Most decisions are binary at their core. If in doubt, start with two options.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => { setDType("binary"); setLastReward("binary"); setTimeout(() => goStep("binaryopts"), 500); }}
              className="ustk-touch" style={{ fontFamily: F.b, fontSize: 14, padding: "15px 20px", borderRadius: 10, border: dType === "binary" ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: dType === "binary" ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}>
              Binary — Two options
              {dType === "binary" && lastReward && <InlineReward show={true} />}
            </button>
            <button onClick={() => { setDType("multi"); setLastReward("multi"); setTimeout(() => goStep("options"), 500); }}
              className="ustk-touch" style={{ fontFamily: F.b, fontSize: 14, padding: "15px 20px", borderRadius: 10, border: dType === "multi" ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: dType === "multi" ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}>
              Three or more — Multiple options
              {dType === "multi" && lastReward && <InlineReward show={true} />}
            </button>
          </div>
        </FadeIn>
      );
    }

    if (step === "options") {
      const add = () => { if (newOpt.trim() && opts.length < 6) { if (isBlockedContent(newOpt)) { setBlocked(true); return; } const nid = uid(); setOpts((p) => [...p, { id: nid, name: newOpt.trim() }]); setNewOpt(""); setRewardTick((t) => t + 1); setAddFlash("option"); setTimeout(() => setAddFlash(null), 800); setLastAddedOpt(nid); setTimeout(() => setLastAddedOpt(null), 2500); setTimeout(() => document.getElementById("multiOpt")?.focus(), 50); } };
      const atMax = opts.length >= 6;
      return (
        <FadeIn key="opts">
          <BackBtn onClick={goBack} />
          <Lbl>Options {opts.length > 0 && <span style={{ color: C.sage, fontWeight: 600, transition: "all 0.3s ease", display: "inline-block", transform: addFlash === "option" ? "scale(1.2)" : "scale(1)" }}>{opts.length}/6</span>}</Lbl>
          <H size="md">What are your options?</H>
          <Sub>30 characters max. Pick a suggestion or type your own.</Sub>
          {opts.length > 0 && <div style={{ marginBottom: 14 }}><OptRows items={opts} onRemove={(id) => setOpts(opts.filter((x) => x.id !== id))} lastAddedId={lastAddedOpt} /></div>}
          {opts.length >= 2 && opts.length <= 3 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "0 0 8px" }}>
              {"\u2022"} Try including one option you wouldn't normally consider.
            </p>
          )}
          {!atMax && (
            <>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1 }}><TxtIn value={newOpt} onChange={setNewOpt} placeholder="" onSubmit={add} maxLen={30} inputId="multiOpt" /></div>
                <Btn v="sage" onClick={add} disabled={!newOpt.trim()} style={{ padding: "12px 18px", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>+ Add</Btn>
                {opts.length >= 3 && <div style={{ width: 6 }} />}
                {opts.length >= 3 && <Btn onClick={() => {
                  if (newOpt.trim()) { if (isBlockedContent(newOpt)) { setBlocked(true); return; } const nid = uid(); setOpts((p) => [...p, { id: nid, name: newOpt.trim() }]); setNewOpt(""); setTimeout(() => goStep("criteria"), 50); } else { goStep("criteria"); }
                }} style={{ padding: "12px 18px", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>Next</Btn>}
              </div>
              {opts.length === 2 && (
                <Btn onClick={() => {
                  if (!newOpt.trim()) return;
                  if (isBlockedContent(newOpt)) { setBlocked(true); return; }
                  const nid = uid(); setOpts((p) => [...p, { id: nid, name: newOpt.trim() }]); setNewOpt("");
                  setTimeout(() => goStep("criteria"), 50);
                }} disabled={!newOpt.trim()} style={{ width: "100%", fontSize: 14, padding: "13px 28px", marginTop: 10 }}>Next →</Btn>
              )}
              <ChipPicker storageKey="opt" usedNames={[...opts.map((o) => o.name), newOpt].filter(Boolean)} aiContext={{ dName, opts, crits: [], typed: newOpt }} onPick={(name) => {
                if (opts.length < 6) { const nid = uid(); setOpts((p) => [...p, { id: nid, name }]); setRewardTick((t) => t + 1); setAddFlash("option"); setTimeout(() => setAddFlash(null), 800); setLastAddedOpt(nid); setTimeout(() => setLastAddedOpt(null), 2500); }
              }}
                onAiSuggestText={(txt) => { if (!newOpt.trim()) setNewOpt(txt); }} />
            </>
          )}
          {atMax && <p style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, margin: "4px 0" }}>Maximum 6 options. Remove one to add another.</p>}
          {atMax && <div style={{ marginTop: 10 }}><Btn onClick={() => goStep("criteria")} style={{ width: "100%", fontSize: 15, padding: "14px 28px" }}>Next</Btn></div>}
          {opts.length < 3 && opts.length > 0 && <p style={{ fontFamily: F.b, fontSize: 11, color: C.taupe, marginTop: 6 }}>Add at least 3 options to continue</p>}

        </FadeIn>
      );
    }

    if (step === "binaryopts") {
      return (
        <FadeIn key="bn">
          <BackBtn onClick={goBack} />
          <Lbl>Your Two Options</Lbl>
          <H size="md">Name your two options</H>
          <Sub>30 characters max. Pick a suggestion or type your own.</Sub>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><Lbl>Option A</Lbl><TxtIn value={bo1} onChange={setBo1} placeholder="" inputId="binA" onSubmit={() => { document.getElementById("binB")?.focus(); }} maxLen={30} /></div>
              <div><Lbl>Option B</Lbl><TxtIn value={bo2} onChange={setBo2} placeholder="" inputId="binB" autoFocus={false} onSubmit={() => { if (bo1.trim() && bo2.trim()) { if (isBlockedContent(bo1) || isBlockedContent(bo2)) { setBlocked(true); return; } goStep("criteria"); } }} maxLen={30} /></div>
              <Btn onClick={() => { if (isBlockedContent(bo1) || isBlockedContent(bo2)) { setBlocked(true); return; } goStep("criteria"); }} disabled={!bo1.trim() || !bo2.trim()} style={{ width: "100%", fontSize: 13, padding: "13px 28px", marginTop: 4 }}>Next</Btn>
            </div>
          </div>
          <ChipPicker storageKey="opt" usedNames={[bo1, bo2].filter(Boolean)} aiContext={{ dName, opts: [bo1,bo2].filter(Boolean).map(n=>({name:n})), crits: [], typed: (!bo2 ? bo2 : !bo1 ? bo1 : "") }} onPick={(name) => {
            if (!bo1.trim()) { setBo1(name); setTimeout(() => document.getElementById("binB")?.focus(), 50); }
            else if (!bo2.trim()) setBo2(name);
          }}
            aiContext={{ dName, opts: [{name: bo1}, {name: bo2}].filter(o => o.name), crits, typed: !bo1.trim() ? bo1 : bo2 }}
            onAiSuggestText={(txt) => { if (!bo1.trim()) setBo1(txt); else if (!bo2.trim()) setBo2(txt); }} />
        </FadeIn>
      );
    }

    if (step === "criteria") {
      const atMax = crits.length >= 10;
      const canAdd = newCrit.trim() && newImp !== null && !atMax;
      const has = crits.length > 0;
      // Next is blocked if: no criteria added, OR pending text with no importance selected
      const pendingIncomplete = newCrit.trim() !== "" && newImp === null;
      const nextBlocked = !has || pendingIncomplete;
      const showCont = has; // require at least 1 fully-added criterion to continue
      return (
        <FadeIn key="crits">
          <BackBtn onClick={goBack} />
          <Lbl>Criteria {has && <span style={{ color: C.sage, fontWeight: 600, transition: "all 0.3s ease", display: "inline-block", transform: addFlash === "criteria" ? "scale(1.2)" : "scale(1)" }}>{crits.length}/10</span>}</Lbl>
          <H size="md">{!has ? "Criteria for this decision" : "Add more or continue"}</H>
          <Sub>{!has ? "30 characters max. Pick suggestions or type your own." : atMax ? "You've reached the maximum." : "Add another, or continue."}</Sub>
          {!has && (
            <p style={{ fontFamily: F.b, fontSize: 10, color: C.accent, margin: "6px 0 2px", fontWeight: 500 }}>
              Add at least one criterion and select its importance to continue.
            </p>
          )}
          {has && crits.length <= 2 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "4px 0 6px" }}>
              {"\u2022"} 3–6 criteria is the sweet spot.
            </p>
          )}
          {has && <div style={{ marginBottom: 16 }}><CritRows items={crits} onRemove={(id) => setCrits(crits.filter((c) => c.id !== id))} lastAddedId={lastAddedCrit} /></div>}
          {!atMax && (
            <>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <TxtIn value={newCrit} onChange={setNewCrit} placeholder="" onSubmit={() => { if (canAdd) addCrit(); }} maxLen={30} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {IMPORTANCE.map((o) => {
                      const sel = newImp === o.value;
                      return (
                        <button key={o.value} onClick={() => setNewImp(o.value)}
                          style={{ fontFamily: F.b, fontSize: 11, fontWeight: sel ? 600 : 400, padding: "7px 0", borderRadius: 6, border: `1.5px solid ${sel ? C.accent : C.border}`, background: sel ? C.accent : "transparent", color: sel ? "#fff" : C.text, cursor: "pointer", transition: "all 0.15s", flex: 1 }}>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontFamily: F.b, fontSize: 8, color: C.muted, margin: "3px 0 0", opacity: 0.6 }}>High = dealbreaker · Low = nice-to-have</p>
                  {pendingIncomplete && <p style={{ fontFamily: F.b, fontSize: 10, color: C.error, margin: "5px 0 0" }}>Select an importance level to add this criterion.</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, paddingTop: 1 }}>
                  <Btn v="sage" onClick={() => addCrit()} disabled={!canAdd} style={{ padding: "12px 16px", fontSize: 13, whiteSpace: "nowrap" }}>
                    + Add
                  </Btn>
                  {showCont && (
                    <Btn onClick={() => { if (nextBlocked) return; const added = canAdd ? addCrit() : false; goFromCrits(added ? 1 : 0); }} disabled={nextBlocked} style={{ padding: "12px 16px", fontSize: 13, whiteSpace: "nowrap" }}>
                      Next
                    </Btn>
                  )}
                </div>
              </div>
              <ChipPicker storageKey="crit" usedNames={[...crits.map((cr) => cr.name), newCrit].filter(Boolean)} aiContext={{ dName, opts, crits, typed: newCrit }} onPick={(name) => { if (newImp !== null && crits.length < 10) { const cid = uid(); setCrits((p) => [...p, { id: cid, name: name.trim(), importance: newImp }]); setNewCrit(""); setRewardTick((t) => t + 1); setAddFlash("criteria"); setTimeout(() => setAddFlash(null), 800); setLastAddedCrit(cid); setTimeout(() => setLastAddedCrit(null), 1500); } else { setNewCrit(name); } }}
                aiContext={{ dName, opts, crits, typed: newCrit }}
                onAiSuggestText={(txt) => { if (!newCrit.trim()) setNewCrit(txt); }} />
            </>
          )}
          {atMax && <p style={{ fontFamily: F.b, fontSize: 12, color: C.taupe, margin: "4px 0" }}>Maximum 10 criteria. Remove one to add another.</p>}
          {atMax && showCont && (
            <div style={{ marginTop: 12 }}>
              <Btn onClick={() => { if (!nextBlocked) goFromCrits(); }} disabled={nextBlocked} style={{ width: "100%", fontSize: 15, padding: "14px 28px", fontWeight: 600 }}>
                Start comparing
              </Btn>
            </div>
          )}

        </FadeIn>
      );
    }

    // ─── GROUP SETUP (only in group mode, between criteria and compare) ───
    if (step === "groupsetup") {
      const doCreateNow = async () => {
        setGsCreating(true);
        const decisionData = dType === "binary"
          ? { name: dName, type: "binary", criteria: crits, binaryOption1: bo1, binaryOption2: bo2 }
          : { name: dName, type: "multi", criteria: crits, options: opts, baseOption: baseOpt };
        const code = await createGroup(decisionData, null, "Creator", groupExpiry);
        setGsCreating(false);
        if (!code) return;
        setGroupCode(code);
        try { await window.storage.set("unstuk_active_groupCode", code); } catch(e) {}
        setIsGroupMode(false);
        trackEvent("group");
        const exL = groupExpiry < 1 ? `${Math.round(groupExpiry*60)} mins` : groupExpiry <= 1 ? "1 hour" : groupExpiry <= 24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry/24)} days`;
        const msg = groupRequireCode
          ? `You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\nJoin code: ${code}\n\nOpen Unstuk → tap "Join with Code" → enter the code above.\n\nDeadline: ${exL}`
          : `You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\n\nOpen Unstuk and join this decision when prompted.\n\nDeadline: ${exL}`;
        setShareSheetData({ text: msg, title: "Invite to Team Decision", afterClose: () => setScreen("home") });
      };
      return (
        <FadeIn key="groupsetup">
          <BackBtn onClick={goBack} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: C.sageSoft, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>{"\uD83D\uDC65"}</span>
            <span style={{ fontFamily: F.b, fontSize: 11, fontWeight: 600, color: C.sage }}>Team Decision</span>
          </div>
          <H size="md">Create team decision</H>
          <Sub>Set a deadline and share with your team. Everyone scores independently.</Sub>

          <div style={{ marginTop: 20 }}>
            <Lbl>Response deadline</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[{ label: "15 min", val: 0.25 }, { label: "1 hour", val: 1 }, { label: "6 hours", val: 6 }, { label: "24 hours", val: 24 }, { label: "3 days", val: 72 }, { label: "1 week", val: 168 }].map((t) => (
                <button key={t.val} onClick={() => setGroupExpiry(t.val)}
                  style={{ fontFamily: F.b, fontSize: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${groupExpiry === t.val ? C.sage : C.border}`, background: groupExpiry === t.val ? C.sageSoft : "#fff", color: groupExpiry === t.val ? C.sage : C.text, fontWeight: groupExpiry === t.val ? 600 : 400, transition: "all 0.15s" }}>{t.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setGroupRequireCode(r => !r)}>
            <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0, background: groupRequireCode ? C.sage : C.accentLt, transition: "background 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: groupRequireCode ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
            <span style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>Require code to join</span>
          </div>
          {!groupRequireCode && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.muted, margin: "4px 0 0 46px", lineHeight: 1.4 }}>Anyone with the invite link can participate. Their data is completely isolated — they cannot see your history, analytics, or any other content.</p>
          )}

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setGroupHideIndiv(h => !h)}>
            <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", flexShrink: 0, background: groupHideIndiv ? C.sage : C.accentLt, transition: "background 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: groupHideIndiv ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
            <span style={{ fontFamily: F.b, fontSize: 12, color: C.text }}>Hide individual scores (group average only)</span>
          </div>

          <div style={{ marginTop: 20 }}>
            <Btn v="sage" onClick={doCreateNow} disabled={gsCreating} style={{ width: "100%", padding: "14px 28px", fontSize: 14 }}>
              {gsCreating ? "Creating…" : "Create & get share link →"}
            </Btn>
          </div>
        </FadeIn>
      );
    }

    if (step === "compare" && dType === "binary") {
      const cur = crits[bIdx];
      if (!cur) {
        if (!res) { setTimeout(() => setRes(scoreBin()), 0); return null; }
        /* Results ready */
                return <ResultsView results={res} dName={dName} critCount={crits.length} onDone={isGroupMode && groupCode ? async () => { const data = await loadGroupResults(groupCode); if (data) { setGroupData(data); setScreen("groupresults"); } else setScreen("home"); } : () => { setIsGroupMode(false); setScreen("home"); }} onBack={() => { setRes(null); setSavedId(null); setBCh((prev) => prev.slice(0, -1)); setBIdx(crits.length - 1); setBPick(null); }} onImmediate={saveImmediate} gutDoneExternal={resultsGutDone} setGutDoneExternal={setResultsGutDone} groupCreatedExternal={resultsGroupCreated} setGroupCreatedExternal={setResultsGroupCreated} groupErr={groupSubmitErr} setGroupExpiry={setGroupExpiry} groupExpiryVal={groupExpiry} setGroupHideIndiv={setGroupHideIndiv} groupHideIndivVal={groupHideIndiv} onOpenShareSheet={setShareSheetData} onGroup={!groupCode ? async () => { const code = await createGroup({ name: dName, type: "binary", criteria: crits, binaryOption1: bo1, binaryOption2: bo2 }, res, "Creator", groupExpiry); if (code) { setGroupCode(code); try { await window.storage.set("unstuk_active_groupCode", code); } catch(e) {} setIsGroupMode(false); trackEvent("group"); const exL = groupExpiry < 1 ? `${Math.round(groupExpiry*60)} mins` : groupExpiry<=1 ? "1 hour" : groupExpiry<=24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry/24)} days`; const msg = groupRequireCode ? `You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\nJoin code: ${code}\n\nOpen Unstuk → tap "Join with Code" → enter the code above.\n\nDeadline: ${exL}` : `You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\n\nOpen Unstuk and join this decision when prompted.\n\nDeadline: ${exL}`; setShareSheetData({ text: msg, title: "Invite to Team Decision" }); } } : null} />;

      }
      if (bPick === null) {
        return (
          <FadeIn key={`bc${bIdx}`}>
            <BackBtn onClick={goBack} />
            <Dots current={bIdx} total={crits.length} />
            <MicroReward tick={rewardTick} current={bIdx} total={crits.length} />
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 6, background: C.accentLt, marginBottom: 10 }}>
              <span style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.accent }}>{cur.name}</span>
            </div>
            <H size="md">Which is better for this?</H>
            <Sub>Or choose same if there's no difference.</Sub>
            {bIdx === 0 && (
              <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "2px 0 6px" }}>
                {"\u2022"} First instinct is best — the model corrects for noise.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
              <button onClick={() => { setBPick(1); triggerPulse(); }} className="ustk-touch"
                style={{ fontFamily: F.b, fontSize: 14, padding: "14px 20px", borderRadius: "8px 8px 0 0", border: bPick === 1 ? `2px solid ${C.sage}` : `1px solid ${C.border}`, borderBottom: "none", background: bPick === 1 ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box", transition: "all 0.15s" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{bo1}{bPick === 1 && <InlineReward show={true} />}</span>
              </button>
              <button onClick={() => {
                setBCh([...bCh, { cId: cur.id, opt: 0, adv: 0 }]);
                setAdvPicked("same"); setTimeout(() => { setBPick(null); setBIdx(bIdx + 1); setRewardTick((t) => t + 1); triggerPulse(); setAdvPicked(null); }, 500);
              }}
                className="ustk-touch" style={{ fontFamily: F.b, fontSize: 12, padding: "10px 20px", border: advPicked === "same" ? `2px solid ${C.sage}` : `1px solid ${C.border}`, background: advPicked === "same" ? C.sageSoft : C.bg, color: C.muted, cursor: "pointer", textAlign: "center", width: "100%", boxSizing: "border-box", letterSpacing: "0.04em", transition: "all 0.15s" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>Same — no difference{advPicked === "same" && <InlineReward show={true} />}</span>
              </button>
              <button onClick={() => { setBPick(2); triggerPulse(); }} className="ustk-touch"
                style={{ fontFamily: F.b, fontSize: 14, padding: "14px 20px", borderRadius: "0 0 8px 8px", border: bPick === 2 ? `2px solid ${C.sage}` : `1px solid ${C.border}`, borderTop: "none", background: bPick === 2 ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box", transition: "all 0.15s" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{bo2}{bPick === 2 && <InlineReward show={true} />}</span>
              </button>
            </div>
            <button onClick={() => { setBIdx(0); setBCh([]); setBPick(null); setStep("binaryopts"); }} style={{ fontFamily: F.b, fontSize: 11, color: C.border, background: "none", border: "none", cursor: "pointer", marginTop: 14, display: "block" }}>Edit criteria or options</button>
          </FadeIn>
        );
      }
      return (
        <FadeIn key={`ba${bIdx}`}>
          <BackBtn onClick={() => setBPick(null)} />
          <Dots current={bIdx} total={crits.length} />
          <MicroReward tick={rewardTick} current={bIdx} total={crits.length} />
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 6, background: C.accentLt, marginBottom: 10 }}>
            <span style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.accent }}>{cur.name}</span>
          </div>
          <H size="md">{(bPick === 1 ? bo1 : bo2)} is better</H>
          <Sub>By how much?</Sub>
          {bIdx === 0 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "2px 0 4px" }}>
              {"\u2022"} Slight = marginal. Strong = hard to justify the other on this alone.
            </p>
          )}
          <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
            {BIN_ADV.map((o, i) => (
              <button key={o.value} onClick={() => { setAdvPicked(o.value); setTimeout(() => { setBCh([...bCh, { cId: cur.id, opt: bPick, adv: o.value }]); setBPick(null); setBIdx(bIdx + 1); setRewardTick((t) => t + 1); triggerPulse(); setAdvPicked(null); }, 500); }}
                style={{
                  flex: 1, fontFamily: F.b, fontSize: 13, padding: "16px 8px",
                  border: `1px solid ${C.border}`,
                  borderLeft: i === 0 ? `1px solid ${C.border}` : "none",
                  borderRadius: i === 0 ? "8px 0 0 8px" : i === BIN_ADV.length - 1 ? "0 8px 8px 0" : "0",
                  background: advPicked === o.value ? C.sageSoft : "#fff", color: C.text, cursor: "pointer", textAlign: "center",
                  border: advPicked === o.value ? `2px solid ${C.sage}` : `1px solid ${C.border}`,
                  transition: "all 0.15s ease",
                }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{o.label}{advPicked === o.value && <InlineReward show={true} />}</span>
              </button>
            ))}
          </div>
        </FadeIn>
      );
    }

    if (step === "base") {
      return (
        <FadeIn key="base">
          <BackBtn onClick={goBack} />
          <Lbl>Starting point</Lbl>
          <H size="md">Which option is your default?</H>
          <Sub>Pick the option you'd go with right now, or the one requiring least change. Everything else gets compared against it.</Sub>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {opts.map((o, i) => (
              <FlatBtn key={o.id} label={<span style={{ display: "flex", alignItems: "center", gap: 6 }}>{o.name}{i === 0 ? " (suggested)" : ""}{baseOpt === o.id && <InlineReward show={true} />}</span>} onClick={() => {
                setBaseOpt(o.id);
                const pairs = []; opts.filter((x) => x.id !== o.id).forEach((op) => { crits.forEach((cr) => { pairs.push({ oId: op.id, cId: cr.id }); }); });
                setMPairs(pairs); setMIdx(0); setMCo([]); setTimeout(() => goStep("compare"), 500);
              }} />
            ))}
          </div>
        </FadeIn>
      );
    }

    if (step === "compare" && dType === "multi") {
      if (mIdx >= mPairs.length) {
        if (!res) { setTimeout(() => setRes(scoreMul()), 0); return null; }
        /* Multi results ready */
                return <ResultsView results={res} dName={dName} critCount={crits.length} onDone={isGroupMode && groupCode ? async () => { const data = await loadGroupResults(groupCode); if (data) { setGroupData(data); setScreen("groupresults"); } else setScreen("home"); } : () => { setIsGroupMode(false); setScreen("home"); }} onBack={() => { setRes(null); setSavedId(null); setMCo((prev) => prev.slice(0, -1)); setMIdx(mPairs.length - 1); }} onImmediate={saveImmediate} gutDoneExternal={resultsGutDone} setGutDoneExternal={setResultsGutDone} groupCreatedExternal={resultsGroupCreated} setGroupCreatedExternal={setResultsGroupCreated} groupErr={groupSubmitErr} setGroupExpiry={setGroupExpiry} groupExpiryVal={groupExpiry} setGroupHideIndiv={setGroupHideIndiv} groupHideIndivVal={groupHideIndiv} onOpenShareSheet={setShareSheetData} onGroup={!groupCode ? async () => { const code = await createGroup({ name: dName, type: "multi", criteria: crits, options: opts, baseOption: baseOpt }, res, "Creator", groupExpiry); if (code) { setGroupCode(code); try { await window.storage.set("unstuk_active_groupCode", code); } catch(e) {} setIsGroupMode(false); trackEvent("group"); const exL = groupExpiry < 1 ? `${Math.round(groupExpiry*60)} mins` : groupExpiry<=1 ? "1 hour" : groupExpiry<=24 ? `${groupExpiry} hours` : `${Math.round(groupExpiry/24)} days`; const msg = groupRequireCode ? `You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\nJoin code: ${code}\n\nOpen Unstuk → tap "Join with Code" → enter the code above.\n\nDeadline: ${exL}` : `You're invited to a team decision on Unstuk.\n\nDecision: ${dName}\n\nOpen Unstuk and join this decision when prompted.\n\nDeadline: ${exL}`; setShareSheetData({ text: msg, title: "Invite to Team Decision" }); } } : null} />;
      }
      const pair = mPairs[mIdx];
      const op = opts.find((o) => o.id === pair.oId);
      const cr = crits.find((c) => c.id === pair.cId);
      const bo = opts.find((o) => o.id === baseOpt);
      return (
        <FadeIn key={`mc${mIdx}`}>
          <BackBtn onClick={goBack} />
          <Dots current={mIdx} total={mPairs.length} />
          <MicroReward tick={rewardTick} current={mIdx} total={mPairs.length} />
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 6, background: C.accentLt, marginBottom: 10 }}>
            <span style={{ fontFamily: F.b, fontSize: 12, fontWeight: 500, color: C.accent }}>{cr.name}</span>
          </div>
          <H size="md">{op.name} vs {bo.name}</H>
          <Sub>How does the first compare to the second?</Sub>
          {mIdx === 0 && (
            <p style={{ fontFamily: F.b, fontSize: 9, color: C.border, margin: "2px 0 4px" }}>
              {"\u2022"} Compare only on this criterion — ignore everything else.
            </p>
          )}
          {/* Scale header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4, marginTop: 20 }}>
            <div style={{ maxWidth: "42%", textAlign: "left" }}>
              <div style={{ fontFamily: F.b, fontSize: 9, color: C.error, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Disadvantage</div>
              <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{op.name}</div>
            </div>
            <div style={{ fontFamily: F.b, fontSize: 9, color: C.muted, textAlign: "center" }}>Same</div>
            <div style={{ maxWidth: "42%", textAlign: "right" }}>
              <div style={{ fontFamily: F.b, fontSize: 9, color: C.sage, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Advantage</div>
              <div style={{ fontFamily: F.b, fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{op.name}</div>
            </div>
          </div>
          {/* Dot track */}
          <div style={{ position: "relative", marginTop: 6 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 10, height: 2, background: `linear-gradient(to right, ${C.error}50, ${C.border}40, ${C.sage}50)`, borderRadius: 1 }} />
            <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {MULTI_ADV.map((o) => {
                const picked = mAdvPicked === o.value;
                const isCentre = o.value === 0;
                const size = isCentre ? 14 : 20;
                const dotColor = picked ? C.sage : o.value < 0 ? `${C.error}60` : o.value > 0 ? `${C.sage}60` : C.border;
                const shortLabel = o.value === -3 ? "Major" : o.value === -2 ? "Mod." : o.value === -1 ? "Minor" : o.value === 0 ? "Same" : o.value === 1 ? "Minor" : o.value === 2 ? "Mod." : "Major";
                return (
                  <div key={o.value} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
                    <button onClick={() => { setMAdvPicked(o.value); setTimeout(() => { setMCo([...mCo, { oId: pair.oId, cId: pair.cId, adv: o.value }]); setMIdx(mIdx + 1); setRewardTick((t) => t + 1); triggerPulse(); setMAdvPicked(null); }, 500); }}
                      style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${picked ? C.sage : dotColor}`, background: picked ? C.sage : o.value < 0 ? `${C.error}15` : o.value > 0 ? `${C.sage}15` : "#fff", cursor: "pointer", padding: 0, flexShrink: 0, boxShadow: picked ? `0 0 0 4px ${C.sage}20` : "none", transition: "all 0.15s ease", position: "relative", zIndex: 1, marginTop: isCentre ? 3 : 0 }} />
                    <span style={{ fontFamily: F.b, fontSize: 8, color: picked ? C.sage : o.value < 0 ? C.error : o.value > 0 ? C.sage : C.muted, opacity: picked ? 1 : 0.6, transition: "all 0.15s", textAlign: "center", lineHeight: 1.1, fontWeight: picked ? 600 : 400 }}>{shortLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ textAlign: "center", minHeight: 22, marginTop: 8 }}>
            {mAdvPicked !== null
              ? <span style={{ fontFamily: F.b, fontSize: 12, color: C.sage, fontWeight: 600 }}>{MULTI_ADV.find(o => o.value === mAdvPicked)?.label} for {op.name} <InlineReward show={true} /></span>
              : <span style={{ fontFamily: F.b, fontSize: 10, color: C.border }}>Tap a dot to score</span>}
          </div>
          <button onClick={() => { setMIdx(0); setMCo([]); setStep("criteria"); }} style={{ fontFamily: F.b, fontSize: 11, color: C.border, background: "none", border: "none", cursor: "pointer", marginTop: 14, display: "block" }}>Edit criteria or options</button>
        </FadeIn>
      );
    }

    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F.b }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          {!isParticipant ? (
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.d, fontSize: 20, fontWeight: 600, color: C.text, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="10" height="10" viewBox="0 0 1024 1024" fill="none" style={{ opacity: 0.25 }}>
                <path d="M 476 248 A 272 272 0 1 0 548 248" stroke={C.accent} strokeWidth="16" fill="none" strokeLinecap="round" />
                <circle cx="512" cy="240" r="14" fill={C.sage} />
              </svg>
              Unstuk
            </button>
          ) : (
            <div style={{ fontFamily: F.d, fontSize: 20, fontWeight: 600, color: C.text, opacity: 0.5 }}>Unstuk</div>
          )}
          {!isParticipant && (
            <button onClick={() => setScreen("home")} style={{ fontFamily: F.b, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.55, transition: "opacity 0.15s", padding: "4px 0" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.55}>
              <span style={{ fontSize: 13 }}>⌂</span> Home
            </button>
          )}
        </div>
        {step !== "name" && dName && (
          <div style={{ fontFamily: F.b, fontSize: 12, color: C.muted, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>{dName}</div>
        )}
        <style>{touchStyle}</style>
        <Card style={selPulse ? { boxShadow: `0 0 16px ${C.sage}20`, borderColor: `${C.sage}30`, transition: "all 0.3s ease" } : { transition: "all 0.3s ease" }}>{renderStep()}</Card>
      </div>
      {shareSheetData && <ShareSheet text={shareSheetData.text} title={shareSheetData.title} onClose={() => { const ac = shareSheetData?.afterClose; setShareSheetData(null); if (ac) ac(); }} />}
    </div>
  );
}

export default function Unstuk() {
  return React.createElement(ErrorBoundary, null, React.createElement(UnstukInner));
}
