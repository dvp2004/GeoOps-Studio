"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  downloadTextFile,
  runGenericBuiltInDemo,
  runGenericCompare,
} from "../api/genericMode";
import type { GenericMapPoint } from "./GenericPreviewMap";

const GenericPreviewMap = dynamic(() => import("./GenericPreviewMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
      Loading map…
    </div>
  ),
});

type CsvKind = "demand" | "current" | "candidate";
type GenericTab = "guide" | "workbench" | "map" | "results";

type CsvPreview = {
  filename: string;
  columns: string[];
  rowCount: number;
  sampleRows: Array<Record<string, string>>;
  missingRecommended: string[];
  points: GenericMapPoint[];
  validPointCount: number;
  invalidPointCount: number;
};

type SummaryCard = {
  currentCost?: number;
  optimisedCost?: number;
  absoluteImprovement?: number;
  improvementPct?: number;
  p?: number;
};

const SAMPLE_FILES = {
  demand: {
    path: "/samples/sample_demand.csv",
    filename: "sample_demand.csv",
  },
  current: {
    path: "/samples/sample_current_facilities.csv",
    filename: "sample_current_facilities.csv",
  },
  candidate: {
    path: "/samples/sample_candidate_facilities.csv",
    filename: "sample_candidate_facilities.csv",
  },
} as const;

const DEMAND_EXAMPLE_ROW = `id,lat,lng,weight
d_001,25.2048,55.2708,18`;

const CURRENT_EXAMPLE_ROW = `id,lat,lng
c_001,25.2055,55.2720`;

const CANDIDATE_EXAMPLE_ROW = `id,lat,lng
cand_001,25.1990,55.2605`;

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

function readBoolParam(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === "1" || value === "true";
}

function updateUrlParams(mutator: (params: URLSearchParams) => void) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  mutator(params);
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState({}, "", next);
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const escapeCsv = (value: unknown) => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ].join("\n");

  downloadTextFile(filename, csv);
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
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
      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
      {subValue ? <div className="mt-2 text-sm text-slate-600">{subValue}</div> : null}
    </div>
  );
}

