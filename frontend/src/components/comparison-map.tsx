"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

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

type ComparisonMapProps = {
  title: string;
  demandPoints: DemandPoint[];
  facilityPoints: FacilityPoint[];
  assignmentLines: AssignmentLine[];
  facilityLabel: string;
  facilityColor: string;
  lineColor: string;
};

function FitToData({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }

    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);

  return null;
}

export default function ComparisonMap({
  title,
  demandPoints,
  facilityPoints,
  assignmentLines,
  facilityLabel,
  facilityColor,
  lineColor,
}: ComparisonMapProps) {
  const allPoints = useMemo<[number, number][]>(() => {
    const demandCoords = demandPoints.map((point) => [point.lat, point.lng] as [number, number]);
    const facilityCoords = facilityPoints.map((point) => [point.lat, point.lng] as [number, number]);
    return [...demandCoords, ...facilityCoords];
  }, [demandPoints, facilityPoints]);

  const initialCenter: [number, number] = allPoints[0] ?? [25.2048, 55.2708];

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm text-gray-600">
          Demand points: {demandPoints.length} · {facilityLabel}s: {facilityPoints.length}
        </p>
      </div>

      <div className="h-[420px] overflow-hidden rounded-xl border">
        <MapContainer center={initialCenter} zoom={12} scrollWheelZoom className="h-full w-full">
          <FitToData points={allPoints} />

          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {assignmentLines.map((line, index) => (
            <Polyline
              key={`${line.demand_id}-${line.facility_id}-${index}`}
              positions={[
                [line.from_lat, line.from_lng],
                [line.to_lat, line.to_lng],
              ]}
              pathOptions={{
                color: lineColor,
                weight: 2,
                opacity: 0.65,
              }}
            />
          ))}

          {demandPoints.map((point) => (
            <CircleMarker
              key={`demand-${point.id}`}
              center={[point.lat, point.lng]}
              radius={6}
              pathOptions={{
                color: "#111827",
                fillColor: "#111827",
                fillOpacity: 0.75,
                weight: 1,
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">Demand {point.id}</p>
                  <p>Weight: {point.weight}</p>
                  <p>
                    {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {facilityPoints.map((point) => (
            <CircleMarker
              key={`facility-${point.id}`}
              center={[point.lat, point.lng]}
              radius={8}
              pathOptions={{
                color: facilityColor,
                fillColor: facilityColor,
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">
                    {facilityLabel} {point.id}
                  </p>
                  <p>
                    {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}