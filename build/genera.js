/**
 * GENERA LE DUE DASHBOARD CIFRATE
 * ------------------------------------------------------------
 * Uso:  BFD_PW_DIRETTIVO=... BFD_PW_COACH=... node build/genera.js <cartella-dati>
 *       Solo la pagina coach (basta tesserati.json):  BFD_SOLO=coach BFD_PW_COACH=... node build/genera.js <cartella-dati>
 *
 * <cartella-dati> deve contenere 4 file JSON, ognuno uguale al campo "values"
 * restituito da Google Sheets (get_values):
 *   bilancio.json   = Saldo 2026/2027 → Bilancio!A1:E4
 *   pagamenti.json  = Saldo 2026/2027 → Pagamenti!A1:E200
 *   guadagni.json   = Saldo 2026/2027 → Guadagni!A1:E100
 *   tesserati.json  = Quote 2026/2027 → Tesserati!A1:P230
 * ATTENZIONE: la cartella dati NON va mai messa nel repository (è pubblico).
 *
 * Funzioni di Node usate:
 * - require('fs'): modulo per leggere e scrivere file; readFileSync legge, writeFileSync scrive,
 *   mkdirSync crea una cartella, rmSync la cancella.
 * - require('path'): modulo per comporre percorsi di file; join unisce i pezzi.
 * - require('child_process').execFileSync: lancia un altro programma (qui staticrypt) e aspetta che finisca.
 * - process.argv: gli argomenti scritti dopo "node build/genera.js"; process.env: le variabili d'ambiente.
 * - JSON.parse / JSON.stringify: da testo a dati e da dati a testo.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RADICE = path.join(__dirname, '..');                 // cartella del repository
const DATI_DIR = process.argv[2];
const PW = { direttivo: process.env.BFD_PW_DIRETTIVO, coach: process.env.BFD_PW_COACH };
const SOLO_COACH = process.env.BFD_SOLO === 'coach';   // true = rigenera solo la pagina dei coach

if (!DATI_DIR) throw new Error('Manca la cartella dei dati: node build/genera.js <cartella-dati>');
if (!PW.coach || (!SOLO_COACH && !PW.direttivo)) throw new Error('Mancano le password BFD_PW_DIRETTIVO e BFD_PW_COACH');

// leggi(nome): apre <cartella-dati>/<nome>.json e lo trasforma in dati
const leggi = (nome) => JSON.parse(fs.readFileSync(path.join(DATI_DIR, nome + '.json'), 'utf8'));
// Con BFD_SOLO=coach i file del Saldo non servono: al loro posto uso tabelle vuote
const bilancio = SOLO_COACH ? [] : leggi('bilancio');
const pagamenti = SOLO_COACH ? [] : leggi('pagamenti');
const guadagni = SOLO_COACH ? [] : leggi('guadagni');
const tesserati = leggi('tesserati');
// Foglio "Certificato Agonistico": è lì che Susanna aggiorna i certificati CARTACEI (A Cognome, B Nome, C Squadra, D Cartaceo)
const certificato = leggi('certificato');

// Data e ora di Roma, es. "17/11/2026 15:30". toLocaleString formatta la data secondo la lingua indicata.
const letti = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

// ---------- Controlli: se la struttura dei fogli è cambiata mi fermo invece di pubblicare dati sbagliati ----------
const intest = (tesserati[0] || []).map((x) => String(x).trim().toUpperCase());
// Colonne attese (dal 23/11/2026): A Cognome, C Squadra, G Advanced, L Cert. cartaceo (copia), M Cert. Golee,
// N Firma modulo, O Note modulo, P Note (economiche: non usate per i coach)
if (intest[0] !== 'COGNOME' || intest[2] !== 'SQUADRA OPEN/WOMEN' || intest[6] !== 'ADVANCED' ||
    intest[11] !== 'CERTIFICATO CARTACEO' || intest[12] !== 'CERTIFICATO GOLEE' ||
    intest[13] !== 'FIRMA MODULO' || intest[14] !== 'NOTE MODULO') {
  throw new Error('Il foglio Tesserati ha cambiato colonne: intestazioni trovate ' + JSON.stringify(tesserati[0]));
}
const intestCert = (certificato[0] || []).map((x) => String(x).trim().toUpperCase());
if (intestCert[0] !== 'COGNOME' || intestCert[1] !== 'NOME' || intestCert[3] !== 'CERTIFICATO CARTACEO') {
  throw new Error('Il foglio Certificato Agonistico ha cambiato colonne: intestazioni trovate ' + JSON.stringify(certificato[0]));
}
if (!SOLO_COACH && String((bilancio[1] || [])[0]).trim() !== 'Conto') throw new Error('Il foglio Bilancio ha cambiato struttura');

// ---------- Dati per il DIRETTIVO: Tesserati solo colonne C-K (niente nomi) ----------
// slice(2, 11) prende le colonne dalla C (indice 2) alla K (indice 10)
const direttivo = {
  bilancio, pagamenti, guadagni,
  tesserati: tesserati.map((r) => (r || []).slice(2, 11)),
  letti
};

// ---------- Dati per i COACH: solo nomi e stati, MAI importi ----------
const PRIME = ['Cheetahs', 'La Fotta', 'Shout', 'Borealis'];
const vero = (c) => /^(TRUE|VERO)$/i.test(String(c ?? '').trim());
const numero = (c) => Number(String(c ?? '').replace(/[€\s.]/g, '').replace(',', '.')) || 0;

// codiceQuota: trasforma importi e spunte in un codice di stato (il telefono poi lo traduce in testo e colore)
function codiceQuota(secondaRata, importo, pagato, squadra) {
  const imp = String(importo ?? '').trim();
  if (imp === '?') return 'indeciso';
  if (vero(pagato)) return numero(secondaRata) > 0 ? 'prima_rata' : 'pagata';
  if (imp === '') return 'da_verificare';        // cella vuota: manca l'informazione
  if (numero(imp) === 0) return 'nulla';         // quota 0 = non deve pagare niente (c'è sempre un motivo)
  return PRIME.includes(squadra) ? 'da_pagare_31_01' : 'da_pagare';
}

// Certificato cartaceo: lo prendo dal foglio "Certificato Agonistico", cercando il giocatore per
// cognome + nome + squadra; se il nome non coincide (es. nome mancante in uno dei due fogli) per cognome + squadra,
// purché ce ne sia uno solo. Se non lo trovo uso la colonna L di Tesserati e lo scrivo nel riepilogo.
const pulisci = (x) => String(x ?? '').trim().toUpperCase();
const perNome = new Map();
const perCognome = new Map();
for (const r of certificato.slice(1)) {
  if (!pulisci(r[0])) continue;
  perNome.set(pulisci(r[0]) + '|' + pulisci(r[1]) + '|' + pulisci(r[2]), vero(r[3]));
  const k = pulisci(r[0]) + '|' + pulisci(r[2]);
  perCognome.set(k, perCognome.has(k) ? null : vero(r[3]));   // null = più giocatori con lo stesso cognome
}
const nonTrovati = [];
function cartaceoDi(r) {
  const kNome = pulisci(r[0]) + '|' + pulisci(r[1]) + '|' + pulisci(r[2]);
  if (perNome.has(kNome)) return perNome.get(kNome);
  const kCog = pulisci(r[0]) + '|' + pulisci(r[2]);
  if (perCognome.has(kCog) && perCognome.get(kCog) !== null) return perCognome.get(kCog);
  nonTrovati.push(String(r[0]).trim() + ' ' + String(r[1] ?? '').trim());
  return vero(r[11]);   // colonna L di Tesserati come riserva
}

const giocatori = [];
for (const r of tesserati.slice(1)) {
  const cognome = String(r[0] ?? '').trim();
  const squadra = String(r[2] ?? '').trim();
  if (!cognome || !squadra || squadra === 'ZZ Hanno Smesso') continue;
  giocatori.push({
    cognome,
    nome: String(r[1] ?? '').trim(),
    squadra,
    mixed: String(r[3] ?? '').trim(),
    quota: codiceQuota(r[7], r[8], r[9], squadra),   // H, I, J
    modulo: vero(r[13]),                            // N: modulo di ammissione a socio firmato
    notaModulo: String(r[14] ?? '').trim(),         // O: note sul modulo (es. "una sola firma", "Non ha Golee")
    cartaceo: cartaceoDi(r),                        // dal foglio Certificato Agonistico
    golee: vero(r[12]),                             // M
    advanced: String(r[6] ?? '').trim()             // G: data di scadenza come testo
    // La colonna P (Note) NON esce mai: contiene informazioni economiche.
  });
}
const coach = { aggiornato: letti, giocatori };

// ---------- Inserisco i dati nei modelli e cifro ----------
// sicuro(dati): JSON pronto da mettere dentro <script>; "<\/" evita che un testo chiuda lo script per errore
const sicuro = (dati) => JSON.stringify(dati).replace(/</g, '\\u003c');

function costruisci(nome, dati, titolo) {
  const modello = fs.readFileSync(path.join(RADICE, 'modelli', nome + '.html'), 'utf8');
  if (!modello.includes('/*__DATI__*/null')) throw new Error('Segnaposto __DATI__ mancante in ' + nome);
  const pagina = modello.replace('/*__DATI__*/null', () => sicuro(dati));

  const tmp = path.join(require('os').tmpdir(), 'bfd-' + nome);   // os.tmpdir() = cartella dei file temporanei
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'index.html'), pagina);

  // staticrypt cifra la pagina con la password (AES): senza password il contenuto è illeggibile.
  // Il "sale" fisso in .staticrypt.json fa sì che "Ricordami" continui a funzionare dopo ogni aggiornamento.
  execFileSync(path.join(RADICE, 'node_modules', '.bin', 'staticrypt'), [
    path.join(tmp, 'index.html'),
    '-p', PW[nome],
    '-d', path.join(RADICE, nome),
    '--short',
    '--remember', '30',
    '--template-title', titolo,
    '--template-instructions', 'Inserisci la password che ti ha mandato la segreteria.',
    '--template-placeholder', 'Password',
    '--template-button', 'Entra',
    '--template-remember', 'Ricordami su questo dispositivo',
    '--template-error', 'Password errata',
    '--template-toggle-show', 'Mostra password',
    '--template-toggle-hide', 'Nascondi password',
    '--template-color-primary', '#3b82f6',
    '--template-color-secondary', '#0f1420'
  ], { cwd: RADICE, stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (!SOLO_COACH) costruisci('direttivo', direttivo, 'BFD · Situazione economica');
costruisci('coach', coach, 'BFD · Situazione squadre');
if (nonTrovati.length) console.log('Non trovati in Certificato Agonistico (uso Tesserati colonna L): ' + nonTrovati.join(', '));
console.log('Fatto: ' + giocatori.length + ' giocatori nella dashboard coach, dati letti il ' + letti);
