import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import GoogleAuthButton from "@/features/auth/GoogleAuthButton";
import { useAuth } from "@/shared/context/AuthContext";

// Only honor an internal, single-slash path — a query param is attacker-
// controlled input, and react-router's navigate() would otherwise happily be
// handed "//evil.com" or similar.
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const { login, loginWithGoogle } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/[0.06] rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-sm"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">SyncPro</span>
        </Link>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-7">
          <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-gray-400 mb-6">Sign in to your account to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Email or username</label>
              {/* type="text", not "email": the browser would reject a username as
                  malformed before the form could submit. */}
              <Input
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or your-username"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Password</label>
                <Link to="/reset-password" className="text-[11px] text-blue-400 hover:text-blue-300">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <GoogleAuthButton onCredential={handleGoogle} onError={setError} />

          <p className="text-sm text-gray-400 text-center mt-6">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
