const express = require('express');
const os = require('os');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error('MONGO_URL environment variable is required');
  process.exit(1);
}

// Short selection timeout so /health fails fast when MongoDB is unreachable.
const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 2000 });
const db = client.db(); // database name (emidb) comes from the connection string
const calculations = db.collection('calculations');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Return the first non-internal IPv4 address of this pod.
function getPodIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'unknown';
}

const POD_NAME = process.env.HOSTNAME || os.hostname();
const POD_IP = getPodIp();

const round2 = (x) => Math.round(x * 100) / 100;

// Readiness probe: 200 only when MongoDB answers a ping.
app.get('/health', async (req, res) => {
  try {
    await client.db('admin').command({ ping: 1 });
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'mongo unreachable' });
  }
});

app.post('/api/emi', async (req, res) => {
  const P = Number(req.body.principal);
  const rate = Number(req.body.rate);
  const n = Number(req.body.months);

  if (![P, rate, n].every((v) => Number.isFinite(v) && v > 0) || !Number.isInteger(n)) {
    return res.status(400).json({
      error: 'principal, rate and months must be positive numbers (months must be a whole number)'
    });
  }

  const r = rate / 12 / 100;
  const factor = Math.pow(1 + r, n);
  const emi = (P * r * factor) / (factor - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - P;

  const doc = {
    principal: P,
    rate,
    months: n,
    emi: round2(emi),
    servedBy: POD_NAME,
    createdAt: new Date()
  };

  try {
    await calculations.insertOne(doc);
  } catch (err) {
    console.error('Insert failed:', err.message);
    return res.status(500).json({ error: 'database unavailable' });
  }

  res.json({
    emi: round2(emi),
    totalPayment: round2(totalPayment),
    totalInterest: round2(totalInterest),
    servedBy: POD_NAME,
    podIp: POD_IP
  });
});

app.get('/api/history', async (req, res) => {
  try {
    const rows = await calculations
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'database unavailable' });
  }
});

app.listen(PORT, () => console.log(`emi-web listening on ${PORT}, pod=${POD_NAME}`));
