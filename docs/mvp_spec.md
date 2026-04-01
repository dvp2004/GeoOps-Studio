# GeoOps Studio MVP Spec

## Anchored use case
Parcel lockers / pickup point placement.

## Core workflow
User uploads:
1. demand points CSV
2. candidate facilities CSV

User chooses:
- number of facilities `p`

System does:
- validate input
- snap points to road network
- compute baseline nearest assignment
- run p-median optimisation
- compare baseline vs optimised results

## First objective
Minimise weighted travel distance using a road-network-aware p-median model.

## Required input files

### Demand CSV
Required columns:
- `id`
- `lat`
- `lng`
- `weight`

### Candidate CSV
Required columns:
- `id`
- `lat`
- `lng`

## First outputs
- selected facility sites
- assignment table
- weighted baseline distance
- weighted optimised distance
- improvement percentage
- exportable CSV / GeoJSON

## First geography
To be fixed next.