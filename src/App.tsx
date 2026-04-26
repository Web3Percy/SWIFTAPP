import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DELORA_API_KEY = "ppk_80ca6ede16f0734ffd82f215c622e86efab59c36360967a06cd8aaea028240ec";
const DELORA_STRING = "SWIFTAPP";
const DELORA_FEE = 0.005; // 0.5%
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const DEFAULT_CHAIN = "base";

const CHAIN_NAMES = {
  "0x1": "Ethereum",
  "0x2105": "Base",
  "0xa4b1": "Arbitrum",
  "0xa": "Optimism",
  "0x89": "Polygon",
  "0x38": "BNB Chain",
};

const CHAIN_IDS = {
  ethereum: "0x1",
  base: "0x2105",
  arbitrum: "0xa4b1",
  optimism: "0xa",
  polygon: "0x89",
  bnb: "0x38",
};

const suggestions = [
  "Swap 50 USDC to ETH",
  "Bridge 0.1 ETH to Arbitrum",
  "Swap all my USDC to WBTC",
  "What can you do?",
];

// ─── Hare Logo SVG ────────────────────────────────────────────────────────────
const HareLogo = ({ size = 32, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="30" cy="42" rx="14" ry="10" fill={color} opacity="0.95" />
    <ellipse cx="38" cy="30" rx="9" ry="8" fill={color} opacity="0.95" />
    <ellipse cx="33" cy="14" rx="3" ry="10" fill={color} opacity="0.95" />
    <ellipse cx="41" cy="12" rx="2.5" ry="10" fill={color} opacity="0.95" transform="rotate(8 41 12)" />
    <circle cx="41" cy="28" r="1.5" fill="#00C2CC" />
    <circle cx="16" cy="44" r="4" fill={color} opacity="0.7" />
    <ellipse cx="20" cy="50" rx="6" ry="3" fill={color} opacity="0.85" transform="rotate(-20 20 50)" />
    <ellipse cx="36" cy="50" rx="4" ry="2.5" fill={color} opacity="0.85" transform="rotate(15 36 50)" />
  </svg>
);

// ─── Groq Intent Parser ───────────────────────────────────────────────────────
async function parseIntent(userMessage, currentChain) {
  const chainName = CHAIN_NAMES[currentChain] || "Base";

  const prompt = `You are a crypto intent parser. The user is currently on the ${chainName} network.
Extract swap/bridge/send intent from the user message.
Return ONLY a JSON object with these fields:
{
  "action": "swap" | "bridge" | "send" | "unknown",
  "fromToken": string or null,
  "toToken": string or null,
  "amount": string or null,
  "fromChain": string or null,
  "toChain": string or null,
  "toAddress": string or null,
  "reply": "A short friendly confirmation message to show the user (1 sentence)"
}

If action is unknown or it's a general question, set action to "unknown" and write a helpful reply explaining what Swift can do.
User message: "${userMessage}"`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Groq parse error:", err);
    return {
      action: "unknown",
      reply: "Sorry, I had trouble understanding that. Try something like 'Swap 50 USDC to ETH'.",
    };
  }
}

