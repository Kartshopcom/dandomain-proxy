const express = require("express");
const http = require("http");
const app = express();

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
  const path = `/admin/webapi/Endpoints/v1_0/OrderService/${key}/GetOrdersByDateInterval/${today}T00:00:00/${today}T23:59:59/${site}`;

  const options = { hostname: shop, path, method: "GET" };

  try {
    const data = await new Promise((resolve, reject) => {
      const req = http.request(options, (r) => {
        let body = "";
        r.on("data", chunk => body += chunk);
        r.on("end", () => {
          try { resolve(JSON.parse(body)); }
          catch(e) { reject(new Error("Kunne ikke parse svar: " + body.substring(0, 200))); }
        });
      });
      req.on("error", reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
      req.end();
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.send("DanDomain proxy kører ✓"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy kører på port ${PORT}`));
