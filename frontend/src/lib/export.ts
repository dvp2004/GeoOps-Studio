export type ComparisonAssignmentRow = {
  demand_id: string;
  candidate_id: string;
  weighted_cost: number;
};

export type DemandPoint = {
  id: string;
  lat: number;
  lng: number;
  weight: number;
};

export type FacilityPoint = {
  id: string;
  lat: number;
  lng: number;
};

export type AssignmentLine = {
  demand_id: string;
  facility_id: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  weighted_cost: number;
};

export type CurrentVsOptimisedComparisonResponse = {
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

function escapeCsvValue(value: string | number): string {
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(rows: Array<Record<string, string | number>>, headers: string[]): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header] ?? "")).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.URL.revokeObjectURL(url);
}

function timestampSuffix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

export function downloadComparisonJson(
  result: CurrentVsOptimisedComparisonResponse
) {
  const filename = `geoops_comparison_${timestampSuffix()}.json`;
  downloadBlob(JSON.stringify(result, null, 2), filename, "application/json");
}

export function downloadAssignmentsCsv(
  result: CurrentVsOptimisedComparisonResponse
) {
  const rows: Array<Record<string, string | number>> = [];

  result.baseline_assignments.forEach((row) => {
    rows.push({
      scenario: "baseline",
      demand_id: row.demand_id,
      assigned_facility_id: row.candidate_id,
      weighted_cost: row.weighted_cost,
    });
  });

  result.optimised_assignments.forEach((row) => {
    rows.push({
      scenario: "optimised",
      demand_id: row.demand_id,
      assigned_facility_id: row.candidate_id,
      weighted_cost: row.weighted_cost,
    });
  });

  const csv = buildCsv(rows, [
    "scenario",
    "demand_id",
    "assigned_facility_id",
    "weighted_cost",
  ]);

  const filename = `geoops_assignments_${timestampSuffix()}.csv`;
  downloadBlob(csv, filename, "text/csv;charset=utf-8;");
}

export function downloadFacilitySummaryCsv(
  result: CurrentVsOptimisedComparisonResponse
) {
  const rows: Array<Record<string, string | number>> = [];

  result.current_facilities.forEach((facility) => {
    rows.push({
      scenario: "current",
      facility_id: facility.id,
      lat: facility.lat,
      lng: facility.lng,
    });
  });

  result.selected_facilities.forEach((facility) => {
    rows.push({
      scenario: "optimised_selected",
      facility_id: facility.id,
      lat: facility.lat,
      lng: facility.lng,
    });
  });

  const csv = buildCsv(rows, ["scenario", "facility_id", "lat", "lng"]);

  const filename = `geoops_facilities_${timestampSuffix()}.csv`;
  downloadBlob(csv, filename, "text/csv;charset=utf-8;");
}