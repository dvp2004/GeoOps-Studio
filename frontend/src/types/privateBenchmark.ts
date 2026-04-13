export type BundleSource = "local" | "upload";

export interface HeadlineMetrics {
  benchmark_name?: string;
  scope?: string;
  chosen_K: number;
  vendors_n: number;
  baseline_total_cost_km: number;
  optimised_total_cost_km: number;
  total_improvement_km: number;
  improvement_pct: number;
  baseline_avg_km_per_order_overall: number;
  optimised_avg_km_per_order_overall: number;
  vendors_improved_n: number;
  vendors_worse_n: number;
  vendors_moved_access_node_n: number;
  [key: string]: string | number | undefined;
}

export interface FairnessSummary {
  vendors_n: number;
  vendors_improved_n?: number;
  vendors_unchanged_n?: number;
  vendors_worse_n?: number;
  improved_ge_1pct?: number;
  improved_ge_5pct?: number;
  improved_ge_10pct?: number;
  median_improvement_pct?: number;
  [key: string]: string | number | undefined;
}

export interface SensitivityRow {
  K: number;
  vendors_n: number;
  improvement_pct: number;
  total_improvement_km: number;
  vendors_improved_n: number;
  vendors_worse_n: number;
  vendors_moved_access_node_n: number;
  [key: string]: string | number | undefined;
}

export interface CuisineRow {
  main_cuisine: string;
  vendors_n: number;
  total_improvement_km: number;
  improvement_pct_total: number;
  vendors_improved_n: number;
  vendors_worse_n: number;
  [key: string]: string | number | undefined;
}

export interface VendorRow {
  vendor_id: string | number;
  vendor_name: string;
  main_cuisine: string;
  Is_kitchen?: boolean;
  vendor_orders_n: number;
  improvement_km?: number;
  improvement_pct_vs_current?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface VendorExplorerRow {
  vendor_id: string;
  vendor_name: string;
  main_cuisine: string;
  Is_kitchen?: boolean;
  vendor_orders_n: number;
  customer_orders_on_nodes?: number;
  current_access_node_id: string;
  assigned_access_node_id: string;
  baseline_current_cost_km: number;
  assigned_cost_km: number;
  improvement_km: number;
  improvement_pct_vs_current: number;
  avg_km_per_order_improvement?: number;
  moved_access_node: boolean;
  vendor_lat?: number;
  vendor_lng?: number;
  vendor_snap_node_id?: string;
  vendor_snap_dist_m?: number;
  current_access_lat?: number;
  current_access_lng?: number;
  assigned_access_lat?: number;
  assigned_access_lng?: number;
  current_access_capacity?: number;
  assigned_access_capacity?: number;
  current_sites_at_access_node?: number;
  assigned_sites_at_access_node?: number;
}

export interface VendorExplorerResponse {
  bundle_name: string;
  source: BundleSource;
  vendors: VendorExplorerRow[];
}

export interface FigureEntry {
  name: string;
  url: string;
}

export interface RequiredFilesResponse {
  recommended_local_bundle: string;
  upload_required_files: string[];
  optional_model_files_for_local_dev: string[];
  optional_figure_files: string[];
}

export interface BundleSummaryResponse {
  bundle_name: string;
  source: BundleSource;
  required_upload_files: string[];
  available_model_files: string[];
  headline: HeadlineMetrics;
  fairness: FairnessSummary;
  sensitivity: SensitivityRow[];
  top_cuisines: CuisineRow[];
  top_winners: VendorRow[];
  top_losers: VendorRow[];
  conclusion_text: string;
  figures: FigureEntry[];
}