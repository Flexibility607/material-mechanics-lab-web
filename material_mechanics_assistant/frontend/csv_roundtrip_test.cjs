const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "combined_report.js");
const source = fs.readFileSync(sourcePath, "utf8");
const exportHook = `
    window.__csvTest = {
        toCsv(data) {
            const rows = [];
            collectCsvRows(data, [], rows);
            const header = ["path", "label", "type", "row", "column", "value"];
            return [header, ...rows].map(row => row.map(csvCell).join(",")).join("\\r\\n");
        },
        parseCsv,
        importInto(data, records) {
            state.catalog = { experiments: [{ id: "TEST", key: "test" }] };
            state.selectedId = "TEST";
            state.data = { test: clone(data) };
            applyCsvRecords(records);
            return state.data.test;
        }
    };
})();`;
const instrumented = source.replace(/\}\)\(\);\s*$/, exportHook);
const context = {
    window: {},
    document: { addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console,
    setTimeout,
    clearTimeout,
    Blob,
    URL,
    Response,
    Request
};
vm.runInNewContext(instrumented, context, { filename: sourcePath });

const api = context.window.__csvTest;
const sample = {
    width_mm: 20,
    valid: true,
    note: "含逗号, 和引号\"的说明",
    loads_kN: [2, 6, 10],
    readings_micro: [[0, 0], [120, -36]],
    runs: [{ loads_kN: [1, 3], readings_micro: [[0, 0], [50, -15]] }]
};

const csv = api.toCsv(sample);
const parsed = api.parseCsv(`\ufeff${csv}`);
const roundTrip = api.importInto(sample, parsed);
assert.deepEqual(JSON.parse(JSON.stringify(roundTrip)), sample);

const edited = parsed.filter(record => !(record.path === "loads_kN" && record.row === "2"));
edited.find(record => record.path === "width_mm").value = "21.5";
edited.push({ path: "loads_kN", label: "载荷序列", type: "series", row: "4", column: "", value: "14" });
edited.push({ path: "readings_micro", label: "应变读数", type: "matrix", row: "1", column: "3", value: "5" });
edited.push({ path: "readings_micro", label: "应变读数", type: "matrix", row: "2", column: "3", value: "8" });
const imported = api.importInto(sample, edited);
assert.equal(imported.width_mm, 21.5);
assert.deepEqual(Array.from(imported.loads_kN), [2, 10, 14]);
assert.deepEqual(Array.from(imported.readings_micro, row => Array.from(row)), [[0, 0, 5], [120, -36, 8]]);

console.log(`CSV round-trip OK: ${parsed.length} records`);
