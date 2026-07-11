from __future__ import annotations

import csv
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
        print(f"{exp['id']} REPORT OK markdown={len(payload['report_markdown'])}")


if __name__ == "__main__":
    main()
