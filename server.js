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

// Webshipper: hent tracking info for en ordre
app.get("/tracking", async (req, res) => {
  const { ref, wsKey } = req.query;
  if (!ref || !wsKey) return res.status(400).json({ error: "Mangler ref eller wsKey" });
  const headers = { Authorization: `Bearer ${wsKey}`, Accept: "application/vnd.api+json" };

  const extractTrackNum = (url) => {
    if (!url) return null;
    const m = url.match(/txtRefNo=([^&]+)/) ||
              url.match(/[?&]id=([^&]+)/) ||
              url.match(/tracknum=([^&]+)/) ||
              url.match(/AWB=([^&]+)/) ||
              url.match(/track[^=]*=([^&]+)/i);
    return m ? m[1] : null;
  };

  const tryFind = async (filterVal) => {
    const r = await fetch(`https://otk.api.webshipper.io/v2/shipments?filter[reference]=${encodeURIComponent(filterVal)}`, { headers });
    const data = await r.json();
    return data.data && data.data[0];
  };

  try {
    // Prøv O121210, 121210, og O0121210
    let shipment = await tryFind(`O${ref}`) || await tryFind(ref) || await tryFind(`O0${ref}`);

    if (!shipment) return res.json({ found: false });

    const attrs = shipment.attributes;
    const tlink = attrs.tracking_links && attrs.tracking_links[0];
    const trackingNumber = extractTrackNum(tlink ? tlink.url : null);
    const country = attrs.delivery_address ? attrs.delivery_address.country_code : "DK";

    res.json({
      found: true,
      status: attrs.status,
      carrier: attrs.carrier_alias,
      tracking_number: trackingNumber,
      tracking_url: tlink ? tlink.url : null,
      destination_country: country
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ParcelApp: hent seneste scan
app.get("/scan", async (req, res) => {
  const { trackingNumber, country } = req.query;
  if (!trackingNumber) return res.status(400).json({ error: "Mangler trackingNumber" });

  const countryMap = {
    "DK": "Denmark", "DE": "Germany", "SE": "Sweden", "NO": "Norway",
    "FI": "Finland", "GB": "United Kingdom", "US": "United States",
    "FR": "France", "NL": "Netherlands", "BE": "Belgium", "IT": "Italy",
    "ES": "Spain", "AT": "Austria", "CH": "Switzerland", "PL": "Poland",
    "CZ": "Czech Republic", "SK": "Slovakia", "HU": "Hungary", "RO": "Romania",
    "PT": "Portugal", "EE": "Estonia", "LV": "Latvia", "LT": "Lithuania",
    "JP": "Japan", "AU": "Australia", "CA": "Canada"
  };

  const destCountry = countryMap[country] || country || "Denmark";
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipments: [{ trackingId: trackingNumber, destinationCountry: destCountry }],
        language: "en",
        apiKey: PARCEL_KEY
      })
    });
    const initData = await initR.json();

    if (initData.shipments && initData.shipments[0]) {
      return res.json(parse(initData.shipments[0]));
    }

    const uuid = initData.uuid;
    if (!uuid) return res.json({ status: null, description: null, location: null });

    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollR = await fetch(`https://parcelsapp.com/api/v3/shipments/tracking?uuid=${uuid}&apiKey=${PARCEL_KEY}`);
      const pollData = await pollR.json();
      if (pollData.done && pollData.shipments && pollData.shipments[0]) {
        return res.json(parse(pollData.shipments[0]));
      }
    }

    res.json({ status: null, description: "Timeout", location: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
