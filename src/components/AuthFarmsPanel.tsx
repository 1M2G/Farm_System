import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { createFarmRecord, getFarmRecords, type FarmRecord } from "../services/integrations";
import { supabase } from "../services/supabase";

type AuthMode = "sign_in" | "sign_up";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export default function AuthFarmsPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [farmBusy, setFarmBusy] = useState(false);
  const [farmError, setFarmError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setFarms([]);
      setFarmError("");
      setAuthReady(true);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAuthError(errorMessage(error));
        setAuthReady(true);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setFarms([]);
      setFarmsLoading(false);
      return;
    }

    let active = true;
    setFarmsLoading(true);
    setFarmError("");
    getFarmRecords(accessToken)
      .then((records) => {
        if (active) setFarms(records);
      })
      .catch((error: unknown) => {
        if (active) setFarmError(errorMessage(error));
      })
      .finally(() => {
        if (active) setFarmsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      if (authMode === "sign_up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Account service returned no user.");
        if (data.session) setAuthMessage("Account created and signed in.");
        else setAuthMessage("If the account can be created, check your email to verify your address before signing in.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.session) throw new Error("Sign-in completed without an active session.");
        setAuthMessage("Signed in successfully.");
      }
      setPassword("");
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAuthMessage("Signed out.");
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const submitFarm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;

    setFarmBusy(true);
    setFarmError("");
    try {
      const farm = await createFarmRecord(session.access_token, farmName);
      setFarms((current) => [...current, farm]);
      setFarmName("");
    } catch (error) {
      setFarmError(errorMessage(error));
    } finally {
      setFarmBusy(false);
    }
  };

  return (
    <section className="card auth-farm-card">
      <p className="eyebrow">ACCOUNT & FARM ACCESS</p>
      <h2>Supabase account</h2>
      <p className="body-copy">Sign in to access farms stored securely with your account.</p>

      {!supabase ? (
        <p className="auth-notice" role="status">
          Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the backend dev server.
        </p>
      ) : !authReady ? (
        <p className="body-copy" role="status">Checking account session…</p>
      ) : session ? (
        <div className="auth-signed-in">
          <div className="auth-session-row">
            <p className="body-copy">Signed in as <strong>{session.user.email}</strong></p>
            <button type="button" className="secondary" onClick={signOut} disabled={authBusy}>
              {authBusy ? "Signing out…" : "Sign out"}
            </button>
          </div>
          <h3>Your farms</h3>
          {farmsLoading ? (
            <p className="body-copy" role="status">Loading farms…</p>
          ) : farms.length ? (
            <ul className="auth-farm-list">
              {farms.map((farm) => <li key={farm.id}>{farm.name}</li>)}
            </ul>
          ) : !farmError ? (
            <p className="body-copy">No farms are linked to this account yet.</p>
          ) : null}
          <form className="auth-farm-form" onSubmit={submitFarm}>
            <label>
              Create a farm
              <input
                value={farmName}
                onChange={(event) => setFarmName(event.target.value)}
                maxLength={100}
                required
                placeholder="e.g. Green Valley Farm"
              />
            </label>
            <button type="submit" className="primary" disabled={farmBusy}>
              {farmBusy ? "Creating…" : "Create farm"}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="auth-mode-switch" aria-label="Account action">
            <button type="button" className={authMode === "sign_in" ? "active" : ""} onClick={() => { setAuthMode("sign_in"); setAuthError(""); setAuthMessage(""); }}>
              Sign in
            </button>
            <button type="button" className={authMode === "sign_up" ? "active" : ""} onClick={() => { setAuthMode("sign_up"); setAuthError(""); setAuthMessage(""); }}>
              Create account
            </button>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={authMode === "sign_up" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <button type="submit" className="primary" disabled={authBusy}>
              {authBusy ? "Please wait…" : authMode === "sign_up" ? "Create account" : "Sign in"}
            </button>
          </form>
          {authMode === "sign_up" && <p className="body-copy">Email verification is required before signing in.</p>}
        </>
      )}

      {authMessage && <p className="auth-success" role="status">{authMessage}</p>}
      {authError && <p className="auth-error" role="alert">{authError}</p>}
      {farmError && <p className="auth-error" role="alert">{farmError}</p>}
    </section>
  );
}
