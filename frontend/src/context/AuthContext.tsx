import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  googleEnabled: boolean;
  signIn: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.me(), api.authConfig()]).then(([me, cfg]) => {
      if (cancelled) return;
      if (me.status === "fulfilled") setUser(me.value.user);
      if (cfg.status === "fulfilled") setGoogleEnabled(cfg.value.googleEnabled);
      setLoading(false);

      // Feedback after the OAuth redirect.
      const params = new URLSearchParams(window.location.search);
      const auth = params.get("auth");
      if (auth) {
        if (auth === "success" && me.status === "fulfilled" && me.value.user) {
          toast.success(`Welcome, ${me.value.user.name.split(" ")[0]}`);
        } else if (auth === "failed") {
          toast.error("Sign-in was cancelled or failed.");
        } else if (auth === "unavailable") {
          toast.error("Google sign-in is not configured on this server.");
        }
        params.delete("auth");
        const qs = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(() => {
    window.location.href = api.googleLoginUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
      setUser(null);
      toast.success("Signed out");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }, []);

  const value = useMemo(() => ({ user, loading, googleEnabled, signIn, logout }), [user, loading, googleEnabled, signIn, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
