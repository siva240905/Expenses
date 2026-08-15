const fs = require('fs');
const path = require('path');

let memoryDb = { transactions: [], monthlySavings: 0 };
const DB_FILE = path.join('/tmp', 'db.json');

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return memoryDb;
}

function saveDb(data) {
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-admin-pin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const data = loadDb();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const ADMIN_PIN = process.env.ADMIN_PIN || '7871';
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_PIN) {
      return res.status(403).json({ error: 'Unauthorized: Invalid Admin PIN' });
    }
    const data = req.body || {};
    saveDb(data);
    return res.status(200).json({ success: true, updatedAt: new Date().toISOString() });
  }

  return res.status(404).json({ error: 'Endpoint not found' });
};
