"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  loadLocalBundleVendors,
  loadUploadedBundleVendors,
} from "../api/privateBenchmark";
import type {
  BundleSource,
  VendorExplorerRow,
} from "../types/privateBenchmark";

const VendorMapInner = dynamic(() => import("./VendorMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
      Loading map…
    </div>
  ),
});

type SortKey =
  | "improvement_km"
  | "improvement_pct_vs_current"
  | "vendor_orders_n"
  | "vendor_name";

type MapMode = "selected" | "filtered" | "topImproved" | "topWorsened" | "absoluteImpact";

type SavedView =
  | "custom"
  | "winners"
  | "losers"
  | "orders"
  | "moved"
  | "fairness";

function fmtInt(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function fmtFloat(value: number | undefined, digits = 2) {
  return typeof value === "number"
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "—";
}

function downloadCsv(filename: string, rows: VendorExplorerRow[]) {
  if (!rows.length) return;

  const headers = [
    "vendor_id",
    "vendor_name",
    "main_cuisine",
    "vendor_orders_n",
    "improvement_km",
    "improvement_pct_vs_current",
    "moved_access_node",
    "current_access_node_id",
    "assigned_access_node_id",
    "baseline_current_cost_km",
    "assigned_cost_km",
  ];

  const escapeCsv = (value: unknown) => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          escapeCsv((row as unknown as Record<string, unknown>)[header])
        )
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function updateUrlParams(mutator: (params: URLSearchParams) => void) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  mutator(params);
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState({}, "", next);
}

function readBoolParam(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === "1" || value === "true";
}

function readSortParam(value: string | null): SortKey {
  if (
    value === "improvement_km" ||
    value === "improvement_pct_vs_current" ||
    value === "vendor_orders_n" ||
    value === "vendor_name"
  ) {
    return value;
  }
  return "improvement_km";
}

function readMapModeParam(value: string | null): MapMode {
  if (
    value === "selected" ||
    value === "filtered" ||
    value === "topImproved" ||
    value === "topWorsened" ||
    value === "absoluteImpact"
  ) {
    return value;
  }
  return "selected";
}

function readSavedViewParam(value: string | null): SavedView {
  if (
    value === "custom" ||
    value === "winners" ||
    value === "losers" ||
    value === "orders" ||
    value === "moved" ||
    value === "fairness"
  ) {
    return value;
  }
  return "custom";
}

