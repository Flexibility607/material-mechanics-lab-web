from __future__ import annotations

import re
import unittest
from pathlib import Path


REPORTS = {
    "B021": ("力学性能.md", (1, 2, 3)),
    "B031": ("材料测量.md", (2, 3)),
    "B041": ("扭转实验.md", (1, 2)),
    "B051": ("直梁弯曲.md", (1, 2, 3)),
    "B061": ("梁变形.md", (1, 2, 3, 4, 5)),
    "B071": ("弯扭组合.md", (1,)),
    "B081": ("偏心拉伸.md", (1, 2)),
}

THOUGHT_HEADING_RE = re.compile(r"^## [六七八]、思考题[ \t]*$", re.MULTILINE)
QUESTION_HEADING_RE = re.compile(
    r"^###[ \t]+(\d+)\.[ \t]*(.*?)[ \t]*$",
    re.MULTILINE,
)
ANY_LEVEL_THREE_HEADING_RE = re.compile(r"^###[ \t]+.*$", re.MULTILINE)
SECTION_END_RE = re.compile(r"^(?:##[ \t]+|---[ \t]*$)", re.MULTILINE)
TOP_LEVEL_BULLET_RE = re.compile(r"^- \S", re.MULTILINE)
NUMBERED_ANSWER_RE = re.compile(r"^[ \t]*\d+\.[ \t]+", re.MULTILINE)


class ThoughtQuestionFormatTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.repo_root = Path(__file__).resolve().parents[2]
        cls.source_root = cls.repo_root / "03-实验报告" / "markdown"
        cls.pages_root = (
            cls.repo_root / "pages" / "engine" / "03-实验报告" / "markdown"
        )

    def extract_thought_section(self, text: str, label: str) -> str:
        heading = THOUGHT_HEADING_RE.search(text)
        self.assertIsNotNone(heading, f"{label} 缺少规范的思考题二级标题")

        remainder = text[heading.end() :]
        section_end = SECTION_END_RE.search(remainder)
        section = remainder[: section_end.start() if section_end else None].strip()
        self.assertTrue(section, f"{label} 的思考题段为空")
        return section

    def test_source_and_pages_markdown_are_identical(self) -> None:
        for experiment_id, (filename, _) in REPORTS.items():
            with self.subTest(experiment=experiment_id):
                source_path = self.source_root / filename
                pages_path = self.pages_root / filename
                self.assertTrue(source_path.is_file(), f"缺少源文件：{source_path}")
                self.assertTrue(pages_path.is_file(), f"缺少 Pages 文件：{pages_path}")
                self.assertEqual(
                    source_path.read_bytes(),
                    pages_path.read_bytes(),
                    f"{experiment_id} 的源 Markdown 与 Pages 镜像不一致",
                )

    def test_thought_questions_have_stems_and_bulleted_answers(self) -> None:
        for experiment_id, (filename, expected_numbers) in REPORTS.items():
            with self.subTest(experiment=experiment_id):
                source_path = self.source_root / filename
                text = source_path.read_text(encoding="utf-8-sig")
                section = self.extract_thought_section(text, experiment_id)
                questions = list(QUESTION_HEADING_RE.finditer(section))
                level_three_headings = ANY_LEVEL_THREE_HEADING_RE.findall(section)

                self.assertEqual(
                    len(questions),
                    len(level_three_headings),
                    f"{experiment_id} 存在格式不规范的三级标题",
                )
                self.assertEqual(
                    tuple(int(question.group(1)) for question in questions),
                    expected_numbers,
                    f"{experiment_id} 的思考题题号不符合预期",
                )

                for index, question in enumerate(questions):
                    question_number = int(question.group(1))
                    stem = question.group(2).strip()
                    body_end = (
                        questions[index + 1].start()
                        if index + 1 < len(questions)
                        else len(section)
                    )
                    body = section[question.end() : body_end]

                    self.assertTrue(
                        stem,
                        f"{experiment_id} 第 {question_number} 题缺少题干",
                    )
                    self.assertRegex(
                        body,
                        TOP_LEVEL_BULLET_RE,
                        f"{experiment_id} 第 {question_number} 题缺少顶格分点答案",
                    )
                    numbered_answer = NUMBERED_ANSWER_RE.search(body)
                    self.assertIsNone(
                        numbered_answer,
                        f"{experiment_id} 第 {question_number} 题仍含编号答案："
                        f"{numbered_answer.group(0).strip() if numbered_answer else ''}",
                    )


if __name__ == "__main__":
    unittest.main(verbosity=2)
