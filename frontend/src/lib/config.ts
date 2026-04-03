const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const API_BASE =
  rawApiBase && rawApiBase.length > 0
    ? rawApiBase.replace(/\/$/, "")
    : "http://127.0.0.1:8000/api";