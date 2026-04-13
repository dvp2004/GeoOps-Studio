from __future__ import annotations

import math
from typing import Any

from fastapi.encoders import jsonable_encoder


def _to_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(num):
        return None
    return num


def _get_path(data: Any, path: list[str]) -> Any:
    current = data
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def _first_number(data: dict[str, Any], paths: list[list[str]]) -> float | None:
    for path in paths:
        value = _get_path(data, path)
        num = _to_float(value)
        if num is not None:
            return num
    return None


def _extract_optimised_facilities(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = payload.get("optimised_facilities")
    if not isinstance(rows, list) or len(rows) == 0:
        rows = payload.get("selected_facilities")

    if not isinstance(rows, list):
        return []

    out: list[dict[str, Any]] = []

    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            continue

        lat = _to_float(row.get("lat", row.get("latitude")))
        lng = _to_float(row.get("lng", row.get("lon", row.get("longitude", row.get("long")))))

        if lat is None or lng is None:
            continue

        out.append(
            {
                "id": str(
                    row.get("id")
                    or row.get("facility_id")
                    or row.get("candidate_id")
                    or f"optimised_{idx + 1}"
                ),
                "label": str(
                    row.get("label")
                    or row.get("name")
                    or row.get("id")
                    or row.get("facility_id")
                    or row.get("candidate_id")
                    or f"Optimised {idx + 1}"
                ),
                "lat": lat,
                "lng": lng,
            }
        )

    return out


def normalise_generic_compare_payload(payload: Any) -> dict[str, Any]:
    payload_dict = jsonable_encoder(payload)

    if not isinstance(payload_dict, dict):
        raise TypeError(
            f"normalise_generic_compare_payload expected dict-like payload, got {type(payload_dict)!r}"
        )

    current_cost = (
        _first_number(
            payload_dict,
            [
                ["summary", "current_total_cost"],
                ["summary", "baseline_total_cost"],
                ["current_total_cost"],
                ["baseline_total_cost"],
                ["current_total_weighted_cost"],
                ["baseline_total_weighted_cost"],
            ],
        )
        or _to_float(payload_dict.get("baseline_total_weighted_cost"))
        or _to_float(payload_dict.get("current_total_weighted_cost"))
        or _to_float(payload_dict.get("baseline_total_cost"))
        or _to_float(payload_dict.get("current_total_cost"))
    )

    optimised_cost = (
        _first_number(
            payload_dict,
            [
                ["summary", "optimised_total_cost"],
                ["summary", "optimized_total_cost"],
                ["summary", "p_median_total_cost"],
                ["optimised_total_cost"],
                ["optimized_total_cost"],
                ["p_median_total_cost"],
                ["optimised_total_weighted_cost"],
                ["optimized_total_weighted_cost"],
            ],
        )
        or _to_float(payload_dict.get("optimised_total_weighted_cost"))
        or _to_float(payload_dict.get("optimized_total_weighted_cost"))
        or _to_float(payload_dict.get("p_median_total_cost"))
        or _to_float(payload_dict.get("optimised_total_cost"))
        or _to_float(payload_dict.get("optimized_total_cost"))
    )

    absolute_improvement = (
        _first_number(
            payload_dict,
            [
                ["summary", "absolute_improvement"],
                ["summary", "total_improvement"],
                ["summary", "total_improvement_km"],
                ["absolute_improvement"],
                ["total_improvement"],
                ["total_improvement_km"],
                ["improvement_abs"],
                ["improvement_km"],
            ],
        )
        or _to_float(payload_dict.get("total_improvement"))
        or _to_float(payload_dict.get("total_improvement_km"))
        or _to_float(payload_dict.get("improvement_abs"))
        or _to_float(payload_dict.get("improvement_km"))
    )

    improvement_pct = (
        _first_number(
            payload_dict,
            [
                ["summary", "improvement_pct"],
                ["summary", "relative_improvement_pct"],
                ["improvement_pct"],
                ["relative_improvement_pct"],
                ["cost_reduction_pct"],
            ],
        )
        or _to_float(payload_dict.get("improvement_pct"))
        or _to_float(payload_dict.get("relative_improvement_pct"))
        or _to_float(payload_dict.get("cost_reduction_pct"))
    )

    p_value = (
        _first_number(
            payload_dict,
            [
                ["summary", "p"],
                ["p"],
                ["selected_facilities_n"],
                ["optimised_facilities_n"],
                ["optimized_facilities_n"],
                ["current_facility_count"],
            ],
        )
        or _to_float(payload_dict.get("p"))
        or _to_float(payload_dict.get("current_facility_count"))
    )

    if absolute_improvement is None and current_cost is not None and optimised_cost is not None:
        absolute_improvement = current_cost - optimised_cost

    if (
        improvement_pct is None
        and current_cost is not None
        and optimised_cost is not None
        and current_cost != 0
    ):
        improvement_pct = ((current_cost - optimised_cost) / current_cost) * 100.0

    payload_dict["summary"] = {
        "current_total_cost": current_cost,
        "optimised_total_cost": optimised_cost,
        "absolute_improvement": absolute_improvement,
        "improvement_pct": improvement_pct,
        "p": int(round(p_value)) if p_value is not None else None,
    }

    payload_dict["optimised_facilities"] = _extract_optimised_facilities(payload_dict)

    return payload_dict