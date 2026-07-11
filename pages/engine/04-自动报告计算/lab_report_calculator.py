#!/usr/bin/env python3
"""材料力学七次实验统一计算器。

输入采用 JSON，计算统一使用 N、mm、MPa 和微应变。程序只计算能够由
原始测量量确定的结果，并生成 JSON 结果和可直接并入报告的 Markdown
计算摘要。
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from statistics import mean
from typing import Any, Iterable


class InputError(ValueError):
    """输入缺失、长度不一致或物理量非法。"""


def require(data: dict[str, Any], key: str, path: str) -> Any:
    if key not in data or data[key] in (None, "", []):
        raise InputError(f"缺少必填字段：{path}.{key}")
    return data[key]


def numbers(values: Iterable[Any]) -> list[float]:
    return [float(value) for value in values if value not in (None, "")]


def average(value: Any, path: str = "value") -> float:
    if isinstance(value, list):
        vals = numbers(value)
        if not vals:
            raise InputError(f"{path} 至少需要一个有效数值")
        return mean(vals)
    if value in (None, ""):
        raise InputError(f"缺少必填数值：{path}")
    return float(value)


def average_optional(value: Any) -> float | None:
    if value in (None, "", []):
        return None
    return average(value)


def relative_error_pct(value: float | None, reference: float | None) -> float | None:
    if value is None or reference in (None, 0):
        return None
    return abs(value - reference) / abs(reference) * 100.0


def linear_fit(xs: list[float], ys: list[float]) -> dict[str, float | None]:
    if len(xs) != len(ys) or len(xs) < 2:
        return {"slope": None, "intercept": None, "r2": None}
    x_bar = mean(xs)
    y_bar = mean(ys)
    sxx = sum((x - x_bar) ** 2 for x in xs)
    if sxx == 0:
        return {"slope": None, "intercept": None, "r2": None}
    slope = sum((x - x_bar) * (y - y_bar) for x, y in zip(xs, ys)) / sxx
    intercept = y_bar - slope * x_bar
    fitted = [slope * x + intercept for x in xs]
    ss_res = sum((y - yf) ** 2 for y, yf in zip(ys, fitted))
    ss_tot = sum((y - y_bar) ** 2 for y in ys)
    r2 = 1.0 if ss_tot == 0 else 1.0 - ss_res / ss_tot
    return {"slope": slope, "intercept": intercept, "r2": r2}


def section_area_circle(d_mm: float) -> float:
    return math.pi * d_mm**2 / 4.0


def polar_section_modulus_solid(d_mm: float) -> float:
    return math.pi * d_mm**3 / 16.0


def calculate_mechanical_properties(data: dict[str, Any]) -> dict[str, Any]:
    results: dict[str, list[dict[str, Any]]] = {
        "tension": [],
        "compression": [],
        "torsion": [],
    }

    for index, row in enumerate(require(data, "tension", "mechanical_properties")):
        path = f"mechanical_properties.tension[{index}]"
        d0 = average(require(row, "d0_mm", path), f"{path}.d0_mm")
        area0 = section_area_circle(d0)
        item: dict[str, Any] = {
            "material": require(row, "material", path),
            "d0_mm": d0,
            "A0_mm2": area0,
            "observation": row.get("observation", ""),
        }
        fs_kN = average_optional(row.get("yield_force_kN"))
        fb_kN = average_optional(row.get("max_force_kN"))
        item["yield_strength_MPa"] = None if fs_kN is None else fs_kN * 1000.0 / area0
        item["tensile_strength_MPa"] = None if fb_kN is None else fb_kN * 1000.0 / area0

        l0 = average_optional(row.get("l0_mm"))
        l1 = average_optional(row.get("report_l1_mm", row.get("l1_mm")))
        d1 = average_optional(row.get("report_d1_mm", row.get("d1_mm")))
        item["l0_mm"] = l0
        item["l1_mm"] = l1
        item["d1_mm"] = d1
        item["elongation_pct"] = (
            None if l0 in (None, 0) or l1 is None else (l1 - l0) / l0 * 100.0
        )
        item["area_reduction_pct"] = (
            None if d1 is None else (d0**2 - d1**2) / d0**2 * 100.0
        )
        results["tension"].append(item)

    for index, row in enumerate(require(data, "compression", "mechanical_properties")):
        path = f"mechanical_properties.compression[{index}]"
        d0 = average(require(row, "d0_mm", path), f"{path}.d0_mm")
        area0 = section_area_circle(d0)
        strength_diameter = average_optional(row.get("strength_diameter_mm"))
        strength_area = area0 if strength_diameter is None else section_area_circle(strength_diameter)
        fs_kN = average_optional(row.get("yield_force_kN"))
        fb_kN = average_optional(row.get("max_force_kN"))
        results["compression"].append({
            "material": require(row, "material", path),
            "d0_mm": d0,
            "h0_mm": average_optional(row.get("h0_mm")),
            "A0_mm2": area0,
            "strength_diameter_mm": strength_diameter,
            "strength_area_mm2": strength_area,
            "yield_strength_MPa": None if fs_kN is None else fs_kN * 1000.0 / area0,
            "compressive_strength_MPa": None if fb_kN is None else fb_kN * 1000.0 / strength_area,
            "compressive_strength_initial_area_MPa": None if fb_kN is None else fb_kN * 1000.0 / area0,
            "observation": row.get("observation", ""),
        })

    for index, row in enumerate(require(data, "torsion", "mechanical_properties")):
        path = f"mechanical_properties.torsion[{index}]"
        d0 = average(require(row, "d0_mm", path), f"{path}.d0_mm")
        wp = polar_section_modulus_solid(d0)
        torque = average(require(row, "max_torque_Nm", path), f"{path}.max_torque_Nm")
        results["torsion"].append({
            "material": require(row, "material", path),
            "d0_mm": d0,
            "Wp_mm3": wp,
            "max_torque_Nm": torque,
            "torsional_strength_MPa": torque * 1000.0 / wp,
            "twist_angle_deg": average_optional(row.get("twist_angle_deg")),
            "observation": row.get("observation", ""),
        })
    return results


def calculate_elastic_constants(data: dict[str, Any]) -> dict[str, Any]:
    width = average(require(data, "width_mm", "elastic_constants"), "elastic_constants.width_mm")
    thickness = average(
        require(data, "thickness_mm", "elastic_constants"),
        "elastic_constants.thickness_mm",
    )
    area = width * thickness
    axial_channels = [int(i) for i in data.get("axial_channels", [0, 1])]
    transverse_channels = [int(i) for i in data.get("transverse_channels", [2, 3])]
    runs = require(data, "runs", "elastic_constants")
    interval_groups: dict[int, list[dict[str, float]]] = {}
    curve_groups: dict[int, list[dict[str, float]]] = {}

    for run_index, run in enumerate(runs):
        loads = numbers(require(run, "loads_kN", f"elastic_constants.runs[{run_index}]"))
        readings = require(run, "readings_micro", f"elastic_constants.runs[{run_index}]")
        if len(loads) != len(readings) or len(loads) < 2:
            raise InputError(f"elastic_constants.runs[{run_index}] 载荷与读数长度必须相同且不少于 2")
        axial: list[float] = []
        transverse: list[float] = []
        for level, row in enumerate(readings):
            vals = numbers(row)
            if max(axial_channels + transverse_channels) >= len(vals):
                raise InputError(f"elastic_constants.runs[{run_index}].readings_micro[{level}] 通道数不足")
            axial.append(mean(vals[i] for i in axial_channels))
            transverse.append(mean(vals[i] for i in transverse_channels))
            curve_groups.setdefault(level, []).append({
                "load_kN": loads[level],
                "axial_micro": axial[-1] - axial[0],
            })

        for level in range(1, len(loads)):
            d_force_N = (loads[level] - loads[level - 1]) * 1000.0
            d_axial = axial[level] - axial[level - 1]
            d_trans = transverse[level] - transverse[level - 1]
            if d_axial == 0:
                raise InputError("elastic_constants 出现零轴向应变增量，无法计算 E")
            interval_groups.setdefault(level, []).append({
                "delta_force_N": d_force_N,
                "delta_axial_micro": d_axial,
                "delta_transverse_micro": d_trans,
            })

    interval_results = []
    for level in sorted(interval_groups):
        rows = interval_groups[level]
        d_force = mean(row["delta_force_N"] for row in rows)
        d_axial = mean(row["delta_axial_micro"] for row in rows)
        d_trans = mean(row["delta_transverse_micro"] for row in rows)
        interval_results.append({
            "interval_index": level,
            "delta_force_N": d_force,
            "delta_axial_micro": d_axial,
            "delta_transverse_micro": d_trans,
            "E_MPa": d_force / (area * d_axial * 1e-6),
            "mu": abs(d_trans / d_axial),
        })

    strain_curve: list[float] = []
    stress_curve: list[float] = []
    first_load = mean(item["load_kN"] for item in curve_groups[min(curve_groups)])
    for level in sorted(curve_groups):
        if level == min(curve_groups):
            continue
        row_group = curve_groups[level]
        load = mean(item["load_kN"] for item in row_group)
        axial_micro = mean(item["axial_micro"] for item in row_group)
        strain_curve.append(axial_micro * 1e-6)
        stress_curve.append((load - first_load) * 1000.0 / area)
    fit = linear_fit(strain_curve, stress_curve)
    return {
        "width_mm": width,
        "thickness_mm": thickness,
        "area_mm2": area,
        "intervals": interval_results,
        "E_mean_MPa": mean(row["E_MPa"] for row in interval_results),
        "mu_mean": mean(row["mu"] for row in interval_results),
        "stress_strain_fit": fit,
    }


def _increment_moduli(xs: list[float], ys: list[float], multiplier: float) -> list[float]:
    if len(xs) != len(ys) or len(xs) < 2:
        raise InputError("序列长度必须相同且不少于 2")
    values = []
    for i in range(1, len(xs)):
        dx = xs[i] - xs[i - 1]
        dy = ys[i] - ys[i - 1]
        if dy == 0:
            raise InputError("相邻测量级出现零增量，无法计算模量")
        values.append(dx * multiplier / dy)
    return values


def _report_difference_increment(values: list[float]) -> float:
    """Return the two-step difference increment used by the handwritten B041 report."""
    if len(values) != 5:
        raise InputError("逐差法需要 5 个等间隔加载级数据")
    return (values[4] + values[3] - values[2] - values[1]) / 4.0


def calculate_shear_modulus(data: dict[str, Any]) -> dict[str, Any]:
    diameter = average(require(data, "diameter_mm", "shear_modulus"), "shear_modulus.diameter_mm")
    arm = average(require(data, "torque_arm_mm", "shear_modulus"))
    gauge_length = average(require(data, "gauge_length_mm", "shear_modulus"))
    dial_arm = average(require(data, "dial_arm_mm", "shear_modulus"))
    ip = math.pi * diameter**4 / 32.0
    wp = polar_section_modulus_solid(diameter)

    dial = require(data, "dial_run", "shear_modulus")
    dial_loads_N = [value * 1000.0 for value in numbers(require(dial, "loads_kN", "shear_modulus.dial_run"))]
    dial_values = numbers(require(dial, "dial_mm", "shear_modulus.dial_run"))
    torques = [force * arm for force in dial_loads_N]
    phis = [value / dial_arm for value in dial_values]
    dial_G = _increment_moduli(torques, phis, gauge_length / ip)
    dial_delta_t = _report_difference_increment(torques)
    dial_delta_phi = _report_difference_increment(phis)
    dial_report_G = dial_delta_t * gauge_length / (dial_delta_phi * ip)

    electric_G: list[float] = []
    electric_runs = []
    for run_index, run in enumerate(require(data, "half_bridge_runs", "shear_modulus")):
        loads_N = [value * 1000.0 for value in numbers(require(run, "loads_kN", f"half_bridge_runs[{run_index}]"))]
        ch1 = numbers(require(run, "channel_1_micro", f"half_bridge_runs[{run_index}]"))
        ch2 = numbers(require(run, "channel_2_micro", f"half_bridge_runs[{run_index}]"))
        if not (len(loads_N) == len(ch1) == len(ch2)):
            raise InputError(f"half_bridge_runs[{run_index}] 三列长度必须相同")
        gamma_factor = float(run.get("reading_to_gamma_factor", 1.0))
        gamma = [(a + b) / 2.0 * gamma_factor * 1e-6 for a, b in zip(ch1, ch2)]
        tau = [force * arm / wp for force in loads_N]
        values = _increment_moduli(tau, gamma, 1.0)
        report_delta_tau = _report_difference_increment(tau)
        report_delta_gamma = _report_difference_increment(gamma)
        report_G = report_delta_tau / report_delta_gamma
        electric_G.extend(values)
        electric_runs.append({
            "run": run_index + 1,
            "G_increment_MPa": values,
            "G_mean_MPa": mean(values),
            "report_delta_gamma_micro": report_delta_gamma * 1e6,
            "G_report_MPa": report_G,
            "fit_tau_vs_gamma": linear_fit(gamma, tau),
        })

    selected_run_number = int(data.get("report_run_index", len(electric_runs)))
    if not 1 <= selected_run_number <= len(electric_runs):
        raise InputError("shear_modulus.report_run_index 超出重复组范围")
    selected_run = electric_runs[selected_run_number - 1]

    full_result = None
    if data.get("full_bridge"):
        full = data["full_bridge"]
        loads_N = [value * 1000.0 for value in numbers(require(full, "loads_kN", "shear_modulus.full_bridge"))]
        readings = numbers(require(full, "readings_micro", "shear_modulus.full_bridge"))
        factor = float(full.get("reading_to_gamma_factor", 0.5))
        gamma = [value * factor * 1e-6 for value in readings]
        tau = [force * arm / wp for force in loads_N]
        full_values = _increment_moduli(tau, gamma, 1.0)
        full_delta_gamma = _report_difference_increment(gamma)
        full_delta_tau = _report_difference_increment(tau)
        full_result = {
            "reading_to_gamma_factor": factor,
            "G_increment_MPa": full_values,
            "G_mean_MPa": mean(full_values),
            "report_delta_gamma_micro": full_delta_gamma * 1e6,
            "G_report_MPa": full_delta_tau / full_delta_gamma,
        }

    return {
        "diameter_mm": diameter,
        "Ip_mm4": ip,
        "Wp_mm3": wp,
        "dial_method": {
            "G_increment_MPa": dial_G,
            "G_mean_MPa": mean(dial_G),
            "report_delta_dial_mm": _report_difference_increment(dial_values),
            "G_report_MPa": dial_report_G,
            "fit_T_vs_phi": linear_fit(phis, torques),
        },
        "half_bridge_method": {
            "runs": electric_runs,
            "G_mean_MPa": mean(electric_G),
            "selected_run": selected_run_number,
            "G_report_MPa": selected_run["G_report_MPa"],
            "report_delta_gamma_micro": selected_run["report_delta_gamma_micro"],
        },
        "full_bridge_method": full_result,
    }


def calculate_beam_bending(data: dict[str, Any]) -> dict[str, Any]:
    elastic_modulus = average(require(data, "E_GPa", "beam_bending")) * 1000.0
    mu_reference = average(require(data, "mu", "beam_bending"))
    width = average(require(data, "width_mm", "beam_bending"))
    height = average(require(data, "height_mm", "beam_bending"))
    inertia = width * height**3 / 12.0
    delta_force = average(require(data, "delta_force_kN", "beam_bending")) * 1000.0
    load_spacing = average(require(data, "load_spacing_mm", "beam_bending"))
    moment = delta_force * load_spacing / 2.0

    points = []
    for index, row in enumerate(require(data, "longitudinal_points", "beam_bending")):
        valid = bool(row.get("valid", True))
        y = average(require(row, "y_mm", f"longitudinal_points[{index}]"))
        strain = average_optional(row.get("readings_micro")) if valid else None
        theory = moment * y / inertia
        experimental = None if strain is None else elastic_modulus * strain * 1e-6
        points.append({
            "gage": row.get("gage", ""),
            "y_mm": y,
            "valid": valid,
            "strain_micro": strain,
            "stress_theory_MPa": theory,
            "stress_experimental_MPa": experimental,
            "relative_error_pct": relative_error_pct(experimental, theory),
            "note": row.get("note", ""),
        })

    mu_values = []
    for row in require(data, "poisson_surfaces", "beam_bending"):
        longitudinal = average(require(row, "longitudinal_micro", "beam_bending.poisson_surfaces"))
        transverse = average(require(row, "transverse_micro", "beam_bending.poisson_surfaces"))
        mu_values.append({
            "surface": row.get("surface", ""),
            "mu": abs(transverse / longitudinal),
        })
    mu_mean = mean(item["mu"] for item in mu_values)

    full = require(data, "full_bridge", "beam_bending")
    full_reading = average(require(full, "readings_micro", "beam_bending.full_bridge"))
    factor = float(full.get("display_factor", 4.0))
    max_strain = full_reading / factor
    return {
        "width_mm": width,
        "height_mm": height,
        "Iz_mm4": inertia,
        "moment_Nmm": moment,
        "points": points,
        "poisson_surfaces": mu_values,
        "mu_mean": mu_mean,
        "mu_reference": mu_reference,
        "mu_error_pct": relative_error_pct(mu_mean, mu_reference),
        "full_bridge": {
            "mean_reading_micro": full_reading,
            "display_factor": factor,
            "max_strain_micro": max_strain,
            "max_stress_MPa": elastic_modulus * max_strain * 1e-6,
        },
    }


def calculate_beam_deformation(data: dict[str, Any]) -> dict[str, Any]:
    simple = require(data, "simply_supported", "beam_deformation")
    elastic_modulus = average(require(simple, "E_GPa", "beam_deformation.simply_supported")) * 1000.0
    length = average(require(simple, "length_mm", "beam_deformation.simply_supported"))
    width = average(require(simple, "width_mm", "beam_deformation.simply_supported"))
    height = average(require(simple, "height_mm", "beam_deformation.simply_supported"))
    inertia = width * height**3 / 12.0
    delta_p = average(require(simple, "delta_load_N", "beam_deformation.simply_supported"))
    deflection_exp = average(require(simple, "central_deflection_mm", "beam_deformation.simply_supported"))
    deflection_theory = delta_p * length**3 / (48.0 * elastic_modulus * inertia)
    angle_delta = average(require(simple, "angle_indicator_delta_mm", "beam_deformation.simply_supported"))
    angle_arm = average(require(simple, "angle_arm_mm", "beam_deformation.simply_supported"))
    theta_exp = angle_delta / angle_arm
    theta_theory = delta_p * length**2 / (16.0 * elastic_modulus * inertia)
    reciprocity_12 = average(require(simple, "reciprocity_12_mm", "beam_deformation.simply_supported"))
    reciprocity_21 = average(require(simple, "reciprocity_21_mm", "beam_deformation.simply_supported"))

    cantilever = require(data, "cantilever", "beam_deformation")
    cantilever_E = average(require(cantilever, "E_GPa", "beam_deformation.cantilever")) * 1000.0
    cantilever_width = average(require(cantilever, "width_mm", "beam_deformation.cantilever"))
    cantilever_height = average(require(cantilever, "height_mm", "beam_deformation.cantilever"))
    wz = cantilever_width * cantilever_height**2 / 6.0
    eps_1 = average(require(cantilever, "strain_position_1_micro", "beam_deformation.cantilever"))
    eps_2 = average(require(cantilever, "strain_position_2_micro", "beam_deformation.cantilever"))
    l12 = average(require(cantilever, "position_spacing_mm", "beam_deformation.cantilever"))
    gravity = float(cantilever.get("gravity_m_s2", 9.8))
    mass = cantilever_E * (eps_1 - eps_2) * 1e-6 * wz / (l12 * gravity)

    return {
        "simply_supported": {
            "length_mm": length,
            "width_mm": width,
            "height_mm": height,
            "Iz_mm4": inertia,
            "deflection_experimental_mm": deflection_exp,
            "deflection_theoretical_mm": deflection_theory,
            "deflection_error_pct": relative_error_pct(deflection_exp, deflection_theory),
            "theta_experimental_rad": theta_exp,
            "theta_theoretical_rad": theta_theory,
            "theta_error_pct": relative_error_pct(theta_exp, theta_theory),
            "reciprocity_12_mm": reciprocity_12,
            "reciprocity_21_mm": reciprocity_21,
            "reciprocity_difference_mm": reciprocity_12 - reciprocity_21,
            "curve_points": simple.get("curve_points", []),
        },
        "cantilever": {
            "width_mm": cantilever_width,
            "height_mm": cantilever_height,
            "Wz_mm3": wz,
            "strain_difference_micro": eps_1 - eps_2,
            "mass_kg": mass,
        },
    }


def normalize_principal_angle(angle_deg: float) -> float:
    while angle_deg <= -45.0:
        angle_deg += 90.0
    while angle_deg > 45.0:
        angle_deg -= 90.0
    return angle_deg


def principal_from_rosette(E_MPa: float, mu: float, eps0: float, eps45: float, epsm45: float) -> dict[str, float]:
    ex = eps0 * 1e-6
    ey = (eps45 + epsm45 - eps0) * 1e-6
    gamma = (epsm45 - eps45) * 1e-6
    avg = (ex + ey) / 2.0
    radius = math.sqrt(((ex - ey) / 2.0) ** 2 + (gamma / 2.0) ** 2)
    eps1 = avg + radius
    eps2 = avg - radius
    coefficient = E_MPa / (1.0 - mu**2)
    sigma1 = coefficient * (eps1 + mu * eps2)
    sigma2 = coefficient * (eps2 + mu * eps1)
    alpha = normalize_principal_angle(0.5 * math.degrees(math.atan2(-gamma, ex - ey)))
    return {
        "epsilon_x_micro": ex * 1e6,
        "epsilon_y_micro": ey * 1e6,
        "gamma_xy_micro": gamma * 1e6,
        "sigma_1_MPa": sigma1,
        "sigma_2_MPa": sigma2,
        "principal_angle_deg": alpha,
    }


def principal_theory(sigma_x: float, tau_xy: float) -> dict[str, float]:
    avg = sigma_x / 2.0
    radius = math.sqrt((sigma_x / 2.0) ** 2 + tau_xy**2)
    angle = normalize_principal_angle(
        0.5 * math.degrees(math.atan2(-2.0 * tau_xy, sigma_x))
    )
    return {
        "sigma_1_MPa": avg + radius,
        "sigma_2_MPa": avg - radius,
        "principal_angle_deg": angle,
    }


def calculate_bending_torsion(data: dict[str, Any]) -> dict[str, Any]:
    elastic_modulus = average(require(data, "E_GPa", "bending_torsion")) * 1000.0
    mu = average(require(data, "mu", "bending_torsion"))
    diameter = average(require(data, "diameter_mm", "bending_torsion"))
    delta_force = average(require(data, "delta_force_kN", "bending_torsion")) * 1000.0
    bending_arm = average(require(data, "bending_arm_mm", "bending_torsion"))
    torsion_arm = average(require(data, "torsion_arm_mm", "bending_torsion"))
    wz = math.pi * diameter**3 / 32.0
    wp = math.pi * diameter**3 / 16.0
    moment_theory = delta_force * bending_arm
    torque_theory = delta_force * torsion_arm
    sigma_magnitude = moment_theory / wz
    tau_magnitude = torque_theory / wp

    surface_results = []
    rosettes = require(data, "rosettes", "bending_torsion")
    for surface in ("upper", "lower"):
        row = require(rosettes, surface, "bending_torsion.rosettes")
        eps0 = average(require(row, "epsilon_0_micro", f"rosettes.{surface}"))
        eps45 = average(require(row, "epsilon_p45_micro", f"rosettes.{surface}"))
        epsm45 = average(require(row, "epsilon_m45_micro", f"rosettes.{surface}"))
        experimental = principal_from_rosette(elastic_modulus, mu, eps0, eps45, epsm45)
        sigma_x = sigma_magnitude if surface == "upper" else -sigma_magnitude
        theoretical = principal_theory(sigma_x, tau_magnitude)
        surface_results.append({
            "surface": surface,
            "mean_epsilon_0_micro": eps0,
            "mean_epsilon_p45_micro": eps45,
            "mean_epsilon_m45_micro": epsm45,
            "experimental": experimental,
            "theoretical": theoretical,
            "sigma_1_error_pct": relative_error_pct(experimental["sigma_1_MPa"], theoretical["sigma_1_MPa"]),
            "sigma_2_error_pct": relative_error_pct(experimental["sigma_2_MPa"], theoretical["sigma_2_MPa"]),
            "angle_error_deg": abs(experimental["principal_angle_deg"] - theoretical["principal_angle_deg"]),
        })

    half = require(data, "half_bridge_bending", "bending_torsion")
    half_display = average(require(half, "readings_micro", "half_bridge_bending"))
    half_factor = float(half.get("display_factor", 2.0))
    bending_strain = half_display / half_factor * 1e-6
    moment_measured = elastic_modulus * wz * bending_strain

    full = require(data, "full_bridge_torsion", "bending_torsion")
    full_display = average(require(full, "readings_micro", "full_bridge_torsion"))
    full_factor = float(full.get("display_factor", 2.0))
    gamma = full_display / full_factor * 1e-6
    shear_modulus = elastic_modulus / (2.0 * (1.0 + mu))
    torque_measured = shear_modulus * wp * gamma

    return {
        "diameter_mm": diameter,
        "Wz_mm3": wz,
        "Wp_mm3": wp,
        "moment_theoretical_Nmm": moment_theory,
        "torque_theoretical_Nmm": torque_theory,
        "surface_results": surface_results,
        "bending_bridge": {
            "mean_display_micro": half_display,
            "equivalent_epsilon_micro": bending_strain * 1e6,
            "moment_measured_Nmm": moment_measured,
            "relative_error_pct": relative_error_pct(moment_measured, moment_theory),
        },
        "torsion_bridge": {
            "mean_display_micro": full_display,
            "equivalent_gamma_micro": gamma * 1e6,
            "torque_measured_Nmm": torque_measured,
            "relative_error_pct": relative_error_pct(torque_measured, torque_theory),
        },
    }


def calculate_eccentric_tension(data: dict[str, Any]) -> dict[str, Any]:
    delta_force = average(require(data, "delta_force_kN", "eccentric_tension")) * 1000.0
    h = average(require(data, "h_mm", "eccentric_tension"))
    b = average(require(data, "b_mm", "eccentric_tension"))
    area = h * b
    wz = h * b**2 / 6.0
    eps_a = average(require(data, "quarter_bridge_epsilon_a_micro", "eccentric_tension"))
    eps_b = average(require(data, "quarter_bridge_epsilon_b_micro", "eccentric_tension"))
    full_display = average(require(data, "full_bridge_2epsilon_F_micro", "eccentric_tension"))
    half_display = average(require(data, "half_bridge_2epsilon_M_micro", "eccentric_tension"))
    epsilon_f = full_display / 2.0 * 1e-6
    epsilon_m = half_display / 2.0 * 1e-6
    elastic_modulus = delta_force / (area * epsilon_f)
    epsilon_max = eps_a * 1e-6
    eccentricity = abs(epsilon_m * elastic_modulus * wz / delta_force)
    return {
        "h_mm": h,
        "b_mm": b,
        "area_mm2": area,
        "Wz_mm3": wz,
        "mean_epsilon_a_micro": eps_a,
        "mean_epsilon_b_micro": eps_b,
        "epsilon_F_micro": epsilon_f * 1e6,
        "epsilon_M_micro": epsilon_m * 1e6,
        "epsilon_max_micro": epsilon_max * 1e6,
        "E_MPa": elastic_modulus,
        "max_stress_MPa": elastic_modulus * epsilon_max,
        "eccentricity_mm": eccentricity,
    }


CALCULATORS = {
    "mechanical_properties": calculate_mechanical_properties,
    "elastic_constants": calculate_elastic_constants,
    "shear_modulus": calculate_shear_modulus,
    "beam_bending": calculate_beam_bending,
    "beam_deformation": calculate_beam_deformation,
    "bending_torsion": calculate_bending_torsion,
    "eccentric_tension": calculate_eccentric_tension,
}


def calculate_all(payload: dict[str, Any]) -> dict[str, Any]:
    experiments = require(payload, "experiments", "root")
    results: dict[str, Any] = {}
    for name, calculator in CALCULATORS.items():
        results[name] = calculator(require(experiments, name, "experiments"))
    return {
        "metadata": payload.get("metadata", {}),
        "unit_system": "N-mm-MPa; strain readings are microstrain",
        "results": results,
    }


def fmt(value: float | None, digits: int = 3) -> str:
    if value is None:
        return "—"
    return f"{value:.{digits}f}"


def render_markdown(result: dict[str, Any]) -> str:
    metadata = result.get("metadata", {})
    r = result["results"]
    lines = [
        "# 材料力学七次实验自动计算结果",
        "",
        f"- 姓名：{metadata.get('name', '—')}",
        f"- 学号：{metadata.get('student_id', '—')}",
        f"- 班级：{metadata.get('class', '—')}",
        f"- 理论课教师：{metadata.get('teacher', '—')}",
        "",
        "> 单位制：力 N、长度 mm、应力/弹性模量 MPa、应变读数为微应变。",
        "",
        "## 1. 材料力学性能",
        "",
        "| 加载 | 材料 | 屈服强度/MPa | 强度/MPa | 延伸率/% | 断面收缩率/% |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for row in r["mechanical_properties"]["tension"]:
        lines.append(
            f"| 拉伸 | {row['material']} | {fmt(row['yield_strength_MPa'], 2)} | "
            f"{fmt(row['tensile_strength_MPa'], 2)} | {fmt(row['elongation_pct'], 2)} | "
            f"{fmt(row['area_reduction_pct'], 2)} |"
        )
    for row in r["mechanical_properties"]["compression"]:
        lines.append(
            f"| 压缩 | {row['material']} | {fmt(row['yield_strength_MPa'], 2)} | "
            f"{fmt(row['compressive_strength_MPa'], 2)} | — | — |"
        )
    for row in r["mechanical_properties"]["torsion"]:
        lines.append(
            f"| 扭转 | {row['material']} | — | {fmt(row['torsional_strength_MPa'], 2)} | — | — |"
        )

    ec = r["elastic_constants"]
    lines += [
        "",
        "## 2. 材料弹性常数",
        "",
        f"- 截面积：{fmt(ec['area_mm2'], 4)} mm²",
        f"- 弹性模量：{fmt(ec['E_mean_MPa'] / 1000.0, 3)} GPa",
        f"- 泊松比：{fmt(ec['mu_mean'], 4)}",
        f"- 线性拟合：$R^2={fmt(ec['stress_strain_fit']['r2'], 6)}$",
    ]

    sm = r["shear_modulus"]
    lines += [
        "",
        "## 3. 扭转与切变模量",
        "",
        f"- 扭角仪逐差法：$G={fmt(sm['dial_method']['G_report_MPa'] / 1000.0, 3)}$ GPa",
        f"- 半桥电测逐差法：$G={fmt(sm['half_bridge_method']['G_report_MPa'] / 1000.0, 3)}$ GPa",
    ]
    if sm["full_bridge_method"]:
        lines.append(
            f"- 全桥电测逐差法：$G={fmt(sm['full_bridge_method']['G_report_MPa'] / 1000.0, 3)}$ GPa"
        )

    bb = r["beam_bending"]
    lines += [
        "",
        "## 4. 直梁弯曲",
        "",
        f"- 截面惯性矩：{fmt(bb['Iz_mm4'], 2)} mm⁴",
        f"- 实测泊松比：{fmt(bb['mu_mean'], 4)}，相对误差 {fmt(bb['mu_error_pct'], 2)}%",
        f"- 全桥最大弯曲正应变：{fmt(bb['full_bridge']['max_strain_micro'], 2)}×10⁻⁶",
        "",
        "| y/mm | 实验应力/MPa | 理论应力/MPa | 相对误差/% |",
        "|---:|---:|---:|---:|",
    ]
    for row in bb["points"]:
        lines.append(
            f"| {fmt(row['y_mm'], 0)} | {fmt(row['stress_experimental_MPa'], 2)} | "
            f"{fmt(row['stress_theory_MPa'], 2)} | {fmt(row['relative_error_pct'], 2)} |"
        )

    bd = r["beam_deformation"]
    lines += [
        "",
        "## 5. 梁变形",
        "",
        f"- 简支梁跨中挠度：实验 {fmt(bd['simply_supported']['deflection_experimental_mm'], 4)} mm，"
        f"理论 {fmt(bd['simply_supported']['deflection_theoretical_mm'], 4)} mm，"
        f"误差 {fmt(bd['simply_supported']['deflection_error_pct'], 2)}%",
        f"- 支点转角：实验 {fmt(bd['simply_supported']['theta_experimental_rad'], 6)} rad，"
        f"理论 {fmt(bd['simply_supported']['theta_theoretical_rad'], 6)} rad，"
        f"误差 {fmt(bd['simply_supported']['theta_error_pct'], 2)}%",
        f"- 位移互等差值：{fmt(bd['simply_supported']['reciprocity_difference_mm'], 4)} mm",
        f"- 悬臂梁测得金属块质量：{fmt(bd['cantilever']['mass_kg'], 4)} kg",
    ]

    bt = r["bending_torsion"]
    lines += [
        "",
        "## 6. 弯扭组合",
        "",
        "| 表面 | σ₁实验/MPa | σ₁理论/MPa | σ₂实验/MPa | σ₂理论/MPa | 主方向实验/(°) |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for row in bt["surface_results"]:
        lines.append(
            f"| {row['surface']} | {fmt(row['experimental']['sigma_1_MPa'], 3)} | "
            f"{fmt(row['theoretical']['sigma_1_MPa'], 3)} | "
            f"{fmt(row['experimental']['sigma_2_MPa'], 3)} | "
            f"{fmt(row['theoretical']['sigma_2_MPa'], 3)} | "
            f"{fmt(row['experimental']['principal_angle_deg'], 3)} |"
        )
    lines += [
        f"- 半桥弯矩：{fmt(bt['bending_bridge']['moment_measured_Nmm'] / 1000.0, 2)} N·m，"
        f"误差 {fmt(bt['bending_bridge']['relative_error_pct'], 2)}%",
        f"- 全桥扭矩：{fmt(bt['torsion_bridge']['torque_measured_Nmm'] / 1000.0, 2)} N·m，"
        f"误差 {fmt(bt['torsion_bridge']['relative_error_pct'], 2)}%",
    ]

    et = r["eccentric_tension"]
    lines += [
        "",
        "## 7. 偏心拉伸",
        "",
        f"- 弹性模量：{fmt(et['E_MPa'] / 1000.0, 3)} GPa",
        f"- 最大正应变：{fmt(et['epsilon_max_micro'], 2)}×10⁻⁶",
        f"- 最大正应力：{fmt(et['max_stress_MPa'], 2)} MPa",
        f"- 偏心距：{fmt(et['eccentricity_mm'], 3)} mm",
        "",
        "## 自动化边界",
        "",
        "以上数值可由原始数据自动生成；实验现象、断口描述、仪器异常、曲线图片和思考题文字仍需由实验者提供或由固定模板补充。",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="材料力学七次实验统一计算与 Markdown 摘要生成")
    parser.add_argument("--input", required=True, help="统一 JSON 输入文件")
    parser.add_argument("--output-json", required=True, help="计算结果 JSON")
    parser.add_argument("--output-md", required=True, help="计算结果 Markdown")
    args = parser.parse_args()

    input_path = Path(args.input)
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    result = calculate_all(payload)
    output_json = Path(args.output_json)
    output_md = Path(args.output_md)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    output_md.write_text(render_markdown(result), encoding="utf-8")
    print(f"已生成：{output_json}")
    print(f"已生成：{output_md}")


if __name__ == "__main__":
    main()
