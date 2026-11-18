/**
 * PESI SHOUT – script del foglio Google "Pesi Shout"
 * ==================================================
 * Fa da ponte tra la pagina del calendario (pubblica, su GitHub) e il foglio Google con i pesi.
 * La pagina non vede mai il foglio: chiede le cose a questo script, che controlla nome + PIN.
 *
 * Il foglio ha due schede, create da prepara():
 *   - "Atlete": Nome visualizzato · Nome · Cognome · PIN (sempre 0000) · Attiva (✓)
 *   - "Pesi":   Salvato il · Data allenamento · Atleta · Programma · Scheda · Chiave · Esercizio · Kg
 * Ogni salvataggio AGGIUNGE righe in fondo a "Pesi": le righe vecchie non vengono mai cambiate.
 * L'unica cancellazione possibile è "elimina": toglie un esercizio di un giorno preciso di UNA atleta
 * (la usa la x nella pagina Andamento). Susanna può comunque correggere a mano nel foglio.
 *
 * Strumenti di Google usati (sono già dentro Apps Script, non si installa niente):
 * - SpreadsheetApp: legge e scrive i fogli Google.
 *     getActiveSpreadsheet() = il foglio a cui è attaccato lo script; openById(id) = apre un altro foglio;
 *     getSheetByName / insertSheet = trova / crea una scheda; getDataRange().getValues() = tutte le celle come tabella;
 *     appendRow / getRange(...).setValues = scrive righe.
 * - ContentService: costruisce la risposta (testo JSON) che torna alla pagina.
 * - CacheService: una piccola memoria temporanea (qui: conta i PIN sbagliati per 15 minuti).
 * - LockService: fa aspettare il proprio turno se due atlete salvano nello stesso istante.
 * - Utilities.formatDate: scrive una data come testo (es. "2027-01-13") nel fuso orario di Roma.
 * - JSON.parse / JSON.stringify: trasformano testo ↔ dati.
 */

const ID_QUOTE = '1YlN1VWqhvhOCm1Jmyi45h88gEalx_VN-UtdN4eZWiTk'; // "Quote 2026/2027": da qui prende le giocatrici Shout
const SQUADRA = 'Shout';
const FUSO = 'Europe/Rome';
const MAX_ERRORI_PIN = 5;        // dopo 5 PIN sbagliati...
const BLOCCO_SECONDI = 15 * 60;  // ...quell'atleta è bloccata per 15 minuti
const GIORNI_INDIETRO = 90;      // si può salvare un allenamento fino a 90 giorni fa

/** testoData(valore): una data del foglio (o un testo) diventa "2027-01-13", nel fuso orario del foglio. */
function testoData(v) {
  const fuso = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || FUSO;
  return v instanceof Date ? Utilities.formatDate(v, fuso, 'yyyy-MM-dd') : String(v);
}

/**
 * prepara(): DA LANCIARE A MANO una volta (e di nuovo quando entrano giocatrici nuove).
 * Crea le schede "Atlete" e "Pesi" se mancano, poi legge "Tesserati" del file Quote e aggiunge
 * le giocatrici Shout che non ci sono ancora, ognuna con un PIN casuale di 4 cifre.
 * Chi è già presente non viene toccato (il suo PIN resta uguale).
 */
function prepara() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const atlete = ss.getSheetByName('Atlete') || ss.insertSheet('Atlete');
  const pesi = ss.getSheetByName('Pesi') || ss.insertSheet('Pesi');
  if (atlete.getLastRow() === 0) {
    atlete.appendRow(['Nome visualizzato', 'Nome', 'Cognome', 'PIN', 'Attiva']);
    atlete.setFrozenRows(1);
  }
  if (pesi.getLastRow() === 0) {
    pesi.appendRow(['Salvato il', 'Data allenamento', 'Atleta', 'Programma', 'Scheda', 'Chiave', 'Esercizio', 'Kg']);
    pesi.setFrozenRows(1);
  }
  // la colonna PIN resta testo, così "0420" non diventa 420
  atlete.getRange('D:D').setNumberFormat('@');

  // giocatrici già presenti (Nome + Cognome) e PIN già usati
  const righe = atlete.getDataRange().getValues().slice(1);
  const presenti = new Set(righe.map(r => (r[1] + ' ' + r[2]).toLowerCase()));
  const pinUsati = new Set(righe.map(r => String(r[3])));
  const nomiVisti = new Set(righe.map(r => String(r[0])));

  // Tesserati: A Cognome, B Nome, C Squadra Open/Women
  const tess = SpreadsheetApp.openById(ID_QUOTE).getSheetByName('Tesserati').getDataRange().getValues();
  const nuove = [];
  for (const r of tess) {
    const cognome = String(r[0]).trim(), nome = String(r[1]).trim(), squadra = String(r[2]).trim();
    if (squadra !== SQUADRA || !nome || !cognome) continue;
    if (presenti.has((nome + ' ' + cognome).toLowerCase())) continue;
    // nome visualizzato "Giulia R."; se esiste già, nome e cognome per intero
    let vis = nome + ' ' + cognome.charAt(0).toUpperCase() + '.';
    if (nomiVisti.has(vis)) vis = nome + ' ' + cognome;
    const pin = '0000';   // niente PIN personale: la pagina manda sempre 0000 (scelta di Susanna, 18/11/2026)
    nomiVisti.add(vis); presenti.add((nome + ' ' + cognome).toLowerCase());
    nuove.push([vis, nome, cognome, pin, true]);
  }
  if (nuove.length) {
    atlete.getRange(atlete.getLastRow() + 1, 1, nuove.length, 5).setValues(nuove);
    atlete.getRange(2, 5, atlete.getLastRow() - 1, 1).insertCheckboxes();
  }
  Logger.log('Giocatrici aggiunte: ' + nuove.length);
}

