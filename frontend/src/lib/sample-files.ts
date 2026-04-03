function downloadTextFile(content: string, filename: string, mimeType: string) {
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

const demandTemplate = `id,lat,lng,weight
D001,25.2048,55.2708,10
D002,25.2148,55.2808,15
`;

const facilityTemplate = `id,lat,lng
F001,25.2048,55.2708
F002,25.2148,55.2808
`;

const demandSample = `id,lat,lng,weight
D001,25.1972,55.2744,12
D002,25.2070,55.2810,9
D003,25.2142,55.2865,15
D004,25.2225,55.2738,7
D005,25.2294,55.2891,14
D006,25.2350,55.2795,10
`;

const currentFacilitiesSample = `id,lat,lng
C001,25.2048,55.2708
C002,25.2148,55.2808
`;

const candidateFacilitiesSample = `id,lat,lng
C001,25.2048,55.2708
C002,25.2148,55.2808
C003,25.2248,55.2908
C004,25.2348,55.3008
`;

export function downloadDemandTemplate() {
  downloadTextFile(demandTemplate, "geoops_demand_template.csv", "text/csv;charset=utf-8;");
}

export function downloadFacilityTemplate() {
  downloadTextFile(
    facilityTemplate,
    "geoops_facility_template.csv",
    "text/csv;charset=utf-8;"
  );
}

export function downloadDemandSample() {
  downloadTextFile(demandSample, "geoops_demand_sample.csv", "text/csv;charset=utf-8;");
}

export function downloadCurrentFacilitiesSample() {
  downloadTextFile(
    currentFacilitiesSample,
    "geoops_current_facilities_sample.csv",
    "text/csv;charset=utf-8;"
  );
}

export function downloadCandidateFacilitiesSample() {
  downloadTextFile(
    candidateFacilitiesSample,
    "geoops_candidate_facilities_sample.csv",
    "text/csv;charset=utf-8;"
  );
}