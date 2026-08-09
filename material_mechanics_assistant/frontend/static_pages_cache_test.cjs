const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const staticApiPath = path.join(repoRoot, "pages", "static_api.js");
const staticApiSource = fs.readFileSync(staticApiPath, "utf8");
const releaseVersion = "20260722-b061-reciprocity-mean";
const requests = [];
let loadPyodideAttempts = 0;

async function nativeFetch(input, init = {}) {
    const url = String(input);
    requests.push({ url, init });
    const body = url.includes("sample_input.json")
        ? JSON.stringify({ metadata: {}, experiments: { beam_deformation: {} } })
        : "";
    return new Response(body, { status: 200 });
}

const pyodide = {
    FS: {
        mkdirTree() {},
        writeFile() {}
    },
    globals: {
        set() {},
        delete() {}
    },
    async runPythonAsync(code) {
        return code.includes("json.dumps")
            ? JSON.stringify({ report_markdown: "ok" })
            : undefined;
    }
};

const window = {
    fetch: nativeFetch,
    async loadPyodide() {
        loadPyodideAttempts += 1;
        if (loadPyodideAttempts === 1) throw new Error("transient engine failure");
        return pyodide;
    }
};
const document = {
    baseURI: "https://example.test/material-mechanics-lab-web/",
    currentScript: {
        src: `https://example.test/material-mechanics-lab-web/static_api.js?v=${releaseVersion}`
    }
};

vm.runInContext(staticApiSource, vm.createContext({
    window,
    document,
    URL,
    Response,
    Request,
    Date,
    JSON,
    Promise
}));

async function main() {
    const catalog = await window.fetch("/api/auto-report/catalog");
    assert.equal(catalog.status, 200);

    const calculateInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experiment_id: "B061", data: {}, metadata: {} })
    };
    const firstAttempt = await window.fetch("/api/auto-report/calculate", calculateInit);
    assert.equal(firstAttempt.status, 500);
    assert.match((await firstAttempt.json()).error, /transient engine failure/);

    const secondAttempt = await window.fetch("/api/auto-report/calculate", calculateInit);
    assert.equal(secondAttempt.status, 200);
    assert.equal((await secondAttempt.json()).report_markdown, "ok");
    assert.equal(loadPyodideAttempts, 2, "failed engine initialization must be retryable");

    const engineRequests = requests.filter(item => item.url.includes("/engine/"));
    assert.ok(engineRequests.length >= 10);
    for (const request of engineRequests) {
        assert.equal(new URL(request.url).searchParams.get("v"), releaseVersion);
        assert.equal(request.init.cache, "no-store");
    }

    for (const htmlName of ["index.html", "combined_report.html"]) {
        const html = fs.readFileSync(path.join(repoRoot, "pages", htmlName), "utf8");
        assert.match(html, new RegExp(`static_api\\.js\\?v=${releaseVersion}`));
    }

    console.log("Static Pages cache/retry regression OK");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
