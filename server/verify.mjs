import { spawn } from "node:child_process";

const port = "3130";
const processUnderTest = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, PORT: port, ADMIN_KEY: "verify-local-only" },
  stdio: "ignore"
});

async function verify() {
  for (let retry = 0; retry < 20; retry += 1) {
    try {
      const health = await fetch(`http://localhost:${port}/health`).then((response) => response.json());
      const overview = await fetch(`http://localhost:${port}/api/admin/overview`, {
        headers: { "X-Admin-Key": "verify-local-only" }
      }).then((response) => response.json());
      if (!health.ok || overview.matches.live !== 2 || overview.reports.open !== 2) throw new Error("Unexpected API response");
      console.log("PASS: health, authorized overview and sample control data are available.");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw new Error("Control server did not start");
}

try {
  await verify();
} finally {
  processUnderTest.kill();
}
