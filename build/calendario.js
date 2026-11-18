/**
 * GENERA IL CALENDARIO SHOUT 2027 (pagina pubblica, senza password)
 * ------------------------------------------------------------
 * Uso:  node build/calendario.js <file-json>
 *
 * <file-json> = il campo "values" del foglio Google "Calendario Shout"
 * (ID 1y2ybw3MQ2UsDSXdb1PKPlWCbfmnGKwkXaxfrNtr7Iv8, Foglio1!A1:F200).
 * Colonne: A settimana ("11-17") o nome del mese, B note, C lunedì, D martedì, E giovedì, F weekend.
 *
 * Dal foglio si prende SOLO il weekend (colonna F); allenamenti settimanali e note non vengono pubblicati.
 * Regole dei colori:
 *   - "Raduno …", "Test Match", "EUC"  → Nazionale (azzurro)
 *   - "Tryouts"                         → Shout (rosso)
 *   - "Pasqua"                          → Paganello, evento giallo da sabato a Pasquetta
 *   - tutto il resto (CIU, Coppa, Grenoble, Elite Invite…) → evento/torneo (giallo)
 *   - un "?" nel testo                  → "da confermare"
 * Allenamenti infrasettimanali (colonne C lunedì, D martedì, E giovedì), dall'11/01:
 *   - orari e luoghi sono nel modello (lun e mar 19:30–21:30 Battiferro, gio 21–23 CUSB);
 *   - "Pod", "Pausa", "Lezione di corsa" → tipo "pod" (viola con la P);
 *   - "Incontro …" (es. "Incontro Formativo Online 19-22") → evento della Nazionale al posto
 *     dell'allenamento, l'orario "19-22" diventa "19:00–22:00";
 *   - "Pasquetta" o una casella uguale all'evento del weekend (es. "Elite", "EUC") → niente;
 *   - tutto il resto (nomi, "?", casella vuota) → allenamento. Non si pubblicano mai i nomi.
 * Pagina Palestra: le schede sono in build/palestra.json (da aggiornare a mano quando cambia il programma).
 * L'inizio allenamenti e gli impegni dopo luglio (non presenti nel foglio) sono nella lista EXTRA qui sotto.
 *
 * Funzioni di Node/JavaScript usate:
 * - require('fs'): legge (readFileSync) e scrive (writeFileSync) file.
 * - require('path').join: unisce pezzi di percorso.
 * - JSON.parse / JSON.stringify: da testo a dati e viceversa.
 * - new Date(anno, mese, giorno): crea una data (i mesi partono da 0 = gennaio).
 * - String.replace con espressioni regolari (/…/): cerca e sostituisce testo.
 */
const fs = require('fs');
const path = require('path');

const ANNO = 2027;
const RADICE = path.join(__dirname, '..');
const FILE = process.argv[2];
if (!FILE) throw new Error('Manca il file: node build/calendario.js <file-json>');
const righe = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// iso(data): data → testo "2027-01-23"
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// piu(data, n): la data spostata di n giorni
const piu = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// tipo(testo): decide il colore
function tipo(t) {
  if (/raduno|test match|\beuc\b/i.test(t)) return 'nazionale';
  if (/tryout/i.test(t)) return 'shout';
  return 'evento';
}
// titolo(testo): nome pulito da mostrare
function titolo(t) {
  const s = t.replace(/\?+/g, '').trim();
  if (/^raduno/i.test(s)) return 'Raduno Nazionale';
  if (/^tryout/i.test(s)) return 'Tryouts Shout';
  return s;
}

