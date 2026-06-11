const express = require("express");
const app = express();
const path = require("path");

app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

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

// Webshipper: hent seneste tracking for et tracking-nummer
app.get("/tracking", async (req, res) => {
  const { trackingNumber, wsKey } = req.query;
  if (!trackingNumber || !wsKey) return res.status(400).json({ error: "Mangler trackingNumber eller wsKey" });

  const url = `https://otk.api.webshipper.io/v2/shipments?filter[tracking_number]=${encodeURIComponent(trackingNumber)}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${wsKey}`,
        Accept: "application/json"
      }
    });
    const data = await r.json();
    const shipment = data.data && data.data[0];
    if (!shipment) return res.json({ status: null, location: null });

    const events = shipment.attributes.tracking_events || [];
    const latest = events[0] || null;
    res.json({
      status: latest ? latest.description : null,
      location: latest ? latest.location : null,
      time: latest ? latest.event_time : null,
      carrier: shipment.attributes.carrier_name || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