/** risposta(oggetto): trasforma i dati in testo JSON da rimandare alla pagina. */
function risposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** elencoAtlete(): le righe di "Atlete" con la casella "Attiva" spuntata, come {nome, pin}. */
function elencoAtlete() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Atlete');
  return sh.getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[4] === true)
    .map(r => ({ nome: String(r[0]), pin: String(r[3]).padStart(4, '0') }));
}

/**
 * verifica(atleta, pin): controlla che nome e PIN siano giusti.
 * Conta i tentativi sbagliati: dopo 5 errori quell'atleta è bloccata per 15 minuti
 * (così nessuno può provare tutti i PIN uno dopo l'altro). Restituisce un messaggio di errore oppure ''.
 */
function verifica(atleta, pin) {
  const cache = CacheService.getScriptCache();
  const chiave = 'err_' + atleta;
  const errori = Number(cache.get(chiave) || 0);
  if (errori >= MAX_ERRORI_PIN) return 'Troppi PIN sbagliati: riprova tra 15 minuti';
  const a = elencoAtlete().find(x => x.nome === atleta);
  if (!a || a.pin !== String(pin)) {
    cache.put(chiave, String(errori + 1), BLOCCO_SECONDI);
    return 'Nome o PIN sbagliato';
  }
  cache.remove(chiave);
  return '';
}

/** pulito(testo, max): accorcia il testo e impedisce che venga letto come formula (=, +, -, @ all'inizio). */
function pulito(t, max) {
  t = String(t == null ? '' : t).slice(0, max);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

/**
 * doGet(e): risponde quando la pagina APRE l'indirizzo dello script.
 * Con ?azione=atlete restituisce solo i nomi visualizzati (mai i PIN), per il menu "Chi sei?".
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.azione === 'atlete') {
    return risposta({ ok: true, atlete: elencoAtlete().map(a => a.nome) });
  }
  return risposta({ ok: true, messaggio: 'Pesi Shout attivo' });
}

/**
 * doPost(e): risponde quando la pagina MANDA dei dati. Il testo ricevuto è JSON con:
 *   azione: 'login' | 'salva' | 'storico' | 'elimina', atleta, pin,
 *   per 'salva': data, programma, scheda, voci[{chiave, esercizio, kg}]; per 'elimina': data, chiave
 * Per ogni azione prima controlla nome + PIN con verifica().
 */
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return risposta({ ok: false, errore: 'Richiesta non valida' }); }
  const errore = verifica(String(d.atleta || ''), String(d.pin || ''));
  if (errore) return risposta({ ok: false, errore });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pesi = ss.getSheetByName('Pesi');

  if (d.azione === 'login') return risposta({ ok: true });

  if (d.azione === 'storico') {
    const righe = pesi.getDataRange().getValues().slice(1)
      .filter(r => String(r[2]) === d.atleta)
      .map(r => ({ data: testoData(r[1]), programma: String(r[3]), scheda: String(r[4]), chiave: String(r[5]),
                   esercizio: String(r[6]), kg: Number(r[7]) }));
    return risposta({ ok: true, righe });
  }

  if (d.azione === 'salva') {
    // data dell'allenamento: oggi oppure fino a 90 giorni fa (non nel futuro)
    const oggi = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
    const limite = Utilities.formatDate(new Date(Date.now() - GIORNI_INDIETRO * 86400000), FUSO, 'yyyy-MM-dd');
    const data = /^\d{4}-\d{2}-\d{2}$/.test(d.data) ? d.data : oggi;
    if (data > oggi || data < limite) return risposta({ ok: false, errore: 'La data deve essere tra oggi e ' + GIORNI_INDIETRO + ' giorni fa' });
    const voci = Array.isArray(d.voci) ? d.voci.slice(0, 30) : [];
    const adesso = new Date();
    const nuove = [];
    for (const v of voci) {
      const kg = Number(String(v.kg).replace(',', '.'));
      if (!isFinite(kg) || kg < 0 || kg > 500) return risposta({ ok: false, errore: 'Peso non valido: ' + pulito(v.esercizio, 40) });
      nuove.push([adesso, data, d.atleta, pulito(d.programma, 40), pulito(d.scheda, 40),
                  pulito(v.chiave, 40), pulito(v.esercizio, 80), kg]);
    }
    if (!nuove.length) return risposta({ ok: false, errore: 'Nessun peso da salvare' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);   // aspetta al massimo 10 secondi il proprio turno
    try {
      pesi.getRange(pesi.getLastRow() + 1, 1, nuove.length, nuove[0].length).setValues(nuove);
    } finally {
      lock.releaseLock();
    }
    return risposta({ ok: true, salvate: nuove.length });
  }

  if (d.azione === 'elimina') {
    // toglie le righe di QUESTA atleta, con questa data e questo esercizio (partendo dal fondo, così i numeri di riga non si spostano)
    const data = String(d.data || ''), chiave = String(d.chiave || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !chiave) return risposta({ ok: false, errore: 'Richiesta non valida' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let tolte = 0;
    try {
      const valori = pesi.getDataRange().getValues();
      for (let i = valori.length - 1; i >= 1; i--) {
        const r = valori[i];
        if (String(r[2]) === d.atleta && testoData(r[1]) === data && String(r[5]) === chiave) {
          pesi.deleteRow(i + 1);   // deleteRow(n) cancella la riga n del foglio (le righe del foglio partono da 1)
          tolte++;
        }
      }
    } finally {
      lock.releaseLock();
    }
    return risposta({ ok: true, tolte });
  }

  return risposta({ ok: false, errore: 'Azione sconosciuta' });
}
