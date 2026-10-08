import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "http://localhost:8443,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean));

if (!adminEmail) {
  throw new Error("ADMIN_EMAIL must be configured before the E-Register API can start.");
}

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

const pool = new Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, max: Number(process.env.PGPOOL_MAX || 5) }
  : {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || "eregister",
    max: Number(process.env.PGPOOL_MAX || 5),
  });

app.disable("x-powered-by");
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  if (request.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return response.sendStatus(403);
    return response.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: "1mb" }));

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeDate(value, label = "date") {
  if (typeof value !== "string") throw apiError(400, `${label} is required.`);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (date.getFullYear() === Number(iso[1]) && date.getMonth() === Number(iso[2]) - 1 && date.getDate() === Number(iso[3])) return value;
  }
  const localized = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(value.trim());
  if (localized) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(localized[2].toLowerCase());
    const day = Number(localized[1]);
    const year = Number(localized[3]);
    const date = new Date(year, month, day);
    if (month >= 0 && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  throw apiError(400, `${label} must be a valid date.`);
}

function requireText(value, label, maxLength = 200) {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
    throw apiError(400, `${label} is required and must be ${maxLength} characters or fewer.`);
  }
  return value.trim();
}

function requireOptionalText(value, label, maxLength = 500) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maxLength) throw apiError(400, `${label} must be ${maxLength} characters or fewer.`);
  return value.trim();
}

function requireAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999) throw apiError(400, "Amount must be greater than zero and within the supported range.");
  return amount;
}

function financialYearStart(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function parseMemberFields(body) {
  const name = requireText(body?.name, "Name", 120);
  const status = body?.status ?? "Active";
  if (!["Active", "Inactive", "Pending"].includes(status)) throw apiError(400, "Member status is invalid.");
  return {
    name,
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join(""),
    hometown: requireOptionalText(body?.hometown, "City", 120),
    phone: requireOptionalText(body?.phone, "Phone", 40),
    email: requireOptionalText(body?.email, "Email", 254),
    status,
    joinDate: normalizeDate(body?.joinDate, "Join date"),
  };
}

const paymentModes = ["UPI", "Cash", "Bank Transfer", "Cheque"];
const paymentStatuses = ["Paid", "Pending", "Failed"];
function parsePaymentFields(body) {
  if (!body || typeof body !== "object") throw apiError(400, "Payment details are required.");
  if (!paymentModes.includes(body.paymentMode)) throw apiError(400, "Payment method is invalid.");
  if (!paymentStatuses.includes(body.status)) throw apiError(400, "Payment status is invalid.");
  return {
    memberId: requireText(body.memberId, "Member", 80),
    date: normalizeDate(body.date, "Payment date"),
    amount: requireAmount(body.amount),
    paymentMode: body.paymentMode,
    status: body.status,
    receiptId: requireText(body.receiptId, "Receipt number", 80),
    description: requireOptionalText(body.description, "Description", 250),
  };
}

function parseExpenseFields(body) {
  if (!body || typeof body !== "object") throw apiError(400, "Expense details are required.");
  if (!paymentModes.includes(body.paymentMode) && body.paymentMode !== undefined && body.paymentMode !== null && body.paymentMode !== "") {
    throw apiError(400, "Payment method is invalid.");
  }
  const status = body.status ?? "Paid";
  if (!paymentStatuses.includes(status)) throw apiError(400, "Expense status is invalid.");
  const date = normalizeDate(body.date, "Expense date");
  const periodId = requireText(body.periodId, "Period", 20);
  if (!["period-1", "period-2", "period-3", "period-4"].includes(periodId)) throw apiError(400, "Expense period is invalid.");
  return {
    year: Number(body.year || financialYearStart(date)),
    periodId,
    title: requireText(body.title, "Expense title", 160),
    amount: requireAmount(body.amount),
    date,
    notes: requireOptionalText(body.notes, "Notes", 1000),
    paymentMode: body.paymentMode || null,
    status,
    receiptId: body.receiptId ? requireText(body.receiptId, "Receipt number", 80) : null,
  };
}

function mapMember(row) {
  return {
    id: row.id,
    sno: Number(row.sno),
    accountNumber: row.account_number,
    name: row.name,
    initials: row.initials,
    avatarColor: row.avatar_color,
    hometown: row.hometown,
    phone: row.phone,
    email: row.email,
    status: row.status,
    joinDate: row.join_date,
    outstandingAmount: 0,
    lastPaymentDate: row.last_payment_date || "—",
    ...(row.entry_amount === null ? {} : { entryAmount: Number(row.entry_amount) }),
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.payment_date,
    amount: Number(row.amount),
    paymentMode: row.payment_mode,
    status: row.status,
    receiptId: row.receipt_id,
    description: row.description,
  };
}

function mapExpense(row) {
  return {
    id: row.id,
    year: Number(row.financial_year_start),
    periodId: row.period_id,
    title: row.title,
    amount: Number(row.amount),
    date: row.expense_date,
    notes: row.notes,
    paymentMode: row.payment_mode || undefined,
    status: row.status,
    receiptId: row.receipt_id || undefined,
  };
}

async function recordAudit(client, actorEmail, action, entityType, entityId, details = {}) {
  await client.query(
    "INSERT INTO audit_events (actor_email, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
    [actorEmail, action, entityType, entityId, JSON.stringify(details)],
  );
}

async function requireAdmin(request, response, next) {
  try {
    const authorization = request.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) throw apiError(401, "Sign in to continue.");
    const decoded = await getAuth().verifyIdToken(token);
    const email = decoded.email?.trim().toLowerCase();
    if (!email || decoded.email_verified !== true || email !== adminEmail) throw apiError(403, "This Google account is not authorized to access E-Register.");
    request.admin = { uid: decoded.uid, email };
    next();
  } catch (error) {
    if (error.status) return next(error);
    next(apiError(401, "Your sign-in could not be verified. Sign in again."));
  }
}