// ─── Delora Widget Initializer ────────────────────────────────────────────────
function initDeloraWidget(theme, intent) {
  if (typeof window.DeloraWidget === "undefined") {
    console.warn("Delora widget not loaded yet");
    return;
  }

  const config = {
    apiKey: DELORA_API_KEY,
    partnerString: DELORA_STRING,
    fee: DELORA_FEE,
    theme: theme,
    defaultChain: DEFAULT_CHAIN,
    containerId: "delora-widget-container",
  };

  if (intent?.fromToken) config.fromToken = intent.fromToken;
  if (intent?.toToken) config.toToken = intent.toToken;
  if (intent?.amount) config.amount = intent.amount;
  if (intent?.fromChain) config.fromChain = intent.fromChain;
  if (intent?.toChain) config.toChain = intent.toChain;

  window.DeloraWidget.init(config);
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hey! I'm Swift ⚡ Tell me what you'd like to do — just type naturally.\n\nTry: \"Swap 50 USDC to ETH\" or \"Bridge 0.1 ETH to Arbitrum\"",
    },
  ]);
  const [typing, setTyping] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [currentChain, setCurrentChain] = useState(DEFAULT_CHAIN);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Colors
  const bg = dark ? "#080810" : "#F0F4FF";
  const surface = dark ? "#0D1020" : "#FFFFFF";
  const surfaceAlt = dark ? "#131628" : "#F7F9FF";
  const border = dark ? "rgba(0,194,204,0.12)" : "rgba(10,31,255,0.1)";
  const text = dark ? "#E8F4F8" : "#0A0A1A";
  const textMuted = dark ? "rgba(232,244,248,0.45)" : "rgba(10,10,26,0.45)";
  const accent = "#00C2CC";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, showWidget]);

  // ── Wallet connection ──
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      addMessage("assistant", "No wallet detected. Please install MetaMask or another EVM wallet to continue.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setWalletAddress(accounts[0]);
      setCurrentChain(chainId);
      addMessage("assistant", `Wallet connected! You're on ${CHAIN_NAMES[chainId] || "an unknown network"}. What would you like to do?`);

      // Listen for chain changes
      window.ethereum.on("chainChanged", (newChain) => {
        setCurrentChain(newChain);
      });
      window.ethereum.on("accountsChanged", (accs) => {
        setWalletAddress(accs[0] || null);
      });
    } catch (err) {
      addMessage("assistant", "Wallet connection cancelled.");
    }
  }, []);

  const addMessage = (role, text) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  // ── Handle send ──
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    addMessage("user", trimmed);
    setInput("");
    setTyping(true);
    setShowWidget(false);

    const intent = await parseIntent(trimmed, currentChain);
    setTyping(false);

    addMessage("assistant", intent.reply || "Got it, opening the widget for you.");

    if (intent.action !== "unknown") {
      setShowWidget(true);
      setTimeout(() => initDeloraWidget(dark ? "dark" : "light", intent), 100);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const chainLabel = CHAIN_NAMES[currentChain] || "Base";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s", display: "flex", flexDirection: "column" }}>

      {/* Ambient glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: dark
          ? "radial-gradient(ellipse at 15% 15%, rgba(26,63,255,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(0,194,204,0.12) 0%, transparent 55%)"
          : "radial-gradient(ellipse at 15% 15%, rgba(26,63,255,0.07) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(0,194,204,0.05) 0%, transparent 55%)",
      }} />

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: dark ? "rgba(8,8,16,0.88)" : "rgba(240,244,255,0.88)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${border}`,
        padding: "0 20px", height: 62,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: "linear-gradient(135deg, #1A3FFF, #00C2CC)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(0,194,204,0.3)",
          }}>
            <HareLogo size={22} color="white" />
          </div>
          <span style={{
            fontSize: 19, fontWeight: 700, letterSpacing: "-0.4px",
            background: "linear-gradient(90deg, #1A3FFF, #00C2CC)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontFamily: "'Space Grotesk', sans-serif",
          }}>swift</span>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Theme toggle */}
          <button onClick={() => setDark(!dark)} style={{
            background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            border: `1px solid ${border}`, borderRadius: 20,
            padding: "6px 13px", color: text, fontSize: 12,
            cursor: "pointer", transition: "all 0.2s",
          }}>
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>

          {/* Chain badge — shown when wallet connected */}
          {walletAddress && (
            <div style={{
              background: surfaceAlt, border: `1px solid ${border}`,
              borderRadius: 20, padding: "6px 12px",
              fontSize: 12, color: accent, fontWeight: 600,
            }}>
              {chainLabel}
            </div>
          )}

          {/* Wallet button */}
          <button onClick={connectWallet} style={{
            background: walletAddress ? surfaceAlt : "linear-gradient(135deg, #1A3FFF, #00C2CC)",
            border: walletAddress ? `1px solid ${border}` : "none",
            borderRadius: 20, padding: "8px 16px",
            color: walletAddress ? text : "white",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            boxShadow: walletAddress ? "none" : "0 0 20px rgba(0,194,204,0.25)",
            transition: "all 0.2s",
          }}>
            {walletAddress ? shortAddress : "Connect Wallet"}
          </button>
        </div>
      </header>

      {/* ── Chat area ── */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        maxWidth: 700, width: "100%", margin: "0 auto",
        padding: "20px 16px 0", position: "relative", zIndex: 1,
      }}>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, paddingBottom: 12 }}>

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "fadeUp 0.3s ease forwards",
            }}>
              {msg.role === "assistant" && (
                <div style={{
                  width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                  background: "linear-gradient(135deg, #1A3FFF, #00C2CC)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginRight: 9, marginTop: 2,
                }}>
                  <HareLogo size={16} color="white" />
                </div>
              )}
              <div style={{
                maxWidth: "78%",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #1A3FFF, #0E2FCC)"
                  : surface,
                border: msg.role === "user" ? "none" : `1px solid ${border}`,
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding: "11px 15px",
                fontSize: 14, lineHeight: 1.65,
                color: msg.role === "user" ? "white" : text,
                whiteSpace: "pre-wrap",
                boxShadow: msg.role === "user"
                  ? "0 4px 20px rgba(26,63,255,0.25)"
                  : "0 2px 10px rgba(0,0,0,0.08)",
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                background: "linear-gradient(135deg, #1A3FFF, #00C2CC)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <HareLogo size={16} color="white" />
              </div>
              <div style={{
                background: surface, border: `1px solid ${border}`,
                borderRadius: "18px 18px 18px 4px", padding: "12px 16px",
                display: "flex", gap: 5, alignItems: "center",
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: accent,
                    animation: `bounce 1s ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Delora Widget container ── */}
          {showWidget && (
            <div style={{
              background: surface, border: `1px solid ${border}`,
              borderRadius: 20, overflow: "hidden",
              boxShadow: `0 0 30px rgba(0,194,204,0.1)`,
              animation: "fadeUp 0.4s ease forwards",
            }}>
              <div style={{
                padding: "12px 16px", borderBottom: `1px solid ${border}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: accent, boxShadow: `0 0 8px ${accent}`,
                }} />
                <span style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                  Powered by Delora
                </span>
              </div>
              {/* Delora mounts here */}
              <div id="delora-widget-container" style={{ minHeight: 300 }} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestion chips — show only at start */}
        {messages.length <= 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s)} style={{
                background: surfaceAlt, border: `1px solid ${border}`,
                borderRadius: 20, padding: "7px 13px",
                fontSize: 12, color: textMuted, cursor: "pointer",
                transition: "all 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textMuted; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{
          position: "sticky", bottom: 0,
          background: dark ? "rgba(8,8,16,0.92)" : "rgba(240,244,255,0.92)",
          backdropFilter: "blur(20px)",
          paddingTop: 10, paddingBottom: 20,
        }}>
          <div style={{
            display: "flex", gap: 10, alignItems: "center",
            background: surface, border: `1px solid ${border}`,
            borderRadius: 22, padding: "10px 10px 10px 18px",
            boxShadow: `0 0 30px rgba(0,194,204,0.07)`,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Swap 50 USDC to ETH on Base..."
              style={{
                flex: 1, background: "transparent", border: "none",
                outline: "none", fontSize: 14, color: text,
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 13, border: "none",
                background: input.trim()
                  ? "linear-gradient(135deg, #1A3FFF, #00C2CC)"
                  : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                color: input.trim() ? "white" : textMuted,
                cursor: input.trim() ? "pointer" : "default",
                fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", flexShrink: 0,
                boxShadow: input.trim() ? "0 4px 16px rgba(0,194,204,0.3)" : "none",
              }}
            >
              ↑
            </button>
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: textMuted, marginTop: 8 }}>
            Swift never stores your data or accesses your funds.
          </p>
        </div>
      </main>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        input::placeholder { color: rgba(128,148,180,0.5); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,194,204,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
      }
    
