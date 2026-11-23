import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.FLORAROAD_DB || resolve(project, 'data', 'floraroad.sqlite');
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY, model TEXT NOT NULL, type TEXT NOT NULL, fuel TEXT NOT NULL,
    seats INTEGER NOT NULL, rate INTEGER NOT NULL, active INTEGER NOT NULL, featured INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bookings (
    reference TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
    pickup TEXT NOT NULL, return_date TEXT NOT NULL CHECK (return_date > pickup),
    customer TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS booking_dates ON bookings(vehicle_id, pickup, return_date) WHERE status != 'cancelled';
  INSERT OR IGNORE INTO vehicles VALUES
    ('corolla', 'Toyota Corolla', 'Sedan', 'Petrol', 5, 549, 1, 1),
    ('cx5', 'Mazda CX-5', 'SUV', 'Petrol', 5, 849, 1, 1),
    ('ranger', 'Ford Ranger', 'Pickup', 'Diesel', 5, 1099, 0, 0);
`);

const app = express();
app.disable('x-powered-by');
app.use('/api', express.json({ limit: '8kb' }), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const zone = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' });

function validDates(pickup, returnDate) {
  const validDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  return validDate(pickup) && validDate(returnDate) && pickup >= zone.format() && pickup < returnDate;
}

const listVehicles = db.prepare(`
  SELECT id, model, type, fuel, seats, rate, featured,
    active = 1 AND NOT EXISTS (
      SELECT 1 FROM bookings WHERE vehicle_id = vehicles.id AND status != 'cancelled'
        AND pickup < ? AND return_date > ?
    ) AS available
  FROM vehicles ORDER BY featured DESC, rate
`);
const availableVehicle = db.prepare(`
  SELECT id FROM vehicles WHERE id = ? AND active = 1 AND NOT EXISTS (
    SELECT 1 FROM bookings WHERE vehicle_id = vehicles.id AND status != 'cancelled'
      AND pickup < ? AND return_date > ?
  )
`);
const insertBooking = db.prepare(`
  INSERT INTO bookings(reference, vehicle_id, pickup, return_date, customer, email, phone, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
`);

app.get('/api/vehicles', (req, res) => {
  const { pickup, returnDate } = req.query;
  const hasDates = pickup !== undefined || returnDate !== undefined;
  if (hasDates && !validDates(pickup, returnDate)) {
    return res.status(400).json({ error: 'Choose a pick-up date from today and a later return date.' });
  }
  res.json({ today: zone.format(), vehicles: listVehicles.all(returnDate ?? null, pickup ?? null) });
});

app.post('/api/bookings', (req, res) => {
  const { vehicle, pickup, returnDate } = req.body ?? {};
  const clean = value => typeof value === 'string' ? value.trim() : '';
  const customer = clean(req.body?.customer);
  const email = clean(req.body?.email);
  const phone = clean(req.body?.phone);
  const digits = phone.replace(/\D/g, '');

  if (!validDates(pickup, returnDate)) {
    return res.status(400).json({ error: 'Choose a pick-up date from today and a later return date.' });
  }
  if (typeof vehicle !== 'string' || !vehicle || customer.length < 2 || customer.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length > 30 ||
      !/^\+?[\d ()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return res.status(400).json({ error: 'Choose a vehicle and enter a valid name, email and phone number.' });
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    if (!availableVehicle.get(vehicle, returnDate, pickup)) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'This vehicle is unavailable for your dates. Choose another vehicle or change your dates.' });
    }
    const reference = 'FR-' + randomUUID().toUpperCase();
    insertBooking.run(reference, vehicle, pickup, returnDate, customer, email, phone);
    db.exec('COMMIT');
    res.status(201).json({ reference, status: 'pending' });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
});

function authenticate(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    return res.status(503).json({ error: 'Set ADMIN_PASSWORD to at least 12 characters in the FLORAROAD .env file, then restart the API.' });
  }

  const expected = Buffer.from('admin:' + password);
  const header = req.get('authorization') || '';
  const provided = header.startsWith('Basic ') ? Buffer.from(header.slice(6), 'base64') : Buffer.alloc(0);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'The operator password is incorrect.' });
  }
  next();
}

app.get('/api/admin/bookings', authenticate, (req, res) => {
  res.json(db.prepare(`
    SELECT b.*, v.model FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id
    ORDER BY b.created_at DESC, b.reference
  `).all());
});

app.patch('/api/admin/bookings/:reference', authenticate, (req, res) => {
  const { status } = req.body ?? {};
  if (!['confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid booking status.' });
  }
  const result = db.prepare(`
    UPDATE bookings SET status = ? WHERE reference = ?
    AND (status = 'pending' OR (status = 'confirmed' AND ? = 'cancelled'))
  `).run(status, req.params.reference, status);
  if (!result.changes) return res.status(409).json({ error: 'This booking has changed. Refresh the list.' });
  res.json({ status });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use(express.static(resolve(project, 'dist')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({ error: 'Invalid request body.' });
  }
  console.error(error.message);
  res.status(500).json({ error: 'The server could not complete the request. Try again.' });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log(`FLORAROAD listening at http://${host}:${port}`));
