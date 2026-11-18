# Aggiornamento settimanale delle dashboard BFD

Repository PUBBLICO: non scrivere mai qui dati dei fogli, nomi, importi o password.

## Procedura
1. Con il connettore Google Sheets (`get_values`, sola lettura) leggi:
   - Saldo 2026/2027 `1wM333Fa7lGGpncYL4S5OCIIJzGOIf3JAZ4WmjtP1jGo`: `Bilancio!A1:E4`, `Pagamenti!A1:E200`, `Guadagni!A1:E100`
   - Quote 2026/2027 `1YlN1VWqhvhOCm1Jmyi45h88gEalx_VN-UtdN4eZWiTk`: `Tesserati!A1:P230`
   (Tesserati è grande: se serve leggilo a pezzi, es. A1:J230 e K1:P230, e ricomponi le righe A..P.)
   Colonne usate per i coach: L Firma modulo, M Note modulo, O Certificato cartaceo, P Certificato Golee.
   La colonna N (Note) contiene informazioni economiche e non va mai nelle pagine dei coach.
2. Salva il campo `values` di ciascuno, identico (stesse righe vuote, stessi testi), in `/tmp/bfd-dati/`
   come `bilancio.json`, `pagamenti.json`, `guadagni.json`, `tesserati.json`. MAI dentro il repository.
3. Controllo: somma della colonna B di Pagamenti con D = FALSE (dalla riga 5) ≈ Bilancio C3 (scarto < 1 €)
   e somma della colonna B di Guadagni = Bilancio D3. Se non tornano, rileggi e confronta; se ancora non tornano
   NON pubblicare: lascia le pagine della settimana precedente e segnalalo a Susanna.
4. `npm ci`, poi `BFD_PW_DIRETTIVO=… BFD_PW_COACH=… node build/genera.js /tmp/bfd-dati`
   (le password sono solo nel testo dell'attività programmata).
5. Controlla con `git status` che cambino solo `direttivo/index.html` e `coach/index.html`, poi commit e push su `main`.
6. Non modificare mai i fogli Google.

# Calendario Shout 2027 (pagina pubblica, aggiornamento SOLO su richiesta di Susanna)
- NON fa parte dell'aggiornamento del lunedì.
- Foglio "Calendario Shout" `1y2ybw3MQ2UsDSXdb1PKPlWCbfmnGKwkXaxfrNtr7Iv8`: leggi `Foglio1!A1:F200` e salva `values` in `/tmp/bfd-dati/calendario.json` (mai nel repository).
- `node build/calendario.js /tmp/bfd-dati/calendario.json`, controlla l'elenco stampato, poi commit e push di `calendario/index.html`.
- Si pubblica solo la colonna WEEKEND: niente note, niente allenamenti settimanali.
- Regole colori e allenamenti infrasettimanali (orari nel modello, Pod/Pausa = allenamento normale, "Incontro …" = evento Nazionale con orario), impegni extra (inizio allenamenti 11/1, raduno Shout 11-12/9, Champions 24-26/9, fine EUC 10/7) sono in `build/calendario.js`.
- Pagina **Palestra** (stessa pagina, scheda `#palestra`): le schede sono in `build/palestra.json`. Quando Susanna manda un programma nuovo, trascrivilo lì (blocchi → esercizi con serie e recupero), aggiorna "aggiornato", rigenera e pubblica.
- Colori dei blocchi (Mobilità, Core, Plyo…) in `COLORI_BLOCCO` nel modello. In `palestra.json` ogni esercizio ha una `chiave` fissa
  (stessa chiave = stesso storico anche quando cambia il programma) e `carico: true` se si segna il peso. Programma nuovo:
  cambia `programma.id`/`nome`/`dal`, riusa le chiavi degli esercizi che restano, chiavi nuove per quelli nuovi.

# Pesi Shout (pagine "I miei pesi" e "Andamento")
- Script Google in `apps-script/pesi.gs`, attaccato al foglio "Pesi Shout" (account BFD): schede Atlete (nome, PIN) e Pesi (righe solo aggiunte).
- L'indirizzo dello script pubblicato va in `build/pesi.json` (`url`). Vuoto = le due pagine restano nascoste.
- Nomi, PIN e pesi stanno SOLO nel foglio Google, mai nel repository.
- Il foglio è "Calendario Shout" `1y2ybw3MQ2UsDSXdb1PKPlWCbfmnGKwkXaxfrNtr7Iv8`, schede `Atlete` e `Pesi`.
- Niente PIN personale: in Atlete la colonna PIN è "0000" per tutte, la pagina lo manda da sola. Nuova giocatrice =
  riga in Atlete con nome visualizzato in MAIUSCOLO ("NOME C."), PIN "0000", Attiva = vero. Chi smette: Attiva = falso
  (i suoi pesi restano). La pagina mostra i nomi in ordine alfabetico.
- "Programma precedente" in Andamento = data prima di `programma.dal` di palestra.json (Google trasforma "2026-11" in una data: non usare quel campo).
- La ✕ in Andamento usa l'azione `elimina` dello script: toglie le righe di quell'atleta, quel giorno, quell'esercizio.

# Area preparazione (preparatore e fisioterapista) – `preparazione/`
- Stessa pagina del calendario in modo "staff": Calendario e Palestra identici, più "Atlete" (panoramica, grafici per esercizio,
  tabella mese per mese) ed "Esercizi" (confronto tra atlete). Legge i pesi dal vivo dallo script Google (sola lettura).
- Cifrata con password (staticrypt). Si rigenera insieme al calendario SOLO se si passa `BFD_PW_STAFF=…`:
  `BFD_PW_STAFF=… node build/calendario.js /tmp/bfd-dati/calendario.json`. Senza password la pagina staff resta quella di prima
  (e il suo calendario resta vecchio): quando aggiorni il calendario chiedi la password a Susanna (è nel documento di progetto,
  MAI nel repository).
