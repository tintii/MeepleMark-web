import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiJson } from "../account/api";
import { useAccount } from "../account/accountState";
import { GroupedSection, PageHeader } from "../components/PageHeader";

export function Setup() {
  const navigate = useNavigate();
  const { refresh } = useAccount();
  const [required, setRequired] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiJson<{ setup: { required: boolean } }>("/api/v1/meta")
      .then((meta) => setRequired(meta.setup.required))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not check installation setup."));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmPassword")) { setError("Passwords do not match."); return; }
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/v1/setup/admin", { method: "POST", body: JSON.stringify({ username: data.get("username"), displayName: data.get("displayName") || undefined, password: data.get("password") }) });
      await refresh(true);
      navigate("/admin", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="page">
    <PageHeader title="Set up MeepleMark" subtitle="Create the administrator for this installation." />
    {error && <p className="form-error" role="alert">{error}</p>}
    {required === null ? <p role="status">Checking installation setup…</p> : required ? <GroupedSection title="Create the first administrator">
      <p>This account controls registration and other accounts. Complete setup while the server is private, before exposing it publicly.</p>
      <form onSubmit={submit}>
        <label className="field"><span className="field-label">Username</span><input name="username" autoComplete="username" minLength={3} maxLength={64} required /></label>
        <label className="field"><span className="field-label">Display name <span className="field-hint">(optional)</span></span><input name="displayName" autoComplete="name" maxLength={128} /></label>
        <label className="field"><span className="field-label">Password</span><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required /><span className="field-hint">Use at least 12 characters.</span></label>
        <label className="field"><span className="field-label">Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required /></label>
        <button disabled={busy || !navigator.onLine} type="submit">Create administrator</button>
        {!navigator.onLine && <p className="type-caption">Connect to this server to finish setup.</p>}
      </form>
    </GroupedSection> : <GroupedSection title="Setup complete">
      <p>This installation already has an account. First-run setup cannot be opened again.</p>
      <Link className="button-link" to="/account">Sign in</Link>
    </GroupedSection>}
  </div>;
}
