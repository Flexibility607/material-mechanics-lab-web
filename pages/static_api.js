(function () {
    "use strict";

    window.MATERIAL_MECHANICS_STATIC_PAGES = true;

    const nativeFetch = window.fetch.bind(window);
    const engineFiles = [
        "material_mechanics_assistant/backend/server.py",
        "04-自动报告计算/lab_report_calculator.py",
        "04-自动报告计算/sample_input.json",
        "03-实验报告/markdown/力学性能.md",
        "03-实验报告/markdown/材料测量.md",
        "03-实验报告/markdown/扭转实验.md",
        "03-实验报告/markdown/直梁弯曲.md",
        "03-实验报告/markdown/梁变形.md",
        "03-实验报告/markdown/弯扭组合.md",
        "03-实验报告/markdown/偏心拉伸.md"
    ];
    const experiments = [
        { id: "B021", key: "mechanical_properties", title: "材料力学性能", report_file: "力学性能.md" },
        { id: "B031", key: "elastic_constants", title: "材料弹性常数 E、μ 的测定", report_file: "材料测量.md" },
        { id: "B041", key: "shear_modulus", title: "扭转实验", report_file: "扭转实验.md" },
        { id: "B051", key: "beam_bending", title: "直梁弯曲实验", report_file: "直梁弯曲.md" },
        { id: "B061", key: "beam_deformation", title: "梁变形实验", report_file: "梁变形.md" },
        { id: "B071", key: "bending_torsion", title: "弯扭组合实验", report_file: "弯扭组合.md" },
        { id: "B081", key: "eccentric_tension", title: "偏心拉伸实验", report_file: "偏心拉伸.md" }
    ];

    let enginePromise = null;
    let calculationQueue = Promise.resolve();

    function jsonResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json; charset=utf-8" }
        });
    }

    function endpoint(input) {
        const value = typeof input === "string" ? input : input.url;
        return new URL(value, document.baseURI).pathname;
    }

    async function loadText(relativePath) {
        const url = new URL(`engine/${relativePath}`, document.baseURI);
        const response = await nativeFetch(url);
        if (!response.ok) throw new Error(`无法载入计算资源：${relativePath}`);
        return response.text();
    }

    async function initializeEngine() {
        if (enginePromise) return enginePromise;
        enginePromise = (async () => {
            if (typeof window.loadPyodide !== "function") {
                throw new Error("Pyodide 未载入，请检查网络连接后刷新页面");
            }
            const pyodide = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.2/full/"
            });
            const sources = await Promise.all(engineFiles.map(loadText));
            engineFiles.forEach((relativePath, index) => {
                const target = `/workspace/${relativePath}`;
                const directory = target.slice(0, target.lastIndexOf("/"));
                pyodide.FS.mkdirTree(directory);
                pyodide.FS.writeFile(target, sources[index], { encoding: "utf8" });
            });
            await pyodide.runPythonAsync(`
import importlib.util
import sys

_server_path = "/workspace/material_mechanics_assistant/backend/server.py"
_spec = importlib.util.spec_from_file_location("material_mechanics_pages_server", _server_path)
_pages_server = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = _pages_server
_spec.loader.exec_module(_pages_server)
`);
            return pyodide;
        })();
        return enginePromise;
    }

    async function catalogResponse() {
        const sample = JSON.parse(await loadText("04-自动报告计算/sample_input.json"));
        return jsonResponse({
            experiments,
            metadata: sample.metadata || {},
            sample: sample.experiments || {},
            unit_system: "N-mm-MPa；应变输入为微应变"
        });
    }

    async function calculateResponse(input, init) {
        const bodyText = init?.body ?? (input instanceof Request ? await input.text() : "{}");
        const payload = JSON.parse(bodyText || "{}");
        const pyodide = await initializeEngine();
        pyodide.globals.set("_web_payload_json", JSON.stringify(payload));
        try {
            const output = await pyodide.runPythonAsync(`
import json
_web_payload = json.loads(_web_payload_json)
_web_result = _pages_server.calculate_auto_report(
    str(_web_payload.get("experiment_id", "")),
    _web_payload.get("data", {}),
    _web_payload.get("metadata", {}),
)
json.dumps(_pages_server.jsonable(_web_result), ensure_ascii=False)
`);
            return jsonResponse(JSON.parse(output));
        } finally {
            pyodide.globals.delete("_web_payload_json");
        }
    }

    window.fetch = async function (input, init = {}) {
        const path = endpoint(input);
        try {
            if (path.endsWith("/api/auto-report/catalog")) return await catalogResponse();
            if (path.endsWith("/api/openai/status")) {
                return jsonResponse({
                    configured: false,
                    model: "",
                    modes: [],
                    note: "GitHub Pages 为静态站点，不在浏览器中保存 OpenAI API 密钥。"
                });
            }
            if (path.endsWith("/api/auto-report/calculate")) {
                const task = () => calculateResponse(input, init);
                const pending = calculationQueue.then(task, task);
                calculationQueue = pending.then(() => undefined, () => undefined);
                return await pending;
            }
            if (path.endsWith("/api/auto-report/refine")) {
                return jsonResponse({ error: "GitHub Pages 静态版不提供 OpenAI 润色；请使用本地网站或桌面应用。" }, 501);
            }
            return nativeFetch(input, init);
        } catch (error) {
            return jsonResponse({ error: error?.message || String(error) }, 500);
        }
    };
})();
