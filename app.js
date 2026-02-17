// ============================================================
// app.js – Frontend-Logik
// ============================================================

const API = 'http://localhost:3000/api/termine';
let alleTermine   = [];
let aktiverFilter = 'alle';

const EMPFAENGER_NAMEN = {
  budholzer: 'Budholzer',
  dichtl:    'Dichtl',
  winter:    'Winter'
};

document.addEventListener('DOMContentLoaded', () => {
  const jetzt = new Date();
  document.getElementById('headerDatum').textContent =
    jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('inp-datum').value = jetzt.toISOString().split('T')[0];

  ladeTermine();
  document.getElementById('terminForm').addEventListener('submit', neuerTermin);
  setInterval(ladeTermine, 30000);
  pruefeServer();
});

async function pruefeServer() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      dot.className = 'status-dot online';
      text.innerHTML = '<strong>Discord Bot</strong> – Verbunden ✅ &nbsp;|&nbsp; Erinnerungen werden automatisch gesendet';
    } else throw new Error();
  } catch {
    dot.className = 'status-dot offline';
    text.innerHTML = '<strong>Discord Bot</strong> – Nicht verbunden ❌ &nbsp;|&nbsp; Bitte <code>npm start</code> ausführen';
  }
}

async function ladeTermine() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error();
    alleTermine = await res.json();
    renderTermine();
    document.getElementById('anzahlBadge').textContent = alleTermine.length;
  } catch {}
}

async function neuerTermin(e) {
  e.preventDefault();
  const termin = {
    empfaenger: document.getElementById('inp-empfaenger').value,
    name:       document.getElementById('inp-name').value.trim(),
    datum:      document.getElementById('inp-datum').value,
    uhrzeit:    document.getElementById('inp-uhrzeit').value,
    link:       document.getElementById('inp-link').value.trim(),
    notiz:      document.getElementById('inp-notiz').value.trim()
  };

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(termin)
    });

    if (!res.ok) {
      const fehler = await res.json();
      zeigeToast(fehler.fehler || 'Fehler beim Speichern', 'error');
      return;
    }

    document.getElementById('inp-empfaenger').selectedIndex = 0;
    document.getElementById('inp-name').value    = '';
    document.getElementById('inp-uhrzeit').value = '';
    document.getElementById('inp-link').value    = '';
    document.getElementById('inp-notiz').value   = '';

    const name = EMPFAENGER_NAMEN[termin.empfaenger] || termin.empfaenger;
    zeigeToast(`Termin gespeichert – Erinnerung geht an ${name}`, 'ok');
    ladeTermine();
  } catch {
    zeigeToast('Server nicht erreichbar – läuft npm start?', 'error');
  }
}

async function loescheTermin(id) {
  if (!confirm('Termin wirklich löschen?')) return;
  try {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    ladeTermine();
  } catch { alert('Fehler beim Löschen.'); }
}

function setFilter(filter, btn) {
  aktiverFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('aktiv'));
  btn.classList.add('aktiv');
  renderTermine();
}

function filterTermine(termine) {
  const heute = new Date().toISOString().split('T')[0];
  const jetzt = new Date();
  switch (aktiverFilter) {
    case 'heute':     return termine.filter(t => t.datum === heute);
    case 'woche': {
      const ende = new Date(jetzt.getTime() + 7 * 86400000).toISOString().split('T')[0];
      return termine.filter(t => t.datum >= heute && t.datum <= ende);
    }
    case 'budholzer': return termine.filter(t => t.empfaenger === 'budholzer');
    case 'dichtl':    return termine.filter(t => t.empfaenger === 'dichtl');
    case 'winter':    return termine.filter(t => t.empfaenger === 'winter');
    default:          return termine;
  }
}

function renderTermine() {
  const container = document.getElementById('termineListe');
  const gefiltert = filterTermine([...alleTermine])
    .sort((a, b) => {
      const c = a.datum.localeCompare(b.datum);
      return c !== 0 ? c : a.uhrzeit.localeCompare(b.uhrzeit);
    });

  if (gefiltert.length === 0) {
    container.innerHTML = `
      <div class="leer">
        <div class="leer-icon">◦</div>
        <p>Keine Termine für diesen Filter.</p>
      </div>`;
    return;
  }

  const gruppen = {};
  for (const t of gefiltert) {
    if (!gruppen[t.datum]) gruppen[t.datum] = [];
    gruppen[t.datum].push(t);
  }

  let html = '';
  for (const [datum, termine] of Object.entries(gruppen)) {
    const datumLabel = new Date(datum + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    html += `<div class="termin-gruppe">
      <div class="datum-label">${datumLabel}</div>`;

    for (const t of termine) {
      const empfKey  = t.empfaenger || 'budholzer';
      const empfName = EMPFAENGER_NAMEN[empfKey] || empfKey;

      const gesendetBadge = t.erinnerungGesendet
        ? '<span class="gesendet-badge">✓ Gesendet</span>' : '';
      const linkHtml = t.link
        ? `<a class="termin-link" href="${escapeHtml(t.link)}" target="_blank" rel="noopener">🔗 Discord-Link öffnen</a>` : '';
      const notizHtml = t.notiz
        ? `<div class="termin-notiz">📝 ${escapeHtml(t.notiz)}</div>` : '';

      html += `
        <div class="termin-karte ${t.erinnerungGesendet ? 'gesendet' : ''}">
          <div class="termin-zeit">${escapeHtml(t.uhrzeit)}</div>
          <div class="termin-info">
            <div><span class="termin-empfaenger emp-${empfKey}">${escapeHtml(empfName)}</span></div>
            <div class="termin-name">${escapeHtml(t.name)}</div>
            ${linkHtml}
            ${notizHtml}
          </div>
          ${gesendetBadge}
          <button class="btn-del" onclick="loescheTermin('${t.id}')" title="Löschen">✕</button>
        </div>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;
}

function zeigeToast(nachricht, typ = 'ok') {
  const toast = document.getElementById('toast');
  toast.textContent = nachricht;
  toast.className = `toast show ${typ}`;
  setTimeout(() => { toast.className = 'toast'; }, 4000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}