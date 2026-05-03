"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type User = {
  id: number;
  username: string;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}