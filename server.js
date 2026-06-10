const express = require("express");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/ordrer", async (req, res) => {
  const { shop, key, site } = req.query;
  const today = new Date().toISOString().split("T")[0];
  const url = `https://api.dandomain.dk/order/v1_0/${key}/GetOrdersByDateInterval/${today}T00:00:00/${today}T23:59:59/${site}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT);
