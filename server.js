const express = require("express");
const app = express();
const path = require("path");

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

const TM_KEY = "1q2wu4qg-7szu-qkwi-gudh-3ejljai1hp4m";

const extractTrackNum = (url) => {
  if (!url) return null;
  const m = url.match(/txtRefNo=([^&]+)/) ||
            url.match(/[?&]id=([^&]+)/) ||
            url.match(/tracknum=([^&]+)/) ||
            url.match(/AWB=([^&]+)/) ||
            url.match(/track[^=]*=([^&]+)/i);
  return m ? m[1] : null;
};

const guessCourier = (trackingNumber, carrier) => {
  const CARRIER_MAP = {
    "gls": "gls", "ups": "ups", "dhl": "dhl",
    "dhl express": "dhl-express", "fedex": "fedex",
    "dsv": "dsv", "dsv xpress": "ups",
    "postnord": "postnord-denmark", "bring": "bring"
  };
  const c = (carrier || "").toLowerCase();
  if (CARRIER_MAP[c]) return CARRIER_MAP[c];
  if (/^1Z/i.test(trackingNumber)) return "ups";
  if (/^JD/i.test(trackingNumber)) return "dhl-express";
  if (/^0432|^0922|^0430|^872/i.test(trackingNumber)) return "gls";
  return "ups";
};

const parseTracking = (d) => {
  const events = (d.origin_info && d.origin_info.trackinfo) || [];
  const latest = events[0];
  return {
    status: d.delivery_status || null,
    description: latest ? (latest.StatusDescription || latest.Details) : null,
    location: latest ? latest.Details : null,
    time: latest ? latest.Date : null
  };
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

// Webshipper: hent alle forsendelser
app.get("/forsendelser", async (req, res) => {
  const { wsKey } = req.query;
  if (!wsKey) return res.status(400).json({ error: "Mangler wsKey" });
  const headers = { Authorization: "Bearer " + wsKey, Accept: "application/vnd.api+json" };
  try {
    const r = await fetch("https://otk.api.webshipper.io/v2/shipments?page[size]=100&sort=-created_at", { headers });
    const data = await r.json();
    if (!data.data) return res.json([]);
    const results = data.data.map(s => {
      const attrs = s.attributes;
      const tlink = attrs.tracking_links && attrs.tracking_links[0];
      const trackingUrl = tlink ? tlink.url : null;
      return {
        id: s.id,
        reference: attrs.reference,
        carrier: attrs.carrier_alias,
        status: attrs.status,
        tracking_url: trackingUrl,
        tracking_number: extractTrackNum(trackingUrl),
        country_code: attrs.delivery_address ? attrs.delivery_address.country_code : "DK"
      };
    });
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TrackingMore: opret eller hent tracking
app.get("/scan", async (req, res) => {
  const { trackingNumber, carrier } = req.query;
  if (!trackingNumber) return res.status(400).json({ error: "Mangler trackingNumber" });

  const courierCode = guessCourier(trackingNumber, carrier);
  const tmHeaders = { "Content-Type": "application/json", "Tracking-Api-Key": TM_KEY };

  const getTracking = async () => {
    const r = await fetch("https://api.trackingmore.com/v4/trackings/get?tracking_numbers=" + encodeURIComponent(trackingNumber) + "&courier_code=" + courierCode, {
      headers: { "Tracking-Api-Key": TM_KEY }
    });
    const d = await r.json();
    return d.data && d.data.length > 0 ? d.data[0] : null;
  };

  try {
    // Prøv at oprette
    const createR = await fetch("https://api.trackingmore.com/v4/trackings/create", {
      method: "POST",
      headers: tmHeaders,
      body: JSON.stringify({ tracking_number: trackingNumber, courier_code: courierCode, language: "en" })
    });
    const createData = await createR.json();

    // Hvis allerede oprettet (4013) eller success (200), poll for data
    if (createData.meta && (createData.meta.code === 200 || createData.meta.code === 4013)) {
      // Poll op til 8 gange
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const d = await getTracking();
        if (d && d.origin_info && d.origin_info.trackinfo && d.origin_info.trackinfo.length > 0) {
          return res.json(parseTracking(d));
        }
        if (d && d.delivery_status && d.delivery_status !== "pending") {
          return res.json(parseTracking(d));
        }
      }
      // Return hvad vi har
      const d = await getTracking();
      return res.json(d ? parseTracking(d) : { status: null, description: null, location: null });
    }

    res.json({ status: null, description: null, location: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
