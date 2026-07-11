(function (global) {
    "use strict";

    const Storage = {
        key(id) {
            return `material-mechanics:v3:${id}:rows`;
        },
        saveRows(id, rows) {
            localStorage.setItem(this.key(id), JSON.stringify(rows));
        },
        loadRows(id) {
            const text = localStorage.getItem(this.key(id));
            if (!text) return null;
            try {
                const rows = JSON.parse(text);
                return Array.isArray(rows) ? rows : null;
            } catch {
                return null;
            }
        },
        clearRows(id) {
            localStorage.removeItem(this.key(id));
        }
    };

    const Csv = {
        parse(text) {
            const rows = [];
            let row = [];
            let cell = "";
            let quoted = false;
            const input = text.replace(/^\uFEFF/, "");

            for (let i = 0; i < input.length; i++) {
                const ch = input[i];
                const next = input[i + 1];
                if (quoted) {
                    if (ch === '"' && next === '"') {
                        cell += '"';
                        i++;
                    } else if (ch === '"') {
                        quoted = false;
                    } else {
                        cell += ch;
                    }
                    continue;
                }
                if (ch === '"') {
                    quoted = true;
                } else if (ch === ",") {
                    row.push(cell);
                    cell = "";
                } else if (ch === "\n") {
                    row.push(cell);
                    rows.push(row);
                    row = [];
                    cell = "";
                } else if (ch !== "\r") {
                    cell += ch;
                }
            }
            if (cell || row.length) {
                row.push(cell);
                rows.push(row);
            }
            if (!rows.length) return [];
            const headers = rows[0].map(h => h.trim());
            return rows.slice(1)
                .filter(values => values.some(value => value.trim() !== ""))
                .map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
        },
        stringify(rows, fields) {
            const escape = value => {
                const text = value == null ? "" : String(value);
                if (/[",\r\n]/.test(text)) {
                    return `"${text.replace(/"/g, '""')}"`;
                }
                return text;
            };
            const lines = [fields.map(escape).join(",")];
            rows.forEach(row => {
                lines.push(fields.map(field => escape(row[field])).join(","));
            });
            return `\uFEFF${lines.join("\n")}`;
        },
        download(filename, text) {
            const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }
    };

    const Format = {
        value(value) {
            if (value === null || value === undefined || value === "") return "—";
            if (typeof value === "number") {
                if (!Number.isFinite(value)) return "—";
                const abs = Math.abs(value);
                if (abs !== 0 && (abs >= 100000 || abs < 0.0001)) return value.toExponential(4);
                if (Number.isInteger(value)) return String(value);
                return String(Number(value.toPrecision(6)));
            }
            if (typeof value === "boolean") return value ? "是" : "否";
            if (Array.isArray(value)) return value.length ? value.join("，") : "—";
            if (typeof value === "object") return JSON.stringify(value, null, 2);
            return String(value);
        },
        label(key) {
            const direct = {
                selected_run: "选用组",
                mean_E_MPa: "平均 E / MPa",
                mean_mu: "平均 μ",
                mean_sigma_max_MPa: "平均最大正应力 / MPa",
                mean_eccentricity_e_mm: "平均偏心距 / mm",
                coverage_complete: "项目覆盖",
                validity_judgement: "判定",
                hooke_law_verified: "胡克定律验证",
                rows: "结果行数",
                increment_count: "增量段数",
                mean_delta_F_kN: "平均 ΔF / kN",
                mean_delta_load_N: "平均 ΔF / N",
                mean_delta_strain_micro: "平均 Δε / με",
                strain_increment_cv_pct: "应变增量 CV / %",
                load_increment_cv_pct: "载荷增量 CV / %",
                mean_G_MPa: "平均 G / MPa",
                selected_group: "选用数据组",
                repetition_count: "重复次数"
            };
            return direct[key] || key.replace(/_/g, " ");
        }
    };

    function enableTableKeyboard(container) {
        container.addEventListener("keydown", event => {
            if (!event.target.matches("input[data-field]")) return;
            const inputs = [...container.querySelectorAll("input[data-field]")];
            const index = inputs.indexOf(event.target);
            const cols = Number(container.dataset.columns || 1);
            let next = -1;
            if (event.key === "ArrowRight" || event.key === "Enter") next = index + 1;
            if (event.key === "ArrowLeft") next = index - 1;
            if (event.key === "ArrowDown") next = index + cols;
            if (event.key === "ArrowUp") next = index - cols;
            if (next >= 0 && next < inputs.length) {
                event.preventDefault();
                inputs[next].focus();
                inputs[next].select();
            }
        });
    }

    global.AssistantCommon = { Storage, Csv, Format, enableTableKeyboard };
})(window);
