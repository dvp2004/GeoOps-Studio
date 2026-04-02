# Reuse Inventory

## Rules
- GeoOps Studio must run without private MIT/Talabat data.
- No reused asset is allowed to remain dependent on hidden files, notebook state, or private schemas.
- “Useful idea” does not equal “reusable implementation”.

## Classification legend
- Reuse directly
- Reuse conceptually only
- Rewrite from scratch
- Ignore

## Asset register

| Source project | Old path / asset | What it does | Classification | Why | New destination in GeoOps Studio | Action now | Notes |
|---|---|---|---|---|---|---|---|

## Explicitly excluded private assets
| Source project | Asset | Why excluded |
|---|---|---|

## Review status
- Reshuffling: in progress
- Carbon_Carts: not reviewed yet
- LocationReasoner: not reviewed yet

## Initial Reshuffling classification

| Source project | Old path / asset | What it does | Classification | Why | New destination in GeoOps Studio | Action now | Notes |
|---|---|---|---|---|---|---|---|
| Reshuffling | Customer_node_find.py | Snaps customer coordinates to nearest OSM node using BallTree and writes node IDs back to dataset | Rewrite from scratch | Useful core idea, but implementation is tied to local shapefiles, private CSV names, fixed dataset shape, and in-place file mutation | engine/network/snapping.py | Re-implement cleanly | Keep the algorithmic idea, not the file |
| Reshuffling | Find_optimal_point.py | Heuristic local search for better vendor location using polygon narrowing and sampled nodes | Reuse conceptually only | Relevant only to future reassignment mode; implementation is tightly coupled to vendor/customer cluster fields and private OSM artefacts | none for MVP | Do not port now | Possible later design reference |
| Reshuffling | Find_dist_opt.py | Distance-driven relocation search over candidate nearby nodes | Reuse conceptually only | Same issue as above; useful search logic idea, contaminated implementation | none for MVP | Do not port now | Revisit only if V1 adds reassignment mode |
| Reshuffling | GA_Latest.py | GA over vendor-by-vendor weighted distance matrix for one-to-one reassignment | Ignore | Wrong optimisation shape for current MVP, depends on private matrix, and contains hard-coded initial assignment | none | Exclude | Do not let this into GeoOps Studio MVP |
| Reshuffling | Num_cust_checker.py | One-off QA/debug script for specific rows and vendor/customer counts | Ignore | Private-data-specific debug script with no product value | none | Exclude | Not reusable |
| Reshuffling | Graph build pattern in multiple scripts | Builds directed road graph from nodes/edges shapefiles | Rewrite from scratch | Important capability, but repeated inline and tied to local shapefile workflow | engine/network/graph_loader.py | Rebuild as a proper module | Core public feature if done cleanly |
| Reshuffling | coord_to_nodes / node_to_coord helper pattern | Converts between coordinates and graph node IDs | Rewrite from scratch | Good utility concept, current form is duplicated and embedded in messy scripts | engine/network/snapping.py | Rebuild cleanly | Worth preserving as product code |
| Reshuffling | calculate_total_distances pattern | Computes weighted shortest-path totals from candidate node(s) to demand node(s) | Rewrite from scratch | Useful core engine logic, but current form relies on global state and private structures | engine/metrics/distance.py | Re-implement | This is actually valuable once cleaned |
| Reshuffling | Mathematical_Modelling.ipynb | Formal facility-location / p-median style framing | Reuse conceptually only | Valuable because it aligns with GeoOps Studio’s optimisation framing, but notebook code should not be copied | docs/algorithm_notes.md | Use as reference only | Supports solver design, not code reuse |
| Reshuffling | Create_Distance_Matrix.py | Builds weighted origin-to-candidate network cost matrix using single-source Dijkstra from each origin node | Rewrite from scratch | Valuable engine pattern, but implementation depends on private data, shapefiles, Talabat-specific columns, and writes private matrix artefacts | engine/network/cost_matrix.py | Re-implement cleanly | Strong candidate for public engine core |

## Explicitly excluded private assets

| Source project | Asset | Why excluded |
|---|---|---|
| Reshuffling | main_dataset.csv | Private master optimisation dataset with Talabat-derived structure |
| Reshuffling | main_dataset_displacement.csv | Private derived result dataset |
| Reshuffling | post_opt_displacement.csv | Private derived export |
| Reshuffling | centroid_distances_main_osm.csv | Private intermediate result table |
| Reshuffling | centroid_distances_main_osm_updated.csv | Private staging/intermediate table |
| Reshuffling | centroid_distances_main_osm_cust_vend.csv | Private correction/validation table |
| Reshuffling | final_distance_matrix.npy | Private precomputed optimisation artefact |
| Reshuffling | final_distance_matrix_updt.npy | Private precomputed optimisation artefact |
| Reshuffling | mit_base_orders_items.csv | Private raw operational data |
| Reshuffling | mit_base_orders_routes_oct_sample.csv | Private raw route data |
| Reshuffling | mit_base_orders_routes_oct_sample_updt.csv | Private processed operational data |
| Reshuffling | final_distance_matrix.npy | Private precomputed optimisation artefact |