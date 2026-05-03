import { WebSocketProvider } from "@/lib/ws-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WebSocketProvider>{children}</WebSocketProvider>;
}