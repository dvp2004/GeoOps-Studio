"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  CircleMarker,
  LayerGroup,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

export type GenericMapPoint = {
  id?: string;
  label?: string;
  lat: number;
  lng: number;
  weight?: number;
};

function FitBounds({
  points,
}: {
  points: GenericMapPoint[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
      return;
    }

    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds.pad(0.2));
  }, [map, points]);

  return null;
}

export default function GenericPreviewMap({
  demandPoints,
  currentPoints,
  candidatePoints,
  optimisedPoints,
  showDemand,
  showCurrent,
  showCandidate,
  showOptimised,
}: {
  demandPoints: GenericMapPoint[];
  currentPoints: GenericMapPoint[];
  candidatePoints: GenericMapPoint[];
  optimisedPoints: GenericMapPoint[];
  showDemand: boolean;
  showCurrent: boolean;
  showCandidate: boolean;
  showOptimised: boolean;
}) {
  const allVisiblePoints = [
    ...(showDemand ? demandPoints : []),
    ...(showCurrent ? currentPoints : []),
    ...(showCandidate ? candidatePoints : []),
    ...(showOptimised ? optimisedPoints : []),
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="relative h-[520px] w-full">
        <MapContainer
          center={[25.2048, 55.2708]}
          zoom={11}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {showDemand ? (
            <LayerGroup>
              {demandPoints.map((point, idx) => (
                <CircleMarker
                  key={`demand-${point.id ?? idx}`}
                  center={[point.lat, point.lng]}
                  radius={3}
                  pathOptions={{ color: "#a855f7", fillOpacity: 0.55 }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{point.label ?? point.id ?? "Demand point"}</div>
                      <div className="text-xs text-slate-600">
                        Lat/Lng: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </div>
                      {typeof point.weight === "number" ? (
                        <div className="text-xs text-slate-600">Weight: {point.weight}</div>
                      ) : null}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          ) : null}

          {showCurrent ? (
            <LayerGroup>
              {currentPoints.map((point, idx) => (
                <CircleMarker
                  key={`current-${point.id ?? idx}`}
                  center={[point.lat, point.lng]}
                  radius={6}
                  pathOptions={{ color: "#2563eb", fillOpacity: 0.95 }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{point.label ?? point.id ?? "Current facility"}</div>
                      <div className="text-xs text-slate-600">
                        Lat/Lng: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          ) : null}

          {showCandidate ? (
            <LayerGroup>
              {candidatePoints.map((point, idx) => (
                <CircleMarker
                  key={`candidate-${point.id ?? idx}`}
                  center={[point.lat, point.lng]}
                  radius={4}
                  pathOptions={{ color: "#64748b", fillOpacity: 0.7 }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{point.label ?? point.id ?? "Candidate facility"}</div>
                      <div className="text-xs text-slate-600">
                        Lat/Lng: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          ) : null}

          {showOptimised ? (
            <LayerGroup>
              {optimisedPoints.map((point, idx) => (
                <CircleMarker
                  key={`optimised-${point.id ?? idx}`}
                  center={[point.lat, point.lng]}
                  radius={7}
                  pathOptions={{ color: "#16a34a", fillOpacity: 0.95 }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{point.label ?? point.id ?? "Optimised facility"}</div>
                      <div className="text-xs text-slate-600">
                        Lat/Lng: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          ) : null}

          <FitBounds points={allVisiblePoints} />
        </MapContainer>

        <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-xs rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Generic mode legend
          </div>

          <div className="mt-3 space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-purple-500" />
              <span>Demand points</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
              <span>Current facilities</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-slate-500" />
              <span>Candidate facilities</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-green-600" />
              <span>Optimised facilities</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}