function TabButton({
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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result.map((v) => v.trim());
}

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function findFirstKey(row: Record<string, string>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find((k) => k.toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

function buildPreview(
  rows: Array<Record<string, string>>,
  filename: string,
  kind: CsvKind
): CsvPreview {
  const firstRow = rows[0] ?? {};
  const columns = Object.keys(firstRow);

  const recommendedColumns =
    kind === "demand" ? ["id", "lat", "lng", "weight"] : ["id", "lat", "lng"];

  const missingRecommended = recommendedColumns.filter(
    (col) => !columns.some((c) => c.toLowerCase() === col.toLowerCase())
  );

  const latKey = findFirstKey(firstRow, ["lat", "latitude"]);
  const lngKey = findFirstKey(firstRow, ["lng", "lon", "longitude", "long"]);
  const idKey = findFirstKey(firstRow, ["id", "facility_id", "candidate_id", "demand_id", "name"]);
  const weightKey = findFirstKey(firstRow, ["weight", "demand", "population", "orders"]);

  let validPointCount = 0;
  let invalidPointCount = 0;

  const points: GenericMapPoint[] = rows
    .slice(0, 2000)
    .map((row, idx) => {
      const lat = latKey ? Number(row[latKey]) : NaN;
      const lng = lngKey ? Number(row[lngKey]) : NaN;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        invalidPointCount += 1;
        return null;
      }

      validPointCount += 1;

      const id = idKey ? row[idKey] : `${kind}_${idx + 1}`;
      const weight = weightKey ? Number(row[weightKey]) : undefined;

      return {
        id,
        label: id,
        lat,
        lng,
        weight: Number.isFinite(weight) ? weight : undefined,
      };
    })
    .filter((p): p is GenericMapPoint => p !== null);

  return {
    filename,
    columns,
    rowCount: rows.length,
    sampleRows: rows.slice(0, 5),
    missingRecommended,
    points,
    validPointCount,
    invalidPointCount,
  };
}

async function readPreviewFromFile(file: File, kind: CsvKind): Promise<CsvPreview> {
  const text = await file.text();
  const rows = parseCsvText(text);
  return buildPreview(rows, file.name, kind);
}

function getDeepValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractSummary(payload: Record<string, unknown>): SummaryCard {
  const summary = getDeepValue(payload, ["summary"]);

  if (typeof summary === "object" && summary !== null) {
    const obj = summary as Record<string, unknown>;

    const currentCost = getNumber(obj.current_total_cost);
    const optimisedCost = getNumber(obj.optimised_total_cost);
    const absoluteImprovement = getNumber(obj.absolute_improvement);
    const improvementPct = getNumber(obj.improvement_pct);
    const p = getNumber(obj.p);

    return {
      currentCost,
      optimisedCost,
      absoluteImprovement,
      improvementPct,
      p,
    };
  }

  const currentCost =
    getNumber(payload.current_total_cost) ??
    getNumber(payload.baseline_total_cost) ??
    getNumber(payload.current_total_weighted_cost) ??
    getNumber(payload.baseline_total_weighted_cost);

  const optimisedCost =
    getNumber(payload.optimised_total_cost) ??
    getNumber(payload.optimized_total_cost) ??
    getNumber(payload.p_median_total_cost) ??
    getNumber(payload.optimised_total_weighted_cost) ??
    getNumber(payload.optimized_total_weighted_cost);

  const absoluteImprovement =
    getNumber(payload.absolute_improvement) ??
    getNumber(payload.total_improvement) ??
    getNumber(payload.total_improvement_km) ??
    (typeof currentCost === "number" && typeof optimisedCost === "number"
      ? currentCost - optimisedCost
      : undefined);

  const improvementPct =
    getNumber(payload.improvement_pct) ??
    getNumber(payload.relative_improvement_pct) ??
    (typeof currentCost === "number" &&
    typeof optimisedCost === "number" &&
    currentCost !== 0
      ? ((currentCost - optimisedCost) / currentCost) * 100
      : undefined);

  const p =
    getNumber(payload.p) ??
    getNumber(payload.selected_facilities_n) ??
    getNumber(payload.optimised_facilities_n) ??
    getNumber(payload.optimized_facilities_n);

  return {
    currentCost,
    optimisedCost,
    absoluteImprovement,
    improvementPct,
    p,
  };
}

function extractOptimisedFacilities(payload: Record<string, unknown>): GenericMapPoint[] {
  const candidateLists = [
    getDeepValue(payload, ["optimised_facilities"]),
    getDeepValue(payload, ["selected_facilities"]),
  ];

  const rows = candidateLists.find(
    (value) => Array.isArray(value) && value.length > 0
  );

  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, idx) => {
      if (typeof row !== "object" || row === null) return null;
      const obj = row as Record<string, unknown>;

      const lat =
        typeof obj.lat === "number"
          ? obj.lat
          : typeof obj.lat === "string"
          ? Number(obj.lat)
          : typeof obj.latitude === "number"
          ? obj.latitude
          : typeof obj.latitude === "string"
          ? Number(obj.latitude)
          : NaN;

      const lng =
        typeof obj.lng === "number"
          ? obj.lng
          : typeof obj.lng === "string"
          ? Number(obj.lng)
          : typeof obj.lon === "number"
          ? obj.lon
          : typeof obj.lon === "string"
          ? Number(obj.lon)
          : typeof obj.longitude === "number"
          ? obj.longitude
          : typeof obj.longitude === "string"
          ? Number(obj.longitude)
          : typeof obj.long === "number"
          ? obj.long
          : typeof obj.long === "string"
          ? Number(obj.long)
          : NaN;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const id = String(
        obj.id ?? obj.facility_id ?? obj.candidate_id ?? `optimised_${idx + 1}`
      );
      const label = String(
        obj.label ??
          obj.name ??
          obj.id ??
          obj.facility_id ??
          obj.candidate_id ??
          `Optimised ${idx + 1}`
      );

      return {
        id,
        label,
        lat,
        lng,
      } satisfies GenericMapPoint;
    })
    .filter((p): p is GenericMapPoint => p !== null);
}

