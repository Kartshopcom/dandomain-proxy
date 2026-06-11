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

// Webshipper: find forsendelse og returnér tracking URL + carrier
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

    // Udtræk trackingnummer fra pakker
    const trackingNumber = attrs.packages && attrs.packages[0] && attrs.packages[0].barcode_usage_id
      ? attrs.packages[0].barcode_usage_id
      : null;

    // Udtræk trackingnummer fra tracking URL hvis muligt
    let trackNum = trackingNumber;
    if (!trackNum && tlink) {
      const m = tlink.url.match(/txtRefNo=([^&]+)/);
      if (m) trackNum = m[1];
    }

    res.json({
      found: true,
      status: attrs.status,
      carrier: attrs.carrier_alias,
      tracking_number: trackNum,
      tracking_url: tlink ? tlink.url : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Multi-carrier scan: hent seneste scan direkte fra carrier
app.get("/scan", async (req, res) => {
  const { trackingNumber, carrier } = req.query;
  if (!trackingNumber) return res.status(400).json({ error: "Mangler trackingNumber" });

  try {
    // GLS
    if (!carrier || carrier.toLowerCase().includes("gls")) {
      const r = await fetch(`https://api.gls-group.eu/app/service/open/rest/GROUP/en/rstt001?match=${trackingNumber}`);
      const data = await r.json();
      const events = data.tuStatus && data.tuStatus[0] && data.tuStatus[0].history || [];
      const latest = events[0];
      if (latest) return res.json({
        carrier: "GLS",
        description: latest.evtDscr,
        location: latest.address ? `${latest.address.city}, ${latest.address.countryCode}` : null,
        time: latest.date + " " + latest.time
      });
    }

    // FedEx (kræver API nøgle — returnér link i stedet)
    if (carrier && carrier.toLowerCase().includes("fedex")) {
      return res.json({
        carrier: "FedEx",
        description: null,
        location: null,
        tracking_url: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`
      });
    }

    // DHL
    if (carrier && carrier.toLowerCase().includes("dhl")) {
      const r = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`, {
        headers: { "DHL-API-Key": "demo-key" }
      });
      const data = await r.json();
      const events = data.shipments && data.shipments[0] && data.shipments[0].events || [];
      const latest = events[0];
      if (latest) return res.json({
        carrier: "DHL",
        description: latest.description,
        location: latest.location ? latest.location.address.addressLocality : null,
        time: latest.timestamp
      });
    }

    // UPS
    if (carrier && carrier.toLowerCase().includes("ups")) {
      return res.json({
        carrier: "UPS",
        description: null,
        location: null,
        tracking_url: `https://www.ups.com/track?tracknum=${trackingNumber}`
      });
    }

    res.json({ carrier: carrier || "Ukendt", description: null, location: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
