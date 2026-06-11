const express = require("express");
const app = express();
const path = require("path");

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

const WS_HEADERS = (key) => ({
  Authorization: "Bearer " + key,
  Accept: "application/vnd.api+json"
});

const extractTrackNum = (url) => {
  if (!url) return null;
  const m = url.match(/txtRefNo=([^&]+)/) ||
            url.match(/[?&]id=([^&]+)/) ||
            url.match(/tracknum=([^&]+)/) ||
            url.match(/AWB=([^&]+)/) ||
            url.match(/track[^=]*=([^&]+)/i);
  return m ? m[1] : null;
};

// DanDomain: hent ordrer fra de seneste 48 timer (site 26 + 29)
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
    const merged = all.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
    merged.sort((a, b) => a.id - b.id);
    res.json(merged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webshipper: hent alle forsendelser inkl. status events
app.get("/forsendelser", async (req, res) => {
  const { wsKey } = req.query;
  if (!wsKey) return res.status(400).json({ error: "Mangler wsKey" });
  const headers = WS_HEADERS(wsKey);

  try {
    const r = await fetch("https://otk.api.webshipper.io/v2/shipments?page[size]=100&sort=-created_at", { headers });
    const data = await r.json();
    if (!data.data) return res.json([]);

    // Hent status_events for alle forsendelser parallelt
    const results = await Promise.all(data.data.map(async s => {
      const attrs = s.attributes;
      const tlink = attrs.tracking_links && attrs.tracking_links[0];
      const trackingUrl = tlink ? tlink.url : null;

      // Hent events
      let latestDesc = null, latestLoc = null, latestTime = null;
      try {
        const evR = await fetch("https://otk.api.webshipper.io/v2/shipments/" + s.id + "/status_events?page[size]=1&sort=-created_at", { headers });
        const evData = await evR.json();
        if (evData.data && evData.data[0]) {
          const ev = evData.data[0].attributes;
          latestDesc = ev.description || ev.status || null;
          latestLoc = ev.location || null;
          latestTime = ev.created_at || null;
        }
      } catch(e) {}

      return {
        id: s.id,
        reference: attrs.reference,
        carrier: attrs.carrier_alias,
        status: attrs.status,
        tracking_url: trackingUrl,
        tracking_number: extractTrackNum(trackingUrl),
        country_code: attrs.delivery_address ? attrs.delivery_address.country_code : "DK",
        latest_description: latestDesc,
        latest_location: latestLoc,
        latest_time: latestTime
      };
    }));

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
