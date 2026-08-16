# 🏏 Cricket Scorer Pro

A broadcast-grade, interactive live cricket scoring and match management application with real-time analytics, ball-by-ball commentary, audio effects, and data export features.

---

## ✨ Features

- **⚡ Live Ball-by-Ball Scoring**: Fast, intuitive keypads for dots, singles, boundaries, extras (wides, no-balls, byes, leg-byes, penalty runs), wickets, and custom runs.
- **📱 Real-Time Multi-Device Sync**:
  - **Firebase Realtime Database Integration**: Any player or spectator can follow the match live on their phone in real time (<50ms updates).
  - **📲 1-Click QR Code & Match Link Sharing**: Scorer can display a dynamic QR code for instant camera scanning or share directly to WhatsApp.
  - **📺 Mobile-First Spectator View**: Read-only broadcast scoreboard that hides scoring controls for players while showing live striker stats, bowler figures, and commentary.
- **📊 Real-Time Analytics & Charts**:
  - **Worm Chart**: Cumulative score comparison over-by-over across innings.
  - **Manhattan Chart**: Bar chart of runs scored per over with wicket markers.
  - **Run Rate Tracker**: Current Run Rate (CRR) vs. Required Run Rate (RRR).
- **🎙️ Automated AI Commentary**: Dynamic, context-aware ball commentary generated for every event.
- **🔊 Realistic Audio Feedback**: Web Audio API synthesized umpire whistles, bat knocks, crowd roars, and buzzer sounds.
- **🔄 Full Undo / Redo**: Multi-level state history allowing rollback of any ball or action seamlessly.
- **📋 Match Setup & Customization**:
  - Custom team names, overs (5, 10, 20, 50, or custom), squad lists, opening batsmen and bowlers.
  - Automatic strike rotation and bowler change validation.
- **💾 Export & Import**:
  - Export full match summaries as structured JSON or printable scorecard reports.
  - Save/resume match state locally via LocalStorage.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher) installed, OR simply open `index.html` directly in any modern web browser.

### Running with Node.js
```bash
# Clone the repository
git clone <YOUR_REPO_URL>
cd "cric score"

# Start the local development server
npm start
```
Open your browser and navigate to `http://localhost:3000`.

### Running Statically
Open `index.html` directly in your favorite browser (Chrome, Edge, Firefox, Safari).

---

## 📂 Project Structure

```
├── index.html          # Main application UI layout & modals
├── package.json        # Project metadata and start scripts
├── server.js           # Lightweight static file development server
├── css/
│   └── styles.css      # Premium dark-theme broadcast styling
└── js/
    ├── actions.js      # Action creators for match events
    ├── app.js          # Main UI controller & DOM event listeners
    ├── audio.js        # Web Audio API sound synthesis
    ├── charts.js       # Worm and Manhattan canvas chart renderers
    ├── commentary.js   # Automated commentary generator
    ├── export.js       # Scorecard PDF/JSON export utilities
    ├── reducer.js      # State transition logic & cricket rules engine
    ├── store.js        # Centralized state store with undo/redo
    └── utils.js        # Helper formatting utilities
```

---

## 📄 License
MIT License. Free to use and modify for personal or commercial projects.
