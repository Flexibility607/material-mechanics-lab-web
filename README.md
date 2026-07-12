# 材料力学实验报告生成器（网站版）

面向 7 次材料力学实验的自动报告生成网站。输入实验报告中的原始测量数据后，程序调用统一 Python 计算器更新数据表、计算过程和数值结论，其余报告正文保持不变。

原始数列和矩阵使用可增删的表格编辑器；每个实验都可下载带当前算例的 CSV 模板，在 Excel 等表格软件中批量修改后重新导入。报告信息输入框为空时，会以灰色显示并自动采用默认值。

点击“计算并生成报告”后，完整报告会在独立的新页面中打开；原始记录扫描页不进入生成结果，报告末尾统一注明“原始记录页：略”。

## 在线版与本地版

- GitHub Pages 在线版：计算器通过 Pyodide 在浏览器本地运行，不上传实验数据。
- 本地网站：使用 Python HTTP 服务，除自动计算外还可通过服务端环境变量接入 OpenAI 报告轻微润色。
- 公开仓库未包含原始扫描图片，并已将姓名、学号、班级、教师和同组者替换为示例字段。

## 本地运行

需要 Python 3.10 或更高版本。在仓库根目录执行：

```powershell
.\material_mechanics_assistant\run.ps1
```

然后打开 `http://127.0.0.1:8765/combined-report`。

OpenAI 为可选功能。请在 `material_mechanics_assistant/.env` 中配置，切勿提交密钥：

```dotenv
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5-mini
```

## 目录

| 路径 | 内容 |
|---|---|
| `material_mechanics_assistant/` | 网站前端、Python 服务端及测试 |
| `04-自动报告计算/` | 7 次实验的统一计算代码和脱敏算例 |
| `03-实验报告/markdown/` | 脱敏后的报告参考正文 |
| `pages/` | 可直接部署到 GitHub Pages 的静态版 |
| `.github/workflows/pages.yml` | GitHub Pages 自动部署工作流 |

## 验证

```powershell
python .\04-自动报告计算\test_calculator.py
python .\04-自动报告计算\test_sample_shapes.py
python .\material_mechanics_assistant\backend\smoke_test.py
node .\material_mechanics_assistant\frontend\csv_roundtrip_test.cjs
```

与原扫描件的逐页回归比较只在私有工作区执行，避免扫描图片和身份字段进入公开仓库。

GitHub Pages 首次计算需要下载浏览器 Python 运行时，速度取决于网络。静态托管不具备安全保管 OpenAI API 密钥的服务端，因此在线版禁用 AI 润色；本地网站和桌面应用仍保留该功能。
