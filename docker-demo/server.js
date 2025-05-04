const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9999;

app.use(cors());
app.use(express.json());

// Statik dosyaları sunmadan önce API rotalarını tanımla
app.get("/api", (req, res) => {
  res.json({ message: "Sesli Sohbet API çalışıyor!" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API sağlıklı çalışıyor!" });
});

app.get("/api/info", (req, res) => {
  res.json({
    name: "Sesli Sohbet API",
    version: "1.0.0",
    description: "Gerçek zamanlı sesli sohbet uygulaması API",
    environment: process.env.NODE_ENV,
    containerized: true
  });
});

// Statik dosyaları sun
app.use(express.static(path.join(__dirname, '../public')));
console.log('Statik dosya dizini:', path.join(__dirname, '../public'));

// Ana sayfa rotası
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  console.log('Index dosya yolu:', indexPath);
  res.sendFile(indexPath);
});

// Test sayfası
app.get("/test", (req, res) => {
  const testPath = path.join(__dirname, 'test.html');
  console.log('Test dosya yolu:', testPath);
  res.sendFile(testPath);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
