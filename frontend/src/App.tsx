import React, { useState } from "react";
import PrivateReshufflingPanel from "./components/PrivateReshufflingPanel";

type Mode = "generic" | "reshuffling";

function GenericPlaceholder() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Generic site-selection mode</h2>
      <p>
        Replace this placeholder with your existing 3-file workflow component.
        Do not delete your current generic mode. Keep it as the public/simple path.
      </p>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>("generic");

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb", color: "#111" }}>
      <header
        style={{
          padding: 20,
          borderBottom: "1px solid #ddd",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>GeoOps-Studio</h1>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button
              onClick={() => setMode("generic")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                cursor: "pointer",
                border: mode === "generic" ? "2px solid #222" : "1px solid #ccc",
                background: "#fff",
              }}
            >
              Generic mode
            </button>

            <button
              onClick={() => setMode("reshuffling")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                cursor: "pointer",
                border: mode === "reshuffling" ? "2px solid #222" : "1px solid #ccc",
                background: "#fff",
              }}
            >
              Reshuffling benchmark
            </button>
          </div>
        </div>
      </header>

      {mode === "generic" ? <GenericPlaceholder /> : <PrivateReshufflingPanel />}
    </div>
  );
}