(function () {
    "use strict";

    const { Storage, Csv, Format, enableTableKeyboard } = window.AssistantCommon;
    const state = {
        experiments: [],
        current: null,
        fields: [],
        fieldMeta: {},
        parameters: [],
        formulas: [],
        template: [],
        sample: [],
        rows: [],
        result: null
    };

    const els = {};

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        bindElements();
        bindEvents();
        restoreTheme();
        await loadExperiments();
    }

    function bindElements() {
        [
            "experimentList", "currentCode", "currentTitle", "currentFocus", "serverState",
            "loadTemplateBtn", "addRowBtn", "trimRowsBtn", "importBtn", "exportBtn",
            "calculateBtn", "csvFileInput", "tableWrap", "tableMeta", "resultSection",
            "summaryHighlights", "summaryConclusion", "resultTableWrap", "resultMeta",
            "summaryJson", "themeToggle", "toast", "parameterGuide", "formulaGuide",
            "theoryMeta", "calcStatus"
        ].forEach(id => {
            els[id] = document.getElementById(id);
        });
    }

    function bindEvents() {
        els.loadTemplateBtn.addEventListener("click", () => {
            state.rows = cloneRows(preferredExampleRows());
            Storage.clearRows(state.current.id);
            renderTable();
            hideResult();
            toast("已载入完整示例数据");
        });
        els.addRowBtn.addEventListener("click", () => {
            state.rows.push(blankRow());
            renderTable();
            persistRows();
        });
        els.trimRowsBtn.addEventListener("click", () => {
            syncRowsFromDom();
            state.rows = state.rows.filter(row => Object.values(row).some(value => String(value ?? "").trim() !== ""));
            if (!state.rows.length) state.rows.push(blankRow());
            renderTable();
            persistRows();
            hideResult();
        });
        els.importBtn.addEventListener("click", () => els.csvFileInput.click());
        els.csvFileInput.addEventListener("change", importCsv);
        els.exportBtn.addEventListener("click", exportCsv);
        els.calculateBtn.addEventListener("click", calculate);
        els.themeToggle.addEventListener("click", toggleTheme);
    }

    async function loadExperiments() {
        try {
            setServerState("连接正常", "ok");
            const response = await fetch("/api/experiments");
            if (!response.ok) throw new Error(await response.text());
            state.experiments = await response.json();
            renderExperimentList();
            const first = state.experiments[0];
            if (first) await selectExperiment(first.id);
        } catch (error) {
            setServerState("连接失败", "bad");
            toast(`无法连接后端：${error.message}`, true);
        }
    }

    async function selectExperiment(id) {
        try {
            const response = await fetch(`/api/experiments/${encodeURIComponent(id)}`);
            if (!response.ok) throw new Error(await response.text());
            const meta = await response.json();
            state.current = meta;
            state.fields = meta.fields || [];
            state.fieldMeta = meta.field_meta || {};
            state.parameters = meta.parameters || [];
            state.formulas = meta.formulas || [];
            state.template = cloneRows(meta.template || []);
            state.sample = cloneRows(meta.sample || []);
            state.rows = Storage.loadRows(meta.id) || cloneRows(preferredExampleRows());
            if (!state.rows.length) state.rows.push(blankRow());
            renderExperimentList();
            renderExperimentHeader();
            renderTheory();
            renderTable();
            hideResult();
        } catch (error) {
            toast(`载入实验失败：${error.message}`, true);
        }
    }

    function renderExperimentList() {
        els.experimentList.innerHTML = state.experiments.map(exp => `
            <button class="experiment-item ${state.current?.id === exp.id ? "active" : ""}" data-id="${escapeHtml(exp.id)}">
                <span class="experiment-item-code">${escapeHtml(exp.code)}</span>
                <span class="experiment-item-main">
                    <span class="experiment-item-title">${escapeHtml(exp.title)}</span>
                    <span class="experiment-item-focus">${escapeHtml(exp.focus)}</span>
                </span>
            </button>
        `).join("");
        els.experimentList.querySelectorAll("button[data-id]").forEach(button => {
            button.addEventListener("click", () => selectExperiment(button.dataset.id));
        });
    }

    function renderExperimentHeader() {
        els.currentCode.textContent = state.current.code;
        els.currentTitle.textContent = state.current.title;
        els.currentFocus.textContent = state.current.focus;
    }

    function renderTheory() {
        els.theoryMeta.textContent = `${state.parameters.length} 组参数，${state.formulas.length} 条计算关系`;
        els.parameterGuide.innerHTML = state.parameters.map(param => `
            <article class="parameter-card">
                <div class="parameter-symbol">${escapeHtml(param.symbol || "")}</div>
                <div class="parameter-main">
                    <div class="parameter-name">
                        ${escapeHtml(param.name || "")}
                        ${param.unit ? `<span class="parameter-unit">${escapeHtml(param.unit)}</span>` : ""}
                    </div>
                    <div class="parameter-description">${escapeHtml(param.description || "")}</div>
                    <div class="parameter-fields">${(param.fields || []).map(field => `<code>${escapeHtml(field)}</code>`).join("")}</div>
                </div>
            </article>
        `).join("");
        els.formulaGuide.innerHTML = state.formulas.map(formula => `
            <div class="formula-chip">${escapeHtml(formula)}</div>
        `).join("");
        queueMathRender([els.parameterGuide, els.formulaGuide]);
    }

    function renderTable() {
        els.tableWrap.dataset.columns = state.fields.length;
        const sampleNote = state.sample.length ? `完整示例 ${state.sample.length} 行` : `模板 ${state.template.length} 行`;
        els.tableMeta.textContent = `${state.rows.length} 行，${state.fields.length} 个字段，${sampleNote}`;
        const header = `
            <thead>
                <tr>
                    ${state.fields.map(field => renderFieldHeader(field)).join("")}
                    <th class="row-action-head"></th>
                </tr>
            </thead>
        `;
        const body = state.rows.map((row, rowIndex) => `
            <tr>
                ${state.fields.map(field => `
                    <td>
                        <input data-row="${rowIndex}" data-field="${escapeHtml(field)}" value="${escapeHtml(row[field] ?? "")}">
                    </td>
                `).join("")}
                <td class="row-action-cell">
                    <button class="icon-button row-delete" data-delete-row="${rowIndex}" title="删除本行" aria-label="删除本行">×</button>
                </td>
            </tr>
        `).join("");
        els.tableWrap.innerHTML = `<table class="data-table">${header}<tbody>${body}</tbody></table>`;
        els.tableWrap.querySelectorAll("input[data-field]").forEach(input => {
            input.addEventListener("input", event => {
                const rowIndex = Number(event.target.dataset.row);
                const field = event.target.dataset.field;
                state.rows[rowIndex][field] = event.target.value;
                persistRows();
            });
        });
        els.tableWrap.querySelectorAll("[data-delete-row]").forEach(button => {
            button.addEventListener("click", () => {
                const rowIndex = Number(button.dataset.deleteRow);
                state.rows.splice(rowIndex, 1);
                if (!state.rows.length) state.rows.push(blankRow());
                renderTable();
                persistRows();
                hideResult();
            });
        });
        enableTableKeyboard(els.tableWrap);
        queueMathRender([els.tableWrap]);
    }

    function renderFieldHeader(field) {
        const meta = fieldMeta(field);
        const title = `${meta.name || field}${meta.unit ? ` (${meta.unit})` : ""}\n${meta.description || ""}\nCSV字段：${field}`;
        return `
            <th title="${escapeHtml(title)}">
                <span class="field-symbol">${escapeHtml(meta.symbol || field)}</span>
                <span class="field-name">${escapeHtml(meta.name || field)}${meta.unit ? ` / ${escapeHtml(meta.unit)}` : ""}</span>
                <code class="field-code">${escapeHtml(field)}</code>
            </th>
        `;
    }

    async function calculate() {
        if (!state.current) return;
        syncRowsFromDom();
        try {
            els.calculateBtn.disabled = true;
            setServerState("计算中", "busy");
            showCalcStatus("计算中，正在调用数据处理脚本...", "busy");
            const response = await fetch(`/api/experiments/${encodeURIComponent(state.current.id)}/process`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: state.rows })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || response.statusText);
            state.result = data;
            persistRows();
            renderResult(data);
            setServerState("连接正常", "ok");
            showCalcStatus(`计算完成：生成 ${data.results?.length || 0} 行处理结果。`, "ok");
            els.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
            toast(`计算完成，生成 ${data.results?.length || 0} 行结果`);
        } catch (error) {
            setServerState("计算失败", "bad");
            renderError(error);
            showCalcStatus(`计算失败：${error.message}`, "bad");
            els.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
            toast(`计算失败：${error.message}`, true);
        } finally {
            els.calculateBtn.disabled = false;
        }
    }

    function renderResult(data) {
        const results = data.results || [];
        const summary = data.summary || {};
        els.resultSection.classList.remove("hidden");
        els.resultMeta.textContent = `${results.length} 行结果`;
        els.summaryHighlights.innerHTML = extractHighlights(summary).map(item => `
            <div class="summary-card">
                <div class="summary-label">${escapeHtml(Format.label(item.key))}</div>
                <div class="summary-value">${escapeHtml(Format.value(item.value))}</div>
            </div>
        `).join("");
        renderConclusion(summary);
        renderOutputTable(results);
        els.summaryJson.textContent = JSON.stringify(summary, null, 2);
        queueMathRender([els.resultSection]);
    }

    function renderError(error) {
        els.resultSection.classList.remove("hidden");
        els.resultMeta.textContent = "计算未完成";
        els.summaryHighlights.innerHTML = "";
        els.summaryConclusion.classList.remove("hidden");
        els.summaryConclusion.innerHTML = `<strong>错误：</strong>${escapeHtml(error.message || String(error))}`;
        els.resultTableWrap.innerHTML = "";
        els.summaryJson.textContent = "";
    }

    function renderConclusion(summary) {
        const conclusion = summary.conclusion;
        if (!conclusion) {
            els.summaryConclusion.classList.add("hidden");
            els.summaryConclusion.innerHTML = "";
            return;
        }
        els.summaryConclusion.classList.remove("hidden");
        if (typeof conclusion === "object") {
            els.summaryConclusion.innerHTML = Object.entries(conclusion).map(([key, value]) => `
                <div><strong>${escapeHtml(Format.label(key))}：</strong>${escapeHtml(Format.value(value))}</div>
            `).join("");
        } else {
            els.summaryConclusion.textContent = String(conclusion);
        }
    }

    function renderOutputTable(rows) {
        if (!rows.length) {
            els.resultTableWrap.innerHTML = "";
            return;
        }
        const fields = Object.keys(rows[0]);
        const visibleRows = rows.slice(0, 200);
        els.resultTableWrap.innerHTML = `
            <table class="output-table">
                <thead><tr>${fields.map(field => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead>
                <tbody>
                    ${visibleRows.map(row => `
                        <tr>${fields.map(field => `<td>${escapeHtml(Format.value(row[field]))}</td>`).join("")}</tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    function extractHighlights(summary) {
        const preferred = [
            "selected_run", "selected_group", "coverage_complete", "validity_judgement",
            "hooke_law_verified", "increment_count", "repetition_count",
            "mean_E_MPa", "mean_mu", "mean_G_MPa", "mean_sigma_max_MPa",
            "mean_eccentricity_e_mm", "mean_delta_F_kN", "mean_delta_load_N",
            "mean_delta_strain_micro", "strain_increment_cv_pct"
        ];
        const items = [];
        preferred.forEach(key => {
            if (summary[key] !== undefined && isPrimitive(summary[key])) {
                items.push({ key, value: summary[key] });
            }
        });
        if (summary.loading_scheme && typeof summary.loading_scheme === "object") {
            Object.entries(summary.loading_scheme).forEach(([key, value]) => {
                if (items.length < 8 && isPrimitive(value)) items.push({ key, value });
            });
        }
        Object.entries(summary).forEach(([key, value]) => {
            if (items.length < 8 && isPrimitive(value) && !items.some(item => item.key === key)) {
                items.push({ key, value });
            }
        });
        return items.slice(0, 8);
    }

    function importCsv(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            state.rows = Csv.parse(String(reader.result || ""));
            if (!state.rows.length) state.rows.push(blankRow());
            state.fields.forEach(field => {
                state.rows.forEach(row => {
                    if (row[field] === undefined) row[field] = "";
                });
            });
            renderTable();
            persistRows();
            hideResult();
            toast("CSV 已导入");
            event.target.value = "";
        };
        reader.readAsText(file, "utf-8");
    }

    function exportCsv() {
        if (!state.current) return;
        syncRowsFromDom();
        Csv.download(`${state.current.id}_input.csv`, Csv.stringify(state.rows, state.fields));
    }

    function syncRowsFromDom() {
        els.tableWrap.querySelectorAll("input[data-field]").forEach(input => {
            const rowIndex = Number(input.dataset.row);
            const field = input.dataset.field;
            if (!state.rows[rowIndex]) state.rows[rowIndex] = blankRow();
            state.rows[rowIndex][field] = input.value;
        });
    }

    function persistRows() {
        if (state.current) Storage.saveRows(state.current.id, state.rows);
    }

    function blankRow() {
        return Object.fromEntries(state.fields.map(field => [field, ""]));
    }

    function preferredExampleRows() {
        return state.sample.length ? state.sample : state.template;
    }

    function fieldMeta(field) {
        return state.fieldMeta[field] || {
            symbol: field,
            name: field,
            unit: "",
            description: "辅助输入字段；保留该字段名用于 CSV 导入导出和脚本处理。"
        };
    }

    function cloneRows(rows) {
        return rows.map(row => ({ ...row }));
    }

    function hideResult() {
        state.result = null;
        els.resultSection.classList.add("hidden");
        els.summaryHighlights.innerHTML = "";
        els.summaryConclusion.innerHTML = "";
        els.resultTableWrap.innerHTML = "";
        els.summaryJson.textContent = "";
        els.calcStatus.classList.add("hidden");
        els.calcStatus.textContent = "";
    }

    function setServerState(text, kind) {
        els.serverState.textContent = text;
        els.serverState.dataset.kind = kind;
    }

    function restoreTheme() {
        const theme = localStorage.getItem("material-mechanics:theme");
        document.body.classList.toggle("dark-mode", theme === "dark");
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle("dark-mode");
        localStorage.setItem("material-mechanics:theme", isDark ? "dark" : "light");
    }

    function toast(text, isError = false) {
        els.toast.textContent = text;
        els.toast.classList.toggle("error", isError);
        els.toast.classList.remove("hidden");
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
    }

    function isPrimitive(value) {
        return value === null || ["string", "number", "boolean"].includes(typeof value);
    }

    function showCalcStatus(text, kind) {
        els.calcStatus.textContent = text;
        els.calcStatus.dataset.kind = kind;
        els.calcStatus.classList.remove("hidden");
    }

    function queueMathRender(elements) {
        const targets = elements.filter(Boolean);
        let tries = 0;
        const attempt = () => {
            if (window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise(targets).catch(() => {});
                return;
            }
            tries += 1;
            if (tries < 20) window.setTimeout(attempt, 150);
        };
        attempt();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
