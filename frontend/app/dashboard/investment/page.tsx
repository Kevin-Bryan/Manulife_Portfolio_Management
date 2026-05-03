"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWebSocket } from "@/lib/ws-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type Asset = {
  id: number;
  symbol: string;
  name: string;
  asset_type: string;
  sector: string | null;
  current_price: number;
};

type Holding = {
  id: number;
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: string;
  sector: string | null;
  quantity: number;
  average_purchase_price: number;
  current_price: number;
  market_value: number;
  cost_basis: number;
  gain_loss: number;
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "1rem",
};

const modalBoxStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  padding: "1.5rem",
  width: "100%",
  maxWidth: "440px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "0.9rem",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "4px",
};

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  fontWeight: 600,
  cursor: "pointer",
};

// ─── Add / Record Transaction Modal ──────────────────────────────────────────

function AddInvestmentModal({
  assets,
  onClose,
  onSend,
}: {
  assets: Asset[];
  onClose: () => void;
  onSend: (type: string, payload: object) => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [txType, setTxType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  const selectedAsset = assets.find((a) => a.id === Number(assetId));

  const handleAssetChange = (value: string) => {
    setAssetId(value);
    const asset = assets.find((a) => a.id === Number(value));
    setPrice(asset ? String(asset.current_price) : "");
  };

  const total =
    quantity && price
      ? (Number(quantity) * Number(price)).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend("add_transaction", {
      asset_id: Number(assetId),
      transaction_type: txType,
      quantity: Number(quantity),
      price: Number(price),
    });
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 1.25rem 0", fontSize: "1.2rem" }}>
          Record Transaction
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>Asset</label>
            <select
              value={assetId}
              onChange={(e) => handleAssetChange(e.target.value)}
              required
              style={{ ...inputStyle, background: "white" }}
            >
              <option value="">Select asset…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Transaction Type</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["buy", "sell"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTxType(t)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    background:
                      txType === t
                        ? t === "buy"
                          ? "#16a34a"
                          : "#dc2626"
                        : "#f3f4f6",
                    color: txType === t ? "#fff" : "#374151",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Quantity</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              placeholder="0.0000"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Price per Unit
              {selectedAsset && (
                <span
                  style={{
                    fontWeight: 400,
                    color: "#9ca3af",
                    marginLeft: "6px",
                  }}
                >
                  (market: ${selectedAsset.current_price.toFixed(2)})
                </span>
              )}
            </label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              placeholder="0.0000"
              style={inputStyle}
            />
          </div>

          {total && (
            <div
              style={{
                background: "#f8fafc",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "0.9rem",
                color: "#6b7280",
              }}
            >
              Total:{" "}
              <strong style={{ color: "#111827" }}>${total}</strong>
            </div>
          )}

          <div
            style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}
          >
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
            <button type="submit" style={btnPrimary}>
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Investment Page ──────────────────────────────────────────────────────────

export default function InvestmentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const { wsStatus, wsError, clearError, sendMessage, subscribe } =
    useWebSocket();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

  // ── Subscribe to real-time holdings updates ───────────────────────────────
  useEffect(() => {
    return subscribe("holdings_updated", (payload) => {
      setHoldings(payload as Holding[]);
    });
  }, [subscribe]);

  // ── Initial data fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !user || !apiUrl) return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        setDataLoading(true);
        setDataError(null);

        const [holdingsRes, assetsRes] = await Promise.all([
          fetch(`${apiUrl}/portfolio/holdings`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiUrl}/portfolio/assets`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (holdingsRes.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }

        if (!holdingsRes.ok) throw new Error("Failed to fetch holdings");
        if (!assetsRes.ok) throw new Error("Failed to fetch assets");

        const [holdingsData, assetsData] = await Promise.all([
          holdingsRes.json(),
          assetsRes.json(),
        ]);

        setHoldings(holdingsData);
        setAssets(assetsData);
      } catch (err) {
        console.error(err);
        setDataError("Failed to load data.");
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, loading, router, apiUrl]);

  // ── Formatters ────────────────────────────────────────────────────────────
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(v);

  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "1.25rem",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  };

  if (loading) return <p style={{ padding: "2rem" }}>Loading...</p>;
  if (!user) return <p style={{ padding: "2rem" }}>Redirecting...</p>;
  if (!apiUrl)
    return <p style={{ padding: "2rem" }}>Missing NEXT_PUBLIC_API_URL</p>;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "2rem",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* ── Error Banner ───────────────────────────────────────────────── */}
        {wsError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "10px",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "#dc2626",
              fontWeight: 500,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>⚠ {wsError}</span>
            <button
              onClick={clearError}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#dc2626",
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header
          style={{
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                fontSize: "0.9rem",
                padding: 0,
                marginBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ← Back to Dashboard
            </button>
            <h1 style={{ fontSize: "1.75rem", margin: 0 }}>
              Manage Investments
            </h1>
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.95rem",
                marginTop: "0.5rem",
              }}
            >
              Add, edit, or remove your holdings. 
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Buy/Sell Investments
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard/transaction")}
              style={{
                backgroundColor: "#eb6025c6",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Transaction History
            </button>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "0.5rem 0.85rem",
                fontSize: "0.85rem",
                color: "#6b7280",
              }}
            >
              Live:{" "}
              <span
                style={{
                  fontWeight: 600,
                  color:
                    wsStatus === "connected"
                      ? "#16a34a"
                      : wsStatus === "error"
                      ? "#dc2626"
                      : "#374151",
                }}
              >
                {wsStatus}
              </span>
            </div>
          </div>
        </header>

        {/* ── Holdings Table ──────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <div style={{ marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Holdings</h2>
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.9rem",
                marginTop: "0.3rem",
              }}
            >
              {holdings.length} holding{holdings.length !== 1 ? "s" : ""}
            </p>
          </div>

          {dataLoading ? (
            <p style={{ color: "#6b7280" }}>Loading holdings...</p>
          ) : dataError ? (
            <p style={{ color: "#dc2626" }}>{dataError}</p>
          ) : holdings.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                color: "#6b7280",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
                📭
              </div>
              <p style={{ margin: 0, fontWeight: 500 }}>No holdings yet.</p>
              <p style={{ margin: "0.5rem 0 1.5rem", fontSize: "0.9rem" }}>
                Record your first transaction to get started.
              </p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                style={{
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Record Transaction
              </button>
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "860px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    background: "#f9fafb",
                  }}
                >
                  {[
                    ["Symbol", "left"],
                    ["Name", "left"],
                    ["Type", "left"],
                    ["Sector", "left"],
                    ["Quantity", "right"],
                    ["Avg. Buy Price", "right"],
                    ["Current Price", "right"],
                    ["Market Value", "right"],
                    ["Gain / Loss", "right"],
                  ].map(([label, align]) => (
                    <th
                      key={label}
                      align={align as "left" | "right"}
                      style={{
                        padding: "0.75rem 0.65rem",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: "#374151",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const perfPct =
                    holding.cost_basis > 0
                      ? (holding.gain_loss / holding.cost_basis) * 100
                      : 0;

                  return (
                    <tr
                      key={holding.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#f9fafb")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "0.85rem 0.65rem",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                        }}
                      >
                        {holding.symbol}
                      </td>
                      <td style={{ padding: "0.85rem 0.65rem" }}>
                        {holding.name}
                      </td>
                      <td style={{ padding: "0.85rem 0.65rem" }}>
                        <span
                          style={{
                            background: "#eff6ff",
                            color: "#2563eb",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                            textTransform: "capitalize",
                          }}
                        >
                          {holding.asset_type.replace("_", " ")}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "0.85rem 0.65rem",
                          color: "#6b7280",
                        }}
                      >
                        {holding.sector ?? "—"}
                      </td>
                      <td align="right" style={{ padding: "0.85rem 0.65rem" }}>
                        {holding.quantity}
                      </td>
                      <td align="right" style={{ padding: "0.85rem 0.65rem" }}>
                        {fmt(holding.average_purchase_price)}
                      </td>
                      <td align="right" style={{ padding: "0.85rem 0.65rem" }}>
                        {fmt(holding.current_price)}
                      </td>
                      <td
                        align="right"
                        style={{
                          padding: "0.85rem 0.65rem",
                          fontWeight: 600,
                        }}
                      >
                        {fmt(holding.market_value)}
                      </td>
                      <td
                        align="right"
                        style={{
                          padding: "0.85rem 0.65rem",
                          color:
                            holding.gain_loss >= 0 ? "#16a34a" : "#dc2626",
                          fontWeight: 600,
                        }}
                      >
                        <div>{fmt(holding.gain_loss)}</div>
                        <div style={{ fontSize: "0.82rem" }}>
                          {fmtPct(perfPct)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddInvestmentModal
          assets={assets}
          onClose={() => setShowAddModal(false)}
          onSend={sendMessage}
        />
      )}
    </main>
  );
}