const express = require("express");
const app = express();
const path = require("path");

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

const PARCEL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2MTVhY2Q0MC00YTE3LTExZjEtYWJhZC00ZmIwOGM4YmQwYzgiLCJzdWJJZCI6IjY5ZmM5MTYyODRkMmRkMmZmZWViODliMyIsImlhdCI6MTc3ODE1OTk3MH0.qbkACqNwnTkDUoS32Hgb9Cj_H_Ubu5f1yWkSpNhks5A";

const COUNTRY_MAP = {
  "DK": "Denmark", "DE": "Germany", "SE": "Sweden", "NO": "Norway",
  "FI": "Finland", "GB": "United Kingdom", "US": "United States",
  "FR": "France", "NL": "Netherlands", "BE": "Belgium", "IT": "Italy",
  "ES": "Spain", "AT": "Austria", "CH": "Switzerland", "PL": "Poland",
  "CZ": "Czech Republic", "SK": "Slovakia", "HU": "Hungary", "RO": "Romania",
  "PT": "Portugal", "EE": "Estonia", "LV": "Latvia", "LT": "Lithuania",
  "JP": "Japan", "AU": "Australia", "CA": "Canada", "IE": "Ireland",
  "HR": "Croatia", "SI": "Slovenia", "BG": "Bulgaria", "GR": "Greece"
};

// DanDomain: hent ordrer fra de seneste 48 timer (site 26 + 29, deduplikeret)
app.get("/ordrer", async (req, res) => {
  const { key } = req.query;
  const now = new Date();
  const past48 = new Date(now - 48 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().split(".")[0];
  const base = "http://otkshop.dk/admin/webapi/Endpoints/v1_0/OrderService/" + key + "/GetByDateInterval?start=" + fmt(past48) + "&end=" + fmt(now);
  try {
    const [r26, r29] = await Promise.all([
      fetch(base + "&site=26", { headers: { Accept: "application/json" } }),
      fetch(base + "&site=29", { headers: { Accept: "application/json" } })
    ]);
    const [t26, t29] = await Promise.all([r26.text(), r29.text()]);
    const o26 = JSON.parse(t26) || [];
    const o29 = JSON.parse(t29) || [];
    const all = [...(Array.isArray(o26) ? o26 : []), ...(Array.isArray(o29) ? o29 : [])];
    // Deduplikér på id
    const seen = new Set();
    const merged = all.filter(o => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
    merged.sort((a, b) => a.id - b.id);
    res.json(merged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GLS tracking direkte
app.get("/scan", async (req, res) => {
  const { trackingNumber, zip } = req.query;
  if (!trackingNumber) return res.status(400).json({ error: "Mangler trackingNumber" });

  try {
    const url = "https://gls-group.eu/app/service/open/rest/DK/da/rstt001?match=" + encodeURIComponent(trackingNumber) + (zip ? "&zip=" + encodeURIComponent(zip) : "");
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    
    // Returner råtekst så vi kan se strukturen
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
