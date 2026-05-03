"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageHandler = (payload: unknown) => void;

type WsContextValue = {
  wsStatus: string;
  wsError: string | null;
  clearError: () => void;
  sendMessage: (type: string, payload: object) => void;
  subscribe: (type: string, handler: MessageHandler) => () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const WsContext = createContext<WsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const socketRef = useRef<WebSocket | null>(null);

  // Handlers are stored in a ref so subscribe/unsubscribe never need to be
  // listed as Effect dependencies, and never trigger re-renders.
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());

  const [wsStatus, setWsStatus] = useState("idle");
  const [wsError, setWsError] = useState<string | null>(null);

  // Auto-dismiss error banner after 4 s
  useEffect(() => {
    if (!wsError) return;
    const t = setTimeout(() => setWsError(null), 4_000);
    return () => clearTimeout(t);
  }, [wsError]);

  // Open / close the socket whenever auth state settles
  useEffect(() => {
    if (loading || !user || !apiUrl) return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const wsUrl =
      apiUrl.replace(/^http/, "ws") +
      `/ws?token=${encodeURIComponent(token)}`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setWsStatus("connected");
      socket.send("ping");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          payload?: unknown;
        };

        // Fan-out to every subscriber registered for this message type
        handlersRef.current.get(data.type)?.forEach((h) => h(data.payload));

        if (data.type === "error") {
          const msg =
            (data.payload as { message?: string })?.message ??
            "An error occurred";
          setWsError(msg);
        }
      } catch {
        // Plain-text frames like "pong" — ignore
      }
    };

    socket.onclose = (event) => {
      setWsStatus(`closed (${event.code})`);
      if (event.code === 4001 || event.code === 1008) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    };

    socket.onerror = () => setWsStatus("error");

    return () => socket.close();
  }, [user, loading, router, apiUrl]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback((type: string, payload: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    } else {
      setWsError("WebSocket is not connected — please refresh.");
    }
  }, []);

  /**
   * Register a handler for a specific message type.
   * Returns an unsubscribe function — call it in a useEffect cleanup.
   */
  const subscribe = useCallback(
    (type: string, handler: MessageHandler): (() => void) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set());
      }
      handlersRef.current.get(type)!.add(handler);

      return () => {
        handlersRef.current.get(type)?.delete(handler);
      };
    },
    []
  );

  const clearError = useCallback(() => setWsError(null), []);

  return (
    <WsContext.Provider
      value={{ wsStatus, wsError, clearError, sendMessage, subscribe }}
    >
      {children}
    </WsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx)
    throw new Error("useWebSocket must be used inside <WebSocketProvider>");
  return ctx;
}