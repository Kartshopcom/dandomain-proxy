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

// DanDomain: hent ordrer fra de seneste 48 timer
app.get("/ordrer", async (req, res) => {
  const { key } = req.query;
  const now = new Date();
  const past48 = new Date(now - 48 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().split(".")[0];
  const url = `http://otkshop.dk/admin/webapi/Endpoints/v1_0/OrderService/${key}/GetByDateInterval?start=${fmt(past48)}&end=${fmt(now)}`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webshipper: hent tracking URL for en ordre
app.get("/tracking", async (req, res) => {
  const { ref, wsKey } = req.query;
  if (!ref || !wsKey) return res.status(400).json({ error: "Mangler ref eller wsKey" });
  const headers = { Authorization: `Bearer ${wsKey}`, Accept: "application/vnd.api+json" };
  try {
    const r = await fetch(`https://otk.api.webshipper.io/v2/shipments?filter[reference]=O${ref}`, { headers });
    const data = await r.json();
    const shipment = data.data && data.data[0];
    if (!shipment) return res.json({ found: false });
    const attrs = shipment.attributes;
    const tlink = attrs.tracking_links && attrs.tracking_links[0];
    // Udtræk tracking nummer fra URL
    let trackingNumber = null;
    if (tlink) {
      const m = tlink.url.match(/txtRefNo=([^&]+)/) || tlink.url.match(/tracknum=([^&]+)/) || tlink.url.match(/track[^=]*=([^&]+)/i);
      if (m) trackingNumber = m[1];
    }
    res.json({
      found: true,
      status: attrs.status,
      carrier: attrs.carrier_alias,
      tracking_number: trackingNumber,
      tracking_url: tlink ? tlink.url : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ParcelApp: hent seneste scan for et tracking nummer
app.get("/scan", async (req, res) => {
  const { trackingNumber } = req.query;
  if (!trackingNumber) return res.status(400).json({ error: "Mangler trackingNumber" });

  try {
    // Trin 1: Start tracking
    const initR = await fetch("https://parcelsapp.com/api/v3/shipments/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipments: [{ trackingId: trackingNumber }],
        language: "en",
        apiKey: PARCEL_KEY
      })
    });
    const initData = await initR.json();

    // Hvis cached data allerede returneret
    if (initData.shipments && initData.shipments[0]) {
      const s = initData.shipments[0];
      const latest = s.events && s.events[0];
      return res.json({
        status: s.status,
        description: latest ? latest.description : null,
        location: latest ? latest.location : null,
        time: latest ? latest.time : null
      });
    }

    const uuid = initData.uuid;
    if (!uuid) return res.json({ status: null, description: null });

    // Trin 2: Poll indtil done (max 8 sekunder)
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollR = await fetch(`https://parcelsapp.com/api/v3/shipments/tracking?uuid=${uuid}&apiKey=${PARCEL_KEY}`);
      const pollData = await pollR.json();
      if (pollData.done && pollData.shipments && pollData.shipments[0]) {
        const s = pollData.shipments[0];
        const latest = s.events && s.events[0];
        return res.json({
          status: s.status,
          description: latest ? latest.description : null,
          location: latest ? latest.location : null,
          time: latest ? latest.time : null
        });
      }
    }

    res.json({ status: null, description: "Timeout", location: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
