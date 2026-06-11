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

    res.json({
      found: true,
      status: attrs.status,
      carrier: attrs.carrier_alias,
      tracking_url: tlink ? tlink.url : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
