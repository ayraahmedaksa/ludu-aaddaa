import crypto from "node:crypto";
import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);
const adminKey = process.env.ADMIN_KEY || "local-demo-only";

app.use(express.json({ limit: "32kb" }));
app.use((_, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  next();
});

const matches = new Map([
  ["L-4821", { id: "L-4821", players: ["রাহাত", "তানভীর"], status: "live", moves: [] }],
  ["L-4820", { id: "L-4820", players: ["মিম", "নীলা"], status: "live", moves: [] }],
  ["L-4819", { id: "L-4819", players: ["সাইফ", "আলিফ"], status: "waiting", moves: [] }]
]);
const reports = new Map([
  ["R-101", { id: "R-101", type: "অশালীন ভাষা", matchId: "L-4821", status: "open" }],
  ["R-102", { id: "R-102", type: "সংযোগ সমস্যা", matchId: "L-4819", status: "open" }]
]);
const announcements = [];
const auditLog = [];
const deposits = new Map();

function audit(action, data = {}) {
  auditLog.unshift({ id: crypto.randomUUID(), action, data, at: new Date().toISOString() });
  auditLog.splice(100);
}

function requireAdmin(request, response, next) {
  if (request.get("X-Admin-Key") !== adminKey) {
    return response.status(401).json({ error: "Admin authorization required" });
  }
  next();
}

app.get("/health", (_, response) => response.json({ ok: true, service: "ludu-control" }));

app.get("/api/admin/overview", requireAdmin, (_, response) => {
  const active = [...matches.values()].filter((match) => match.status === "live");
  response.json({
    users: { total: 12480, activeToday: 1296, onlineNow: 482 },
    matches: { live: active.length, paused: [...matches.values()].filter((match) => match.status === "paused").length },
    reports: { open: [...reports.values()].filter((report) => report.status === "open").length },
    announcements: announcements.length
  });
});

app.get("/api/admin/matches", requireAdmin, (_, response) => response.json([...matches.values()]));

app.post("/api/admin/matches/:matchId/:command", requireAdmin, (request, response) => {
  const match = matches.get(request.params.matchId);
  const command = request.params.command;
  if (!match) return response.status(404).json({ error: "Match not found" });
  if (!["pause", "resume", "cancel"].includes(command)) return response.status(400).json({ error: "Unsupported command" });
  match.status = command === "pause" ? "paused" : command === "resume" ? "live" : "cancelled";
  audit(`match.${command}`, { matchId: match.id });
  response.json({ match });
});

app.get("/api/admin/reports", requireAdmin, (_, response) => response.json([...reports.values()]));

app.post("/api/admin/reports/:reportId/resolve", requireAdmin, (request, response) => {
  const report = reports.get(request.params.reportId);
  if (!report) return response.status(404).json({ error: "Report not found" });
  report.status = "resolved";
  report.note = String(request.body?.note || "").slice(0, 500);
  audit("report.resolved", { reportId: report.id });
  response.json({ report });
});

app.post("/api/admin/announcements", requireAdmin, (request, response) => {
  const text = String(request.body?.text || "").trim();
  if (!text || text.length > 500) return response.status(400).json({ error: "Announcement must be 1–500 characters" });
  const announcement = { id: crypto.randomUUID(), text, at: new Date().toISOString() };
  announcements.unshift(announcement);
  audit("announcement.published", { announcementId: announcement.id });
  response.status(201).json({ announcement });
});

app.get("/api/admin/audit-log", requireAdmin, (_, response) => response.json(auditLog));

// Manual Send Money demo workflow. No bKash API or automatic balance crediting.
app.get("/api/admin/deposits", requireAdmin, (_, response) => response.json([...deposits.values()]));
app.post("/api/payment/deposit", (request, response) => {
  const amount = Number(request.body?.amount);
  const trxId = String(request.body?.trx_id || "").trim();
  const sender = String(request.body?.sender_number || "").trim();
  if (!Number.isFinite(amount) || amount < 500 || !trxId || !sender) return response.status(400).json({ success:false, message:"ন্যূনতম ৫০০ টাকা এবং TrxID/প্রেরক নম্বর দিন" });
  if ([...deposits.values()].some((item) => item.trxId === trxId)) return response.status(409).json({ success:false, message:"এই TrxID আগে জমা হয়েছে" });
  const deposit = { id: crypto.randomUUID(), amount, method: String(request.body?.method || "bkash"), sender, trxId, status:"pending", createdAt:new Date().toISOString() };
  deposits.set(deposit.id, deposit); audit("deposit.submitted", { depositId: deposit.id, amount });
  response.status(201).json({ success:true, message:"রিকোয়েস্ট জমা হয়েছে; অ্যাডমিন যাচাই করবেন", deposit });
});
app.post("/api/admin/deposits/:depositId/:command", requireAdmin, (request, response) => {
  const deposit = deposits.get(request.params.depositId);
  if (!deposit) return response.status(404).json({ error:"Deposit not found" });
  if (!["approve","reject"].includes(request.params.command)) return response.status(400).json({ error:"Unsupported command" });
  deposit.status = request.params.command === "approve" ? "approved" : "rejected";
  deposit.reviewedAt = new Date().toISOString(); audit(`deposit.${deposit.status}`, { depositId: deposit.id });
  response.json({ deposit });
});

app.listen(port, () => console.log(`Ludu control API ready at http://localhost:${port}`));