app.get("/api/health/live", (_request, response) => response.json({ ok: true }));
app.get("/api/health/ready", asyncRoute(async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ ok: true, database: "connected" });
}));

app.use("/api", requireAdmin);

app.get("/api/session", (request, response) => response.json({ email: request.admin.email }));

app.get("/api/register", asyncRoute(async (_request, response) => {
  const [members, payments, expenses] = await Promise.all([
    pool.query("SELECT m.*, (SELECT to_char(max(payment_date), 'YYYY-MM-DD') FROM payments p WHERE p.member_id = m.id AND p.status = 'Paid') AS last_payment_date FROM members m WHERE archived_at IS NULL ORDER BY sno"),
    pool.query("SELECT * FROM payments ORDER BY payment_date DESC, created_at DESC"),
    pool.query("SELECT * FROM expenses WHERE archived_at IS NULL ORDER BY expense_date DESC, created_at DESC"),
  ]);
  response.json({ members: members.rows.map(mapMember), payments: payments.rows.map(mapPayment), expenses: expenses.rows.map(mapExpense) });
}));

app.post("/api/members", asyncRoute(async (request, response) => {
  const fields = parseMemberFields(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(61002400)");
    const { rows: [next] } = await client.query("SELECT COALESCE(MAX(sno), 0) + 1 AS sno FROM members");
    const sno = Number(next.sno);
    const id = `MF-${2400 + sno}`;
    const accountNumber = `6100${String(sno).padStart(6, "0")}`;
    const palette = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#0891B2", "#BE185D"];
    const { rows: [member] } = await client.query(
      "INSERT INTO members (id, sno, account_number, name, initials, avatar_color, hometown, phone, email, status, join_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *, to_char(join_date, 'YYYY-MM-DD') AS join_date",
      [id, sno, accountNumber, fields.name, fields.initials, palette[(sno - 1) % palette.length], fields.hometown, fields.phone, fields.email, fields.status, fields.joinDate],
    );
    await recordAudit(client, request.admin.email, "create", "member", id, { name: fields.name });
    await client.query("COMMIT");
    response.status(201).json(mapMember(member));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/members/bulk", asyncRoute(async (request, response) => {
  if (!Array.isArray(request.body?.entries) || request.body.entries.length > 500) throw apiError(400, "Provide up to 500 member entries.");
  const entries = request.body.entries.map((entry) => ({
    name: requireText(entry?.name, "Name", 120),
    joinDate: normalizeDate(entry?.joinDate, "Join date"),
    amount: Number(entry?.amount),
  }));
  if (entries.some((entry) => !Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 9999999999)) throw apiError(400, "Every credit amount must be zero or greater and within the supported range.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(61002400)");
    const { rows: [next] } = await client.query("SELECT COALESCE(MAX(sno), 0) + 1 AS sno FROM members");
    let sno = Number(next.sno);
    const palette = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#0891B2", "#BE185E"];
    const created = [];
    for (const entry of entries) {
      const id = `MF-${2400 + sno}`;
      const initials = entry.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
      const accountNumber = `6100${String(sno).padStart(6, "0")}`;
      const { rows: [member] } = await client.query(
        "INSERT INTO members (id, sno, account_number, name, initials, avatar_color, status, join_date, entry_amount) VALUES ($1,$2,$3,$4,$5,$6,'Active',$7,$8) RETURNING *, to_char(join_date, 'YYYY-MM-DD') AS join_date",
        [id, sno, accountNumber, entry.name, initials, palette[(sno - 1) % palette.length], entry.joinDate, entry.amount || null],
      );
      if (entry.amount > 0) {
        const receiptId = `RCP-${id}`;
        await client.query(
          "INSERT INTO payments (id, member_id, payment_date, amount, payment_mode, status, receipt_id, description) VALUES ($1,$2,$3,$4,'Cash','Paid',$5,'Member entry credit')",
          [`TXN-${crypto.randomUUID()}`, id, entry.joinDate, entry.amount, receiptId],
        );
      }
      await recordAudit(client, request.admin.email, "create", "member", id, { name: entry.name, source: "year-wise-entry" });
      created.push(mapMember(member));
      sno += 1;
    }
    await client.query("COMMIT");
    response.status(201).json({ members: created });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.patch("/api/members/:id", asyncRoute(async (request, response) => {
  const fields = parseMemberFields(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [member] } = await client.query(
      "UPDATE members SET name=$2, initials=$3, hometown=$4, phone=$5, email=$6, status=$7, join_date=$8, updated_at=now() WHERE id=$1 AND archived_at IS NULL RETURNING *, to_char(join_date, 'YYYY-MM-DD') AS join_date",
      [request.params.id, fields.name, fields.initials, fields.hometown, fields.phone, fields.email, fields.status, fields.joinDate],
    );
    if (!member) throw apiError(404, "Member not found.");
    await recordAudit(client, request.admin.email, "update", "member", member.id, { name: fields.name });
    await client.query("COMMIT");
    response.json(mapMember(member));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.delete("/api/members/:id", asyncRoute(async (request, response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [member] } = await client.query("UPDATE members SET archived_at=now(), updated_at=now() WHERE id=$1 AND archived_at IS NULL RETURNING id, name", [request.params.id]);
    if (!member) throw apiError(404, "Member not found.");
    await recordAudit(client, request.admin.email, "archive", "member", member.id, { name: member.name });
    await client.query("COMMIT");
    response.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/payments", asyncRoute(async (request, response) => {
  const fields = parsePaymentFields(request.body);
  const id = requireText(request.body.id, "Payment id", 100);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [payment] } = await client.query(
      "INSERT INTO payments (id, member_id, payment_date, amount, payment_mode, status, receipt_id, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *, to_char(payment_date, 'YYYY-MM-DD') AS payment_date",
      [id, fields.memberId, fields.date, fields.amount, fields.paymentMode, fields.status, fields.receiptId, fields.description],
    );
    await recordAudit(client, request.admin.email, "create", "payment", id, { amount: fields.amount, receiptId: fields.receiptId });
    await client.query("COMMIT");
    response.status(201).json(mapPayment(payment));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.patch("/api/payments/:id", asyncRoute(async (request, response) => {
  const fields = parsePaymentFields(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [payment] } = await client.query(
      "UPDATE payments SET member_id=$2, payment_date=$3, amount=$4, payment_mode=$5, status=$6, receipt_id=$7, description=$8, updated_at=now() WHERE id=$1 RETURNING *, to_char(payment_date, 'YYYY-MM-DD') AS payment_date",
      [request.params.id, fields.memberId, fields.date, fields.amount, fields.paymentMode, fields.status, fields.receiptId, fields.description],
    );
    if (!payment) throw apiError(404, "Payment not found.");
    await recordAudit(client, request.admin.email, "update", "payment", payment.id, { amount: fields.amount, receiptId: fields.receiptId });
    await client.query("COMMIT");
    response.json(mapPayment(payment));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/expenses", asyncRoute(async (request, response) => {
  const fields = parseExpenseFields(request.body);
  const id = requireText(request.body.id, "Expense id", 100);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [expense] } = await client.query(
      "INSERT INTO expenses (id, financial_year_start, period_id, title, amount, expense_date, notes, payment_mode, status, receipt_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *, to_char(expense_date, 'YYYY-MM-DD') AS expense_date",
      [id, fields.year, fields.periodId, fields.title, fields.amount, fields.date, fields.notes, fields.paymentMode, fields.status, fields.receiptId],
    );
    await recordAudit(client, request.admin.email, "create", "expense", id, { title: fields.title, amount: fields.amount });
    await client.query("COMMIT");
    response.status(201).json(mapExpense(expense));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.patch("/api/expenses/:id", asyncRoute(async (request, response) => {
  const fields = parseExpenseFields(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [expense] } = await client.query(
      "UPDATE expenses SET financial_year_start=$2, period_id=$3, title=$4, amount=$5, expense_date=$6, notes=$7, payment_mode=$8, status=$9, receipt_id=$10, updated_at=now() WHERE id=$1 AND archived_at IS NULL RETURNING *, to_char(expense_date, 'YYYY-MM-DD') AS expense_date",
      [request.params.id, fields.year, fields.periodId, fields.title, fields.amount, fields.date, fields.notes, fields.paymentMode, fields.status, fields.receiptId],
    );
    if (!expense) throw apiError(404, "Expense not found.");
    await recordAudit(client, request.admin.email, "update", "expense", expense.id, { title: fields.title, amount: fields.amount });
    await client.query("COMMIT");
    response.json(mapExpense(expense));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.delete("/api/expenses/:id", asyncRoute(async (request, response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [expense] } = await client.query("UPDATE expenses SET archived_at=now(), updated_at=now() WHERE id=$1 AND archived_at IS NULL RETURNING id, title, amount", [request.params.id]);
    if (!expense) throw apiError(404, "Expense not found.");
    await recordAudit(client, request.admin.email, "archive", "expense", expense.id, { title: expense.title, amount: Number(expense.amount) });
    await client.query("COMMIT");
    response.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.use((error, _request, response, _next) => {
  const status = Number(error.status) || (error.code === "23505" ? 409 : error.code === "23503" ? 400 : 500);
  const message = status >= 500 ? "The server could not complete the request." : error.message;
  if (status >= 500) console.error("E-Register API error:", error);
  response.status(status).json({ error: message });
});

async function start() {
  const migrationPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  const schema = await readFile(path.resolve(migrationPath), "utf8");
  await pool.query(schema);
  app.listen(port, "0.0.0.0", () => console.log(`E-Register API listening on ${port}`));
}

start().catch((error) => {
  console.error("E-Register API failed to start:", error);
  process.exitCode = 1;
});
