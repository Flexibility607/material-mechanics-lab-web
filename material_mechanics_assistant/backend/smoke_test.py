from __future__ import annotations

import csv
import re
from pathlib import Path

from server import (
    AUTO_REPORT_EXPERIMENTS,
    AUTO_REPORT_SAMPLE,
    EXPERIMENTS,
    EXPERIMENT_ROOT,
    calculate_auto_report,
    process_rows,
)


def read_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def main():
    for exp in EXPERIMENTS:
        folder = EXPERIMENT_ROOT / exp["folder"]
        sample_dir = folder / "样例数据"
        samples = sorted(sample_dir.glob("*.csv"))
        if not samples:
            print(f"{exp['id']} SKIP no sample csv")
            continue
        payload = process_rows(exp, read_rows(samples[0]))
        print(f"{exp['id']} OK rows={len(payload['results'])} summary_keys={len(payload['summary'])}")

    sample = __import__("json").loads(AUTO_REPORT_SAMPLE.read_text(encoding="utf-8"))
    for exp in AUTO_REPORT_EXPERIMENTS:
        payload = calculate_auto_report(
            exp["id"], sample["experiments"][exp["key"]], sample.get("metadata", {})
        )
        if "实验结论" not in payload["report_markdown"]:
            raise AssertionError(f"{exp['id']} 自动报告缺少实验结论")
        report = payload["report_markdown"]
        for expected in (
            "- 理论课程教师：mqc老师",
            "- 实验课程教师：zm老师，sxh老师",
            "- 学号：3088",
            "- 班级：242311",
            "- 姓名：时效性",
            "- 同组者：龙小糖",
            "- 日期：2026.7.12",
            "## 附：原始记录页\n\n略。",
        ):
            if expected not in report:
                raise AssertionError(f"{exp['id']} 自动报告缺少：{expected}")
        if "<details>" in report or re.search(r"/report-images/[^)]+/page-\d+\.png", report):
            raise AssertionError(f"{exp['id']} 自动报告仍包含原始记录页图片")
        if exp["id"] == "B041":
            for expected in (
                "| $F$/kN | 0.5 | 1.5 | 2.5 | 3.5 | 4.5 |",
                "G&=\\frac{\\Delta F\\,a\\,L\\,b}{\\Delta\\delta\\,I_p}",
                "### 3. 电测法求 $G$——半桥原始数据",
                "\\tau=\\frac{T}{W_p}",
                "全桥原始读数如下",
                "T=Fa,\\qquad \\varphi=\\frac{\\delta}{b}",
                "| $\\varphi/10^{-4}\\ \\mathrm{rad}$ | 0 | 7.38 | 15.34 | 23.59 | 31.46 |",
                "![扭矩—扭转角直线拟合图](data:image/svg+xml;base64,",
                "G_{T-\\varphi}&=\\frac{k_{T-\\varphi}L}{I_p}",
                "### 5. 电测法的平均增量结果",
                "![切应力—切应变直线拟合图](data:image/svg+xml;base64,",
            ):
                if expected not in report:
                    raise AssertionError(f"B041 自动报告缺少：{expected}")
            if "计算项" in report or "复核" in report:
                raise AssertionError("B041 自动报告仍包含计算项表格或复核内容")
        if exp["id"] == "B051":
            for expected in (
                "| 应变片编号 | 1 | 2 | 3 | 4 | 5 | 7 | 8 | 9 | 10 |",
                "| 第 1 次 | 43 | -157 | -125 | -63 | -2 | 60 | 119 | 151 | -45 |",
                "| 平均 $\\bar\\varepsilon$ | 43.5 | -156 | -124.5 | -63 | -2 | 60 | 119 | 152 | -44 |",
                "![截面高度—弯曲正应力曲线](data:image/svg+xml;base64,",
                "\\mu_1=\\left|\\frac{43.5}{-156}\\right|",
                "\\mu_2=\\left|\\frac{-44}{152}\\right|",
            ):
                if expected not in report:
                    raise AssertionError(f"B051 自动报告缺少：{expected}")
            if "损坏" in report:
                raise AssertionError("B051 自动报告仍把 3 号测点标记为损坏")
        if exp["id"] == "B061":
            for expected in (
                "两加载位置的原始应变数据如下",
                "| 第 1 组 $\\varepsilon_1$ | 151 | 151 | 152 | 151 | 151.25 |",
                "| 第 2 组 $\\varepsilon_2$ | 66 | 65 | 65 | 64 | 65 |",
                "| $\\Delta\\varepsilon=\\varepsilon_1-\\varepsilon_2$ | 85 | 86 | 87 | 87 | 86.25 |",
                "\\Delta\\bar\\varepsilon",
                "=\\bar\\varepsilon_1-\\bar\\varepsilon_2",
            ):
                if expected not in report:
                    raise AssertionError(f"B061 自动报告缺少：{expected}")
            readings = payload["input"]["cantilever"]["strain_readings_micro"]
            if len(readings) != 4 or any(len(row) != 2 for row in readings):
                raise AssertionError("B061 悬臂梁输入不是若干行 2 列的两组原始应变")
            mutated_data = __import__("json").loads(__import__("json").dumps(sample["experiments"][exp["key"]]))
            mutated_data["cantilever"]["strain_readings_micro"][0][0] = 150
            mutated_report = calculate_auto_report(exp["id"], mutated_data, sample.get("metadata", {}))["report_markdown"]
            for expected in (
                "以下两组均为直接输入的原始应变读数，差值由程序在数据处理过程中计算",
                "| 第 1 组 $\\varepsilon_1$ | 150 | 151 | 152 | 151 | 151 |",
                "| $\\Delta\\varepsilon=\\varepsilon_1-\\varepsilon_2$ | 84 | 86 | 87 | 87 | 86 |",
                "\\Delta\\bar\\varepsilon=\\bar\\varepsilon_1-\\bar\\varepsilon_2",
            ):
                if expected not in mutated_report:
                    raise AssertionError(f"B061 动态报告缺少：{expected}")
        if exp["id"] == "B071":
            for expected in (
                "三个测点的实际方位角可按布片情况填写",
                "当前算例默认采用 $+45^\\circ$、$0^\\circ$ 和 $-45^\\circ$",
                "半桥桥路组合固定为当前的上、下表面 $0^\\circ$ 应变片组合",
                "全桥桥路组合固定为当前的 $\\pm45^\\circ$ 应变片扭转组合",
            ):
                if expected not in report:
                    raise AssertionError(f"B071 自动报告缺少：{expected}")
            rosettes = payload["input"]["rosettes"]
            for surface in ("upper", "lower"):
                angles = [point["angle_deg"] for point in rosettes[surface]["measurement_points"]]
                if angles != [45.0, 0.0, -45.0]:
                    raise AssertionError(f"B071 {surface} 默认方位角不正确：{angles}")
            mutated_data = __import__("json").loads(__import__("json").dumps(sample["experiments"][exp["key"]]))
            mutated_data["rosettes"]["upper"]["measurement_points"][0]["angle_deg"] = 35
            mutated_report = calculate_auto_report(exp["id"], mutated_data, sample.get("metadata", {}))["report_markdown"]
            for expected in (
                "| 上表面 | $+35^\\circ$ | -149 | -147 | -147 | -148 | -147.75 |",
                "桥路组合固定为当前的上、下表面 $0^\\circ$ 应变片组合",
                "桥路组合固定为当前的 $\\pm45^\\circ$ 应变片扭转全桥",
            ):
                if expected not in mutated_report:
                    raise AssertionError(f"B071 动态报告缺少：{expected}")
        print(f"{exp['id']} REPORT OK markdown={len(payload['report_markdown'])}")


if __name__ == "__main__":
    main()
