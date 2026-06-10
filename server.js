const express = require("express");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/ordrer", async (req, res) => {
  const { shop, key, site } = req.query;
  const today = new Date().toISOString().split("T")[0];
const url = `http://otkshop.dk/admin/webapi/Endpoints/v1_0/OrderService/${key}/GetByDateInterval?startdate=${today}T00:00:00&enddate=${today}T23:59:59&siteid=${site}`;
  try {
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
const text = await r.text();
res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT);
