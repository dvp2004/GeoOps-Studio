"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
};

export default function Home() {
  const [backendStatus, setBackendStatus] = useState("checking...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: HealthResponse = await res.json();
        setBackendStatus(data.status);
      })
      .catch((err: Error) => {
        setError(err.message);
        setBackendStatus("unreachable");
      });
  }, []);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">GeoOps Studio</h1>
        <p className="text-lg">
          Network-based facility placement and reassignment optimisation.
        </p>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold mb-2">System check</h2>
          <p>
            Backend status: <strong>{backendStatus}</strong>
          </p>
          {error && <p className="mt-2 text-sm">Error: {error}</p>}
        </div>
      </div>
    </main>
  );
}