const eventi = [];
const allenamenti = [];
const INIZIO_ALLENAMENTI = '2027-01-11';
let mese = -1;
for (const r of righe) {
  const a = (r[0] || '').trim();
  const i = MESI.indexOf(a.toLowerCase());
  if (i >= 0) { mese = i; continue; }                 // riga con il nome del mese
  const m = a.match(/^(\d+)-(\d+)$/);                  // riga di una settimana
  if (!m || mese < 0) continue;
  const testo = (r[5] || '').trim();
  const lunedi = new Date(ANNO, mese, Number(m[1]));
  // allenamenti della settimana: [colonna, giorni dopo il lunedì]
  for (const [col, dopo] of [[2, 0], [3, 1], [4, 3]]) {
    const v = (r[col] || '').trim();
    const giorno = iso(piu(lunedi, dopo));
    if (giorno < INIZIO_ALLENAMENTI) continue;
    if (/pasquetta/i.test(v)) continue;
    if (/incontro/i.test(v)) {
      const o = v.match(/(\d{1,2})(?:[.:](\d{2}))?\s*-\s*(\d{1,2})(?:[.:](\d{2}))?/);
      const orario = o ? `${o[1]}:${o[2] || '00'}–${o[3]}:${o[4] || '00'}` : '';
      const nome = v.replace(o ? o[0] : '', '').replace(/\?+/g, '').trim();
      eventi.push({ titolo: nome.charAt(0) + nome.slice(1).toLowerCase(), tipo: 'nazionale', inizio: giorno, fine: giorno,
        daConfermare: v.includes('?'), orario });
      continue;
    }
    const primaParola = v.split(/\s+/)[0].toLowerCase();
    if (primaParola && testo.toLowerCase().startsWith(primaParola) && /[a-z]/.test(primaParola)) continue;
    allenamenti.push({ data: giorno, tipo: /pod|pausa|corsa/i.test(v) ? 'pod' : 'allenamento' });
  }
  if (!testo) continue;
  const sabato = piu(lunedi, 5), domenica = piu(lunedi, 6), giovedi = piu(lunedi, 3);
  // il giovedì fa parte dell'evento se nella colonna E c'è la stessa parola (es. "Elite" / "Elite Invite")
  const gio = (r[4] || '').trim().split(/\s+/)[0].toLowerCase();
  const daGiovedi = gio && testo.toLowerCase().startsWith(gio) && !/carri|fede/.test(gio);
  const soloSabato = /sabato/i.test(testo);
  if (/pasqua/i.test(testo)) {   // Pasqua = Paganello (Rimini): sabato, domenica e Pasquetta
    eventi.push({ titolo: 'Paganello', tipo: 'evento', inizio: iso(sabato), fine: iso(piu(domenica, 1)), daConfermare: false });
    continue;
  }
  eventi.push({
    titolo: titolo(testo),
    tipo: tipo(testo),
    inizio: iso(daGiovedi ? giovedi : sabato),
    fine: iso(soloSabato ? sabato : domenica),
    daConfermare: testo.includes('?'),
  });
}

// Impegni non presenti nel foglio
const EXTRA = [
  { titolo: 'Inizio allenamenti', tipo: 'shout', inizio: '2027-01-11', fine: '2027-01-11' },
  { titolo: 'Raduno Shout', tipo: 'shout', inizio: '2027-09-11', fine: '2027-09-12' },
  { titolo: 'Champions', tipo: 'evento', inizio: '2027-09-24', fine: '2027-09-26' },
];
// L'EUC (Vichy) dura fino al 10 luglio 2027: allunga la fine se il foglio la mette prima
for (const e of eventi) if (/^euc$/i.test(e.titolo)) { e.titolo = 'EUC · Vichy'; if (e.fine < '2027-07-10') e.fine = '2027-07-10'; }
for (const x of EXTRA) eventi.push({ daConfermare: false, ...x });
eventi.sort((x, y) => x.inizio.localeCompare(y.inizio));

const ora = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
const modello = fs.readFileSync(path.join(RADICE, 'modelli', 'calendario.html'), 'utf8');
const pagina = modello
  .replace('__EVENTI__', JSON.stringify(eventi))
  .replace('__ALLENAMENTI__', JSON.stringify(allenamenti))
  .replace('__PALESTRA__', fs.readFileSync(path.join(__dirname, 'palestra.json'), 'utf8'))
  .replace('__AGGIORNATO__', ora);
fs.mkdirSync(path.join(RADICE, 'calendario'), { recursive: true });
fs.writeFileSync(path.join(RADICE, 'calendario', 'index.html'), pagina);
eventi.sort((x, y) => x.inizio.localeCompare(y.inizio));
console.log(`Calendario generato: ${eventi.length} impegni, ${allenamenti.length} giorni infrasettimanali`);
console.log(' Pod/Pausa: ' + allenamenti.filter(a => a.tipo === 'pod').map(a => a.data).join(', '));
for (const e of eventi) console.log(` ${e.inizio} → ${e.fine}  [${e.tipo}]  ${e.titolo}${e.daConfermare ? ' (da confermare)' : ''}`);
