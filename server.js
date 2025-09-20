// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");

const app = express();
app.get("/", (_req, res) => res.send("Bot is running ✅"));

const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

server.on("listening", () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.log(`ℹ️ Port ${PORT} already in use → skip health server (another instance likely running).`);
    // ไม่ throw, ไม่ exit → ปล่อยให้ index.js ทำงานต่อ
  } else {
    console.error("Health server error:", err);
  }
});

server.listen(PORT);
