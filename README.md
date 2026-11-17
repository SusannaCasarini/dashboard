# Dashboard Bologna Flying Disc

Due pagine protette da password, aggiornate ogni lunedì dai fogli Google della segreteria:

- `direttivo/` – situazione economica 2026/2027
- `coach/` – quote (solo stato, senza importi), certificati e Advanced per squadra

Le pagine pubblicate sono **cifrate** (StatiCrypt, AES): senza password il contenuto è illeggibile.
In questo repository non ci sono dati in chiaro: i modelli sono in `modelli/`, lo script in `build/genera.js`.

## Calendario Shout 2027 (pubblico, senza password)

- `calendario/` – impegni del weekend gennaio–settembre 2027: Nazionale in azzurro, Shout in rosso, eventi e tornei in giallo.
- Modello in `modelli/calendario.html`, generazione con `node build/calendario.js <file-json>`. Si aggiorna solo su richiesta.
