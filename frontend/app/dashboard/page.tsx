"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWebSocket } from "@/lib/ws-context";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const { wsStatus, wsError, clearError, subscribe } = useWebSocket();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

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

        const res = await fetch(`${apiUrl}/portfolio/holdings`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch holdings");

        setHoldings(await res.json());
      } catch (err) {
        console.error(err);
        setDataError("Failed to load portfolio data.");
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, loading, router, apiUrl]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalValue = holdings.reduce((s, h) => s + h.market_value, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost_basis, 0);
  const totalGainLoss = holdings.reduce((s, h) => s + h.gain_loss, 0);
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // ── Formatters ────────────────────────────────────────────────────────────
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(v);

  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  // ── Shared styles ─────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "1.25rem",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  };

  const mutedText: React.CSSProperties = {
    color: "#6b7280",
    fontSize: "0.95rem",
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
            <h1 style={{ fontSize: "2rem", margin: 0 }}>Portfolio Dashboard</h1>
            <p style={{ ...mutedText, marginTop: "0.5rem" }}>
              Welcome back, <strong>{user.username}</strong>. Here&apos;s an overview of
              your investments.
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
              onClick={() => router.push("/dashboard/investment")}
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
              Manage Investments
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

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {/* Total Value */}
          <div style={cardStyle}>
            <p
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.85rem",
                color: "#6b7280",
                fontWeight: 500,
              }}
            >
              Total Portfolio Value
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {dataLoading ? "—" : fmt(totalValue)}
            </p>
          </div>

          {/* Gain / Loss */}
          <div style={cardStyle}>
            <p
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.85rem",
                color: "#6b7280",
                fontWeight: 500,
              }}
            >
              Total Gain / Loss
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: 700,
                color: dataLoading
                  ? "#111827"
                  : totalGainLoss >= 0
                  ? "#16a34a"
                  : "#dc2626",
              }}
            >
              {dataLoading ? "—" : fmt(totalGainLoss)}
            </p>
            {!dataLoading && (
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: totalGainLoss >= 0 ? "#16a34a" : "#dc2626",
                }}
              >
                {fmtPct(totalGainLossPct)}
              </p>
            )}
          </div>

          {/* Cost Basis */}
          <div style={cardStyle}>
            <p
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.85rem",
                color: "#6b7280",
                fontWeight: 500,
              }}
            >
              Total Cost Basis
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {dataLoading ? "—" : fmt(totalCost)}
            </p>
          </div>

          {/* Holdings count */}
          <div style={cardStyle}>
            <p
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.85rem",
                color: "#6b7280",
                fontWeight: 500,
              }}
            >
              Holdings
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {dataLoading ? "—" : holdings.length}
            </p>
          </div>
        </div>

        {/* ── Holdings Overview Table ─────────────────────────────────────── */}
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>List of Investments</h2>

            </div>
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
                onClick={() => router.push("/dashboard/investment")}
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
                minWidth: "700px",
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
                    ["Market Value", "right"],
                    ["Gain / Loss", "right"],
                    ["Allocation", "right"],
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
                  const allocation =
                    totalValue > 0
                      ? (holding.market_value / totalValue) * 100
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
                      <td
                        align="right"
                        style={{
                          padding: "0.85rem 0.65rem",
                          color: "#6b7280",
                        }}
                      >
                        {allocation.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}