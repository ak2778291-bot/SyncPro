// src/context/AuthContext.tsx
// Self-hosted auth (email/password + Google) — replaces Clerk.
// Holds the current user + JWT (persisted in localStorage) and exposes the
// same `user` / `isLoaded` shape the app previously consumed from Clerk.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getAuthToken,
  getMe,
  googleLogin as googleLoginRequest,
  login as loginRequest,
  setAuthToken,
  signup as signupRequest,
  type AuthResponse,
  type AuthUser,
} from "@/shared/api/client";

type AuthContextType = {
  user: AuthUser | null;
  userId: string | null;
  isLoaded: boolean;
  isAuthenticated: boolean;
  /** `identifier` is an email or a username. */
  login: (identifier: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name?: string,
    username?: string,
  ) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  /** Re-reads the account from the server. Network-dependent, so prefer
   * `markEmailVerified` for a fact the caller already has proof of. */
  refreshUser: () => Promise<void>;
  /** Flips `email_verified` locally, synchronously, no network round-trip.
   * For the moment right after `confirmEmailCode()` succeeds: the server has
   * already proven the account is verified, so re-deriving that fact from a
   * second fetch (which can silently fail — see `refreshUser`) would make the
   * UI's belief about verification depend on a call that doesn't need to
   * happen at all. */
  markEmailVerified: () => void;
  /** Replaces the cached user with one the server just returned. Same reason
   * `markEmailVerified` exists: the response to a successful profile save
   * already *is* the fresh user, so re-fetching it would be a second
   * round-trip that can fail and leave the UI stale after a save that
   * actually worked. */
  markProfileUpdated: (user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const applyAuth = useCallback((res: AuthResponse) => {
    setAuthToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  // On mount: if a token exists, rehydrate the session via /auth/me.
  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();
    if (!token) {
      setIsLoaded(true);
      return;
    }
    getMe()
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        // Expired/invalid token — clear it.
        if (!cancelled) {
          setAuthToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      applyAuth(await loginRequest({ identifier, password }));
    },
    [applyAuth],
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string, username?: string) => {
      applyAuth(await signupRequest({ email, password, name, username }));
    },
    [applyAuth],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      applyAuth(await googleLoginRequest(credential));
    },
    [applyAuth],
  );

  const refreshUser = useCallback(async () => {
    try {
      const { user: fresh } = await getMe();
      setUser(fresh);
    } catch {
      /* a failed refresh leaves the previous state; the banner simply stays */
    }
  }, []);

  const markEmailVerified = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, email_verified: true } : prev));
  }, []);

  const markProfileUpdated = useCallback((fresh: AuthUser) => {
    setUser(fresh);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id ?? null,
        isLoaded,
        isAuthenticated: !!user,
        login,
        signup,
        loginWithGoogle,
        refreshUser,
        markEmailVerified,
        markProfileUpdated,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
