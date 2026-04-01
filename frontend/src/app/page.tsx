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

export default function Home() {
  const [demandFile, setDemandFile] = useState<File | null>(null);
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [result, setResult] = useState<ValidationResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!demandFile || !candidateFile) {
      setError("Please upload both demand and candidate CSV files.");
      return;
    }

    const formData = new FormData();
    formData.append("demand_file", demandFile);
    formData.append("candidate_file", candidateFile);

    try {
      setLoading(true);

      const response = await fetch("http://127.0.0.1:8000/api/validate-files", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Validation failed.");
      }

      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
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

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">GeoOps Studio</h1>
          <p className="text-lg">
            Upload demand and candidate facility CSVs to validate the first workflow.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border p-6 space-y-6">
          <div className="space-y-2">
            <label className="block font-medium">Demand CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setDemandFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <label className="block font-medium">Candidate CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCandidateFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl border px-4 py-2 font-medium"
          >
            {loading ? "Validating..." : "Validate files"}
          </button>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
              {error}
            </div>
          )}
        </form>

        {result && (
          <div className="grid gap-6 md:grid-cols-2">
            {renderPreviewCard(result.demand)}
            {renderPreviewCard(result.candidate)}
          </div>
        )}
      </div>
    </main>
  );
}