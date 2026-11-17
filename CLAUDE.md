# Aggiornamento settimanale delle dashboard BFD

Repository PUBBLICO: non scrivere mai qui dati dei fogli, nomi, importi o password.

## Procedura
1. Con il connettore Google Sheets (`get_values`, sola lettura) leggi:
   - Saldo 2026/2027 `1wM333Fa7lGGpncYL4S5OCIIJzGOIf3JAZ4WmjtP1jGo`: `Bilancio!A1:E4`, `Pagamenti!A1:E200`, `Guadagni!A1:E100`
   - Quote 2026/2027 `1YlN1VWqhvhOCm1Jmyi45h88gEalx_VN-UtdN4eZWiTk`: `Tesserati!A1:P230`
   (Tesserati è grande: se serve leggilo a pezzi, es. A1:J230 e N1:O230, e ricomponi le righe A..P.)
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
- Regole colori e impegni extra (raduno Shout 11-12/9, Champions 24-26/9, fine EUC 10/7) sono in `build/calendario.js`.
