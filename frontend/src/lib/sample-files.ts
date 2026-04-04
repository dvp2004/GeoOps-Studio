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
D001,25.2048,55.2708,120
D002,25.2075,55.2740,85
D003,25.2102,55.2682,60
D004,25.1994,55.2771,95
D005,25.2141,55.2800,70
D006,25.2178,55.2669,110
`;

const currentFacilitiesSample = `id,lat,lng
CUR001,25.2061,55.2723
CUR002,25.2116,55.2784
`;

const candidateFacilitiesSample = `id,lat,lng
C001,25.2061,55.2723
C002,25.2116,55.2784
ALT001,25.1994,55.2771
ALT002,25.2178,55.2669
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