"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  absoluteApiUrl,
  fetchLocalBundles,
  fetchRequiredFiles,
  loadLocalBundle,
  uploadBundle,
} from "../api/privateBenchmark";
import type {
  BundleSummaryResponse,
  FigureEntry,
  RequiredFilesResponse,
} from "../types/privateBenchmark";
import VendorExplorerPanel from "./VendorExplorerPanel";

type BenchmarkTab = "overview" | "explorer" | "evidence" | "method";

type FileNote = {
  purpose: string;
  why: string;
  exactNameRequired?: boolean;
  exampleColumns?: string[];
  exampleRow?: Record<string, unknown>;
  note?: string;
};

function fmtInt(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString() : String(value ?? "—");
}

function fmtFloat(value: unknown, digits = 2): string {
  return typeof value === "number"
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : String(value ?? "—");
}

function humaniseFigureName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function StatCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{value}</div>
      {subValue ? <div className="mt-2 text-sm text-slate-600">{subValue}</div> : null}
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-800"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-3 align-top text-slate-700">
                    {typeof row[col] === "number"
                      ? Number(row[col]).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })
                      : String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FigureGallery({ figures }: { figures: FigureEntry[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedIndex(null);
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return (prev + 1) % figures.length;
        });
      }
      if (event.key === "ArrowLeft") {
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return (prev - 1 + figures.length) % figures.length;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, figures.length]);

  if (!figures.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        No figures available in this bundle.
      </div>
    );
  }

  const selectedFigure = selectedIndex !== null ? figures[selectedIndex] : null;

  function goPrev() {
    setSelectedIndex((prev) => {
      if (prev === null) return 0;
      return (prev - 1 + figures.length) % figures.length;
    });
  }

  function goNext() {
    setSelectedIndex((prev) => {
      if (prev === null) return 0;
      return (prev + 1) % figures.length;
    });
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {figures.map((fig, idx) => (
          <button
            key={fig.name}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {humaniseFigureName(fig.name)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Click to enlarge</div>
              </div>

              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition group-hover:bg-slate-100">
                Expand
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={absoluteApiUrl(fig.url)}
                alt={fig.name}
                className="h-[320px] w-full object-contain"
              />
            </div>
          </button>
        ))}
      </div>

      {selectedFigure ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="relative w-full max-w-7xl rounded-3xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">
                  {humaniseFigureName(selectedFigure.name)}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Figure {selectedIndex! + 1} of {figures.length}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Next →
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIndex(null)}
                  className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-white">
              <img
                src={absoluteApiUrl(selectedFigure.url)}
                alt={selectedFigure.name}
                className="max-h-[82vh] w-full object-contain"
              />
            </div>

            <div className="mt-3 text-xs text-slate-400">
              Tip: use ← / → to move between figures, Esc to close.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
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

const FILE_NOTES: Record<string, FileNote> = {
  "assignment_access_topk80_analysis.parquet": {
    purpose: "Vendor-level benchmark output",
    why: "Powers the Vendor Explorer, map view, and current-vs-optimised vendor metrics.",
    exactNameRequired: true,
    exampleColumns: [
      "vendor_id",
      "vendor_name",
      "main_cuisine",
      "vendor_orders_n",
      "baseline_current_cost_km",
      "assigned_cost_km",
      "improvement_km",
      "improvement_pct_vs_current",
      "current_access_node_id",
      "assigned_access_node_id",
    ],
    exampleRow: {
      vendor_id: 658411,
      vendor_name: "ALBAIK Downtown Burj Khalifa",
      main_cuisine: "fried chicken",
      vendor_orders_n: 167077,
      baseline_current_cost_km: 1008885.4,
      assigned_cost_km: 973421.2,
      improvement_km: 35464.2,
      improvement_pct_vs_current: 3.51,
      current_access_node_id: "11513814249",
      assigned_access_node_id: "792215041",
    },
    note: "Extra columns are fine, but the benchmark expects this exact filename in upload mode.",
  },
  "final_fairness_table_k80.csv": {
    purpose: "Fairness summary table",
    why: "Used to populate downside-tail and fairness snapshot metrics.",
    exactNameRequired: true,
    exampleColumns: [
      "vendors_n",
      "vendors_improved_n",
      "vendors_unchanged_n",
      "vendors_worse_n",
      "worse_le_-1pct",
      "worse_le_-5pct",
      "worse_le_-10pct",
      "improved_ge_5pct",
      "improved_ge_10pct",
      "median_improvement_pct",
    ],
    exampleRow: {
      vendors_n: 8787,
      vendors_improved_n: 5164,
      vendors_unchanged_n: 6,
      vendors_worse_n: 3617,
      "worse_le_-1pct": 1853,
      "worse_le_-5pct": 811,
      "worse_le_-10pct": 365,
      improved_ge_5pct: 1499,
      improved_ge_10pct: 685,
      median_improvement_pct: 0.000104,
    },
  },
  "final_headline_table_k80.csv": {
    purpose: "Headline benchmark KPIs",
    why: "Drives the overview cards and selected benchmark summary.",
    exactNameRequired: true,
    exampleColumns: [
      "chosen_K",
      "vendors_n",
      "baseline_total_cost_km",
      "optimised_total_cost_km",
      "total_improvement_km",
      "improvement_pct",
      "baseline_avg_km_per_order_overall",
      "optimised_avg_km_per_order_overall",
      "vendors_improved_n",
      "vendors_worse_n",
      "vendors_moved_access_node_n",
    ],
    exampleRow: {
      chosen_K: 80,
      vendors_n: 8787,
      baseline_total_cost_km: 172509456.0,
      optimised_total_cost_km: 162965666.0,
      total_improvement_km: 9543778.5,
      improvement_pct: 5.5323,
      baseline_avg_km_per_order_overall: 5.569234,
      optimised_avg_km_per_order_overall: 5.261126,
      vendors_improved_n: 5164,
      vendors_worse_n: 3617,
      vendors_moved_access_node_n: 6304,
    },
  },
  "final_k_sensitivity_table.csv": {
    purpose: "K-sensitivity comparison",
    why: "Used to compare K=40, K=80, and K=100 benchmark runs.",
    exactNameRequired: true,
    exampleColumns: [
      "K",
      "vendors_n",
      "improvement_pct",
      "total_improvement_km",
      "vendors_improved_n",
      "vendors_worse_n",
      "vendors_moved_access_node_n",
      "worse_le_-5pct",
      "worse_le_-10pct",
    ],
    exampleRow: {
      K: 80,
      vendors_n: 8787,
      improvement_pct: 5.532322,
      total_improvement_km: 9543778.0,
      vendors_improved_n: 5164,
      vendors_worse_n: 3617,
      vendors_moved_access_node_n: 6304,
      "worse_le_-5pct": 811,
      "worse_le_-10pct": 365,
    },
  },
  "final_section_conclusion_k80.txt": {
    purpose: "Method and interpretation notes",
    why: "Displayed in the Method tab for honest benchmark framing.",
    exactNameRequired: true,
    note: "This is a plain text file. No fixed columns are required, but the filename must match exactly in upload mode.",
  },
  "final_top_cuisines_k80.csv": {
    purpose: "Cuisine evidence table",
    why: "Used in the Evidence tab to show which cuisines contribute most to improvement.",
    exactNameRequired: true,
    exampleColumns: [
      "main_cuisine",
      "vendors_n",
      "total_improvement_km",
      "improvement_pct_total",
      "vendors_improved_n",
      "vendors_worse_n",
    ],
    exampleRow: {
      main_cuisine: "burgers",
      vendors_n: 524,
      total_improvement_km: 1314738.0,
      improvement_pct_total: 6.597954,
      vendors_improved_n: 332,
      vendors_worse_n: 191,
    },
  },
  "final_top_losers_k80.csv": {
    purpose: "Worst-performing vendors table",
    why: "Used in the Evidence tab to show the downside tail.",
    exactNameRequired: true,
    exampleColumns: [
      "vendor_name",
      "main_cuisine",
      "vendor_orders_n",
      "improvement_km",
      "improvement_pct_vs_current",
    ],
    exampleRow: {
      vendor_name: "Example Vendor",
      main_cuisine: "asian",
      vendor_orders_n: 1902,
      improvement_km: -63.8,
      improvement_pct_vs_current: -0.82,
    },
  },
  "final_top_winners_k80.csv": {
    purpose: "Best-performing vendors table",
    why: "Used in the Evidence tab to show the upside tail.",
    exactNameRequired: true,
    exampleColumns: [
      "vendor_name",
      "main_cuisine",
      "vendor_orders_n",
      "improvement_km",
      "improvement_pct_vs_current",
    ],
    exampleRow: {
      vendor_name: "Noon & Kabab, IBN Batutta Mall",
      main_cuisine: "iranian",
      vendor_orders_n: 5542,
      improvement_km: 4735.3,
      improvement_pct_vs_current: 15.71,
    },
  },
  "access_node_capacity_main.parquet": {
    purpose: "Access-node geometry and capacity",
    why: "Provides map coordinates and capacity context for current and optimised access assignments.",
    exactNameRequired: true,
    exampleColumns: [
      "site_snap_node_id",
      "access_capacity",
      "sites_at_access_node",
      "site_snap_lat",
      "site_snap_lng",
    ],
    exampleRow: {
      site_snap_node_id: "1049694274",
      access_capacity: 82,
      sites_at_access_node: 16,
      site_snap_lat: 25.081004,
      site_snap_lng: 55.207793,
    },
  },
  "baseline_current_vendor_costs_main_sym.parquet": {
    purpose: "Baseline cost table",
    why: "Useful for local debugging and benchmark diagnostics.",
    exactNameRequired: true,
    exampleColumns: [
      "vendor_id",
      "site_id_exact",
      "site_snap_node_id",
      "baseline_current_cost_km",
    ],
    exampleRow: {
      vendor_id: 658411,
      site_id_exact: "site_exact_000534",
      site_snap_node_id: "11513814249",
      baseline_current_cost_km: 1008885.4,
    },
  },
  "site_master_exact_main.parquet": {
    purpose: "Exact site master table",
    why: "Used for richer local bundle inspection and site-level debugging.",
    exactNameRequired: true,
    exampleColumns: [
      "site_id_exact",
      "site_lat",
      "site_lng",
      "site_capacity",
      "site_snap_node_id",
    ],
    exampleRow: {
      site_id_exact: "site_exact_000000",
      site_lat: 25.104846,
      site_lng: 55.168178,
      site_capacity: 74,
      site_snap_node_id: "8495990263",
    },
  },
  "vendor_access_cost_access_ids.parquet": {
    purpose: "Access-node index lookup",
    why: "Maps cost-matrix columns back to access-node ids.",
    exactNameRequired: true,
    exampleColumns: ["access_node_id", "access_col"],
    exampleRow: {
      access_node_id: "10001325454",
      access_col: 0,
    },
  },
  "vendor_access_cost_matrix_main_sym.npy": {
    purpose: "Benchmark cost matrix",
    why: "The core weighted network-cost matrix used by the reshuffling benchmark.",
    exactNameRequired: true,
    note: "This is a NumPy binary matrix, not a CSV. There is no row preview in the UI. The filename must match exactly in upload mode.",
  },
  "vendor_access_cost_vendor_ids.parquet": {
    purpose: "Vendor index lookup",
    why: "Maps cost-matrix rows back to vendor ids.",
    exactNameRequired: true,
    exampleColumns: ["vendor_id", "vendor_row"],
    exampleRow: {
      vendor_id: 658411,
      vendor_row: 3665,
    },
  },
  "vendor_current_site_main.parquet": {
    purpose: "Current vendor-site mapping",
    why: "Useful for local debugging of current assignment structure.",
    exactNameRequired: true,
    exampleColumns: ["vendor_id", "site_id_exact"],
    exampleRow: {
      vendor_id: 658411,
      site_id_exact: "site_exact_000534",
    },
  },
  "vendor_main_model.parquet": {
    purpose: "Vendor model table",
    why: "Provides vendor metadata, current restaurant coordinates, and core explorer fields.",
    exactNameRequired: true,
    exampleColumns: [
      "vendor_id",
      "vendor_name",
      "main_cuisine",
      "vendor_orders_n",
      "vendor_lat",
      "vendor_lng",
      "vendor_snap_node_id",
    ],
    exampleRow: {
      vendor_id: 658411,
      vendor_name: "ALBAIK Downtown Burj Khalifa",
      main_cuisine: "fried chicken",
      vendor_orders_n: 167077,
      vendor_lat: 25.196604,
      vendor_lng: 55.279385,
      vendor_snap_node_id: "11513814249",
    },
  },
  "vendor_to_site_exact_main.parquet": {
    purpose: "Vendor-to-site mapping",
    why: "Supports richer local debugging of exact site assignments.",
    exactNameRequired: true,
    exampleColumns: ["vendor_id", "site_id_exact"],
    exampleRow: {
      vendor_id: 658411,
      site_id_exact: "site_exact_000534",
    },
  },
};

function getFileNote(name: string): FileNote {
  return (
    FILE_NOTES[name] ?? {
      purpose: "Benchmark bundle asset",
      why: "Used by the reshuffling benchmark bundle.",
      exactNameRequired: true,
    }
  );
}

function FileNotesGrid({
  title,
  files,
}: {
  title: string;
  files: string[];
}) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="grid gap-3">
        {files.map((name) => {
          const note = getFileNote(name);
          return (
            <div key={name} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="font-mono text-xs text-slate-600">{name}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{note.purpose}</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">{note.why}</div>
              <div className="mt-2 text-xs text-slate-500">
                Filename must match exactly:{" "}
                <span className="font-semibold text-slate-700">
                  {note.exactNameRequired ? "Yes" : "No"}
                </span>
              </div>

              {note.note ? (
                <div className="mt-2 text-xs leading-6 text-slate-500">{note.note}</div>
              ) : null}

              {note.exampleColumns?.length || note.exampleRow ? (
                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">
                    Example structure
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
                    {note.exampleColumns?.length ? (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Example columns
                        </div>
                        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                          {note.exampleColumns.join(", ")}
                        </div>
                      </div>
                    ) : null}

                    {note.exampleRow ? (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Example row fragment
                        </div>
                        <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-700">
{JSON.stringify(note.exampleRow, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PrivateReshufflingPanel() {
  const [requiredFiles, setRequiredFiles] = useState<RequiredFilesResponse | null>(null);
  const [localBundles, setLocalBundles] = useState<string[]>([]);
  const [selectedLocalBundle, setSelectedLocalBundle] = useState("reshuffling_k80");
  const [uploadBundleName, setUploadBundleName] = useState("reshuffling_k80_upload");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [data, setData] = useState<BundleSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<BenchmarkTab>("overview");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("rbTab");
    if (tab === "overview" || tab === "explorer" || tab === "evidence" || tab === "method") {
      setActiveTab(tab);
    }
    const bundle = params.get("rbBundle");
    if (bundle) {
      setSelectedLocalBundle(bundle);
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [req, bundles] = await Promise.all([fetchRequiredFiles(), fetchLocalBundles()]);
        setRequiredFiles(req);
        setLocalBundles(bundles);

        if (bundles.includes(selectedLocalBundle)) {
          return;
        }
        if (bundles.includes("reshuffling_k80")) {
          setSelectedLocalBundle("reshuffling_k80");
        } else if (bundles.length > 0) {
          setSelectedLocalBundle(bundles[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialise reshuffling benchmark panel.");
      }
    }

    void bootstrap();
  }, [selectedLocalBundle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("rbTab", activeTab);
    if (data?.bundle_name) {
      params.set("rbBundle", data.bundle_name);
    } else if (selectedLocalBundle) {
      params.set("rbBundle", selectedLocalBundle);
    }
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [activeTab, data?.bundle_name, selectedLocalBundle]);

  const headline = data?.headline;
  const fairness = data?.fairness;
  const selectedK = Number(headline?.chosen_K ?? 80);

  const fairnessMinus1 = Number(fairness?.["worse_le_-1pct"] ?? 0);
  const fairnessMinus5 = Number(fairness?.["worse_le_-5pct"] ?? 0);
  const fairnessMinus10 = Number(fairness?.["worse_le_-10pct"] ?? 0);

  const chosenKRow = useMemo(
    () => data?.sensitivity.find((row) => Number(row.K) === selectedK) ?? null,
    [data?.sensitivity, selectedK]
  );

  async function handleLoadLocal() {
    if (!selectedLocalBundle) return;

    setLoading(true);
    setError("");

    try {
      const result = await loadLocalBundle(selectedLocalBundle);
      setData(result);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load local bundle.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadFiles.length) {
      setError("Choose the reshuffling bundle files first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await uploadBundle(uploadFiles, uploadBundleName);
      setData(result);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload bundle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-slate-900">Reshuffling benchmark</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Local bundle mode is the right development path. Upload mode exists for ad hoc private
            packages, but the benchmark is designed to run from a frozen bundle on disk.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-lg font-semibold text-slate-900">Load local bundle</div>
            <div className="grid gap-3">
              <select
                value={selectedLocalBundle}
                onChange={(e) => setSelectedLocalBundle(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
              >
                {localBundles.map((bundle) => (
                  <option key={bundle} value={bundle}>
                    {bundle}
                  </option>
                ))}
              </select>

              <button
                onClick={handleLoadLocal}
                disabled={loading || !selectedLocalBundle}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Loading…" : "Load local benchmark"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-lg font-semibold text-slate-900">Upload bundle</div>
            <div className="grid gap-3">
              <input
                type="text"
                value={uploadBundleName}
                onChange={(e) => setUploadBundleName(e.target.value)}
                placeholder="Bundle name"
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
              />

              <input
                type="file"
                multiple
                onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />

              <button
                onClick={handleUpload}
                disabled={loading || uploadFiles.length === 0}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Uploading…" : "Upload and load benchmark"}
              </button>
            </div>
          </div>
        </div>

        <details className="mt-5 rounded-2xl border border-slate-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
            Required and optional files
          </summary>

          <div className="space-y-4 px-4 pb-4 pt-1">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <div className="font-semibold">Important</div>
              <div className="mt-1">
                In upload mode, the benchmark expects the <span className="font-semibold">exact filenames</span> listed below.
                The loader matches files by name, not just by content. If a required file is renamed, upload mode may not recognise it.
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <FileNotesGrid
                title="Required upload files"
                files={requiredFiles?.upload_required_files ?? []}
              />

              <FileNotesGrid
                title="Optional local-dev model files"
                files={requiredFiles?.optional_model_files_for_local_dev ?? []}
              />
            </div>
          </div>
        </details>
      </section>

      {data && headline ? (
        <>
          <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-300">
                  Loaded bundle
                </div>
                <div className="mt-2 text-3xl font-bold">{data.bundle_name}</div>
                <div className="mt-2 text-sm text-slate-200">
                  Balanced benchmark selected at <span className="font-semibold">K = {selectedK}</span>
                </div>
              </div>

              <div className="max-w-xl text-sm leading-6 text-slate-200">
                K={selectedK} is the benchmark choice because it materially improves weighted
                road-network cost over K=40 while avoiding the heavier fairness tail seen at K=100.
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm leading-6 text-slate-100">
              This benchmark reports <span className="font-semibold">weighted shortest-path road-network cost</span>,
              not literal rider GPS distance. Figures shown here should be read as benchmark network-cost improvement
              under the graph model.
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
                Overview
              </TabButton>
              <TabButton active={activeTab === "explorer"} onClick={() => setActiveTab("explorer")}>
                Vendor Explorer
              </TabButton>
              <TabButton active={activeTab === "evidence"} onClick={() => setActiveTab("evidence")}>
                Evidence
              </TabButton>
              <TabButton active={activeTab === "method"} onClick={() => setActiveTab("method")}>
                Method
              </TabButton>
            </div>
          </section>

          {activeTab === "overview" ? (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <StatCard label="Chosen K" value={fmtInt(headline.chosen_K)} />
                <StatCard label="Vendors" value={fmtInt(headline.vendors_n)} />
                <StatCard
                  label="Weighted network cost improvement"
                  value={`${fmtFloat(headline.improvement_pct, 3)}%`}
                  subValue={`${fmtFloat(headline.total_improvement_km, 0)} weighted network km improved`}
                />
                <StatCard
                  label="Average weighted network km / order"
                  value={`${fmtFloat(headline.optimised_avg_km_per_order_overall, 3)} km`}
                  subValue={`Baseline ${fmtFloat(headline.baseline_avg_km_per_order_overall, 3)} km`}
                />
                <StatCard
                  label="Improved vendors"
                  value={fmtInt(headline.vendors_improved_n)}
                  subValue={`Worse vendors ${fmtInt(headline.vendors_worse_n)}`}
                />
                <StatCard
                  label="Moved vendors"
                  value={fmtInt(headline.vendors_moved_access_node_n)}
                  subValue={`Worse than -5%: ${fmtInt(fairnessMinus5)}`}
                />
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-xl font-semibold text-slate-900">K sensitivity</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Compare weighted road-network cost improvement against fairness downside across candidate set size.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {data.sensitivity.map((row) => {
                    const isChosen = Number(row.K) === selectedK;
                    return (
                      <div
                        key={row.K}
                        className={`rounded-2xl border p-5 ${
                          isChosen
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-900"
                        }`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          K = {row.K}
                        </div>
                        <div className="mt-3 text-3xl font-bold">
                          {fmtFloat(row.improvement_pct, 3)}%
                        </div>
                        <div className="mt-1 text-sm opacity-80">
                          {fmtFloat(row.total_improvement_km, 0)} weighted network km improved
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="opacity-70">Improved</div>
                            <div className="font-semibold">{fmtInt(row.vendors_improved_n as number)}</div>
                          </div>
                          <div>
                            <div className="opacity-70">Worsened</div>
                            <div className="font-semibold">{fmtInt(row.vendors_worse_n as number)}</div>
                          </div>
                          <div>
                            <div className="opacity-70">Moved</div>
                            <div className="font-semibold">{fmtInt(row.vendors_moved_access_node_n as number)}</div>
                          </div>
                          <div>
                            <div className="opacity-70">Worse than -10%</div>
                            <div className="font-semibold">{fmtInt(Number(row["worse_le_-10pct"] ?? 0))}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-xl font-semibold text-slate-900">Fairness snapshot</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    The benchmark is globally efficient in weighted road-network terms rather than individually fair,
                    so the downside tail still matters.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <StatCard label="Worse than -1%" value={fmtInt(fairnessMinus1)} />
                  <StatCard label="Worse than -5%" value={fmtInt(fairnessMinus5)} />
                  <StatCard label="Worse than -10%" value={fmtInt(fairnessMinus10)} />
                  <StatCard label="Improved ≥ 5%" value={fmtInt(Number(fairness?.improved_ge_5pct ?? 0))} />
                  <StatCard label="Improved ≥ 10%" value={fmtInt(Number(fairness?.improved_ge_10pct ?? 0))} />
                  <StatCard
                    label="Median improvement %"
                    value={fmtFloat(Number(fairness?.median_improvement_pct ?? 0), 4)}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-900">Selected benchmark summary</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Why K={selectedK} remains the benchmark choice.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">Objective outcome</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      K={selectedK} delivers {fmtFloat(chosenKRow?.improvement_pct, 3)}% improvement,
                      equivalent to {fmtFloat(chosenKRow?.total_improvement_km, 0)} weighted network km
                      of benchmark improvement.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">Fairness trade-off</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      At K={selectedK}, {fmtInt(fairnessMinus5)} vendors worsen by more than 5% and{" "}
                      {fmtInt(fairnessMinus10)} worsen by more than 10%, even though the overall weighted
                      network objective improves.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">Interpretation</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      This is a graph-based shortest-path benchmark over snapped demand and access locations.
                      It is operationally meaningful, but it should not be read as literal rider GPS distance saved.
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "explorer" ? (
            <VendorExplorerPanel bundleName={data.bundle_name} source={data.source} />
          ) : null}

          {activeTab === "evidence" ? (
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-900">Figures</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Static benchmark figures generated offline and served from the local bundle. Click any figure to enlarge it.
                  </p>
                </div>
                <FigureGallery figures={data.figures} />
              </section>

              <section className="grid gap-6 xl:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-slate-900">Top cuisines</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Largest contribution to system-wide improvement by cuisine.
                    </p>
                  </div>
                  <SimpleTable
                    columns={[
                      "main_cuisine",
                      "vendors_n",
                      "total_improvement_km",
                      "improvement_pct_total",
                      "vendors_improved_n",
                      "vendors_worse_n",
                    ]}
                    rows={data.top_cuisines.slice(0, 12) as Array<Record<string, unknown>>}
                  />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-slate-900">Top winners</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Vendors with the strongest absolute gains under the selected benchmark.
                    </p>
                  </div>
                  <SimpleTable
                    columns={[
                      "vendor_name",
                      "main_cuisine",
                      "vendor_orders_n",
                      "improvement_km",
                      "improvement_pct_vs_current",
                    ]}
                    rows={data.top_winners.slice(0, 12) as Array<Record<string, unknown>>}
                  />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-slate-900">Top losers</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Vendors with the strongest downside under the selected benchmark.
                    </p>
                  </div>
                  <SimpleTable
                    columns={[
                      "vendor_name",
                      "main_cuisine",
                      "vendor_orders_n",
                      "improvement_km",
                      "improvement_pct_vs_current",
                    ]}
                    rows={data.top_losers.slice(0, 12) as Array<Record<string, unknown>>}
                  />
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "method" ? (
            <section className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Method</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">What is being optimised?</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      The objective is weighted shortest-path road-network cost over snapped demand and
                      access locations. This is stronger than straight-line displacement, but still a
                      benchmark abstraction rather than literal rider GPS traces.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">How should the map be read?</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      The vendor explorer map uses a visual connector between the current restaurant
                      location and the optimised assigned access node. That line is illustrative only
                      and is not the actual route used in the optimisation objective.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">Why K=80?</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      K=80 materially improves the weighted network objective over K=40 while keeping
                      the fairness downside more controlled than the more aggressive K=100 run.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">How should the headline be interpreted?</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      The benchmark improvement should be read as weighted network-cost reduction under
                      the graph model. It is meaningful, but it is not a direct claim about literal rider
                      kilometres driven in production.
                    </div>
                  </div>
                </div>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <details>
                  <summary className="cursor-pointer text-lg font-semibold text-slate-900">
                    Full conclusion notes
                  </summary>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">
                      {data.conclusion_text}
                    </pre>
                  </div>
                </details>
              </section>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}