const express = require("express");

// Tillad alle origins (så din webapp kan kalde proxyen)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/ordrer", async (req, res) => {
  const { shop, key, site } = req.query;

  if (!shop || !key || !site) {
    return res.status(400).json({ error: "Mangler shop, key eller site parameter" });
  }

  const today = new Date().toISOString().split("T")[0];
  const url = `http://${shop}/admin/webapi/Endpoints/v1_0/OrderService/${key}/GetOrdersByDateInterval/${today}T00:00:00/${today}T23:59:59/${site}`;

  try {
    const r = await fetch(url, { timeout: 15000 });
    if (!r.ok) throw new Error(`DanDomain svarede med HTTP ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.send("DanDomain proxy kører ✓"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy kører på port ${PORT}`));
