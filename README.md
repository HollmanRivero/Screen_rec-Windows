# ScreenRec for Windows 11 🎥

A modern, high-performance desktop screen recorder for Windows 11 built with **Electron**, **Node.js**, and **FFmpeg**.

Record your entire display or individual application windows, overlay your webcam with draggable picture-in-picture (PiP), capture and mix microphone and desktop system audio, and export cleanly to **MP4, WebM, MOV, AVI, or animated WebP**.

---

## 🌟 Key Features

- **⏳ 10-Minutters Gratis Prøvetid (Free Trial)**:
  - Test alle funksjoner med opptil 10 minutter aktiv opptakstid før kjøp.
  - Live nedtelling i topplinjen (`⏳ Prøvetid: 10:00`).
  - Enkel aktivering med lisensnøkkel (`SCREC-XXXX-XXXX-XXXX`) for å låse opp permanent **PRO-versjon**.
- **⚡ Hurtigvalg (Quick 1-Click Modes)**:
  - 🖥️ **Bare Skjermen (Screen Only)** — ta opp hele skjermen med ett klikk.
  - 🎥 **Skjerm + Webcam (Combo Overlay)** — legg webkameraet som et flyttbart bilde-i-bilde over skjermen.
  - 🤳 **Kun Webcam (Webcam Only)** — ta opp direkte fra webkameraet som hovedkilde.
- **🔍 Kildevalg & Sanntids Miniatyrbilder**:
  - Filtrer etter **Alle**, **Skjermer**, eller **Vinduer**.
  - Oppdater kildelisten umiddelbart med roterende `⟳`-knapp.
- **🖼️ Flyttbart Webkamera (PiP)**:
  - Klikk og dra webkameraet til ønsket posisjon hvor som helst over forhåndsvisningen.
- **🎙️ Flerkanals Lydopptak**:
  - Ta opp mikrofonlyd med støydemping og ekkokansellering.
  - Ta opp system-/skrivebordslyd direkte i Windows 11.
- **🎬 Flere Eksportformater via FFmpeg**:
  - **MP4** (H.264 + AAC), **WebM** (rask lagring), **MOV** (QuickTime), **AVI**, og **Animert WebP**.
- **🪟 Windows 11 Tilpasning**:
  - Full støtte for Windows 11 Dark Mode, High-DPI skjermer og maskinvareakselerasjon.

---

## 💰 Kjøp Lisens / Betalingsmåter

ScreenRec leveres med en **10-minutters gratis prøveperiode**. For å fortsette å bruke programmet ubegrenset etter prøvetiden kan du kjøpe en livstidslisens:

1. 🧡 **Vipps (350 kr — Norge)**:
   - Vipps **350 kr** til **`972 69 623`** (Hollman Rivero).
   - Skriv inn din e-postadresse i Vipps-meldingen.
   - Du mottar din personlige lisensnøkkel umiddelbart på SMS/e-post!
2. 🅿️ **PayPal (€30 EUR — Internasjonalt)**:
   - Kjøp direkte i appen med ett klikk, eller betal via [paypal.me/hollmanrivero/30EUR](https://paypal.me/hollmanrivero/30EUR).
3. 💬 **Direkte bestilling via WhatsApp**:
   - Send melding til **[+47 972 69 623](https://wa.me/4797269623?text=Hei%20Hollman!%20Jeg%20vil%20kj%C3%B8pe%20lisens%20til%20ScreenRec-Win11.)** for direkte assistanse og rask overlevering av lisensnøkkel.

### Slik aktiverer du lisensen i appen:
1. Klikk på **Prøvetid**-merket øverst i appen (eller vent til betalingsvinduet dukker opp etter prøvetiden).
2. Skriv inn lisensnøkkelen du mottok ved kjøp (format: `SCREC-XXXX-XXXX-XXXX`).
3. Klikk **Aktiver**. Merket endrer seg til **⭐ PRO LISENS**, og all tidsbegrensning fjernes permanent.

---

## 🚀 Installasjon og Kjøring (Utvikler)

### 1. Klon repositoryet
```bash
git clone https://github.com/HollmanRivero/Screen_rec-Windows.git
cd Screen_rec-Windows
```

### 2. Installer avhengigheter
```bash
npm install
```

### 3. Start appen i utviklermodus
```bash
npm start
```

### 4. Kjør automatiserte tester
```bash
npm test
```

---

## 📥 Installasjonsveiledning for Kunder (Windows 11)

Last ned den nyeste installasjonsfilen fra [GitHub Releases](https://github.com/HollmanRivero/Screen_rec-Windows/releases):

1. Last ned `ScreenRec Setup 1.0.0.exe` (eller portable `.exe`).
2. Dobbeltklikk på installasjonsfilen for å installere.
3. Start **ScreenRec** fra skrivebordet eller startmenyen.
4. Gi appen tillatelse til kamera og mikrofon når Windows ber om det.

---

## 📦 Bygg Installatører (Windows)

For å bygge `.exe` installasjonsprogrammet:

```powershell
# Bygg Windows NSIS installer og Portable exe
npm run build:win
```
*Eller dobbeltklikk på batchfilen `Build ScreenRec.bat`.*

Alle ferdige installatører havner automatisk i mappen **`dist/`**.

---

## 👤 Eier og Utvikler

**Hollman Enrique Salazar Rivero**

- 💬 **WhatsApp:** [wa.me/4797269623](https://wa.me/4797269623) (`+47 972 69 623`)
- 📧 **E-post:** [hollman.rivero@smart-things.site](mailto:hollman.rivero@smart-things.site)
- 🅿️ **PayPal:** [paypal.me/hollmanrivero](https://paypal.me/hollmanrivero)

---

## 📄 Lisens og Bruksvilkår

Copyright (c) 2026 **Hollman Enrique Salazar Rivero**. Alle rettigheter forbeholdt.

Dette programmet er kommersiell programvare (Commercial Trialware):
- ✅ **10-minutters gratis prøvetid**: Enhver bruker har rett til å evaluere programmet i 10 minutter med aktiv opptakstid.
- 🔒 **Krav om betalt lisens**: All videre bruk etter prøvetiden krever kjøp av en gyldig lisensnøkkel.
- ❌ **Forbud mot modifisering**: Det er strengt forbudt å endre, dekompilere, tilpasse eller lage avledede verker av kildekoden eller applikasjonen.
- ❌ **Forbud mot videresalg**: Det er strengt forbudt å videreselge, leie ut, viderelisensiere eller redistribuere programmet uten skriftlig tillatelse fra opphavsrettsinnehaveren.

Se filen [LICENSE](LICENSE) for fullstendige juridiske vilkår.
