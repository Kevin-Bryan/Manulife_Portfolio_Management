"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWebSocket } from "@/lib/ws-context";

// ─── Internal type (stable regardless of API shape) ───────────────────────────

type Transaction = {
  id: number;
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: string;
  transaction_type: "buy" | "sell";
  quantity: number;
  price_per_unit: number;
  total_value: number;
  transaction_date: string;
  notes?: string | null;
};

type SortField =
  | "transaction_date"
  | "symbol"
  | "transaction_type"
  | "quantity"
  | "price_per_unit"
  | "total_value";

type SortDir = "asc" | "desc";

// ─── Raw API response (unknown shape from DRF) ────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawTransaction = Record<string, any>;

// ─── Robust field resolver ────────────────────────────────────────────────────

function resolveField(
  raw: RawTransaction,
  candidates: string[],
  label: string
): unknown {
  for (const key of candidates) {
    if (raw[key] !== undefined && raw[key] !== null) {
      return raw[key];
    }
  }
  console.warn(
    `[TransactionHistory] Could not resolve field "${label}". ` +
      `Tried: ${candidates.join(", ")}. ` +
      `Available keys: ${Object.keys(raw).join(", ")}`
  );
  return undefined;
}

function resolveNumber(
  raw: RawTransaction,
  candidates: string[],
  label: string
): number {
  const val = resolveField(raw, candidates, label);
  const n = Number(val);
  if (isNaN(n)) {
    console.warn(
      `[TransactionHistory] Field "${label}" resolved to "${val}" which is NaN after Number().`
    );
    return 0;
  }
  return n;
}

function resolveString(
  raw: RawTransaction,
  candidates: string[],
  label: string
): string {
  const val = resolveField(raw, candidates, label);
  return val != null ? String(val) : "";
}

// ─── The adapter — maps any DRF response shape → stable Transaction ───────────

function normalizeTransaction(raw: RawTransaction): Transaction {
  const quantity = resolveNumber(
    raw,
    ["quantity", "qty", "shares", "units"],
    "quantity"
  );

  const price_per_unit = resolveNumber(
    raw,
    ["price_per_unit", "price", "unit_price", "price_each", "cost_per_unit", "rate"],
    "price_per_unit"
  );

  // ✅ Try every known API candidate first.
  // If the field is missing, null, or resolves to NaN/0, fall back to
  // quantity × price_per_unit so the column always shows a real number.
  const rawTotal = resolveField(
    raw,
    [
      "total_value",
      "total",
      "value",
      "total_amount",
      "gross_value",
      "net_value",
      "cost",
      "amount",
    ],
    "total_value"
  );
  const resolvedTotal = rawTotal != null ? Number(rawTotal) : NaN;
  const total_value =
    !isNaN(resolvedTotal) && resolvedTotal !== 0
      ? resolvedTotal
      : quantity * price_per_unit;

  return {
    id: resolveNumber(raw, ["id"], "id"),

    asset_id: resolveNumber(
      raw,
      ["asset_id", "asset", "assetId"],
      "asset_id"
    ),

    symbol: resolveString(
      raw,
      ["symbol", "ticker", "asset_symbol"],
      "symbol"
    ),

    name: resolveString(
      raw,
      ["name", "asset_name", "company_name", "full_name"],
      "name"
    ),

    asset_type: resolveString(
      raw,
      ["asset_type", "type", "category", "asset_category"],
      "asset_type"
    ),

    transaction_type:
      (resolveString(
        raw,
        ["transaction_type", "type", "action", "order_type", "side"],
        "transaction_type"
      ) as "buy" | "sell") || "buy",

    quantity,
    price_per_unit,
    total_value,

    transaction_date: resolveString(
      raw,
      [
        "transaction_date",
        "date",
        "created_at",
        "timestamp",
        "trade_date",
        "executed_at",
      ],
      "transaction_date"
    ),

    notes:
      (resolveField(
        raw,
        ["notes", "note", "comment", "description"],
        "notes"
      ) as string | null | undefined) ?? null,
  };
}

// ─── Transaction History Page ─────────────────────────────────────────────────

