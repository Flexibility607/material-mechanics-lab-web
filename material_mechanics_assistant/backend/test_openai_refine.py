from __future__ import annotations

import json
import unittest

from server import OpenAIIntegrationError, call_openai_responses, validate_refined_report


ORIGINAL = """# 材料力学实验报告

- 学号：3088

## 一、实验结论

测得 $G=27.727\\ \\mathrm{GPa}$，数据变化基本符合理论规律。

| 项目 | 数值 |
|---|---:|
| 切变模量 | 27.727 |

![原图](/report-images/demo/page-1.png)
"""


class FakeResponse:
    def __init__(self, text: str):
        self.body = json.dumps({
            "output": [{
                "type": "message",
                "content": [{"type": "output_text", "text": text}],
            }]
        }, ensure_ascii=False).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        return self.body


class OpenAIRefineTest(unittest.TestCase):
    def test_accepts_prose_only_change_and_builds_responses_request(self):
        captured = {}
        refined = ORIGINAL.replace("数据变化基本符合理论规律", "实验数据的变化趋势与理论规律基本一致")

        def opener(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse(refined)

        result = call_openai_responses(
            ORIGINAL,
            api_key="test-key",
            model="test-model",
            api_url="https://example.test/v1/responses",
            opener=opener,
        )
        sent = json.loads(captured["request"].data.decode("utf-8"))
        self.assertEqual(sent["model"], "test-model")
        self.assertNotIn("reasoning", sent)
        self.assertFalse(sent["store"])
        self.assertEqual(captured["request"].headers["Authorization"], "Bearer test-key")
        self.assertEqual(result["report_markdown"], refined.strip())
        self.assertEqual(result["protection_check"], "passed")

    def test_rejects_changed_number(self):
        refined = ORIGINAL.replace("27.727", "28.000", 1)

        def opener(request, timeout):
            return FakeResponse(refined)

        with self.assertRaises(OpenAIIntegrationError) as context:
            call_openai_responses(ORIGINAL, api_key="test-key", opener=opener)
        self.assertEqual(context.exception.status, 422)
        self.assertIn("发生变化", str(context.exception))

    def test_validation_rejects_heading_and_table_changes(self):
        changed = ORIGINAL.replace("## 一、实验结论", "## 一、结果").replace("切变模量", "剪切模量")
        problems = validate_refined_report(ORIGINAL, changed)
        self.assertIn("标题发生变化", problems)
        self.assertIn("数据表发生变化", problems)

    def test_validation_rejects_changed_unit(self):
        changed = ORIGINAL.replace("GPa", "MPa", 1)
        problems = validate_refined_report(ORIGINAL, changed)
        self.assertIn("单位发生变化", problems)


if __name__ == "__main__":
    unittest.main()
