(function () {
    "use strict";

    const state = {
        catalog: null,
        selectedId: "B021",
        data: {},
        reportMarkdown: "",
        calculatedMarkdown: "",
        reportHtml: "",
        openAIConfigured: false,
        refineBusy: false
    };

    const els = {};
    const storageKey = "material-mechanics:auto-report:v3";
    const metadataInputMap = {
        teacher: "teacher",
        student_id: "studentId",
        class: "className",
        name: "studentName",
        partner: "partners",
        date: "date"
    };

    const labels = {
        material: "材料",
        tension: "拉伸试件",
        compression: "压缩试件",
        torsion: "扭转试件",
        d0_mm: "初始直径 d₀ / mm",
        d0_measurements_mm: "直径原始测量值 / mm",
        d1_mm: "断后最小直径 d₁ / mm",
        report_d1_mm: "报告采用的平均断后直径 / mm",
        l0_mm: "初始标距 l₀ / mm",
        l1_mm: "断后标距 l₁ / mm",
        report_l1_mm: "报告采用的平均断后标距 / mm",
        h0_mm: "初始高度 h₀ / mm",
        h1_mm: "压缩后高度 h₁ / mm",
        terminal_force_kN: "压缩终止载荷 Fᵦ / kN",
        strength_diameter_mm: "强度计算采用直径 / mm",
        yield_force_kN: "屈服载荷 Fₛ / kN",
        max_force_kN: "峰值或破坏载荷 Fᵦ / kN",
        max_torque_Nm: "最大扭矩 Tᵦ / N·m",
        twist_angle_deg: "扭转角 φ / °",
        observation: "实验现象",
        data_note: "数据说明",
        width_mm: "宽度测量值 / mm",
        thickness_mm: "厚度测量值 / mm",
        height_mm: "高度测量值 / mm",
        axial_channels: "轴向应变通道索引",
        transverse_channels: "横向应变通道索引",
        runs: "重复加载",
        loads_kN: "载荷序列 / kN",
        readings_micro: "应变读数 / 10⁻⁶",
        diameter_mm: "直径测量值 / mm",
        torque_arm_mm: "扭矩力臂 a / mm",
        gauge_length_mm: "测量标距 L / mm",
        dial_arm_mm: "百分表臂长 b / mm",
        dial_run: "扭角仪数据",
        dial_mm: "百分表读数 / mm",
        half_bridge_runs: "半桥重复数据",
        channel_1_micro: "通道 1 / 10⁻⁶",
        channel_2_micro: "通道 2 / 10⁻⁶",
        reading_to_gamma_factor: "显示值到切应变系数",
        full_bridge: "全桥数据",
        E_GPa: "弹性模量 E / GPa",
        mu: "泊松比 μ",
        delta_force_kN: "载荷增量 ΔF / kN",
        load_spacing_mm: "加载点间距 a / mm",
        longitudinal_points: "纵向应变测点",
        gage: "应变片编号",
        y_mm: "距中性层 y / mm",
        valid: "读数有效",
        note: "备注",
        poisson_surfaces: "上下表面泊松比读数",
        surface: "表面",
        longitudinal_micro: "纵向应变 / 10⁻⁶",
        transverse_micro: "横向应变 / 10⁻⁶",
        display_factor: "桥路显示系数",
        simply_supported: "简支梁",
        cantilever: "悬臂梁",
        length_mm: "跨度 L / mm",
        delta_load_N: "载荷增量 ΔP / N",
        central_deflection_mm: "跨中挠度重复值 / mm",
        angle_indicator_delta_mm: "转角百分表位移 / mm",
        angle_arm_mm: "转角测量臂长 / mm",
        reciprocity_12_mm: "互等位移 ΔW₁₂ / mm",
        reciprocity_21_mm: "互等位移 ΔW₂₁ / mm",
        curve_points: "挠曲线测点",
        x_mm: "位置 x / mm",
        deflection_mm: "挠度 / mm",
        position_spacing_mm: "两加载位置间距 l₁₂ / mm",
        strain_position_1_micro: "位置 1 应变 / 10⁻⁶",
        strain_position_2_micro: "位置 2 应变 / 10⁻⁶",
        gravity_m_s2: "重力加速度 g / m·s⁻²",
        bending_arm_mm: "弯曲力臂 Lₘ / mm",
        torsion_arm_mm: "扭转力臂 Lₜ / mm",
        rosettes: "三向应变花",
        upper: "上表面",
        lower: "下表面",
        epsilon_0_micro: "0° 应变 / 10⁻⁶",
        epsilon_p45_micro: "+45° 应变 / 10⁻⁶",
        epsilon_m45_micro: "−45° 应变 / 10⁻⁶",
        half_bridge_bending: "弯矩半桥",
        full_bridge_torsion: "扭矩全桥",
        h_mm: "截面尺寸 h / mm",
        b_mm: "截面尺寸 b / mm",
        quarter_bridge_epsilon_a_micro: "四分之一桥 εₐ / 10⁻⁶",
        quarter_bridge_epsilon_b_micro: "四分之一桥 εᵦ / 10⁻⁶",
        full_bridge_2epsilon_F_micro: "全桥 2εF / 10⁻⁶",
        half_bridge_2epsilon_M_micro: "半桥 2εM / 10⁻⁶"
    };

    const help = {
        axial_channels: "通道从 0 开始编号。本报告轴向为第 1、4 通道，因此填写 0, 3。",
        transverse_channels: "本报告横向为第 2、3 通道，因此填写 1, 2。",
        display_factor: "仪器显示值除以该系数得到实际应变；半桥通常为 2，全桥弯曲通常为 4。",
        reading_to_gamma_factor: "半桥读数已是 γ 时填 1；全桥显示为 2γ 时填 0.5。",
        readings_micro: "矩阵每行对应一个加载级，行内各数对应应变通道。"
    };

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        bindElements();
        bindEvents();
        restoreTheme();
        try {
            setServerState("连接中", "busy");
            const response = await fetch("/api/auto-report/catalog");
            const catalog = await response.json();
            if (!response.ok) throw new Error(catalog.error || response.statusText);
            state.catalog = catalog;
            restoreState();
            ensureStateData();
            renderExperimentList();
            renderCurrentForm();
            setServerState("连接正常", "ok");
            showStatus("已载入七次实验及报告原始数据算例。", "ok");
            await loadOpenAIStatus();
        } catch (error) {
            setServerState("连接失败", "bad");
            showStatus(`载入失败：${error.message}`, "bad");
        }
    }

    function bindElements() {
        [
            "serverState", "themeToggle", "toast", "calcStatus", "reportExperimentList",
            "rawInputForm", "rawDataTitle", "rawDataHint", "loadExampleBtn", "resetCurrentBtn",
            "downloadCsvTemplateBtn", "importCsvBtn", "csvFileInput",
            "calculateReportBtn", "downloadMarkdownBtn", "downloadHtmlBtn", "printBtn",
            "reportPreview", "reportMeta", "teacher", "studentId", "className",
            "studentName", "partners", "date", "openaiStatus", "openaiModel",
            "refineMode", "refineInstruction", "refineReportBtn", "restoreCalculatedBtn"
        ].forEach(id => { els[id] = document.getElementById(id); });
    }

    function bindEvents() {
        els.themeToggle.addEventListener("click", toggleTheme);
        els.loadExampleBtn.addEventListener("click", loadAllExamples);
        els.resetCurrentBtn.addEventListener("click", resetCurrentExperiment);
        els.downloadCsvTemplateBtn.addEventListener("click", downloadCsvTemplate);
        els.importCsvBtn.addEventListener("click", () => els.csvFileInput.click());
        els.csvFileInput.addEventListener("change", importCsvFile);
        els.calculateReportBtn.addEventListener("click", calculateReport);
        els.downloadMarkdownBtn.addEventListener("click", downloadMarkdown);
        els.downloadHtmlBtn.addEventListener("click", downloadHtml);
        els.printBtn.addEventListener("click", () => window.print());
        els.refineReportBtn.addEventListener("click", refineReport);
        els.restoreCalculatedBtn.addEventListener("click", restoreCalculatedReport);
        ["teacher", "studentId", "className", "studentName", "partners", "date"].forEach(id => {
            els[id].addEventListener("input", saveState);
        });
    }

    function ensureStateData() {
        const sample = state.catalog.sample || {};
        state.catalog.experiments.forEach(exp => {
            if (!state.data[exp.key]) state.data[exp.key] = clone(sample[exp.key]);
        });
        const ids = state.catalog.experiments.map(exp => exp.id);
        if (!ids.includes(state.selectedId)) state.selectedId = ids[0];
        configureMetadataDefaults();
    }

    function metadataDefaults() {
        const meta = state.catalog?.metadata || {};
        return {
            teacher: meta.teacher || "指导教师",
            student_id: meta.student_id || "20260000",
            class: meta.class || "示例班级",
            name: meta.name || "示例学生",
            partner: meta.partner || "无",
            date: meta.date || todayIso()
        };
    }

    function configureMetadataDefaults() {
        const defaults = metadataDefaults();
        Object.entries(metadataInputMap).forEach(([key, id]) => {
            const value = defaults[key];
            els[id].dataset.defaultValue = value;
            els[id].placeholder = `默认：${value}`;
        });
    }

    function currentExperiment() {
        return state.catalog.experiments.find(exp => exp.id === state.selectedId);
    }

    function renderExperimentList() {
        els.reportExperimentList.innerHTML = state.catalog.experiments.map(exp => `
            <button class="report-experiment-button ${exp.id === state.selectedId ? "active" : ""}" data-exp-id="${escapeHtml(exp.id)}">
                <span class="exp-code">${escapeHtml(exp.id)}</span>
                <span><strong>${escapeHtml(exp.title)}</strong><small>${escapeHtml(exp.key)}</small></span>
            </button>
        `).join("");
        els.reportExperimentList.querySelectorAll("button[data-exp-id]").forEach(button => {
            button.addEventListener("click", () => {
                state.selectedId = button.dataset.expId;
                state.reportMarkdown = "";
                state.calculatedMarkdown = "";
                state.reportHtml = "";
                els.reportPreview.className = "report-preview empty-preview";
                els.reportPreview.textContent = "确认本实验原始数据后，点击“计算并生成报告”。";
                els.reportMeta.textContent = "尚未生成";
                disableOutputs();
                updateRefineButtons();
                renderExperimentList();
                renderCurrentForm();
                saveState();
            });
        });
    }

    function renderCurrentForm() {
        const exp = currentExperiment();
        const data = state.data[exp.key];
        els.rawDataTitle.textContent = `${exp.id} ${exp.title}原始数据`;
        els.rawInputForm.innerHTML = renderObject(data, [], exp.title, 0);
        els.rawInputForm.querySelectorAll("[data-input-path]").forEach(input => {
            input.addEventListener("input", handleDataInput);
            input.addEventListener("change", handleDataInput);
        });
        els.rawInputForm.querySelectorAll("[data-array-action]").forEach(button => {
            button.addEventListener("click", handleArrayAction);
        });
    }

    function renderObject(object, path, title, depth) {
        const fields = Object.entries(object).map(([key, value]) => {
            const fieldPath = [...path, key];
            if (Array.isArray(value) && value.length && value.every(item => isPlainObject(item))) {
                return `<div class="nested-field wide-field">${renderObjectArray(value, fieldPath, fieldLabel(key), depth + 1)}</div>`;
            }
            if (isPlainObject(value)) {
                return `<div class="nested-field wide-field">${renderObject(value, fieldPath, fieldLabel(key), depth + 1)}</div>`;
            }
            return renderField(key, value, fieldPath);
        }).join("");
        return `
            <section class="input-object depth-${depth}">
                <div class="object-title">${escapeHtml(title)}</div>
                <div class="input-grid">${fields}</div>
            </section>
        `;
    }

    function renderObjectArray(items, path, title, depth) {
        return `
            <section class="input-object depth-${depth}">
                <div class="object-title">${escapeHtml(title)}</div>
                <div class="array-entries">
                    ${items.map((item, index) => {
                        const itemTitle = item.material || item.surface || item.gage || `第 ${index + 1} 组`;
                        return `
                            <div class="array-entry">
                                <div class="object-title">${escapeHtml(String(itemTitle))}</div>
                                <div class="input-grid">
                                    ${Object.entries(item).map(([key, value]) => {
                                        const itemPath = [...path, index, key];
                                        if (isPlainObject(value)) return `<div class="nested-field wide-field">${renderObject(value, itemPath, fieldLabel(key), depth + 1)}</div>`;
                                        return renderField(key, value, itemPath);
                                    }).join("")}
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    }

    function renderField(key, value, path) {
        const encodedPath = escapeHtml(JSON.stringify(path));
        const label = fieldLabel(key);
        const helpText = help[key] ? `<span class="field-help">${escapeHtml(help[key])}</span>` : "";
        if (Array.isArray(value)) {
            return renderArrayTable(value, path, label, helpText);
        }
        if (typeof value === "boolean") {
            return `
                <label>${escapeHtml(label)}
                    <input data-input-path="${encodedPath}" data-kind="boolean" type="checkbox" ${value ? "checked" : ""}>
                    ${helpText}
                </label>
            `;
        }
        const kind = typeof value === "number" ? "number" : "text";
        const inputType = kind === "number" ? "number" : "text";
        return `
            <label class="${String(value).length > 45 ? "wide-field" : ""}">${escapeHtml(label)}
                <input data-input-path="${encodedPath}" data-kind="${kind}" type="${inputType}" ${kind === "number" ? "step=\"any\"" : ""} value="${escapeHtml(value ?? "")}">
                ${helpText}
            </label>
        `;
    }

    function renderArrayTable(value, path, label, helpText) {
        const encodedArrayPath = escapeHtml(JSON.stringify(path));
        const isMatrix = value.length > 0 && Array.isArray(value[0]);
        if (isMatrix) {
            const columnCount = Math.max(1, ...value.map(row => row.length));
            return `
                <div class="wide-field array-field">
                    <div class="array-field-title">${escapeHtml(label)}</div>
                    <div class="array-table-wrap">
                        <table class="array-data-table">
                            <thead><tr>
                                <th>加载级</th>
                                ${Array.from({ length: columnCount }, (_, column) => `
                                    <th>第 ${column + 1} 列${columnCount > 1 ? `<button type="button" class="table-icon-button" data-array-action="delete-column" data-array-path="${encodedArrayPath}" data-array-column="${column}" aria-label="删除第 ${column + 1} 列">×</button>` : ""}</th>
                                `).join("")}
                                <th>操作</th>
                            </tr></thead>
                            <tbody>
                                ${value.map((row, rowIndex) => `
                                    <tr>
                                        <th>${rowIndex + 1}</th>
                                        ${Array.from({ length: columnCount }, (_, columnIndex) => renderArrayCell(row[columnIndex] ?? 0, [...path, rowIndex, columnIndex], `${label} 第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列`)).join("")}
                                        <td><button type="button" class="table-delete-button" data-array-action="delete-row" data-array-path="${encodedArrayPath}" data-array-row="${rowIndex}" ${value.length <= 1 ? "disabled" : ""}>删除</button></td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                    <div class="array-table-actions">
                        <button type="button" data-array-action="add-row" data-array-path="${encodedArrayPath}">＋ 添加一行</button>
                        <button type="button" data-array-action="add-column" data-array-path="${encodedArrayPath}">＋ 添加一列</button>
                    </div>
                    ${helpText}
                </div>
            `;
        }
        return `
            <div class="wide-field array-field">
                <div class="array-field-title">${escapeHtml(label)}</div>
                <div class="array-table-wrap">
                    <table class="array-data-table series-table">
                        <thead><tr><th>序号</th><th>数值</th><th>操作</th></tr></thead>
                        <tbody>
                            ${value.map((item, index) => `
                                <tr>
                                    <th>${index + 1}</th>
                                    ${renderArrayCell(item, [...path, index], `${label} 第 ${index + 1} 项`)}
                                    <td><button type="button" class="table-delete-button" data-array-action="delete-item" data-array-path="${encodedArrayPath}" data-array-row="${index}" ${value.length <= 1 ? "disabled" : ""}>删除</button></td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
                <div class="array-table-actions">
                    <button type="button" data-array-action="add-item" data-array-path="${encodedArrayPath}">＋ 添加数据</button>
                </div>
                ${helpText}
            </div>
        `;
    }

    function renderArrayCell(value, path, ariaLabel) {
        const encodedPath = escapeHtml(JSON.stringify(path));
        const kind = typeof value === "number" ? "number" : "text";
        return `<td><input aria-label="${escapeHtml(ariaLabel)}" data-input-path="${encodedPath}" data-kind="${kind}" type="${kind === "number" ? "number" : "text"}" ${kind === "number" ? "step=\"any\"" : ""} value="${escapeHtml(value ?? "")}"></td>`;
    }

    function handleDataInput(event) {
        const input = event.target;
        const path = JSON.parse(input.dataset.inputPath);
        let value;
        if (input.dataset.kind === "boolean") value = input.checked;
        else if (input.dataset.kind === "number") value = input.value === "" ? null : Number(input.value);
        else value = input.value;
        setPath(state.data[currentExperiment().key], path, value);
        saveState();
    }

    function handleArrayAction(event) {
        const button = event.currentTarget;
        const path = JSON.parse(button.dataset.arrayPath);
        const target = getPath(state.data[currentExperiment().key], path);
        const action = button.dataset.arrayAction;
        if (!Array.isArray(target)) return;
        if (action === "add-item") target.push(defaultArrayValue(target));
        if (action === "delete-item" && target.length > 1) target.splice(Number(button.dataset.arrayRow), 1);
        if (action === "add-row") {
            const columns = Math.max(1, ...target.map(row => Array.isArray(row) ? row.length : 0));
            target.push(Array.from({ length: columns }, () => defaultMatrixValue(target)));
        }
        if (action === "delete-row" && target.length > 1) target.splice(Number(button.dataset.arrayRow), 1);
        if (action === "add-column") target.forEach(row => row.push(defaultMatrixValue(target)));
        if (action === "delete-column" && target[0]?.length > 1) {
            const column = Number(button.dataset.arrayColumn);
            target.forEach(row => row.splice(column, 1));
        }
        renderCurrentForm();
        saveState();
    }

    function defaultArrayValue(array) {
        const last = array[array.length - 1];
        if (typeof last === "number") return 0;
        if (typeof last === "boolean") return false;
        return "";
    }

    function defaultMatrixValue(matrix) {
        const lastRow = matrix[matrix.length - 1] || [];
        return defaultArrayValue(lastRow);
    }

    function setPath(root, path, value) {
        let target = root;
        for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
        target[path[path.length - 1]] = value;
    }

    function getPath(root, path) {
        return path.reduce((target, key) => target?.[key], root);
    }

    async function calculateReport() {
        const exp = currentExperiment();
        try {
            setServerState("计算中", "busy");
            showStatus(`正在计算 ${exp.id} 并替换报告数据...`, "busy");
            const response = await fetch("/api/auto-report/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    experiment_id: exp.id,
                    metadata: reportInfo(),
                    data: state.data[exp.key]
                })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || response.statusText);
            state.reportMarkdown = payload.report_markdown;
            state.calculatedMarkdown = payload.report_markdown;
            state.reportHtml = markdownToHtml(state.reportMarkdown);
            els.reportPreview.className = "report-preview";
            els.reportPreview.innerHTML = `<article class="report-paper">${state.reportHtml}</article>`;
            els.reportMeta.textContent = `${exp.id} · 已按当前原始数据生成`;
            els.downloadMarkdownBtn.disabled = false;
            els.downloadHtmlBtn.disabled = false;
            els.printBtn.disabled = false;
            updateRefineButtons();
            setServerState("连接正常", "ok");
            showStatus("报告已生成。固定正文保持不变，数据表、计算结果和数值结论已更新。", "ok");
            queueMathRender([els.reportPreview]);
            saveState();
        } catch (error) {
            setServerState("计算失败", "bad");
            showStatus(`计算失败：${error.message}`, "bad");
            els.reportPreview.className = "report-preview empty-preview";
            els.reportPreview.textContent = `计算失败：${error.message}`;
            disableOutputs();
            state.reportMarkdown = "";
            state.calculatedMarkdown = "";
            updateRefineButtons();
        }
    }

    async function loadOpenAIStatus() {
        try {
            const response = await fetch("/api/openai/status");
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || response.statusText);
            state.openAIConfigured = Boolean(payload.configured);
            els.openaiStatus.textContent = state.openAIConfigured ? "OpenAI 已配置" : "未配置 API 密钥";
            els.openaiStatus.dataset.kind = state.openAIConfigured ? "ok" : "bad";
            els.openaiModel.textContent = payload.model ? "模型：" + payload.model : "";
        } catch (error) {
            state.openAIConfigured = false;
            els.openaiStatus.textContent = "OpenAI 状态不可用";
            els.openaiStatus.dataset.kind = "bad";
            els.openaiModel.textContent = error.message;
        }
        updateRefineButtons();
    }

    async function refineReport() {
        if (!state.reportMarkdown || !state.openAIConfigured || state.refineBusy) return;
        const original = state.reportMarkdown;
        try {
            state.refineBusy = true;
            updateRefineButtons();
            els.openaiStatus.textContent = "正在保护性润色";
            els.openaiStatus.dataset.kind = "busy";
            showStatus("正在调用 OpenAI；返回后会逐项检查标题、数字、公式、表格和图片。", "busy");
            const response = await fetch("/api/auto-report/refine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_markdown: state.reportMarkdown,
                    mode: els.refineMode.value,
                    instruction: els.refineInstruction.value.trim()
                })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || response.statusText);
            state.reportMarkdown = payload.report_markdown;
            renderReport(state.selectedId + " · AI 轻度润色 · 数据保护校验通过");
            els.openaiStatus.textContent = "保护校验通过";
            els.openaiStatus.dataset.kind = "ok";
            els.openaiModel.textContent = payload.model ? "模型：" + payload.model : els.openaiModel.textContent;
            showStatus("润色完成；标题、数字、公式、数据表和图片链接均未改变。", "ok");
        } catch (error) {
            state.reportMarkdown = original;
            els.openaiStatus.textContent = "未采用 AI 输出";
            els.openaiStatus.dataset.kind = "bad";
            showStatus("润色未应用：" + error.message, "bad");
        } finally {
            state.refineBusy = false;
            updateRefineButtons();
        }
    }

    function restoreCalculatedReport() {
        if (!state.calculatedMarkdown) return;
        state.reportMarkdown = state.calculatedMarkdown;
        renderReport(state.selectedId + " · 已恢复计算原稿");
        showStatus("已恢复未经 AI 润色的计算原稿。", "ok");
        updateRefineButtons();
    }

    function renderReport(metaText) {
        state.reportHtml = markdownToHtml(state.reportMarkdown);
        els.reportPreview.className = "report-preview";
        els.reportPreview.innerHTML = '<article class="report-paper">' + state.reportHtml + "</article>";
        els.reportMeta.textContent = metaText;
        queueMathRender([els.reportPreview]);
    }

    function updateRefineButtons() {
        if (!els.refineReportBtn || !els.restoreCalculatedBtn) return;
        els.refineReportBtn.disabled = state.refineBusy || !state.openAIConfigured || !state.reportMarkdown;
        els.restoreCalculatedBtn.disabled = state.refineBusy || !state.calculatedMarkdown || state.reportMarkdown === state.calculatedMarkdown;
    }

    function markdownToHtml(markdown) {
        const lines = markdown.replace(/\r\n/g, "\n").split("\n");
        const output = [];
        let index = 0;
        while (index < lines.length) {
            const raw = lines[index];
            const line = raw.trim();
            if (!line) { index++; continue; }

            if (line === "$$") {
                const math = [];
                index++;
                while (index < lines.length && lines[index].trim() !== "$$") math.push(lines[index++]);
                index++;
                output.push(`<div class="report-formula">\\[${escapeHtml(math.join("\n"))}\\]</div>`);
                continue;
            }
            if (/^\$\$.*\$\$$/.test(line)) {
                output.push(`<div class="report-formula">\\[${escapeHtml(line.slice(2, -2))}\\]</div>`);
                index++;
                continue;
            }
            if (/^<\/?details>|^<summary>/.test(line)) {
                if (line.startsWith("<summary>")) output.push(`<summary>${inlineMarkdown(line.replace(/^<summary>|<\/summary>$/g, ""))}</summary>`);
                else output.push(line);
                index++;
                continue;
            }
            const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (image) {
                output.push(`<img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}">`);
                index++;
                continue;
            }
            const heading = line.match(/^(#{1,4})\s+(.+)$/);
            if (heading) {
                const level = Math.min(heading[1].length, 3);
                output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
                index++;
                continue;
            }
            if (line === "---") {
                output.push("<hr>");
                index++;
                continue;
            }
            if (line.startsWith("|") && index + 1 < lines.length && /^\|?\s*:?-+/.test(lines[index + 1].trim())) {
                const tableLines = [];
                while (index < lines.length && lines[index].trim().startsWith("|")) tableLines.push(lines[index++].trim());
                output.push(renderMarkdownTable(tableLines));
                continue;
            }
            if (/^\d+\.\s+/.test(line)) {
                const items = [];
                while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) items.push(lines[index++].trim().replace(/^\d+\.\s+/, ""));
                output.push(`<ol>${items.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
                continue;
            }
            if (/^-\s+/.test(line)) {
                const items = [];
                while (index < lines.length && /^-\s+/.test(lines[index].trim())) items.push(lines[index++].trim().replace(/^-\s+/, ""));
                output.push(`<ul>${items.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
                continue;
            }
            if (line.startsWith(">")) {
                output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
                index++;
                continue;
            }

            const paragraph = [line];
            index++;
            while (index < lines.length && lines[index].trim() && !isSpecialMarkdownLine(lines[index].trim())) {
                paragraph.push(lines[index++].trim());
            }
            output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
        }
        return output.join("\n");
    }

    function isSpecialMarkdownLine(line) {
        return /^(#{1,4})\s|^\$\$|^\||^\d+\.\s|^-\s|^>|^---$|^<\/?details>|^<summary>|^!\[/.test(line);
    }

    function renderMarkdownTable(lines) {
        const cells = line => line.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
        const header = cells(lines[0]);
        const rows = lines.slice(2).map(cells);
        return `<table class="report-data-table"><thead><tr>${header.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }

    function inlineMarkdown(text) {
        let html = escapeHtml(text);
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
        return html;
    }

    function loadAllExamples() {
        state.data = clone(state.catalog.sample);
        renderCurrentForm();
        saveState();
        showStatus("已重新载入七次报告的完整原始数据算例。", "ok");
    }

    function resetCurrentExperiment() {
        const exp = currentExperiment();
        state.data[exp.key] = clone(state.catalog.sample[exp.key]);
        renderCurrentForm();
        saveState();
        showStatus(`已恢复 ${exp.id} 报告算例。`, "ok");
    }

    function downloadCsvTemplate() {
        const exp = currentExperiment();
        const rows = [];
        collectCsvRows(state.data[exp.key], [], rows);
        const header = ["path", "label", "type", "row", "column", "value"];
        const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
        downloadText(`${exp.id}_原始数据模板.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
        showStatus(`已生成 ${exp.id} CSV 模板；可在表格软件中修改后重新导入。`, "ok");
    }

    function collectCsvRows(value, path, rows) {
        if (Array.isArray(value)) {
            if (value.length && value.every(item => isPlainObject(item))) {
                value.forEach((item, index) => collectCsvRows(item, [...path, index], rows));
                return;
            }
            const label = fieldLabel(String(path[path.length - 1] ?? "value"));
            if (value.length && Array.isArray(value[0])) {
                value.forEach((row, rowIndex) => row.forEach((item, columnIndex) => {
                    rows.push([csvPath(path), label, "matrix", rowIndex + 1, columnIndex + 1, item]);
                }));
            } else {
                value.forEach((item, index) => rows.push([csvPath(path), label, "series", index + 1, "", item]));
            }
            return;
        }
        if (isPlainObject(value)) {
            Object.entries(value).forEach(([key, item]) => collectCsvRows(item, [...path, key], rows));
            return;
        }
        const label = fieldLabel(String(path[path.length - 1] ?? "value"));
        rows.push([csvPath(path), label, typeof value, "", "", value]);
    }

    function csvPath(path) {
        return path.join(".");
    }

    function csvCell(value) {
        return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    async function importCsvFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const records = parseCsv(await file.text());
            applyCsvRecords(records);
            renderCurrentForm();
            saveState();
            showStatus(`已从 ${file.name} 导入原始数据。`, "ok");
        } catch (error) {
            showStatus(`CSV 导入失败：${error.message}`, "bad");
        } finally {
            event.target.value = "";
        }
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let cell = "";
        let quoted = false;
        const source = text.replace(/^\ufeff/, "");
        for (let index = 0; index < source.length; index++) {
            const char = source[index];
            if (quoted) {
                if (char === '"' && source[index + 1] === '"') {
                    cell += '"';
                    index++;
                } else if (char === '"') quoted = false;
                else cell += char;
                continue;
            }
            if (char === '"') quoted = true;
            else if (char === ",") {
                row.push(cell);
                cell = "";
            } else if (char === "\n") {
                row.push(cell.replace(/\r$/, ""));
                if (row.some(item => item !== "")) rows.push(row);
                row = [];
                cell = "";
            } else cell += char;
        }
        row.push(cell.replace(/\r$/, ""));
        if (row.some(item => item !== "")) rows.push(row);
        if (quoted) throw new Error("CSV 中存在未闭合的引号");
        if (rows.length < 2) throw new Error("CSV 没有可导入的数据行");
        const headers = rows[0].map(item => item.trim().toLowerCase());
        for (const required of ["path", "type", "value"]) {
            if (!headers.includes(required)) throw new Error(`缺少 ${required} 列，请使用下载的模板`);
        }
        return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
    }

    function applyCsvRecords(records) {
        const exp = currentExperiment();
        const data = clone(state.data[exp.key]);
        const series = new Map();
        const matrices = new Map();
        records.forEach(record => {
            const path = record.path.split(".").filter(Boolean).map(part => /^\d+$/.test(part) ? Number(part) : part);
            if (!path.length) return;
            if (record.type === "series") {
                if (!series.has(record.path)) series.set(record.path, { path, values: [] });
                series.get(record.path).values.push([Number(record.row), csvValue(record.value, "series")]);
                return;
            }
            if (record.type === "matrix") {
                if (!matrices.has(record.path)) matrices.set(record.path, { path, values: [] });
                matrices.get(record.path).values.push([Number(record.row), Number(record.column), csvValue(record.value, "matrix")]);
                return;
            }
            const current = getPath(data, path);
            setPath(data, path, csvValue(record.value, record.type, current));
        });
        series.forEach(group => {
            const values = group.values
                .filter(([row]) => Number.isInteger(row) && row > 0)
                .sort((a, b) => a[0] - b[0])
                .map(([, value]) => value);
            if (values.length) setPath(data, group.path, values);
        });
        matrices.forEach(group => {
            const valid = group.values.filter(([row, column]) => Number.isInteger(row) && row > 0 && Number.isInteger(column) && column > 0);
            if (!valid.length) return;
            const rowCount = Math.max(...valid.map(([row]) => row));
            const columnCount = Math.max(...valid.map(([, column]) => column));
            const matrix = Array.from({ length: rowCount }, () => Array(columnCount).fill(0));
            valid.forEach(([row, column, value]) => { matrix[row - 1][column - 1] = value; });
            setPath(data, group.path, matrix);
        });
        state.data[exp.key] = data;
    }

    function csvValue(value, type, current) {
        if (type === "boolean" || typeof current === "boolean") return /^(true|1|yes|是)$/i.test(String(value).trim());
        if (type === "number" || type === "series" || type === "matrix" || typeof current === "number") {
            const number = Number(value);
            if (Number.isFinite(number)) return number;
        }
        return value;
    }

    function enteredReportInfo() {
        return {
            teacher: els.teacher.value.trim(),
            student_id: els.studentId.value.trim(),
            class: els.className.value.trim(),
            name: els.studentName.value.trim(),
            partner: els.partners.value.trim(),
            date: els.date.value.trim()
        };
    }

    function reportInfo() {
        const entered = enteredReportInfo();
        const defaults = metadataDefaults();
        return Object.fromEntries(Object.keys(defaults).map(key => [key, entered[key] || defaults[key]]));
    }

    function saveState() {
        localStorage.setItem(storageKey, JSON.stringify({
            selectedId: state.selectedId,
            data: state.data,
            metadata: enteredReportInfo()
        }));
    }

    function restoreState() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
            if (!saved) return;
            state.selectedId = saved.selectedId || state.selectedId;
            state.data = saved.data || {};
            const metadata = saved.metadata || {};
            els.teacher.value = metadata.teacher || "";
            els.studentId.value = metadata.student_id || "";
            els.className.value = metadata.class || "";
            els.studentName.value = metadata.name || "";
            els.partners.value = metadata.partner || "";
            els.date.value = metadata.date || els.date.value;
        } catch {
            localStorage.removeItem(storageKey);
        }
    }

    function todayIso() {
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
        return local.toISOString().slice(0, 10);
    }

    function downloadMarkdown() {
        downloadText(`${state.selectedId}_实验报告.md`, state.reportMarkdown, "text/markdown;charset=utf-8");
    }

    function downloadHtml() {
        const title = `${state.selectedId} 实验报告`;
        const full = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><script>window.MathJax={tex:{inlineMath:[["\\(","\\)"],["$","$"]],displayMath:[["\\[","\\]"],["$$","$$"]]},svg:{fontCache:"global"}};</script><script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script><style>${downloadStyles()}</style></head><body><article class="report-paper">${state.reportHtml}</article></body></html>`;
        downloadText(`${state.selectedId}_实验报告.html`, full, "text/html;charset=utf-8");
    }

    function downloadStyles() {
        return `body{margin:24px;background:#fff;color:#111827}.report-paper{font-family:"Times New Roman","SimSun",serif;line-height:1.72;font-size:15px;max-width:920px;margin:auto}.report-paper h1{text-align:center;font-family:"Microsoft YaHei",sans-serif}.report-paper h2{font-family:"Microsoft YaHei",sans-serif;border-bottom:1px solid #d1d5db;padding-bottom:4px}.report-data-table{width:100%;border-collapse:collapse;font-size:12.5px}.report-data-table th,.report-data-table td{border:1px solid #374151;padding:5px;text-align:center}.report-data-table th{background:#f3f4f6}.report-formula{border-left:3px solid #0f766e;background:#f9fafb;padding:8px 10px;margin:8px 0}.report-paper img{max-width:100%;height:auto}`;
    }

    async function downloadText(filename, text, type) {
        if (window.desktopAPI?.saveTextFile) {
            try {
                const result = await window.desktopAPI.saveTextFile({ defaultName: filename, content: text });
                if (result.saved) showStatus(`已导出 ${filename}`, "ok");
            } catch (error) {
                showStatus(`导出失败：${error.message}`, "bad");
            }
            return;
        }
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function disableOutputs() {
        els.downloadMarkdownBtn.disabled = true;
        els.downloadHtmlBtn.disabled = true;
        els.printBtn.disabled = true;
    }

    function fieldLabel(key) {
        return labels[key] || key.replace(/_/g, " ");
    }

    function isPlainObject(value) {
        return value && typeof value === "object" && !Array.isArray(value);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function restoreTheme() {
        const theme = localStorage.getItem("material-mechanics:theme");
        document.body.classList.toggle("dark-mode", theme === "dark");
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle("dark-mode");
        localStorage.setItem("material-mechanics:theme", isDark ? "dark" : "light");
    }

    function setServerState(text, kind) {
        els.serverState.textContent = text;
        els.serverState.dataset.kind = kind;
    }

    function showStatus(text, kind) {
        els.calcStatus.textContent = text;
        els.calcStatus.dataset.kind = kind;
        els.calcStatus.classList.remove("hidden");
        toast(text, kind === "bad");
    }

    function toast(text, isError = false) {
        els.toast.textContent = text;
        els.toast.classList.toggle("error", isError);
        els.toast.classList.remove("hidden");
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
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