export default function TransactionHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const { wsStatus, subscribe } = useWebSocket();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const wsConnected = wsStatus === "connected";

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell">("all");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");

  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>("transaction_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // ── WS subscription ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribe("holdings_updated", () => {
      setRefreshKey((k) => k + 1);
      setRefreshing(true);
    });
    return unsubscribe;
  }, [subscribe]);

  // ── Fetch transactions ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !user || !apiUrl) return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    let ignore = false;

    fetch(`${apiUrl}/portfolio/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch transactions");
        return res.json() as Promise<RawTransaction[]>;
      })
      .then((data) => {
        if (!ignore && data) {
          if (process.env.NODE_ENV === "development" && data.length > 0) {
            console.log("[TransactionHistory] raw tx[0]:", data[0]);
          }
          const normalized = data.map(normalizeTransaction);
          setDataError(null);
          setTransactions(normalized);
          setDataLoading(false);
          setRefreshing(false);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!ignore) {
          setDataError("Failed to load transactions.");
          setDataLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [user, loading, apiUrl, router, refreshKey]);

  // ── Derived asset types for dropdown ─────────────────────────────────────
  const assetTypes = useMemo(() => {
    const types = new Set(transactions.map((t) => t.asset_type));
    return Array.from(types)
      .filter((at): at is string => typeof at === "string" && at.length > 0)
      .sort();
  }, [transactions]);

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...transactions];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((t) => t.transaction_type === typeFilter);
    }

    if (assetTypeFilter !== "all") {
      result = result.filter((t) => t.asset_type === assetTypeFilter);
    }

    result.sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];

      if (sortField === "transaction_date") {
        valA = new Date(valA as string).getTime();
        valB = new Date(valB as string).getTime();
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [transactions, search, typeFilter, assetTypeFilter, sortField, sortDir]);

  // ── Pagination slice ──────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const buyCount = transactions.filter((t) => t.transaction_type === "buy").length;
  const sellCount = transactions.filter((t) => t.transaction_type === "sell").length;
  const totalBought = transactions
    .filter((t) => t.transaction_type === "buy")
    .reduce((s, t) => s + t.total_value, 0);
  const totalSold = transactions
    .filter((t) => t.transaction_type === "sell")
    .reduce((s, t) => s + t.total_value, 0);

  // ── Formatters ────────────────────────────────────────────────────────────
  const fmt = (v: number | string | null | undefined) => {
    const n = Number(v);
    if (isNaN(n)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  };

  const fmtDate = (d: string) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // ── Sort handler ──────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setAssetTypeFilter("all");
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <span style={{ color: "#d1d5db", marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ color: "#2563eb", marginLeft: "4px" }}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

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

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading) return <p style={{ padding: "2rem" }}>Loading...</p>;
  if (!user) return <p style={{ padding: "2rem" }}>Redirecting...</p>;
  if (!apiUrl) return <p style={{ padding: "2rem" }}>Missing NEXT_PUBLIC_API_URL</p>;

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
              onClick={() => router.push("/dashboard")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                fontSize: "0.875rem",
                padding: 0,
                marginBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              ← Back to Dashboard
            </button>
            <h1 style={{ fontSize: "2rem", margin: 0 }}>Transaction History</h1>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              <p style={{ ...mutedText, margin: 0 }}>
                All recorded transactions for <strong>{user.username}</strong>.
              </p>

              {/* ── WebSocket status badge ─────────────────────────────── */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: wsConnected ? "#dcfce7" : "#f3f4f6",
                  color: wsConnected ? "#16a34a" : "#6b7280",
                  border: `1px solid ${wsConnected ? "#bbf7d0" : "#e5e7eb"}`,
                }}
              >
              </span>

              {refreshing && (
                <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                  Refreshing…
                </span>
              )}
            </div>
          </div>

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
              alignSelf: "flex-end",
            }}
          >
            + Record Transaction
          </button>
        </header>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div style={cardStyle}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#6b7280", fontWeight: 500 }}>
              Total Transactions
            </p>
            <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#111827" }}>
              {dataLoading ? "—" : transactions.length}
            </p>
          </div>

          <div style={cardStyle}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#6b7280", fontWeight: 500 }}>
              Total Bought
            </p>
            <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#16a34a" }}>
              {dataLoading ? "—" : fmt(totalBought)}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#6b7280" }}>
              {dataLoading ? "" : `${buyCount} buy order${buyCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div style={cardStyle}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#6b7280", fontWeight: 500 }}>
              Total Sold
            </p>
            <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#dc2626" }}>
              {dataLoading ? "—" : fmt(totalSold)}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#6b7280" }}>
              {dataLoading ? "" : `${sellCount} sell order${sellCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div style={cardStyle}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#6b7280", fontWeight: 500 }}>
              Net Capital Deployed
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: 700,
                color: dataLoading
                  ? "#111827"
                  : totalBought - totalSold >= 0
                  ? "#2563eb"
                  : "#dc2626",
              }}
            >
              {dataLoading ? "—" : fmt(totalBought - totalSold)}
            </p>
          </div>
        </div>

        {/* ── Table Card ──────────────────────────────────────────────────── */}
        <div style={cardStyle}>

          {/* ── Filters ─────────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Search symbol or name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                flex: "1 1 200px",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "0.9rem",
                outline: "none",
                color: "#111827",
                background: "#fff",
              }}
            />

            <div style={{ display: "flex", gap: "0.35rem" }}>
              {(["all", "buy", "sell"] as const).map((t) => {
                const active = typeFilter === t;
                const activeBg =
                  t === "buy" ? "#dcfce7" : t === "sell" ? "#fee2e2" : "#2563eb";
                const activeColor =
                  t === "buy" ? "#16a34a" : t === "sell" ? "#dc2626" : "#ffffff";
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setTypeFilter(t);
                      setPage(1);
                    }}
                    style={{
                      padding: "0.45rem 0.9rem",
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: active ? "transparent" : "#e5e7eb",
                      fontWeight: 500,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      background: active ? activeBg : "#fff",
                      color: active ? activeColor : "#374151",
                      transition: "all 0.15s",
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                );
              })}
            </div>

            {assetTypes.length > 0 && (
              <select
                value={assetTypeFilter}
                onChange={(e) => {
                  setAssetTypeFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  color: "#374151",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Asset Types</option>
                {assetTypes.map((at) => (
                  <option key={at} value={at}>
                    {at.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            )}

            <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* ── States ───────────────────────────────────────────────────── */}
          {dataLoading ? (
            <p style={{ color: "#6b7280", padding: "2rem 0" }}>Loading transactions…</p>
          ) : dataError ? (
            <p style={{ color: "#dc2626" }}>{dataError}</p>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
              <p style={{ margin: 0, fontWeight: 500 }}>No transactions yet.</p>
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
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
              <p style={{ margin: 0, fontWeight: 500 }}>No transactions match your filters.</p>
              <button
                onClick={clearFilters}
                style={{
                  marginTop: "1rem",
                  background: "none",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  color: "#374151",
                  fontSize: "0.9rem",
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* ── Table ─────────────────────────────────────────────── */}
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "760px",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                      {(
                        [
                          ["Date",         "transaction_date", "left" ],
                          ["Symbol",       "symbol",           "left" ],
                          ["Name",          null,              "left" ],
                          ["Type",         "transaction_type", "left" ],
                          ["Quantity",     "quantity",         "right"],
                          ["Price / Unit", "price_per_unit",   "right"],
                          ["Total Value",  "total_value",      "right"],
                          ["Notes",         null,              "left" ],
                        ] as [string, SortField | null, "left" | "right"][]
                      ).map(([label, field, align]) => (
                        <th
                          key={label}
                          onClick={field ? () => handleSort(field) : undefined}
                          style={{
                            padding: "0.75rem 0.65rem",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            color: "#374151",
                            textAlign: align,
                            whiteSpace: "nowrap",
                            cursor: field ? "pointer" : "default",
                            userSelect: "none",
                          }}
                        >
                          {label}
                          {field && <SortIcon field={field} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((tx) => (
                      <tr
                        key={tx.id}
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
                            color: "#6b7280",
                            fontSize: "0.875rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtDate(tx.transaction_date)}
                        </td>
                        <td
                          style={{
                            padding: "0.85rem 0.65rem",
                            fontWeight: 700,
                            fontSize: "0.95rem",
                          }}
                        >
                          {tx.symbol}
                        </td>
                        <td
                          style={{
                            padding: "0.85rem 0.65rem",
                            color: "#374151",
                            fontSize: "0.9rem",
                          }}
                        >
                          {tx.name}
                        </td>
                        <td style={{ padding: "0.85rem 0.65rem" }}>
                          <span
                            style={{
                              background:
                                tx.transaction_type === "buy" ? "#dcfce7" : "#fee2e2",
                              color:
                                tx.transaction_type === "buy" ? "#16a34a" : "#dc2626",
                              borderRadius: "6px",
                              padding: "2px 10px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td
                          align="right"
                          style={{ padding: "0.85rem 0.65rem", fontWeight: 500 }}
                        >
                          {tx.quantity.toLocaleString("en-US", {
                            maximumFractionDigits: 6,
                          })}
                        </td>
                        <td
                          align="right"
                          style={{ padding: "0.85rem 0.65rem", color: "#374151" }}
                        >
                          {fmt(tx.price_per_unit)}
                        </td>
                        <td
                          align="right"
                          style={{
                            padding: "0.85rem 0.65rem",
                            fontWeight: 600,
                            color:
                              tx.transaction_type === "buy" ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {tx.transaction_type === "sell" ? "−" : "+"}
                          {fmt(tx.total_value)}
                        </td>
                        <td
                          style={{
                            padding: "0.85rem 0.65rem",
                            color: "#9ca3af",
                            fontSize: "0.85rem",
                            maxWidth: "140px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tx.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "1.25rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid #f1f5f9",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length}
                  </span>

                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      style={{
                        padding: "0.45rem 0.85rem",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        background: page === 1 ? "#f9fafb" : "#fff",
                        color: page === 1 ? "#9ca3af" : "#374151",
                        cursor: page === 1 ? "default" : "pointer",
                        fontWeight: 500,
                        fontSize: "0.85rem",
                      }}
                    >
                      ← Prev
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 5) p = i + 1;
                      else if (page <= 3) p = i + 1;
                      else if (page >= totalPages - 2) p = totalPages - 4 + i;
                      else p = page - 2 + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          style={{
                            padding: "0.45rem 0.75rem",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            background: page === p ? "#2563eb" : "#fff",
                            color: page === p ? "#fff" : "#374151",
                            cursor: "pointer",
                            fontWeight: 500,
                            fontSize: "0.85rem",
                            minWidth: "36px",
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      style={{
                        padding: "0.45rem 0.85rem",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        background: page === totalPages ? "#f9fafb" : "#fff",
                        color: page === totalPages ? "#9ca3af" : "#374151",
                        cursor: page === totalPages ? "default" : "pointer",
                        fontWeight: 500,
                        fontSize: "0.85rem",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}