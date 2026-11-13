import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./api";
import type { User } from "./types";
import "./Auth.css";

type Mode = "login" | "register";

interface AuthProps {
  onAuth: (user: User) => void;
}

function Auth({ onAuth }: AuthProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("oauth_error");

    if (oauthError) {
      setError(oauthError);
      params.delete("oauth_error");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`
      );
    }

    api.providers()
      .then(({ google }) => setGoogleEnabled(google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const user = mode === "login"
        ? await api.login(email, password)
        : await api.register(email, password);
      onAuth(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
  };

  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authBrand">
          <i className="fa-solid fa-circle-dot"></i>
          <h1>MAI</h1>
          <p>Your intelligent assistant</p>
        </div>

        <div className="authTabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "authTab active" : "authTab"}
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "authTab active" : "authTab"}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
        </div>

        <form className="authForm" onSubmit={submit}>
          <label className="authField">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="authField">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          {error && (
            <div className="authError" role="alert">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <button className="authSubmit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> Please wait
              </>
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="authDivider">
              <span>or</span>
            </div>
            <button
              type="button"
              className="googleBtn"
              onClick={() => {
                window.location.href = api.googleLoginUrl();
              }}
            >
              <i className="fa-brands fa-google"></i>
              Continue with Google
            </button>
          </>
        )}

        <p className="authHint">
          {mode === "login" ? "New here? Create an account to save your chats." : "Already have an account? Sign in instead."}
        </p>
      </div>
    </div>
  );
}

export default Auth;
