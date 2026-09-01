// @ts-check
const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createServer } = require("./serve");

function findBrowserBinary() {
    const candidates = [
        // Windows Edge / Chrome
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        // Linux / macOS fallbacks
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    ];

    for (const bin of candidates) {
        if (fs.existsSync(bin)) {
            return bin;
        }
    }
    return null;
}

async function runTests() {
    const port = 3456;
    const server = createServer(port);

    await new Promise((resolve) => server.listen(port, resolve));
    console.log(`\n🧪 Launching Headless Test Suite on port ${port}...`);

    const browserBinary = findBrowserBinary();
    if (!browserBinary) {
        console.error("❌ No Chrome or Edge executable found on this system.");
        server.close();
        process.exit(1);
    }

    const testUrl = `http://localhost:${port}/Leaflet-Step-1/tests/logic-tests.html`;

    const args = [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-extensions",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=10000",
        "--dump-dom",
        testUrl
    ];

    const startTime = Date.now();
    const child = spawn(browserBinary, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("close", (code) => {
        server.close();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        // Parse test items from DOM
        const titleMatch = stdout.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : "Unknown";

        const summaryMatch = stdout.match(/<p id="summary"[^>]*>([^<]+)<\/p>/i);
        const summary = summaryMatch ? summaryMatch[1] : "";

        // Extract individual <li> results
        const regex = /<li class="(pass|fail)">([^<]+)<\/li>/gi;
        let match;
        const passedTests = [];
        const failedTests = [];

        while ((match = regex.exec(stdout)) !== null) {
            const status = match[1];
            const text = match[2].trim();
            if (status === "pass") {
                passedTests.push(text);
            } else {
                failedTests.push(text);
            }
        }

        console.log("\n=======================================================");
        console.log(`📋 Earthquake Monitor Automated Test Results (${duration}s)`);
        console.log("=======================================================\n");

        if (passedTests.length > 0) {
            passedTests.forEach((t) => console.log(` \x1b[32m✔\x1b[0m ${t}`));
        }

        if (failedTests.length > 0) {
            console.log("\n--- Failures ---");
            failedTests.forEach((t) => console.log(` \x1b[31m✖\x1b[0m ${t}`));
        }

        console.log("\n-------------------------------------------------------");
        console.log(`Total: ${passedTests.length + failedTests.length} tests | Passed: \x1b[32m${passedTests.length}\x1b[0m | Failed: ${failedTests.length > 0 ? `\x1b[31m${failedTests.length}\x1b[0m` : "0"}`);
        console.log(`Overall Status: ${title.startsWith("PASS") ? "\x1b[32m[ PASSED ]\x1b[0m" : "\x1b[31m[ FAILED ]\x1b[0m"}`);
        console.log("=======================================================\n");

        if (failedTests.length > 0 || !title.startsWith("PASS")) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    });

    child.on("error", (err) => {
        server.close();
        console.error("❌ Failed to launch browser process:", err.message);
        process.exit(1);
    });
}

runTests().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
