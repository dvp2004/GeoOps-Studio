"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type {
  AssignmentLine,
  DemandPoint,
  FacilityPoint,
} from "@/components/comparison-map";
import { API_BASE } from "@/lib/config";
import {
  downloadAssignmentsCsv,
  downloadComparisonJson,
  downloadFacilitySummaryCsv,
} from "@/lib/export";
import {
  downloadCandidateFacilitiesSample,
  downloadCurrentFacilitiesSample,
  downloadDemandSample,
  downloadDemandTemplate,
  downloadFacilityTemplate,
} from "@/lib/sample-files";

const ComparisonMap = dynamic(() => import("@/components/comparison-map"), {
  ssr: false,
});

type FileSummary = {
  file_kind: "demand" | "candidate";
  filename: string;
  row_count: number;
  columns: string[];
  preview_rows: Record<string, string | number>[];
};

type ValidationResponse = {
  demand: FileSummary;
  candidate: FileSummary;
};

type BaselineAssignmentRow = {
  demand_id: string;
  demand_weight: number;
  snapped_demand_node_id: string;
  assigned_candidate_id: string;
  assigned_candidate_node_id: string;
  weighted_cost_km: number;
};

type BaselineSolveResponse = {
  graph_id: string;
  demand_count: number;
  candidate_count: number;
  total_weighted_cost_km: number;
  assignment_rows: BaselineAssignmentRow[];
};

type ComparisonAssignmentRow = {
  demand_id: string;
  candidate_id: string;
  weighted_cost: number;
};

type CurrentVsOptimisedComparisonResponse = {
  p: number;
  current_facility_count: number;
  candidate_pool_count: number;
  baseline_total_weighted_cost: number;
  optimised_total_weighted_cost: number;
  improvement_pct: number;
  current_facility_ids: string[];
  selected_candidate_ids: string[];
  baseline_assignments: ComparisonAssignmentRow[];
  optimised_assignments: ComparisonAssignmentRow[];
  demand_points: DemandPoint[];
  current_facilities: FacilityPoint[];
  selected_facilities: FacilityPoint[];
  baseline_assignment_lines: AssignmentLine[];
  optimised_assignment_lines: AssignmentLine[];
};

type UploadFieldProps = {
  inputId: string;
  label: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
};

const cardClass = "rounded-3xl border border-slate-200 bg-white shadow-sm";
const subtleCardClass = "rounded-2xl border border-slate-200 bg-slate-50";
const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const buttonBase =
  "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const demoButtonClass = `${buttonBase} bg-indigo-600 text-white hover:bg-indigo-700`;
