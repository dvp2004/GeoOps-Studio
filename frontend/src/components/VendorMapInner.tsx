"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { VendorExplorerRow } from "../types/privateBenchmark";

function hasCoords(lat?: number, lng?: number): lat is number {
  return typeof lat === "number" && typeof lng === "number";
}

function FitToVendors({
  vendors,
  showCurrentRestaurant,
  showCurrentAccess,
  showAssignedAccess,
}: {
  vendors: VendorExplorerRow[];
  showCurrentRestaurant: boolean;
  showCurrentAccess: boolean;
  showAssignedAccess: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const pts: L.LatLngExpression[] = [];

    for (const vendor of vendors) {
      if (showCurrentRestaurant && hasCoords(vendor.vendor_lat, vendor.vendor_lng)) {
        pts.push([vendor.vendor_lat!, vendor.vendor_lng!]);
      }
      if (showCurrentAccess && hasCoords(vendor.current_access_lat, vendor.current_access_lng)) {
        pts.push([vendor.current_access_lat!, vendor.current_access_lng!]);
      }
      if (showAssignedAccess && hasCoords(vendor.assigned_access_lat, vendor.assigned_access_lng)) {
        pts.push([vendor.assigned_access_lat!, vendor.assigned_access_lng!]);
      }
    }

    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 12);
      return;
    }

    const bounds = L.latLngBounds(pts as L.LatLngTuple[]);
    map.fitBounds(bounds.pad(0.2));
  }, [vendors, showCurrentRestaurant, showCurrentAccess, showAssignedAccess, map]);

  return null;
}

export default function VendorMapInner({
  selectedVendor,
  displayVendors,
  mapModeLabel,
  showCurrentRestaurant,
  showCurrentAccess,
  showAssignedAccess,
  showMovementLines,
}: {
  selectedVendor: VendorExplorerRow | null;
  displayVendors: VendorExplorerRow[];
  mapModeLabel: string;
  showCurrentRestaurant: boolean;
  showCurrentAccess: boolean;
  showAssignedAccess: boolean;
  showMovementLines: boolean;
}) {
  const defaultCentre: [number, number] = [25.2048, 55.2708];

  const vendorsToRender = useMemo(() => displayVendors.slice(0, 25), [displayVendors]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="relative h-[560px] w-full">
        <MapContainer
          center={defaultCentre}
          zoom={11}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {vendorsToRender.map((vendor) => {
            const isSelected = selectedVendor?.vendor_id === vendor.vendor_id;

            const currentRestaurant =
              hasCoords(vendor.vendor_lat, vendor.vendor_lng)
                ? ([vendor.vendor_lat!, vendor.vendor_lng!] as [number, number])
                : null;

            const currentAccess =
              hasCoords(vendor.current_access_lat, vendor.current_access_lng)
                ? ([vendor.current_access_lat!, vendor.current_access_lng!] as [number, number])
                : null;

            const assignedAccess =
              hasCoords(vendor.assigned_access_lat, vendor.assigned_access_lng)
                ? ([vendor.assigned_access_lat!, vendor.assigned_access_lng!] as [number, number])
                : null;

            return (
              <div key={vendor.vendor_id}>
                {showCurrentRestaurant && currentRestaurant ? (
                  <CircleMarker
                    center={currentRestaurant}
                    radius={isSelected ? 8 : 5}
                    pathOptions={{ color: "#2563eb", fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold">{vendor.vendor_name}</div>
                        <div>Current restaurant location</div>
                        <div className="text-xs text-slate-600">Visual reference only</div>
                        <div className="text-xs text-slate-600">
                          Δ weighted km:{" "}
                          {typeof vendor.improvement_km === "number"
                            ? vendor.improvement_km.toFixed(1)
                            : "—"}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null}

                {showCurrentAccess && currentAccess ? (
                  <CircleMarker
                    center={currentAccess}
                    radius={isSelected ? 7 : 4}
                    pathOptions={{ color: "#64748b", fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold">{vendor.vendor_name}</div>
                        <div>Current assigned access node</div>
                        <div className="text-xs text-slate-600">
                          Node: {vendor.current_access_node_id}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null}

                {showAssignedAccess && assignedAccess ? (
                  <CircleMarker
                    center={assignedAccess}
                    radius={isSelected ? 8 : 5}
                    pathOptions={{ color: "#16a34a", fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold">{vendor.vendor_name}</div>
                        <div>Optimised assigned access node</div>
                        <div className="text-xs text-slate-600">
                          Node: {vendor.assigned_access_node_id}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null}

                {showMovementLines && currentRestaurant && assignedAccess ? (
                  <Polyline
                    positions={[currentRestaurant, assignedAccess]}
                    pathOptions={{
                      color: isSelected ? "#0f172a" : "#94a3b8",
                      weight: isSelected ? 3 : 2,
                      opacity: isSelected ? 0.95 : 0.55,
                    }}
                  />
                ) : null}
              </div>
            );
          })}

          <FitToVendors
            vendors={vendorsToRender}
            showCurrentRestaurant={showCurrentRestaurant}
            showCurrentAccess={showCurrentAccess}
            showAssignedAccess={showAssignedAccess}
          />
        </MapContainer>

        <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-xs rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Map legend
          </div>

          <div className="mt-3 space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
              <span>Current restaurant location</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-slate-500" />
              <span>Current assigned access node</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-green-600" />
              <span>Optimised assigned access node</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-[2px] w-6 bg-slate-500" />
              <span>Illustrative connector only</span>
            </div>
          </div>

          <div className="mt-3 text-[11px] leading-5 text-slate-500">
            The connector is a visual aid. It is not the literal rider route and it is not the optimisation path.
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
        Map view: <span className="font-semibold text-slate-900">{mapModeLabel}</span>. Up to 25 vendors are rendered at once to keep the map readable.
      </div>
    </div>
  );
}