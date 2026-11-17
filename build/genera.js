/**
 * GENERA LE DUE DASHBOARD CIFRATE
 * ------------------------------------------------------------
 * Uso:  BFD_PW_DIRETTIVO=... BFD_PW_COACH=... node build/genera.js <cartella-dati>
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

if (!DATI_DIR) throw new Error('Manca la cartella dei dati: node build/genera.js <cartella-dati>');
if (!PW.direttivo || !PW.coach) throw new Error('Mancano le password BFD_PW_DIRETTIVO e BFD_PW_COACH');

// leggi(nome): apre <cartella-dati>/<nome>.json e lo trasforma in dati
const leggi = (nome) => JSON.parse(fs.readFileSync(path.join(DATI_DIR, nome + '.json'), 'utf8'));
const bilancio = leggi('bilancio');
const pagamenti = leggi('pagamenti');
const guadagni = leggi('guadagni');
const tesserati = leggi('tesserati');

// Data e ora di Roma, es. "17/11/2026 15:30". toLocaleString formatta la data secondo la lingua indicata.
const letti = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

// ---------- Controlli: se la struttura dei fogli è cambiata mi fermo invece di pubblicare dati sbagliati ----------
const intest = (tesserati[0] || []).map((x) => String(x).trim().toUpperCase());
if (intest[0] !== 'COGNOME' || intest[2] !== 'SQUADRA OPEN/WOMEN' || intest[6] !== 'ADVANCED') {
  throw new Error('Il foglio Tesserati ha cambiato colonne: intestazioni trovate ' + JSON.stringify(tesserati[0]));
}
if (String((bilancio[1] || [])[0]).trim() !== 'Conto') throw new Error('Il foglio Bilancio ha cambiato struttura');

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
  if (imp === '' || numero(imp) === 0) return 'da_verificare';
  return PRIME.includes(squadra) ? 'da_pagare_31_01' : 'da_pagare';
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
    cartaceo: vero(r[13]),                          // N
    golee: vero(r[14]),                             // O
    advanced: String(r[6] ?? '').trim()             // G: data di scadenza come testo
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
    '--template-color-primary', '#1d2330',
    '--template-color-secondary', '#f4f5f7'
  ], { cwd: RADICE, stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
}

costruisci('direttivo', direttivo, 'BFD · Situazione economica');
costruisci('coach', coach, 'BFD · Situazione squadre');
console.log('Fatto: ' + giocatori.length + ' giocatori nella dashboard coach, dati letti il ' + letti);
