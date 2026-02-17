// ============================================================
// server.js – Haupt-Server
// ============================================================

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const TERMINE_FILE = path.join(__dirname, 'termine.json');

function ladeTermine() {
  try {
    if (!fs.existsSync(TERMINE_FILE)) { fs.writeFileSync(TERMINE_FILE, '[]'); return []; }
    const inhalt = fs.readFileSync(TERMINE_FILE, 'utf8').trim();
    if (!inhalt) return [];
    return JSON.parse(inhalt);
  } catch { fs.writeFileSync(TERMINE_FILE, '[]'); return []; }
}

function speichereTermine(termine) {
  fs.writeFileSync(TERMINE_FILE, JSON.stringify(termine, null, 2));
}

app.get('/api/termine', (req, res) => {
  res.json(ladeTermine());
});

app.post('/api/termine', (req, res) => {
  const { empfaenger, name, datum, uhrzeit, link, notiz } = req.body;
  if (!empfaenger || !name || !datum || !uhrzeit) {
    return res.status(400).json({ fehler: 'Empfänger, Name, Datum und Uhrzeit sind Pflichtfelder!' });
  }
  const termine = ladeTermine();
  const neuerTermin = {
    id:                 Date.now().toString(),
    empfaenger,
    name,
    datum,
    uhrzeit,
    link:               link  || '',
    notiz:              notiz || '',
    erstelltAm:         new Date().toISOString(),
    erinnerungGesendet: false
  };
  termine.push(neuerTermin);
  speichereTermine(termine);
  console.log(`✅ Neuer Termin: ${name} → ${empfaenger} am ${datum} um ${uhrzeit} Uhr`);
  res.status(201).json(neuerTermin);
});

app.delete('/api/termine/:id', (req, res) => {
  let termine = ladeTermine();
  const vorher = termine.length;
  termine = termine.filter(t => t.id !== req.params.id);
  if (termine.length === vorher) return res.status(404).json({ fehler: 'Termin nicht gefunden' });
  speichereTermine(termine);
  res.json({ erfolg: true });
});

app.listen(PORT, () => {
  console.log(`\n🌐 Webserver läuft auf: http://localhost:${PORT}`);
  console.log(`📁 Termine gespeichert in: ${TERMINE_FILE}\n`);
});

require('./bot.js');