function statusTone(value: number | undefined): {
  label: string;
  className: string;
} {
  const v = value ?? 0;
  if (v > 0.0001) {
    return {
      label: "Improved",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (v < -0.0001) {
    return {
      label: "Worsened",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }
  return {
    label: "Unchanged",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  };
}

export default function VendorExplorerPanel({
  bundleName,
  source,
}: {
  bundleName: string;
  source: BundleSource;
}) {
  const [vendors, setVendors] = useState<VendorExplorerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [movedOnly, setMovedOnly] = useState(false);
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const [sortKey, setSortKey] = useState<SortKey>("improvement_km");
  const [filterMode, setFilterMode] = useState<"all" | "improved" | "worsened">(
    "all"
  );
  const [cuisineFilter, setCuisineFilter] = useState<string>("all");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");

  const [showCurrentRestaurant, setShowCurrentRestaurant] = useState(true);
  const [showCurrentAccess, setShowCurrentAccess] = useState(false);
  const [showAssignedAccess, setShowAssignedAccess] = useState(true);
  const [showMovementLines, setShowMovementLines] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>("selected");
  const [savedView, setSavedView] = useState<SavedView>("custom");

  const [compareLeftId, setCompareLeftId] = useState<string>("");
  const [compareRightId, setCompareRightId] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    setSearch(params.get("rbQ") ?? "");
    setMovedOnly(readBoolParam(params.get("rbMoved"), false));
    setDirection(params.get("rbDir") === "asc" ? "asc" : "desc");
    setSortKey(readSortParam(params.get("rbSort")));

    const filter = params.get("rbFilter");
    if (filter === "improved" || filter === "worsened" || filter === "all") {
      setFilterMode(filter);
    }

    setCuisineFilter(params.get("rbCuisine") ?? "all");
    setSelectedVendorId(params.get("rbSel") ?? "");
    setMapMode(readMapModeParam(params.get("rbMap")));
    setSavedView(readSavedViewParam(params.get("rbView")));
    setShowCurrentRestaurant(readBoolParam(params.get("rbCR"), true));
    setShowCurrentAccess(readBoolParam(params.get("rbCA"), false));
    setShowAssignedAccess(readBoolParam(params.get("rbAA"), true));
    setShowMovementLines(readBoolParam(params.get("rbLine"), true));
    setCompareLeftId(params.get("rbCmpA") ?? "");
    setCompareRightId(params.get("rbCmpB") ?? "");
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result =
          source === "local"
            ? await loadLocalBundleVendors(bundleName)
            : await loadUploadedBundleVendors(bundleName);

        if (!isMounted) return;

        setVendors(result.vendors);
        if (!selectedVendorId && result.vendors.length > 0) {
          setSelectedVendorId(String(result.vendors[0].vendor_id));
        }
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load vendor explorer dataset."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [bundleName, source, selectedVendorId]);

  const cuisines = useMemo(() => {
    return Array.from(
      new Set(vendors.map((v) => v.main_cuisine).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const filtered = useMemo(() => {
    let rows = [...vendors];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        [
          row.vendor_name,
          row.main_cuisine,
          String(row.vendor_id),
          row.current_access_node_id,
          row.assigned_access_node_id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }

    if (movedOnly) {
      rows = rows.filter((row) => row.moved_access_node);
    }

    if (filterMode === "improved") {
      rows = rows.filter((row) => row.improvement_km > 0);
    }

    if (filterMode === "worsened") {
      rows = rows.filter((row) => row.improvement_km < 0);
    }

    if (cuisineFilter !== "all") {
      rows = rows.filter((row) => row.main_cuisine === cuisineFilter);
    }

    rows.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return direction === "desc"
          ? bVal.localeCompare(aVal)
          : aVal.localeCompare(bVal);
      }

      const aNum = typeof aVal === "number" ? aVal : 0;
      const bNum = typeof bVal === "number" ? bVal : 0;
      return direction === "desc" ? bNum - aNum : aNum - bNum;
    });

    return rows;
  }, [vendors, search, movedOnly, filterMode, cuisineFilter, sortKey, direction]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedVendorId("");
      return;
    }

    const stillExists = filtered.some(
      (row) => String(row.vendor_id) === selectedVendorId
    );
    if (!stillExists) {
      setSelectedVendorId(String(filtered[0].vendor_id));
    }
  }, [filtered, selectedVendorId]);

  useEffect(() => {
    updateUrlParams((params) => {
      search ? params.set("rbQ", search) : params.delete("rbQ");
      movedOnly ? params.set("rbMoved", "1") : params.delete("rbMoved");
      params.set("rbDir", direction);
      params.set("rbSort", sortKey);
      filterMode !== "all"
        ? params.set("rbFilter", filterMode)
        : params.delete("rbFilter");
      cuisineFilter !== "all"
        ? params.set("rbCuisine", cuisineFilter)
        : params.delete("rbCuisine");
      selectedVendorId ? params.set("rbSel", selectedVendorId) : params.delete("rbSel");
      params.set("rbMap", mapMode);
      params.set("rbView", savedView);
      showCurrentRestaurant ? params.set("rbCR", "1") : params.delete("rbCR");
      showCurrentAccess ? params.set("rbCA", "1") : params.delete("rbCA");
      showAssignedAccess ? params.set("rbAA", "1") : params.delete("rbAA");
      showMovementLines ? params.set("rbLine", "1") : params.delete("rbLine");
      compareLeftId ? params.set("rbCmpA", compareLeftId) : params.delete("rbCmpA");
      compareRightId ? params.set("rbCmpB", compareRightId) : params.delete("rbCmpB");
    });
  }, [
    search,
    movedOnly,
    direction,
    sortKey,
    filterMode,
    cuisineFilter,
    selectedVendorId,
    mapMode,
    savedView,
    showCurrentRestaurant,
    showCurrentAccess,
    showAssignedAccess,
    showMovementLines,
    compareLeftId,
    compareRightId,
  ]);

  const selectedVendor =
    filtered.find((row) => String(row.vendor_id) === selectedVendorId) ??
    vendors.find((row) => String(row.vendor_id) === selectedVendorId) ??
    null;

  const compareLeft =
    vendors.find((row) => String(row.vendor_id) === compareLeftId) ?? null;
  const compareRight =
    vendors.find((row) => String(row.vendor_id) === compareRightId) ?? null;

  const improvedCount = filtered.filter((row) => row.improvement_km > 0).length;
  const worsenedCount = filtered.filter((row) => row.improvement_km < 0).length;
  const movedCount = filtered.filter((row) => row.moved_access_node).length;

  const mapVendors = useMemo(() => {
    if (mapMode === "selected") {
      return selectedVendor ? [selectedVendor] : [];
    }

    if (mapMode === "filtered") {
      return filtered.slice(0, 25);
    }

    if (mapMode === "topImproved") {
      return [...filtered]
        .filter((v) => v.improvement_km > 0)
        .sort((a, b) => b.improvement_km - a.improvement_km)
        .slice(0, 25);
    }

    if (mapMode === "topWorsened") {
      return [...filtered]
        .filter((v) => v.improvement_km < 0)
        .sort((a, b) => a.improvement_km - b.improvement_km)
        .slice(0, 25);
    }

    return [...filtered]
      .sort((a, b) => Math.abs(b.improvement_km) - Math.abs(a.improvement_km))
      .slice(0, 25);
  }, [filtered, mapMode, selectedVendor]);

  const mapModeLabel = useMemo(() => {
    if (mapMode === "selected") return "Selected vendor only";
    if (mapMode === "filtered") return "Top 25 vendors in current filtered view";
    if (mapMode === "topImproved") return "Top 25 improved vendors";
    if (mapMode === "topWorsened") return "Top 25 worsened vendors";
    return "Top 25 by absolute weighted cost change";
  }, [mapMode]);

  function applyPreset(
    preset: "topImproved" | "topWorsened" | "highestOrders" | "randomMoved"
  ) {
    if (!vendors.length) return;

    let nextSearch = "";
    let nextMovedOnly = false;
    let nextFilterMode: "all" | "improved" | "worsened" = "all";
    let nextSortKey: SortKey = "improvement_km";
    let nextDirection: "desc" | "asc" = "desc";
    let nextCuisineFilter = "all";
    let nextSavedView: SavedView = "custom";
    let targetVendorId: string | null = null;

    if (preset === "topImproved") {
      nextSavedView = "winners";
      nextFilterMode = "improved";
      nextSortKey = "improvement_km";
      nextDirection = "desc";
      const row = [...vendors]
        .filter((v) => v.improvement_km > 0)
        .sort((a, b) => b.improvement_km - a.improvement_km)[0];
      targetVendorId = row ? String(row.vendor_id) : null;
    }

    if (preset === "topWorsened") {
      nextSavedView = "losers";
      nextFilterMode = "worsened";
      nextSortKey = "improvement_km";
      nextDirection = "asc";
      const row = [...vendors]
        .filter((v) => v.improvement_km < 0)
        .sort((a, b) => a.improvement_km - b.improvement_km)[0];
      targetVendorId = row ? String(row.vendor_id) : null;
    }

    if (preset === "highestOrders") {
      nextSavedView = "orders";
      nextSortKey = "vendor_orders_n";
      nextDirection = "desc";
      const row = [...vendors].sort((a, b) => b.vendor_orders_n - a.vendor_orders_n)[0];
      targetVendorId = row ? String(row.vendor_id) : null;
    }

    if (preset === "randomMoved") {
      nextSavedView = "moved";
      nextMovedOnly = true;
      const movedRows = vendors.filter((v) => v.moved_access_node);
      if (movedRows.length > 0) {
        const randomRow =
          movedRows[Math.floor(Math.random() * movedRows.length)];
        targetVendorId = String(randomRow.vendor_id);
      }
    }

    setSearch(nextSearch);
    setMovedOnly(nextMovedOnly);
    setFilterMode(nextFilterMode);
    setSortKey(nextSortKey);
    setDirection(nextDirection);
    setCuisineFilter(nextCuisineFilter);
    setSavedView(nextSavedView);

    if (targetVendorId) {
      setSelectedVendorId(targetVendorId);
      setMapMode("selected");
    }
  }

  function applySavedView(view: SavedView) {
    if (view === "custom") {
      setSavedView("custom");
      return;
    }

    if (view === "winners") {
      setSavedView("winners");
      setSearch("");
      setMovedOnly(false);
      setFilterMode("improved");
      setSortKey("improvement_km");
      setDirection("desc");
      setCuisineFilter("all");
      setMapMode("topImproved");
      return;
    }

    if (view === "losers") {
      setSavedView("losers");
      setSearch("");
      setMovedOnly(false);
      setFilterMode("worsened");
      setSortKey("improvement_km");
      setDirection("asc");
      setCuisineFilter("all");
      setMapMode("topWorsened");
      return;
    }

    if (view === "orders") {
      setSavedView("orders");
      setSearch("");
      setMovedOnly(false);
      setFilterMode("all");
      setSortKey("vendor_orders_n");
      setDirection("desc");
      setCuisineFilter("all");
      setMapMode("filtered");
      return;
    }

    if (view === "moved") {
      setSavedView("moved");
      setSearch("");
      setMovedOnly(true);
      setFilterMode("all");
      setSortKey("improvement_km");
      setDirection("desc");
      setCuisineFilter("all");
      setMapMode("absoluteImpact");
      return;
    }

    setSavedView("fairness");
    setSearch("");
    setMovedOnly(false);
    setFilterMode("worsened");
    setSortKey("improvement_pct_vs_current");
    setDirection("asc");
    setCuisineFilter("all");
    setMapMode("topWorsened");
  }

  function assignSelectedToCompare(side: "left" | "right") {
    if (!selectedVendor) return;
    if (side === "left") {
      setCompareLeftId(String(selectedVendor.vendor_id));
    } else {
      setCompareRightId(String(selectedVendor.vendor_id));
    }
  }

  const selectedStatus = statusTone(selectedVendor?.improvement_pct_vs_current);

  const compareDeltaOrders =
    compareLeft && compareRight
      ? (compareLeft.vendor_orders_n ?? 0) - (compareRight.vendor_orders_n ?? 0)
      : null;

  const compareDeltaImprovementKm =
    compareLeft && compareRight
      ? (compareLeft.improvement_km ?? 0) - (compareRight.improvement_km ?? 0)
      : null;

  const compareDeltaImprovementPct =
    compareLeft && compareRight
      ? (compareLeft.improvement_pct_vs_current ?? 0) -
        (compareRight.improvement_pct_vs_current ?? 0)
      : null;

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Vendor explorer</h3>
          <p className="mt-1 text-sm text-slate-600">
            Search, sort, filter, and inspect individual vendors against their current and optimised access assignments.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} vendors in current view`}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        <button
          type="button"
          onClick={() => applySavedView("winners")}
          className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
            savedView === "winners"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
          }`}
        >
          Saved view: winners
        </button>
        <button
          type="button"
          onClick={() => applySavedView("losers")}
          className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
            savedView === "losers"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
          }`}
        >
          Saved view: losers
        </button>
        <button
          type="button"
          onClick={() => applySavedView("orders")}
          className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
            savedView === "orders"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
          }`}
        >
          Saved view: high-order
        </button>
        <button
          type="button"
          onClick={() => applySavedView("moved")}
          className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
            savedView === "moved"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
          }`}
        >
          Saved view: moved only
        </button>
        <button
          type="button"
          onClick={() => applySavedView("fairness")}
          className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
            savedView === "fairness"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
          }`}
        >
          Saved view: fairness tail
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() => applyPreset("topImproved")}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Top improved vendor
        </button>
        <button
          type="button"
          onClick={() => applyPreset("topWorsened")}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Top worsened vendor
        </button>
        <button
          type="button"
          onClick={() => applyPreset("highestOrders")}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Highest-order vendor
        </button>
        <button
          type="button"
          onClick={() => applyPreset("randomMoved")}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Random moved vendor
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Current view</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{fmtInt(filtered.length)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Improved</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{fmtInt(improvedCount)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Worsened</div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{fmtInt(worsenedCount)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Moved access node</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{fmtInt(movedCount)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.08fr_1.42fr]">
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSavedView("custom");
              }}
              placeholder="Search vendor, cuisine, or node id"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            />

            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setSavedView("custom");
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="improvement_km">Sort by improvement (km)</option>
              <option value="improvement_pct_vs_current">Sort by improvement (%)</option>
              <option value="vendor_orders_n">Sort by orders</option>
              <option value="vendor_name">Sort by vendor name</option>
            </select>

            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as "desc" | "asc");
                setSavedView("custom");
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>

            <select
              value={filterMode}
              onChange={(e) => {
                setFilterMode(e.target.value as "all" | "improved" | "worsened");
                setSavedView("custom");
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">All vendors</option>
              <option value="improved">Improved only</option>
              <option value="worsened">Worsened only</option>
            </select>

            <select
              value={cuisineFilter}
              onChange={(e) => {
                setCuisineFilter(e.target.value);
                setSavedView("custom");
              }}
              className="col-span-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">All cuisines</option>
              {cuisines.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>

            <label className="col-span-full flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={movedOnly}
                onChange={(e) => {
                  setMovedOnly(e.target.checked);
                  setSavedView("custom");
                }}
              />
              Show only vendors that moved access node
            </label>

            <div className="col-span-full flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadCsv(`${bundleName}_vendor_explorer_filtered.csv`, filtered)
                }
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Export filtered CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setMovedOnly(false);
                  setDirection("desc");
                  setSortKey("improvement_km");
                  setFilterMode("all");
                  setCuisineFilter("all");
                  setSavedView("custom");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Reset filters
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current selection
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {selectedVendor?.vendor_name ?? "No vendor selected"}
                  </div>
                </div>

                {selectedVendor ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedStatus.className}`}
                  >
                    {selectedStatus.label}
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                {selectedVendor?.main_cuisine ?? "—"}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => assignSelectedToCompare("left")}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Set as Compare A
                </button>
                <button
                  type="button"
                  onClick={() => assignSelectedToCompare("right")}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Set as Compare B
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Orders
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {fmtInt(selectedVendor?.vendor_orders_n)}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Moved access node:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedVendor?.moved_access_node ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Weighted network cost change
              </div>
              <div
                className={`mt-2 text-2xl font-bold ${
                  (selectedVendor?.improvement_km ?? 0) >= 0
                    ? "text-emerald-700"
                    : "text-rose-700"
                }`}
              >
                {fmtFloat(selectedVendor?.improvement_km, 1)} km
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {fmtFloat(selectedVendor?.improvement_pct_vs_current, 2)}% vs current benchmark cost
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current vs optimised cost
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <div>
                  Current:{" "}
                  <span className="font-semibold text-slate-900">
                    {fmtFloat(selectedVendor?.baseline_current_cost_km, 1)} km
                  </span>
                </div>
                <div>
                  Optimised:{" "}
                  <span className="font-semibold text-slate-900">
                    {fmtFloat(selectedVendor?.assigned_cost_km, 1)} km
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              Vendor list
            </div>
            <div className="max-h-[540px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Cuisine</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Δ weighted km</th>
                    <th className="px-4 py-3">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 300).map((row) => {
                    const selected = String(row.vendor_id) === selectedVendorId;
                    return (
                      <tr
                        key={row.vendor_id}
                        onClick={() => {
                          setSelectedVendorId(String(row.vendor_id));
                          setMapMode("selected");
                        }}
                        className={`cursor-pointer border-b border-slate-100 ${
                          selected ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium">{row.vendor_name}</td>
                        <td className="px-4 py-3">{row.main_cuisine}</td>
                        <td className="px-4 py-3">{fmtInt(row.vendor_orders_n)}</td>
                        <td className="px-4 py-3">{fmtFloat(row.improvement_km, 1)}</td>
                        <td className="px-4 py-3">
                          {fmtFloat(row.improvement_pct_vs_current, 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div className="md:col-span-2 text-sm font-semibold text-slate-900">
              Map mode
            </div>

            <button
              type="button"
              onClick={() => setMapMode("selected")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                mapMode === "selected"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              }`}
            >
              Selected vendor
            </button>

            <button
              type="button"
              onClick={() => setMapMode("filtered")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                mapMode === "filtered"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              }`}
            >
              Current filtered view
            </button>

            <button
              type="button"
              onClick={() => setMapMode("topImproved")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                mapMode === "topImproved"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              }`}
            >
              Top 25 improved
            </button>

            <button
              type="button"
              onClick={() => setMapMode("topWorsened")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                mapMode === "topWorsened"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              }`}
            >
              Top 25 worsened
            </button>

            <button
              type="button"
              onClick={() => setMapMode("absoluteImpact")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold md:col-span-2 ${
                mapMode === "absoluteImpact"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              }`}
            >
              Top 25 by absolute weighted cost change
            </button>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showCurrentRestaurant}
                onChange={(e) => setShowCurrentRestaurant(e.target.checked)}
              />
              Current restaurant
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showCurrentAccess}
                onChange={(e) => setShowCurrentAccess(e.target.checked)}
              />
              Current access node
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showAssignedAccess}
                onChange={(e) => setShowAssignedAccess(e.target.checked)}
              />
              Optimised access node
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showMovementLines}
                onChange={(e) => setShowMovementLines(e.target.checked)}
              />
              Show connector lines
            </label>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            The map line is <span className="font-semibold">illustrative only</span>. It connects the current restaurant
            location to the optimised assigned access node so movement is easy to read visually. It is not the literal rider route,
            and it is not the optimisation path used in the benchmark objective.
          </div>

          <VendorMapInner
            selectedVendor={selectedVendor}
            displayVendors={mapVendors}
            mapModeLabel={mapModeLabel}
            showCurrentRestaurant={showCurrentRestaurant}
            showCurrentAccess={showCurrentAccess}
            showAssignedAccess={showAssignedAccess}
            showMovementLines={showMovementLines}
          />

          {selectedVendor ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current assigned access node
                </div>
                <div className="mt-2 font-mono text-sm text-slate-900">
                  {selectedVendor.current_access_node_id}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Optimised assigned access node
                </div>
                <div className="mt-2 font-mono text-sm text-slate-900">
                  {selectedVendor.assigned_access_node_id}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current weighted network cost
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {fmtFloat(selectedVendor.baseline_current_cost_km, 1)} km
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Optimised weighted network cost
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {fmtFloat(selectedVendor.assigned_cost_km, 1)} km
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {(compareLeft || compareRight) ? (
        <div className="fixed bottom-4 left-1/2 z-[70] w-[min(96vw,1120px)] -translate-x-1/2 rounded-3xl border border-slate-300 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Vendor comparison drawer
              </div>
              <div className="text-xs text-slate-500">
                Compare two vendors side by side. This state is persisted in the URL.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const left = compareLeftId;
                  setCompareLeftId(compareRightId);
                  setCompareRightId(left);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Swap
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompareLeftId("");
                  setCompareRightId("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[compareLeft, compareRight].map((vendor, idx) => {
              const sideLabel = idx === 0 ? "Compare A" : "Compare B";
              const tone = statusTone(vendor?.improvement_pct_vs_current);

              return (
                <div
                  key={sideLabel}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {sideLabel}
                    </div>
                    {vendor ? (
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.className}`}
                      >
                        {tone.label}
                      </span>
                    ) : null}
                  </div>

                  {vendor ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="text-lg font-semibold text-slate-900">
                        {vendor.vendor_name}
                      </div>
                      <div>{vendor.main_cuisine}</div>
                      <div>
                        Orders:{" "}
                        <span className="font-semibold text-slate-900">
                          {fmtInt(vendor.vendor_orders_n)}
                        </span>
                      </div>
                      <div>
                        Δ weighted km:{" "}
                        <span
                          className={`font-semibold ${
                            vendor.improvement_km >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {fmtFloat(vendor.improvement_km, 1)}
                        </span>
                      </div>
                      <div>
                        Δ % vs current:{" "}
                        <span className="font-semibold text-slate-900">
                          {fmtFloat(vendor.improvement_pct_vs_current, 2)}%
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-600">
                        Current node: {vendor.current_access_node_id}
                      </div>
                      <div className="font-mono text-xs text-slate-600">
                        Assigned node: {vendor.assigned_access_node_id}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">
                      No vendor assigned yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {compareLeft && compareRight ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Orders delta
                </div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {fmtInt(compareDeltaOrders ?? undefined)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Compare A minus Compare B
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Weighted km delta
                </div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {fmtFloat(compareDeltaImprovementKm ?? undefined, 1)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Compare A minus Compare B
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Percentage delta
                </div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {fmtFloat(compareDeltaImprovementPct ?? undefined, 2)}%
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Compare A minus Compare B
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}