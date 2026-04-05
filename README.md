# GeoOps Studio

GeoOps Studio is a public web app for **network-based facility placement and reassignment optimisation**.

The current MVP is framed around a practical use case: comparing a **current facility network** against a **like-for-like p-median redesign** over a road-network-based model.

## What the app does

Users can:

- upload demand points with weights
- upload current facilities
- upload candidate facilities
- validate input CSVs
- run a current-network baseline
- run a fair current-vs-optimised p-median comparison
- inspect assignment tables
- view current and optimised states on a map
- export results as JSON and CSV
- run a built-in demo scenario with one click

## Current MVP scope

This repo currently supports:

- strict CSV validation
- a built-in public demo graph
- snapping demand and facility coordinates to the demo network
- weighted shortest-path cost computation
- baseline nearest-facility assignment
- p-median optimisation with OR-Tools
- current-vs-optimised comparison where `p` matches the number of current facilities
- map visualisation with Leaflet
- client-side export of comparison results
- built-in demo mode and reset flow

## Why this exists

The goal is to ship a serious, public-safe optimisation product that:

- does **not** depend on private MIT or Talabat data
- is small enough to host realistically
- is clear enough to show in interviews and on GitHub
- demonstrates real decision-support workflow rather than notebook-only analysis

## Tech stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- React Leaflet
- Leaflet

### Backend

- FastAPI
- Pydantic
- Pandas
- NumPy
- SciPy
- OR-Tools
- NetworkX
- scikit-learn

## Repo structure

```text
GeoOps-Studio/
├── backend/
├── frontend/
├── engine/
├── data_demo/
├── docs/
├── README.md
└── .gitignore