# GeoOps Studio Input Contracts

## Demand CSV
Required columns:
- `id` (string, unique, non-empty)
- `lat` (float, between -90 and 90)
- `lng` (float, between -180 and 180)
- `weight` (float, > 0)

## Candidate CSV
Required columns:
- `id` (string, unique, non-empty)
- `lat` (float, between -90 and 90)
- `lng` (float, between -180 and 180)

## Validation rules
- file must be CSV
- headers must match required names exactly
- no missing values in required columns
- no duplicate `id` values
- coordinates must be numeric and in valid range
- demand `weight` must be numeric and greater than 0