function exportJson(filename: string, payload: unknown) {
  const content = JSON.stringify(payload, null, 2);
  downloadTextFile(filename, content);
}

function PreviewTable({
  preview,
  title,
}: {
  preview: CsvPreview | null;
  title: string;
}) {
  if (!preview) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No file loaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-xs text-slate-500">
          Showing first {preview.sampleRows.length} row(s)
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-white">
            <tr>
              {preview.columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.sampleRows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                {preview.columns.map((col) => (
                  <td key={col} className="px-4 py-3 text-slate-700">
                    {row[col] ?? ""}
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

async function fetchPublicSampleAsFile(path: string, filename: string): Promise<File> {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch public sample file: ${filename}`);
  }

  const text = await response.text();

  return new File([text], filename, {
    type: "text/csv",
  });
}

function downloadPublicSample(path: string, filename: string) {
  const a = document.createElement("a");
  a.href = path;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function extractFacilityIdsForDebug(payload: Record<string, unknown>): string[] {
  const candidateLists = [
    getDeepValue(payload, ["optimised_facilities"]),
    getDeepValue(payload, ["selected_facilities"]),
  ];

  const rows = candidateLists.find(
    (value) => Array.isArray(value) && value.length > 0
  );

  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (typeof row !== "object" || row === null) return null;
      const obj = row as Record<string, unknown>;
      const id = obj.id ?? obj.facility_id ?? obj.candidate_id;
      return id != null ? String(id) : null;
    })
    .filter((v): v is string => Boolean(v));
}

function nowTimeString(): string {
  return new Date().toLocaleTimeString();
}

function InfoNote({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
      <div className="font-semibold">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function MetaBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

function SoftNote({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
      {children}
    </div>
  );
}

export default function GenericModePanel() {
  const [activeTab, setActiveTab] = useState<GenericTab>("guide");

  const [demandFile, setDemandFile] = useState<File | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [candidateFile, setCandidateFile] = useState<File | null>(null);

  const [demandPreview, setDemandPreview] = useState<CsvPreview | null>(null);
  const [currentPreview, setCurrentPreview] = useState<CsvPreview | null>(null);
  const [candidatePreview, setCandidatePreview] = useState<CsvPreview | null>(null);

  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastFacilityIds, setLastFacilityIds] = useState<string[]>([]);
  const [runInFlightLabel, setRunInFlightLabel] = useState<string | null>(null);

  const [p, setP] = useState(2);
  const [graphId, setGraphId] = useState("dubai_micro");

  const [showDemand, setShowDemand] = useState(true);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showCandidate, setShowCandidate] = useState(true);
  const [showOptimised, setShowOptimised] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [resultSource, setResultSource] = useState<"demo" | "upload" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const tab = params.get("gTab");
    if (tab === "guide" || tab === "workbench" || tab === "map" || tab === "results") {
      setActiveTab(tab);
    }

    const qp = Number(params.get("gP"));
    if (Number.isFinite(qp) && qp > 0) {
      setP(qp);
    }

    const qGraph = params.get("gGraph");
    if (qGraph) {
      setGraphId(qGraph);
    }

    setShowDemand(readBoolParam(params.get("gShowDemand"), true));
    setShowCurrent(readBoolParam(params.get("gShowCurrent"), true));
    setShowCandidate(readBoolParam(params.get("gShowCandidate"), true));
    setShowOptimised(readBoolParam(params.get("gShowOptimised"), true));
  }, []);

  useEffect(() => {
    updateUrlParams((params) => {
      params.set("gTab", activeTab);
      params.set("gP", String(p));
      params.set("gGraph", graphId);
      showDemand ? params.set("gShowDemand", "1") : params.delete("gShowDemand");
      showCurrent ? params.set("gShowCurrent", "1") : params.delete("gShowCurrent");
      showCandidate ? params.set("gShowCandidate", "1") : params.delete("gShowCandidate");
      showOptimised ? params.set("gShowOptimised", "1") : params.delete("gShowOptimised");
    });
  }, [activeTab, p, graphId, showDemand, showCurrent, showCandidate, showOptimised]);

  useEffect(() => {
    if (currentPreview?.rowCount && Number.isFinite(currentPreview.rowCount)) {
      setP(currentPreview.rowCount);
    }
  }, [currentPreview?.rowCount]);

  const summary = useMemo(() => (result ? extractSummary(result) : null), [result]);
  const optimisedFacilities = useMemo(
    () => (result ? extractOptimisedFacilities(result) : []),
    [result]
  );

  const validationReady = Boolean(demandFile && currentFile && candidateFile);

  const currentRows = currentPreview?.rowCount ?? 0;
  const candidateRows = candidatePreview?.rowCount ?? 0;

  const fairComparePMatchesCurrent = currentRows > 0 ? p === currentRows : true;
  const candidateEnoughForP = candidateRows > 0 ? candidateRows >= p : true;

  const validationMessages = useMemo(() => {
    const msgs: Array<{ tone: "good" | "warn"; text: string }> = [];

    if (demandPreview) {
      if (demandPreview.missingRecommended.length) {
        msgs.push({
          tone: "warn",
          text: `Demand file is missing recommended columns: ${demandPreview.missingRecommended.join(", ")}.`,
        });
      } else {
        msgs.push({
          tone: "good",
          text: "Demand file contains the recommended columns.",
        });
      }

      if (demandPreview.invalidPointCount > 0) {
        msgs.push({
          tone: "warn",
          text: `Demand preview found ${demandPreview.invalidPointCount} row(s) with invalid or missing coordinates in the first 2,000 parsed rows.`,
        });
      }
    }

    if (currentPreview) {
      if (!fairComparePMatchesCurrent) {
        msgs.push({
          tone: "warn",
          text: `For fair current-vs-optimised comparison, p should equal the current facility count (${currentRows}).`,
        });
      } else {
        msgs.push({
          tone: "good",
          text: `p matches the current facility count (${currentRows}).`,
        });
      }
    }

    if (candidatePreview) {
      if (!candidateEnoughForP) {
        msgs.push({
          tone: "warn",
          text: `Candidate file has only ${candidateRows} row(s), which is less than p=${p}.`,
        });
      } else {
        msgs.push({
          tone: "good",
          text: `Candidate file has enough rows for p=${p}.`,
        });
      }

      if (candidatePreview.invalidPointCount > 0) {
        msgs.push({
          tone: "warn",
          text: `Candidate preview found ${candidatePreview.invalidPointCount} row(s) with invalid or missing coordinates in the first 2,000 parsed rows.`,
        });
      }
    }

    return msgs;
  }, [
    demandPreview,
    currentPreview,
    candidatePreview,
    fairComparePMatchesCurrent,
    currentRows,
    candidateEnoughForP,
    candidateRows,
    p,
  ]);

  const runChecklist = [
    {
      label: "Demand file loaded",
      ok: Boolean(demandPreview),
    },
    {
      label: "Current facilities loaded",
      ok: Boolean(currentPreview),
    },
    {
      label: "Candidate facilities loaded",
      ok: Boolean(candidatePreview),
    },
    {
      label: "p matches current count",
      ok: fairComparePMatchesCurrent,
    },
    {
      label: "Candidate rows cover p",
      ok: candidateEnoughForP,
    },
  ];

  async function handleFile(file: File | null, kind: CsvKind) {
    if (!file) {
      if (kind === "demand") {
        setDemandFile(null);
        setDemandPreview(null);
      } else if (kind === "current") {
        setCurrentFile(null);
        setCurrentPreview(null);
      } else {
        setCandidateFile(null);
        setCandidatePreview(null);
      }
      return;
    }

    const preview = await readPreviewFromFile(file, kind);

    if (kind === "demand") {
      setDemandFile(file);
      setDemandPreview(preview);
    } else if (kind === "current") {
      setCurrentFile(file);
      setCurrentPreview(preview);
      if (preview.rowCount > 0) {
        setP(preview.rowCount);
      }
    } else {
      setCandidateFile(file);
      setCandidatePreview(preview);
    }
  }

  async function loadSampleIntoWorkbench() {
    const [demand, current, candidate] = await Promise.all([
      fetchPublicSampleAsFile(SAMPLE_FILES.demand.path, SAMPLE_FILES.demand.filename),
      fetchPublicSampleAsFile(SAMPLE_FILES.current.path, SAMPLE_FILES.current.filename),
      fetchPublicSampleAsFile(SAMPLE_FILES.candidate.path, SAMPLE_FILES.candidate.filename),
    ]);

    const [dPrev, cPrev, candPrev] = await Promise.all([
      readPreviewFromFile(demand, "demand"),
      readPreviewFromFile(current, "current"),
      readPreviewFromFile(candidate, "candidate"),
    ]);

    setDemandFile(demand);
    setCurrentFile(current);
    setCandidateFile(candidate);

    setDemandPreview(dPrev);
    setCurrentPreview(cPrev);
    setCandidatePreview(candPrev);

    setP(cPrev.rowCount || 2);
    setError("");
    setActiveTab("workbench");
  }

  function clearWorkbench() {
    setDemandFile(null);
    setCurrentFile(null);
    setCandidateFile(null);
    setDemandPreview(null);
    setCurrentPreview(null);
    setCandidatePreview(null);
    setResult(null);
    setResultSource(null);
    setError("");
    setP(2);
  }

  async function handleRunDemo() {
    setLoading(true);
    setError("");
    setResult(null);
    setResultSource(null);
    setLastFacilityIds([]);
    setRunInFlightLabel("Running built-in demo…");
    setActiveTab("results");

    try {
      const payload = await runGenericBuiltInDemo();
      setResult(payload);
      setResultSource("demo");
      setLastRunAt(nowTimeString());
      setLastFacilityIds(extractFacilityIdsForDebug(payload));
      setRunInFlightLabel(null);
      setActiveTab("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Built-in demo failed.");
      setRunInFlightLabel(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunCompare() {
    if (!demandFile || !currentFile || !candidateFile) {
      setError("Upload demand, current facilities, and candidate facilities first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setResultSource(null);
    setLastFacilityIds([]);
    setRunInFlightLabel("Running uploaded current-vs-optimised compare…");
    setActiveTab("results");

    try {
      const payload = await runGenericCompare({
        demandFile,
        currentFile,
        candidateFile,
        p,
        graphId,
      });
      setResult(payload);
      setResultSource("upload");
      setLastRunAt(nowTimeString());
      setLastFacilityIds(extractFacilityIdsForDebug(payload));
      setRunInFlightLabel(null);
      setActiveTab("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Current-vs-optimised compare failed.");
      setRunInFlightLabel(null);
    } finally {
      setLoading(false);
    }
  }

  const mapDemand = demandPreview?.points ?? [];
  const mapCurrent = currentPreview?.points ?? [];
  const mapCandidate = candidatePreview?.points ?? [];
  const mapOptimised = optimisedFacilities;

  const optimisedFacilityRows = optimisedFacilities.map((point) => ({
    id: point.id ?? "",
    label: point.label ?? "",
    lat: point.lat,
    lng: point.lng,
  }));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Generic Mode"
        subtitle="Public 3-file workflow for current-vs-optimised comparison. Filenames do not need to match anything special here; the backend receives files by form field, not by uploaded filename."
      >
        <div className="flex flex-wrap gap-2">
          <TabButton active={activeTab === "guide"} onClick={() => setActiveTab("guide")}>
            Guide
          </TabButton>
          <TabButton active={activeTab === "workbench"} onClick={() => setActiveTab("workbench")}>
            Workbench
          </TabButton>
          <TabButton active={activeTab === "map"} onClick={() => setActiveTab("map")}>
            Map
          </TabButton>
          <TabButton active={activeTab === "results"} onClick={() => setActiveTab("results")}>
            Results
          </TabButton>
        </div>
      </SectionCard>

      {activeTab === "guide" ? (
        <div className="space-y-6">
            <SectionCard
              title="Public samples and built-in demo"
              subtitle="Use the built-in demo or load the public sample CSVs directly into the workbench."
            >
            <InfoNote title="About the public sample workflow">
              The built-in demo and sample CSVs are small public starter datasets for demonstrating
              the workflow. They are useful for testing the app, but they are not meant to represent
              real operational coverage, real private demand, or production-quality optimisation results.
            </InfoNote>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-lg font-semibold text-slate-900">Built-in demo</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use the existing demo route to test the public workflow instantly.
                </p>
                <button
                  type="button"
                  onClick={handleRunDemo}
                  disabled={loading}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "Running…" : "Run built-in demo"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-lg font-semibold text-slate-900">Sample starter workflow</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Either download the public templates or load them directly into the workbench.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPublicSample(SAMPLE_FILES.demand.path, SAMPLE_FILES.demand.filename)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Download demand template
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPublicSample(SAMPLE_FILES.current.path, SAMPLE_FILES.current.filename)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Download current template
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPublicSample(SAMPLE_FILES.candidate.path, SAMPLE_FILES.candidate.filename)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Download candidate template
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSampleIntoWorkbench()}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Load sample into workbench
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Schema guide"
            subtitle="This is the public guidance layer. It reduces stupid input mistakes before backend validation."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Demand CSV</div>
                <div className="mt-2 text-sm text-slate-600">
                  Recommended columns: <span className="font-mono">id, lat, lng, weight</span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-700">
{DEMAND_EXAMPLE_ROW}
                </pre>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Current facilities CSV</div>
                <div className="mt-2 text-sm text-slate-600">
                  Recommended columns: <span className="font-mono">id, lat, lng</span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-700">
{CURRENT_EXAMPLE_ROW}
                </pre>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Candidate facilities CSV</div>
                <div className="mt-2 text-sm text-slate-600">
                  Recommended columns: <span className="font-mono">id, lat, lng</span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-700">
{CANDIDATE_EXAMPLE_ROW}
                </pre>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "workbench" ? (
        <div className="space-y-6">
          <SectionCard
            title="Generic Mode workbench"
            subtitle="Upload the three public CSV inputs, inspect them, and run a current-vs-optimised comparison."
          >
            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className={error ? "mb-4" : "mb-4"}>
              <InfoNote title="Interpretation note">
                This public mode compares current facilities against candidate facilities using the
                uploaded CSVs and the selected graph. Result quality depends heavily on the quality,
                coverage, and realism of the uploaded data. The built-in sample files are illustrative only.
              </InfoNote>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadSampleIntoWorkbench()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Load sample into workbench
              </button>
              <button
                type="button"
                onClick={clearWorkbench}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Clear workbench
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Demand file</div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null, "demand")}
                  className="mt-3 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                {demandPreview ? (
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div>Filename: <span className="font-mono">{demandPreview.filename}</span></div>
                    <div>Rows: <span className="font-semibold">{fmtInt(demandPreview.rowCount)}</span></div>
                    <div>Valid coords in preview: <span className="font-semibold">{fmtInt(demandPreview.validPointCount)}</span></div>
                    <div>Invalid coords in preview: <span className="font-semibold">{fmtInt(demandPreview.invalidPointCount)}</span></div>
                    <div>Columns: <span className="font-mono">{demandPreview.columns.join(", ") || "—"}</span></div>
                    {demandPreview.missingRecommended.length ? (
                      <div className="text-amber-700">
                        Missing recommended columns: {demandPreview.missingRecommended.join(", ")}
                      </div>
                    ) : (
                      <div className="text-emerald-700">Recommended columns present.</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Current facilities file</div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null, "current")}
                  className="mt-3 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                {currentPreview ? (
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div>Filename: <span className="font-mono">{currentPreview.filename}</span></div>
                    <div>Rows: <span className="font-semibold">{fmtInt(currentPreview.rowCount)}</span></div>
                    <div>Valid coords in preview: <span className="font-semibold">{fmtInt(currentPreview.validPointCount)}</span></div>
                    <div>Invalid coords in preview: <span className="font-semibold">{fmtInt(currentPreview.invalidPointCount)}</span></div>
                    <div>Columns: <span className="font-mono">{currentPreview.columns.join(", ") || "—"}</span></div>
                    {currentPreview.missingRecommended.length ? (
                      <div className="text-amber-700">
                        Missing recommended columns: {currentPreview.missingRecommended.join(", ")}
                      </div>
                    ) : (
                      <div className="text-emerald-700">Recommended columns present.</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Candidate facilities file</div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null, "candidate")}
                  className="mt-3 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                {candidatePreview ? (
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div>Filename: <span className="font-mono">{candidatePreview.filename}</span></div>
                    <div>Rows: <span className="font-semibold">{fmtInt(candidatePreview.rowCount)}</span></div>
                    <div>Valid coords in preview: <span className="font-semibold">{fmtInt(candidatePreview.validPointCount)}</span></div>
                    <div>Invalid coords in preview: <span className="font-semibold">{fmtInt(candidatePreview.invalidPointCount)}</span></div>
                    <div>Columns: <span className="font-mono">{candidatePreview.columns.join(", ") || "—"}</span></div>
                    {candidatePreview.missingRecommended.length ? (
                      <div className="text-amber-700">
                        Missing recommended columns: {candidatePreview.missingRecommended.join(", ")}
                      </div>
                    ) : (
                      <div className="text-emerald-700">Recommended columns present.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Run settings</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    <div className="mb-1 font-medium">p</div>
                    <input
                      type="number"
                      min={1}
                      value={p}
                      onChange={(e) => setP(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    <div className="mb-1 font-medium">graph_id</div>
                    <input
                      type="text"
                      value={graphId}
                      onChange={(e) => setGraphId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                </div>

                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
                  For a fair current-vs-optimised compare, <span className="font-semibold">p should equal the number of current facilities</span>.
                  This panel auto-sets <span className="font-semibold">p</span> from the current file row count, but you can still override it.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Run checklist</div>
                <div className="mt-3 space-y-2">
                  {runChecklist.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-xl px-3 py-2 text-xs font-medium ${
                        item.ok
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border border-amber-200 bg-amber-50 text-amber-900"
                      }`}
                    >
                      {item.ok ? "✓" : "!"} {item.label}
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {validationMessages.length ? (
                    validationMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl px-3 py-2 text-xs leading-6 ${
                          msg.tone === "good"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border border-amber-200 bg-amber-50 text-amber-900"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      Upload files to see validation insights.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleRunCompare}
                  disabled={loading || !validationReady}
                  className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Running…" : "Run current vs optimised"}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Input previews"
            subtitle="Inspect the first few parsed rows before solving. This catches stupid formatting mistakes early."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <PreviewTable preview={demandPreview} title="Demand preview" />
              <PreviewTable preview={currentPreview} title="Current facilities preview" />
              <PreviewTable preview={candidatePreview} title="Candidate facilities preview" />
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "map" ? (
        <SectionCard
          title="Input and result map"
          subtitle="This map previews uploaded public inputs and overlays optimised facilities if the response exposes them."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showDemand}
                onChange={(e) => setShowDemand(e.target.checked)}
              />
              Show demand
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showCurrent}
                onChange={(e) => setShowCurrent(e.target.checked)}
              />
              Show current facilities
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showCandidate}
                onChange={(e) => setShowCandidate(e.target.checked)}
              />
              Show candidate facilities
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showOptimised}
                onChange={(e) => setShowOptimised(e.target.checked)}
              />
              Show optimised facilities
            </label>
          </div>

          <GenericPreviewMap
            demandPoints={mapDemand}
            currentPoints={mapCurrent}
            candidatePoints={mapCandidate}
            optimisedPoints={mapOptimised}
            showDemand={showDemand}
            showCurrent={showCurrent}
            showCandidate={showCandidate}
            showOptimised={showOptimised}
          />
        </SectionCard>
      ) : null}
      {activeTab === "results" ? (
        <div className="space-y-6">
          {loading && !result ? (
            <SectionCard
              title="Results"
              subtitle="The current run is in progress."
            >
              <SoftNote>
                {runInFlightLabel ?? "Running…"}
              </SoftNote>
            </SectionCard>
          ) : result ? (
            <>
              <SectionCard
                title="Result summary"
                subtitle="Review the optimisation outcome and exported outputs."
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  <MetaBadge>
                    Source: {resultSource === "demo" ? "Built-in demo" : "Uploaded files"}
                  </MetaBadge>
                  {lastRunAt ? <MetaBadge>Loaded at: {lastRunAt}</MetaBadge> : null}
                  {typeof summary?.p === "number" ? <MetaBadge>p = {fmtInt(summary.p)}</MetaBadge> : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Current cost"
                    value={fmtFloat(summary?.currentCost, 2)}
                  />
                  <StatCard
                    label="Optimised cost"
                    value={fmtFloat(summary?.optimisedCost, 2)}
                  />
                  <StatCard
                    label="Absolute improvement"
                    value={fmtFloat(summary?.absoluteImprovement, 2)}
                  />
                  <StatCard
                    label="Improvement %"
                    value={
                      typeof summary?.improvementPct === "number"
                        ? `${fmtFloat(summary.improvementPct, 2)}%`
                        : "—"
                    }
                  />
                </div>

                <div className="mt-5">
                  <InfoNote title="How to read this result">
                    These public-mode results reflect the uploaded sample or user-provided CSV inputs
                    and the selected graph configuration. They are useful for comparing scenarios, but
                    they are not the same thing as a private benchmark built from richer operational data.
                  </InfoNote>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportJson("generic_mode_result.json", result)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Download response JSON
                  </button>

                  {optimisedFacilityRows.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv("generic_mode_optimised_facilities.csv", optimisedFacilityRows)
                      }
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      Download optimised facilities CSV
                    </button>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard
                title="Optimised facilities"
                subtitle="Facilities selected by the optimiser from the available candidate set."
              >
                {optimisedFacilityRows.length ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            {["id", "label", "lat", "lng"].map((col) => (
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
                          {optimisedFacilityRows.slice(0, 100).map((row, idx) => (
                            <tr
                              key={`${row.id}_${idx}`}
                              className="border-b border-slate-100 last:border-b-0"
                            >
                              <td className="px-4 py-3 text-slate-700">{String(row.id)}</td>
                              <td className="px-4 py-3 text-slate-700">{String(row.label)}</td>
                              <td className="px-4 py-3 text-slate-700">{fmtFloat(row.lat, 5)}</td>
                              <td className="px-4 py-3 text-slate-700">{fmtFloat(row.lng, 5)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <SoftNote>
                    This result did not expose a usable optimised facility coordinate list, so the facility
                    table is unavailable for this run.
                  </SoftNote>
                )}
              </SectionCard>

              <SectionCard
                title="Run details"
                subtitle="Available for inspection without dominating the main results."
              >
                <details className="rounded-2xl border border-slate-200">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
                    Expand technical run details
                  </summary>
                  <div className="space-y-4 px-4 pb-4 pt-2">
                    <div className="flex flex-wrap gap-2">
                      <MetaBadge>
                        Result source: {resultSource === "demo" ? "Built-in demo" : "Uploaded files"}
                      </MetaBadge>
                      {lastRunAt ? <MetaBadge>Loaded at: {lastRunAt}</MetaBadge> : null}
                      {lastFacilityIds.length ? (
                        <MetaBadge>Facility IDs: {lastFacilityIds.join(", ")}</MetaBadge>
                      ) : null}
                    </div>

                    <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700">
      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </details>
              </SectionCard>
            </>
          ) : (
            <SectionCard
              title="Results"
              subtitle="No result loaded yet."
            >
              <SoftNote>
                Run the built-in demo or upload the three public CSV inputs in the workbench first.
              </SoftNote>
            </SectionCard>
          )}
        </div>
      ) : null}
    </div>
  );
}