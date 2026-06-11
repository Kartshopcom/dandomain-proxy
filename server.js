const express = require("express");
const app = express();
const path = require("path");

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Webshipper: hent alle forsendelser fra de seneste 48 timer med tracking events
app.get("/forsendelser", async (req, res) => {
  const { wsKey } = req.query;
  if (!wsKey) return res.status(400).json({ error: "Mangler wsKey" });

  const headers = {
    Authorization: "Bearer " + wsKey,
    Accept: "application/vnd.api+json"
  };

  try {
    // Hent forsendelser oprettet inden for 48 timer
    const now = new Date();
    const past48 = new Date(now - 48 * 60 * 60 * 1000).toISOString();

    const r = await fetch("https://otk.api.webshipper.io/v2/shipments?filter[created_after]=" + encodeURIComponent(past48) + "&page[size]=100", { headers });
    const data = await r.json();

    if (!data.data) return res.json([]);

    const result = data.data.map(s => {
      const attrs = s.attributes;
      const tlink = attrs.tracking_links && attrs.tracking_links[0];
      const latest = attrs.latest_status_event;

      return {
        id: s.id,
        reference: attrs.reference,
        carrier: attrs.carrier_alias,
        status: attrs.status,
        created_at: attrs.created_at,
        tracking_url: tlink ? tlink.url : null,
        latest_description: latest ? latest.description : null,
        latest_location: latest ? latest.location : null,
        latest_time: latest ? latest.event_time : null,
        customer: attrs.delivery_address ? attrs.delivery_address.att_contact : null
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DanDomain: hent ordrer fra de seneste 48 timer
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

const PORT = process.env.PORT || 3000;
app.listen(PORT);
