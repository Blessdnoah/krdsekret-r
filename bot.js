// ============================================================
// bot.js – Discord Bot
// Jeder Empfänger kriegt seine eigene DM
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const fs   = require('fs');
const path = require('path');

const CONFIG = {
  BOT_TOKEN: 'MTQ3MzQxOTA1NzIzMDM4MTM2MQ.G5Ujy0.Qn3ZsG7hxW-Rpw4grNbpZOzOTE_egqc73ugN54',
  SERVER_ID: '1473418650378567700',
  CLIENT_ID: '1473419057230381361',

  EMPFAENGER: {
    budholzer: { id: '1259415036842213490', anrede: 'Guten Morgen Herr Budholzer' },
    dichtl:    { id: '429301283627728928',  anrede: 'Guten Morgen Herr Dichtl'    },
    winter:    { id: '1025689932179722250', anrede: 'Guten Morgen Herr Winter'    }
  }
};

const TERMINE_FILE = path.join(__dirname, 'termine.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ]
});

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

function formatiereDatum(datumStr) {
  return new Date(datumStr + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

async function sendeDM(empfKey, termine, istTagesplan = false) {
  const empf = CONFIG.EMPFAENGER[empfKey];
  if (!empf) return;

  try {
    const user = await client.users.fetch(empf.id);
    const dm   = await user.createDM();

    const terminListe = termine.map(t => {
      let z = `• **${t.name}**\n  🕐 ${t.uhrzeit} Uhr`;
      if (t.link)  z += `\n  🔗 ${t.link}`;
      if (t.notiz) z += `\n  📝 ${t.notiz}`;
      return z;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x1A56A0)
      .setTitle(istTagesplan ? '🌅 Guten Morgen – Tagesplan' : '📅 Terminkalender – Erinnerung')
      .setDescription(
        `${empf.anrede} <@${empf.id}>,\n\n` +
        `hier ist dein Plan für heute, **${formatiereDatum(termine[0].datum)}**:`
      )
      .addFields({ name: '📋 Termine', value: terminListe })
      .addFields({ name: '\u200B', value: istTagesplan
        ? '_Ich wünsche dir einen erfolgreichen Tag._'
        : '_Ich wünsche dir einen erfolgreichen Termin._'
      })
      .setFooter({ text: 'Im Auftrag des Sekretariates · Felix Winter' })
      .setTimestamp();

    await dm.send({ embeds: [embed] });
    console.log(`📨 DM → ${empfKey}: ${termine.map(t => t.name).join(', ')}`);
  } catch (err) {
    console.error(`❌ Fehler bei ${empfKey}:`, err.message);
  }
}

async function pruefeErinnerungen() {
  const jetzt   = new Date();
  const termine = ladeTermine();
  const faellig = [];

  for (const t of termine) {
    if (t.erinnerungGesendet) continue;
    const erinnerungsZeit = new Date(new Date(`${t.datum}T${t.uhrzeit}:00`).getTime() - 3600000);
    if (Math.abs(jetzt - erinnerungsZeit) <= 60000) faellig.push(t);
  }

  if (faellig.length === 0) return;

  for (const empfKey of Object.keys(CONFIG.EMPFAENGER)) {
    const meineTermine = faellig.filter(t => t.empfaenger === empfKey);
    if (meineTermine.length > 0) await sendeDM(empfKey, meineTermine, false);
  }

  for (const t of faellig) {
    const i = termine.findIndex(x => x.id === t.id);
    if (i !== -1) termine[i].erinnerungGesendet = true;
  }
  speichereTermine(termine);
}

async function sendeTagesplan() {
  const heute   = new Date().toISOString().split('T')[0];
  const termine = ladeTermine();

  for (const empfKey of Object.keys(CONFIG.EMPFAENGER)) {
    const meineTermine = termine
      .filter(t => t.datum === heute && t.empfaenger === empfKey)
      .sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit));
    if (meineTermine.length > 0) await sendeDM(empfKey, meineTermine, true);
  }
}

client.once('clientReady', () => {
  console.log(`\n🤖 Bot eingeloggt als: ${client.user.tag}`);
  console.log(`👥 Empfänger: Budholzer, Dichtl, Winter`);
  console.log(`🔍 Überwacht Termine alle 60 Sekunden...\n`);
  cron.schedule('* * * * *', pruefeErinnerungen);
  cron.schedule('0 8 * * *', sendeTagesplan, { timezone: 'Europe/Berlin' });
});

client.on('error', err => console.error('❌ Bot Fehler:', err));
client.login(CONFIG.BOT_TOKEN).catch(err => console.error('❌ Login fehlgeschlagen:', err.message));

module.exports = client;