const primaryButtonClass = `${buttonBase} bg-slate-900 text-white hover:bg-slate-800`;
const compareButtonClass = `${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const secondaryButtonClass = `${buttonBase} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`;
const ghostButtonClass = `${buttonBase} border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200`;
const downloadButtonClass = `${buttonBase} border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200`;

function UploadField({
  inputId,
  label,
  description,
  file,
  onFileChange,
}: UploadFieldProps) {
  return (
    <div className={`${subtleCardClass} p-4 space-y-3`}>
      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-900">
          {label}
        </label>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      <input
        id={inputId}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={inputId} className={`${secondaryButtonClass} cursor-pointer`}>
          Choose CSV
        </label>

        <span className="text-sm text-slate-600">
          {file ? file.name : "No file selected"}
        </span>
      </div>
    </div>
  );
}

export default function GenericGeoOpsPage() {
  const [demandFile, setDemandFile] = useState<File | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [pValue, setPValue] = useState("");

  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [validationLabel, setValidationLabel] = useState("");
  const [baselineResult, setBaselineResult] = useState<BaselineSolveResponse | null>(null);
  const [comparisonResult, setComparisonResult] =
    useState<CurrentVsOptimisedComparisonResponse | null>(null);

  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "">("");

  const [validating, setValidating] = useState(false);
  const [baselineSolving, setBaselineSolving] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [runningDemo, setRunningDemo] = useState(false);

  const [fileInputKey, setFileInputKey] = useState(0);

  const anyBusy = validating || baselineSolving || comparing || runningDemo;

  function clearResults() {
    setBaselineResult(null);
    setComparisonResult(null);
  }

  function clearFeedback() {
    setError("");
    setStatusMessage("");
    setStatusTone("");
  }

  function resetAllMessages() {
    clearFeedback();
    setValidationResult(null);
    setValidationLabel("");
    clearResults();
  }

  function handleResetWorkspace() {
    setDemandFile(null);
    setCurrentFile(null);
    setCandidateFile(null);
    setPValue("");
    setValidationResult(null);
    setValidationLabel("");
    setBaselineResult(null);
    setComparisonResult(null);
    clearFeedback();
    setFileInputKey((prev) => prev + 1);
  }

  function setStatus(message: string, tone: "info" | "success") {
    setStatusMessage(message);
    setStatusTone(tone);
    setError("");
  }

  async function handleValidateFacilities(mode: "current" | "candidate") {
    clearFeedback();
    setValidationResult(null);
    setValidationLabel("");
    clearResults();

    if (!demandFile) {
      setError("Please upload the demand CSV.");
      return;
    }

    const facilityFile = mode === "current" ? currentFile : candidateFile;

    if (!facilityFile) {
      setError(
        mode === "current"
          ? "Please upload the current facilities CSV."
          : "Please upload the candidate facilities CSV."
      );
      return;
    }

    const formData = new FormData();
    formData.append("demand_file", demandFile);
    formData.append("candidate_file", facilityFile);

    try {
      setValidating(true);

      const response = await fetch(`${API_BASE}/validate-files`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Validation failed.");
      }

      setValidationResult(data);
      setValidationLabel(
        mode === "current"
          ? "Validated pair: demand + current facilities"
          : "Validated pair: demand + candidate pool"
      );
      setStatus(
        mode === "current"
          ? "Current facilities file validated successfully."
          : "Candidate pool file validated successfully.",
        "success"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setValidating(false);
    }
  }

  async function handleBaselineSolve() {
    clearFeedback();
    setBaselineResult(null);
    setComparisonResult(null);

    if (!demandFile || !currentFile) {
      setError("Please upload both the demand CSV and the current facilities CSV.");
      return;
    }

    const formData = new FormData();
    formData.append("demand_file", demandFile);
    formData.append("candidate_file", currentFile);
    formData.append("graph_id", "dubai_micro");

    try {
      setBaselineSolving(true);

      const response = await fetch(`${API_BASE}/solve-baseline`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Current baseline solve failed.");
      }

      setBaselineResult(data);
      setStatus("Current network baseline finished successfully.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setBaselineSolving(false);
    }
  }

  async function handleCompare() {
    clearFeedback();
    setComparisonResult(null);
    setBaselineResult(null);

    if (!demandFile || !currentFile || !candidateFile) {
      setError(
        "Please upload demand, current facilities, and candidate facilities CSV files."
      );
      return;
    }

    const parsedP = Number(pValue);

    if (!Number.isInteger(parsedP) || parsedP < 1) {
      setError("p must be a whole number greater than or equal to 1.");
      return;
    }

    const formData = new FormData();
    formData.append("demand_file", demandFile);
    formData.append("current_file", currentFile);
    formData.append("candidate_file", candidateFile);
    formData.append("graph_id", "dubai_micro");
    formData.append("p", String(parsedP));

    try {
      setComparing(true);

      const response = await fetch(`${API_BASE}/compare-current-vs-p-median`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Comparison run failed.");
      }

      setComparisonResult(data);
      setStatus("Current vs optimised comparison finished successfully.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setComparing(false);
    }
  }

  async function handleRunDemo() {
    clearFeedback();
    setValidationResult(null);
    setValidationLabel("");
    clearResults();

    try {
      setRunningDemo(true);

      const response = await fetch(`${API_BASE}/demo/current-vs-optimised`, {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Built-in demo run failed.");
      }

      setComparisonResult(data);
      setPValue(String(data.p));
      setStatus(
        "Built-in demo scenario loaded. Use this for quick smoke tests and screenshots.",
        "success"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setRunningDemo(false);
    }
  }

  function renderPreviewCard(summary: FileSummary, titleOverride?: string) {
    return (
      <div className={`${cardClass} p-6 space-y-4`}>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {titleOverride ?? `${summary.file_kind} file`}
          </h2>
          <p className="text-sm text-slate-600">
            {summary.filename} · {summary.row_count} rows
          </p>
        </div>

        <div>
          <p className="font-medium text-slate-900">Columns</p>
          <p className="text-sm text-slate-600">{summary.columns.join(", ")}</p>
        </div>

        <div className="overflow-x-auto">
          <p className="mb-2 font-medium text-slate-900">Preview</p>
          <table className="min-w-full border border-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {summary.columns.map((column) => (
                  <th key={column} className="border border-slate-200 px-3 py-2 text-left">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.preview_rows.map((row, index) => (
                <tr key={index}>
                  {summary.columns.map((column) => (
                    <td key={column} className="border border-slate-200 px-3 py-2 text-slate-700">
                      {String(row[column] ?? "")}
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

  function renderBaselineResults(result: BaselineSolveResponse) {
    return (
      <div className={`${cardClass} p-6 space-y-6`}>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-slate-900">Current network baseline</h2>
          <p className="text-sm text-slate-600">
            Graph: {result.graph_id} · Demand points: {result.demand_count} · Current facilities:{" "}
            {result.candidate_count}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Total weighted cost</p>
          <p className="text-2xl font-bold text-slate-900">
            {result.total_weighted_cost_km.toFixed(3)} km
          </p>
        </div>

        <div className="overflow-x-auto">
          <p className="mb-2 font-medium text-slate-900">Assignments</p>
          <table className="min-w-full border border-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border border-slate-200 px-3 py-2 text-left">Demand ID</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Weight</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Demand node</th>
                <th className="border border-slate-200 px-3 py-2 text-left">
                  Assigned current facility
                </th>
                <th className="border border-slate-200 px-3 py-2 text-left">Facility node</th>
                <th className="border border-slate-200 px-3 py-2 text-left">
                  Weighted cost (km)
                </th>
              </tr>
            </thead>
            <tbody>
              {result.assignment_rows.map((row) => (
                <tr key={row.demand_id}>
                  <td className="border border-slate-200 px-3 py-2">{row.demand_id}</td>
                  <td className="border border-slate-200 px-3 py-2">{row.demand_weight}</td>
                  <td className="border border-slate-200 px-3 py-2">{row.snapped_demand_node_id}</td>
                  <td className="border border-slate-200 px-3 py-2">{row.assigned_candidate_id}</td>
                  <td className="border border-slate-200 px-3 py-2">
                    {row.assigned_candidate_node_id}
                  </td>
                  <td className="border border-slate-200 px-3 py-2">
                    {row.weighted_cost_km.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderComparisonTable(title: string, rows: ComparisonAssignmentRow[]) {
    return (
      <div className="overflow-x-auto">
        <p className="mb-2 font-medium text-slate-900">{title}</p>
        <table className="min-w-full border border-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-200 px-3 py-2 text-left">Demand ID</th>
              <th className="border border-slate-200 px-3 py-2 text-left">Assigned facility</th>
              <th className="border border-slate-200 px-3 py-2 text-left">Weighted cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.demand_id}-${row.candidate_id}-${index}`}>
                <td className="border border-slate-200 px-3 py-2">{row.demand_id}</td>
                <td className="border border-slate-200 px-3 py-2">{row.candidate_id}</td>
                <td className="border border-slate-200 px-3 py-2">{row.weighted_cost.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderComparisonResults(result: CurrentVsOptimisedComparisonResponse) {
    return (
      <div className={`${cardClass} p-6 space-y-6`}>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-slate-900">Current vs optimised comparison</h2>
          <p className="text-sm text-slate-600">
            Current facilities: {result.current_facility_count} · Candidate pool:{" "}
            {result.candidate_pool_count} · p: {result.p}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Current weighted cost</p>
            <p className="text-2xl font-bold text-slate-900">
              {result.baseline_total_weighted_cost.toFixed(3)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Optimised weighted cost</p>
            <p className="text-2xl font-bold text-slate-900">
              {result.optimised_total_weighted_cost.toFixed(3)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Improvement</p>
            <p className="text-2xl font-bold text-emerald-700">
              {result.improvement_pct.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Current facility IDs</p>
            <p className="text-base font-medium text-slate-900">
              {result.current_facility_ids.join(", ")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Selected optimised facility IDs</p>
            <p className="text-base font-medium text-slate-900">
              {result.selected_candidate_ids.join(", ")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => downloadComparisonJson(result)} className={downloadButtonClass}>
            Download JSON
          </button>

          <button type="button" onClick={() => downloadAssignmentsCsv(result)} className={downloadButtonClass}>
            Download assignments CSV
          </button>

          <button
            type="button"
            onClick={() => downloadFacilitySummaryCsv(result)}
            className={downloadButtonClass}
          >
            Download facilities CSV
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ComparisonMap
            title="Current network map"
            demandPoints={result.demand_points}
            facilityPoints={result.current_facilities}
            assignmentLines={result.baseline_assignment_lines}
            facilityLabel="Current facility"
            facilityColor="#ea580c"
            lineColor="#fb923c"
          />

          <ComparisonMap
            title="Optimised network map"
            demandPoints={result.demand_points}
            facilityPoints={result.selected_facilities}
            assignmentLines={result.optimised_assignment_lines}
            facilityLabel="Selected facility"
            facilityColor="#16a34a"
            lineColor="#4ade80"
          />
        </div>

        {renderComparisonTable("Baseline assignments", result.baseline_assignments)}
        {renderComparisonTable("Optimised assignments", result.optimised_assignments)}
      </div>
    );
  }

  function renderWorkspaceHint() {
    if (baselineResult || comparisonResult) {
      return null;
    }

    return (
      <div className={`${cardClass} p-8`}>
        <div className="max-w-3xl space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Nothing has been run yet</h2>
          <p className="text-slate-600">
            Start with <strong>Run built-in demo</strong> for the fastest end-to-end view, or
            upload your own CSV files and validate them before running the baseline or comparison.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">GeoOps Studio</h1>
          <p className="max-w-4xl text-lg text-slate-700">
            Upload demand, current facilities, and candidate facilities to compare the
            current network against a like-for-like p-median redesign.
          </p>
          <p className="text-sm text-slate-500">
            Built-in demo mode is the fastest path for smoke tests and screenshots.
          </p>
        </div>

        <div className={`${cardClass} p-6 space-y-6`}>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Input guide</h2>
              <p className="text-sm text-slate-700">
                Demand rows need <code>id, lat, lng, weight</code>. Facility rows need{" "}
                <code>id, lat, lng</code>. For fair current-vs-optimised comparison, <code>p</code>{" "}
                must match the number of current facilities.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadDemandTemplate} className={ghostButtonClass}>
                Download demand template
              </button>

              <button type="button" onClick={downloadFacilityTemplate} className={ghostButtonClass}>
                Download facility template
              </button>

              <button type="button" onClick={downloadDemandSample} className={ghostButtonClass}>
                Download demand sample
              </button>

              <button
                type="button"
                onClick={downloadCurrentFacilitiesSample}
                className={ghostButtonClass}
              >
                Download current facilities sample
              </button>

              <button
                type="button"
                onClick={downloadCandidateFacilitiesSample}
                className={ghostButtonClass}
              >
                Download candidate facilities sample
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3" key={fileInputKey}>
            <UploadField
              inputId="demand-upload"
              label="Demand CSV"
              description="Rows with demand IDs, coordinates, and weights."
              file={demandFile}
              onFileChange={(file) => {
                setDemandFile(file);
                resetAllMessages();
              }}
            />

            <UploadField
              inputId="current-upload"
              label="Current facilities CSV"
              description="Currently open facilities used for the baseline."
              file={currentFile}
              onFileChange={(file) => {
                setCurrentFile(file);
                resetAllMessages();
              }}
            />

            <UploadField
              inputId="candidate-upload"
              label="Candidate facilities CSV"
              description="Possible facilities the optimiser may choose from."
              file={candidateFile}
              onFileChange={(file) => {
                setCandidateFile(file);
                resetAllMessages();
              }}
            />
          </div>

          <div className="max-w-sm space-y-2">
            <label htmlFor="p-value" className="block text-sm font-semibold text-slate-900">
              p (must match current facility count for this comparison)
            </label>
            <input
              id="p-value"
              type="number"
              min="1"
              step="1"
              value={pValue}
              onChange={(e) => setPValue(e.target.value)}
              className={inputClass}
              placeholder="Enter facility count"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleRunDemo} disabled={anyBusy} className={demoButtonClass}>
              {runningDemo ? "Running demo..." : "Run built-in demo"}
            </button>

            <button
              type="button"
              onClick={() => handleValidateFacilities("current")}
              disabled={anyBusy}
              className={secondaryButtonClass}
            >
              {validating ? "Validating..." : "Validate demand + current"}
            </button>

            <button
              type="button"
              onClick={() => handleValidateFacilities("candidate")}
              disabled={anyBusy}
              className={secondaryButtonClass}
            >
              {validating ? "Validating..." : "Validate demand + candidate pool"}
            </button>

            <button
              type="button"
              onClick={handleBaselineSolve}
              disabled={anyBusy}
              className={primaryButtonClass}
            >
              {baselineSolving ? "Solving baseline..." : "Run current baseline"}
            </button>

            <button
              type="button"
              onClick={handleCompare}
              disabled={anyBusy}
              className={compareButtonClass}
            >
              {comparing ? "Comparing..." : "Run current vs optimised comparison"}
            </button>

            <button
              type="button"
              onClick={handleResetWorkspace}
              disabled={anyBusy}
              className={secondaryButtonClass}
            >
              Reset workspace
            </button>
          </div>

          {statusMessage && (
            <div
              className={`rounded-2xl border p-4 text-sm ${
                statusTone === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {statusMessage}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {validationResult && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{validationLabel}</p>
            <div className="grid gap-6 md:grid-cols-2">
              {renderPreviewCard(validationResult.demand, "Demand file")}
              {renderPreviewCard(
                validationResult.candidate,
                validationLabel.includes("current")
                  ? "Current facilities file"
                  : "Candidate pool file"
              )}
            </div>
          </div>
        )}

        {renderWorkspaceHint()}
        {baselineResult && renderBaselineResults(baselineResult)}
        {comparisonResult && renderComparisonResults(comparisonResult)}
      </div>
    </main>
  );
}