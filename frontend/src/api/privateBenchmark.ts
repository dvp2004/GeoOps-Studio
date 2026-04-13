import type {
  BundleSummaryResponse,
  RequiredFilesResponse,
  VendorExplorerResponse,
} from "../types/privateBenchmark";

const API_HOST = (process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function absoluteApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_HOST}${path}`;
}

export async function fetchRequiredFiles(): Promise<RequiredFilesResponse> {
  const response = await fetch(`${API_HOST}/api/private/reshuffling/required-files`, {
    cache: "no-store",
  });
  return parseJson<RequiredFilesResponse>(response);
}

export async function fetchLocalBundles(): Promise<string[]> {
  const response = await fetch(`${API_HOST}/api/private/reshuffling/bundles`, {
    cache: "no-store",
  });
  const data = await parseJson<{ bundles: string[] }>(response);
  return data.bundles;
}

export async function loadLocalBundle(bundleName: string): Promise<BundleSummaryResponse> {
  const response = await fetch(
    `${API_HOST}/api/private/reshuffling/bundles/${encodeURIComponent(bundleName)}`,
    { cache: "no-store" }
  );
  return parseJson<BundleSummaryResponse>(response);
}

export async function loadLocalBundleVendors(bundleName: string): Promise<VendorExplorerResponse> {
  const response = await fetch(
    `${API_HOST}/api/private/reshuffling/bundles/${encodeURIComponent(bundleName)}/vendors`,
    { cache: "no-store" }
  );
  return parseJson<VendorExplorerResponse>(response);
}

export async function loadUploadedBundleVendors(bundleName: string): Promise<VendorExplorerResponse> {
  const response = await fetch(
    `${API_HOST}/api/private/reshuffling/uploads/${encodeURIComponent(bundleName)}/vendors`,
    { cache: "no-store" }
  );
  return parseJson<VendorExplorerResponse>(response);
}

export async function uploadBundle(
  files: File[],
  bundleName?: string
): Promise<BundleSummaryResponse> {
  const form = new FormData();
  if (bundleName?.trim()) {
    form.append("bundle_name", bundleName.trim());
  }

  for (const file of files) {
    form.append("files", file);
  }

  const response = await fetch(`${API_HOST}/api/private/reshuffling/upload`, {
    method: "POST",
    body: form,
  });

  return parseJson<BundleSummaryResponse>(response);
}