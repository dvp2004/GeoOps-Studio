"use client";

import { useEffect, useState } from "react";
import GenericModePanel from "../components/GenericModePanel";
import PrivateReshufflingPanel from "../components/PrivateReshufflingPanel";

type Mode = "generic" | "reshuffling";

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("generic");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (modeParam === "generic" || modeParam === "reshuffling") {
      setMode(modeParam);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("mode", mode);
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [mode]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                GeoOps-Studio
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Geospatial optimisation workbench
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
                Public Generic Mode is the reusable 3-file optimisation workflow.
                Reshuffling Benchmark is the richer private benchmark surface backed by a non-public benchmark bundle.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ModeButton active={mode === "generic"} onClick={() => setMode("generic")}>
                Generic Mode
              </ModeButton>
              <ModeButton
                active={mode === "reshuffling"}
                onClick={() => setMode("reshuffling")}
              >
                Reshuffling Benchmark
              </ModeButton>
            </div>
          </div>
        </header>

        {mode === "generic" ? <GenericModePanel /> : <PrivateReshufflingPanel />}
      </div>
    </main>
  );
}