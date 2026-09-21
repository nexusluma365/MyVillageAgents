import { useEffect, useState } from "react";

const AUTH_KEY = "ai_village_auth_v1";
const USERNAME = "Admin";
const PASSWORD = "Millionaire1@";

export default function AuthGate({ children }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setIsAuthed(sessionStorage.getItem(AUTH_KEY) === "ok");
  }, []);

  if (isAuthed) return children;

  function handleSubmit(event) {
    event.preventDefault();
    if (username === USERNAME && password === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "ok");
      setIsAuthed(true);
      setError("");
      return;
    }
    setError("That login did not work.");
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-mark">🏘️</div>
        <div>
          <h1>AI Agent Village</h1>
          <p>Private command center</p>
        </div>
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit">Enter Village</button>
      </form>
    </main>
  );
}
