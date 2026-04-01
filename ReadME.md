# GeoOps Studio

GeoOps Studio is a public web-based planning tool for network-based facility placement and reassignment optimisation.

## MVP goal
Build a vertical slice where a user can:

- upload weighted demand points
- upload candidate facility locations
- run a road-network-aware p-median optimisation
- compare baseline vs optimised assignments
- view outputs on a map
- export results

## Repo structure

- `frontend/` - Next.js UI
- `backend/` - FastAPI service
- `engine/` - optimisation and geospatial logic
- `data_demo/` - public demo datasets
- `docs/` - specs and project docs

## Status
Project initialised. MVP scaffold in progress.