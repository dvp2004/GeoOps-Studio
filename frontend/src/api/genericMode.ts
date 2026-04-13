const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

async function parseJsonOrThrow(response: Response) {
  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : typeof data === "string"
        ? data
        : `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return data;
}

export async function runGenericBuiltInDemo(): Promise<Record<string, unknown>> {
  const url = `${API_BASE}/api/demo/current-vs-optimised?_ts=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  return (await parseJsonOrThrow(response)) as Record<string, unknown>;
}

export async function runGenericCompare(params: {
  demandFile: File;
  currentFile: File;
  candidateFile: File;
  p: number;
  graphId: string;
}): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("demand_file", params.demandFile);
  form.append("current_file", params.currentFile);
  form.append("candidate_file", params.candidateFile);
  form.append("p", String(params.p));
  form.append("graph_id", params.graphId);

  const response = await fetch(`${API_BASE}/api/compare-current-vs-p-median`, {
    method: "POST",
    body: form,
  });

  return (await parseJsonOrThrow(response)) as Record<string, unknown>;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}