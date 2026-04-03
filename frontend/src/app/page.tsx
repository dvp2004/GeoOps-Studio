"use client";

import { FormEvent, useState } from "react";

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

type OptimisationAssignmentRow = {
  demand_id: string;
  candidate_id: string;
  weighted_cost: number;
};

type OptimisationComparisonResponse = {
  p: number;
  baseline_total_weighted_cost: number;
  optimised_total_weighted_cost: number;
  improvement_pct: number;
  selected_candidate_ids: string[];
  baseline_assignments: OptimisationAssignmentRow[];
  optimised_assignments: OptimisationAssignmentRow[];
};

const API_BASE = "http://127.0.0.1:8000/api";

export default function Home() {
  const [demandFile, setDemandFile] = useState<File | null>(null);
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [pValue, setPValue] = useState("2");

  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [baselineResult, setBaselineResult] = useState<BaselineSolveResponse | null>(null);
  const [comparisonResult, setComparisonResult] = useState<OptimisationComparisonResponse | null>(null);

  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [baselineSolving, setBaselineSolving] = useState(false);
  const [optimising, setOptimising] = useState(false);

  function resetResults() {
    setBaselineResult(null);
    setComparisonResult(null);
  }

  function handleDemandFileChange(file: File | null) {
    setDemandFile(file);
    resetResults();
    setError("");
  }

  function handleCandidateFileChange(file: File | null) {
    setCandidateFile(file);
    resetResults();
    setError("");
  }

  async function handleValidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setValidationResult(null);
    resetResults();

    if (!demandFile || !candidateFile) {
      setError("Please upload both demand and candidate CSV files.");
      return;
    }

    const formData = new FormData();
    formData.append("demand_file", demandFile);
    formData.append("candidate_file", candidateFile);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setValidating(false);
    }
  }

  async function handleBaselineSolve() {
    setError("");
    setBaselineResult(null);
    setComparisonResult(null);

    if (!demandFile || !candidateFile) {
      setError("Please upload both demand and candidate CSV files.");
      return;
    }

    const formData = new FormData();
    formData.append("demand_file", demandFile);
    formData.append("candidate_file", candidateFile);
    formData.append("graph_id", "dubai_micro");

    try {
      setBaselineSolving(true);

      const response = await fetch(`${API_BASE}/solve-baseline`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Baseline solve failed.");
      }

      setBaselineResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setBaselineSolving(false);
    }
  }

  async function handlePMedianSolve() {
    setError("");
    setComparisonResult(null);
    setBaselineResult(null);

    if (!demandFile || !candidateFile) {
      setError("Please upload both demand and candidate CSV files.");
      return;
    }

    const parsedP = Number(pValue);

    if (!Number.isInteger(parsedP) || parsedP < 1) {
      setError("p must be a whole number greater than or equal to 1.");
      return;
    }

    const formData = new FormData();
    formData.append("demand_file", demandFile);
    formData.append("candidate_file", candidateFile);
    formData.append("graph_id", "dubai_micro");
    formData.append("p", String(parsedP));

    try {
      setOptimising(true);

      const response = await fetch(`${API_BASE}/solve-p-median`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "p-median solve failed.");
      }

      setComparisonResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setOptimising(false);
    }
  }

  function renderPreviewCard(summary: FileSummary) {
    return (
      <div className="rounded-2xl border p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold capitalize">{summary.file_kind} file</h2>
          <p className="text-sm text-gray-600">
            {summary.filename} · {summary.row_count} rows
          </p>
        </div>

        <div>
          <p className="font-medium">Columns</p>
          <p className="text-sm">{summary.columns.join(", ")}</p>
        </div>

        <div className="overflow-x-auto">
          <p className="font-medium mb-2">Preview</p>
          <table className="min-w-full border text-sm">
            <thead>
              <tr>
                {summary.columns.map((column) => (
                  <th key={column} className="border px-3 py-2 text-left">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.preview_rows.map((row, index) => (
                <tr key={index}>
                  {summary.columns.map((column) => (
                    <td key={column} className="border px-3 py-2">
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
      <div className="rounded-2xl border p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Baseline solve result</h2>
          <p className="text-sm text-gray-600">
            Graph: {result.graph_id} · Demand points: {result.demand_count} · Candidate sites:{" "}
            {result.candidate_count}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">Total weighted cost</p>
          <p className="text-2xl font-bold">{result.total_weighted_cost_km.toFixed(3)} km</p>
        </div>

        <div className="overflow-x-auto">
          <p className="font-medium mb-2">Assignments</p>
          <table className="min-w-full border text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left">Demand ID</th>
                <th className="border px-3 py-2 text-left">Weight</th>
                <th className="border px-3 py-2 text-left">Demand node</th>
                <th className="border px-3 py-2 text-left">Assigned candidate</th>
                <th className="border px-3 py-2 text-left">Candidate node</th>
                <th className="border px-3 py-2 text-left">Weighted cost (km)</th>
              </tr>
            </thead>
            <tbody>
              {result.assignment_rows.map((row) => (
                <tr key={row.demand_id}>
                  <td className="border px-3 py-2">{row.demand_id}</td>
                  <td className="border px-3 py-2">{row.demand_weight}</td>
                  <td className="border px-3 py-2">{row.snapped_demand_node_id}</td>
                  <td className="border px-3 py-2">{row.assigned_candidate_id}</td>
                  <td className="border px-3 py-2">{row.assigned_candidate_node_id}</td>
                  <td className="border px-3 py-2">{row.weighted_cost_km.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderOptimisationTable(
    title: string,
    rows: OptimisationAssignmentRow[],
  ) {
    return (
      <div className="overflow-x-auto">
        <p className="font-medium mb-2">{title}</p>
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-3 py-2 text-left">Demand ID</th>
              <th className="border px-3 py-2 text-left">Assigned candidate</th>
              <th className="border px-3 py-2 text-left">Weighted cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.demand_id}-${row.candidate_id}-${index}`}>
                <td className="border px-3 py-2">{row.demand_id}</td>
                <td className="border px-3 py-2">{row.candidate_id}</td>
                <td className="border px-3 py-2">{row.weighted_cost.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderComparisonResults(result: OptimisationComparisonResponse) {
    return (
      <div className="rounded-2xl border p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">p-median comparison result</h2>
          <p className="text-sm text-gray-600">Selected facility count (p): {result.p}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">Baseline weighted cost</p>
            <p className="text-2xl font-bold">
              {result.baseline_total_weighted_cost.toFixed(3)}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">Optimised weighted cost</p>
            <p className="text-2xl font-bold">
              {result.optimised_total_weighted_cost.toFixed(3)}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">Improvement</p>
            <p className="text-2xl font-bold">{result.improvement_pct.toFixed(2)}%</p>
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">Selected facility IDs</p>
          <p className="text-base font-medium">
            {result.selected_candidate_ids.length > 0
              ? result.selected_candidate_ids.join(", ")
              : "No facilities selected"}
          </p>
        </div>

        {renderOptimisationTable("Baseline assignments", result.baseline_assignments)}
        {renderOptimisationTable("Optimised assignments", result.optimised_assignments)}
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">GeoOps Studio</h1>
          <p className="text-lg">
            Upload demand and candidate facility CSVs, validate them, run the baseline
            network assignment workflow, and compare against p-median optimisation.
          </p>
        </div>

        <form onSubmit={handleValidate} className="rounded-2xl border p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block font-medium">Demand CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleDemandFileChange(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Candidate CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleCandidateFileChange(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="max-w-xs space-y-2">
            <label htmlFor="p-value" className="block font-medium">
              p-median facility count (p)
            </label>
            <input
              id="p-value"
              type="number"
              min="1"
              step="1"
              value={pValue}
              onChange={(e) => setPValue(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={validating}
              className="rounded-xl border px-4 py-2 font-medium"
            >
              {validating ? "Validating..." : "Validate files"}
            </button>

            <button
              type="button"
              onClick={handleBaselineSolve}
              disabled={baselineSolving}
              className="rounded-xl border px-4 py-2 font-medium"
            >
              {baselineSolving ? "Solving baseline..." : "Run baseline solve"}
            </button>

            <button
              type="button"
              onClick={handlePMedianSolve}
              disabled={optimising}
              className="rounded-xl border px-4 py-2 font-medium"
            >
              {optimising ? "Optimising..." : "Run p-median comparison"}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
              {error}
            </div>
          )}
        </form>

        {validationResult && (
          <div className="grid gap-6 md:grid-cols-2">
            {renderPreviewCard(validationResult.demand)}
            {renderPreviewCard(validationResult.candidate)}
          </div>
        )}

        {baselineResult && renderBaselineResults(baselineResult)}
        {comparisonResult && renderComparisonResults(comparisonResult)}
      </div>
    </main>
  );
}