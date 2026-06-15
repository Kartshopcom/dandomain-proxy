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

// Debug: se descriptions felt fra DanDomain produkt endpoint
app.get("/debug-produkt", async (req, res) => {
  const { key, number, site } = req.query;
  try {
    const r = await fetch("http://otkshop.dk/admin/webapi/Endpoints/v1_0/ProductService/" + key + "/" + encodeURIComponent(number) + "/" + (site || 26), {
      headers: { Accept: "application/json" }
    });
    const text = await r.text();
    const data = JSON.parse(text);
    res.json({
      descriptions: data.descriptions,
      shortDescription: data.shortDescription
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DanDomain: hent produkter med beskrivelse fra begge sites
app.get("/produkter", async (req, res) => {
  const { key, page, size } = req.query;
  const pageSize = parseInt(size) || 50;
  const pageIndex = parseInt(page) || 1;

  const getDesc = async (number, siteId) => {
    try {
      const r = await fetch("http://otkshop.dk/admin/webapi/Endpoints/v1_0/ProductService/" + key + "/" + encodeURIComponent(number) + "/" + siteId, {
        headers: { Accept: "application/json" }
      });
      const text = await r.text();
      // JSON starter efter det første nummer og HTML blob
      const jsonStart = text.indexOf('{"');
      if (jsonStart === -1) return false;
      const data = JSON.parse(text.substring(jsonStart));
      const desc = data.descriptions ? (data.descriptions.description || '') : '';
      return desc.trim().length > 0;
    } catch { return false; }
  };

  try {
    const listR = await fetch("http://otkshop.dk/admin/webapi/Endpoints/v1_0/ProductService/" + key + "/ProductPage/26?pageIndex=" + pageIndex + "&pageSize=" + pageSize, {
      headers: { Accept: "application/json" }
    });
    const products = await listR.json();
    if (!Array.isArray(products)) return res.json([]);

    const result = await Promise.all(products.map(async p => {
      const [desc26, desc29] = await Promise.all([
        getDesc(p.number, 26),
        getDesc(p.number, 29)
      ]);
      return {
        id: p.id,
        number: p.number,
        name: p.name,
        desc26,
        desc29
      };
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => console.log("Server kører"));
