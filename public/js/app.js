/**
 * Master Application Controller for Cricket Scorer Pro
 * Wires State Store, DOM Reactive Rendering, Sound Synthesis,
 * Canvas Charts, Commentary, Modals, Confetti, and Keyboard Shortcuts.
 */

import { createStore, getArchivedMatches, deleteArchivedMatch } from './store.js';
import { reducer, initialState } from './reducer.js';
import * as actions from './actions.js';
import { sound } from './audio.js';
import { renderWormChart, renderManhattanChart } from './charts.js';
import { exportScorecardImage, getWhatsAppScorecardText } from './export.js';
import {
  formatOvers,
  calcRunRate,
  calcRequiredRunRate,
  calcStrikeRate,
  calcEconomy,
  getBallLabel,
  getBallClass,
  calculateMVP
} from './utils.js';
import { renderQRCode } from './qrcode.js';
import {
  broadcastMatchState,
  broadcastMatchEnded,
  subscribeToLiveMatch,
  unsubscribeFromLiveMatch,
  generateMatchId,
  normalizeMatchId,
  getShareableMatchUrl,
  getFirebaseConfig,
  saveFirebaseConfig,
  isFirebaseConfigured,
  getActiveBroadcastId,
  setActiveBroadcastId,
  onConnectionStatusChange,
  getOrSetMatchPin,
  isDeviceAuthorizedScorer,
  verifyAndAuthorizeScorer,
  broadcastReaction,
  onReaction,
  startPresenceTracking,
  stopPresenceTracking
} from './firebase-sync.js';

// ─── Store Initialization ───────────────────────────────────────────
const store = createStore(reducer, initialState);

// ─── Live Broadcasting & Spectator State ─────────────────────────────
let isSpectatorMode = false;
let activeBroadcastMatchId = getActiveBroadcastId() || generateMatchId();
setActiveBroadcastId(activeBroadcastMatchId);
let activeWatchingMatchId = null;

// ─── DOM Helper ─────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Screens Map ────────────────────────────────────────────────────
const screens = {
  SETUP: $('setup-screen'),
  TOSS: $('toss-screen'),
  OPENING_PLAYERS: $('opening-players-screen'),
  INNINGS_1: $('scoring-screen'),
  INNINGS_2: $('scoring-screen'),
  INNINGS_BREAK: $('break-screen'),
  RESULT: $('result-screen')
};

// ─── Confetti Particle System ───────────────────────────────────────
const confettiCanvas = $('confetti-canvas');
let confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimId = null;

function resizeConfetti() {
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function fireConfetti(count = 70, colors = ['#22c55e', '#38bdf8', '#fbbf24', '#f87171', '#a855f7']) {
  if (!confettiCanvas || !confettiCtx) return;
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 18,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10
    });
  }

  if (!confettiAnimId) {
    animateConfetti();
  }
}

function animateConfetti() {
  if (!confettiCtx) return;
  confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  confettiParticles = confettiParticles.filter(p => p.alpha > 0.01 && p.y < window.innerHeight);

  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.4; // gravity
    p.vx *= 0.98;
    p.alpha -= 0.012;
    p.rotation += p.vRot;

    confettiCtx.save();
    confettiCtx.globalAlpha = Math.max(0, p.alpha);
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
    confettiCtx.restore();
  });

  if (confettiParticles.length > 0) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  } else {
    confettiAnimId = null;
    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

// ─── Event Overlay (FOUR / SIX / WICKET / MILESTONES) ────────────────
const eventContainer = $('event-overlay-container');

function showEventOverlay(type, customText = null) {
  const labels = {
    four: 'FOUR! ⚡',
    six: 'SIX! 🚀',
    wicket: 'WICKET! 💥',
    milestone: 'MILESTONE! 🌟'
  };

  const text = customText || labels[type] || 'ACTION!';
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `<span class="event-overlay-text event-overlay-${type}">${text}</span>`;
  eventContainer.appendChild(overlay);

  setTimeout(() => overlay.remove(), 950);
}

// ─── Modal Helpers ──────────────────────────────────────────────────
function openModal(modalId) {
  const modal = $(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = $(modalId);
  if (modal) modal.classList.remove('active');
}

// ─── Setup Screen Handlers ──────────────────────────────────────────
let selectedFormat = 'T20';

$$('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    $$('.preset-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedFormat = chip.dataset.format;

    if (selectedFormat !== 'CUSTOM') {
      $('overs-input').value = chip.dataset.overs;
      $('players-input').value = chip.dataset.players;
      $('max-overs-input').value = chip.dataset.max;
    }
  });
});

$('start-btn').addEventListener('click', () => {
  const teamA = $('team-a-input').value.trim() || 'Team A';
  const teamB = $('team-b-input').value.trim() || 'Team B';
  const totalOvers = parseInt($('overs-input').value, 10) || 20;
  const playersPerTeam = parseInt($('players-input').value, 10) || 11;
  const maxOversPerBowler = parseInt($('max-overs-input').value, 10) || 4;

  const squadAText = $('squad-a-text').value.trim();
  const squadBText = $('squad-b-text').value.trim();

  const squadA = squadAText ? squadAText.split(',').map(s => s.trim()).filter(Boolean) : [];
  const squadB = squadBText ? squadBText.split(',').map(s => s.trim()).filter(Boolean) : [];

  store.dispatch(actions.startMatch({
    teamA,
    teamB,
    totalOvers,
    playersPerTeam,
    maxOversPerBowler,
    squadA,
    squadB,
    matchType: selectedFormat
  }));
});

// ─── Toss Handlers ──────────────────────────────────────────────────
let tossWinnerKey = null;
let tossDecision = 'bat';

$('toss-team-a').addEventListener('click', () => {
  tossWinnerKey = 'teamA';
  $('toss-team-a').classList.add('selected');
  $('toss-team-b').classList.remove('selected');
  $('toss-decision-box').style.display = 'block';
});

$('toss-team-b').addEventListener('click', () => {
  tossWinnerKey = 'teamB';
  $('toss-team-b').classList.add('selected');
  $('toss-team-a').classList.remove('selected');
  $('toss-decision-box').style.display = 'block';
});

$('decision-bat-btn').addEventListener('click', () => {
  tossDecision = 'bat';
  $('decision-bat-btn').classList.add('active');
  $('decision-bowl-btn').classList.remove('active');
});

$('decision-bowl-btn').addEventListener('click', () => {
  tossDecision = 'bowl';
  $('decision-bowl-btn').classList.add('active');
  $('decision-bat-btn').classList.remove('active');
});

$('toss-proceed-btn').addEventListener('click', () => {
  if (!tossWinnerKey) return;
  const battingFirstKey = tossDecision === 'bat'
    ? tossWinnerKey
    : (tossWinnerKey === 'teamA' ? 'teamB' : 'teamA');

  store.dispatch(actions.setToss(battingFirstKey, tossDecision));
});

// ─── Opening Players Screen Handlers ────────────────────────────────
$('start-scoring-btn').addEventListener('click', () => {
  const striker = $('striker-select').value;
  const nonStriker = $('non-striker-select').value;
  const bowler = $('opening-bowler-select').value;

  if (!striker || !nonStriker || striker === nonStriker) {
    alert('Please select two distinct opening batters.');
    return;
  }
  if (!bowler) {
    alert('Please select an opening bowler.');
    return;
  }

  store.dispatch(actions.setOpeningPlayers(striker, nonStriker, bowler));
});

// ─── Keypad Scoring Grid Handlers ───────────────────────────────────
$$('.pad-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const actionType = btn.dataset.action;
    const runs = parseInt(btn.dataset.val, 10);

    if (actionType === 'run') {
      store.dispatch(actions.recordBall(runs));

      // Sound triggers
      if (runs === 0) sound.playDot();
      else if (runs === 4) {
        sound.playFour();
        fireConfetti(35, ['#f59e0b', '#fbbf24', '#fde047']);
      } else if (runs === 6) {
        sound.playSix();
        fireConfetti(65, ['#eab308', '#facc15', '#fef08a']);
      } else {
        sound.playRun(runs);
      }
    }
  });
});

// ─── Secondary Scoring Action Buttons ───────────────────────────────
$('pad-swap-strike-btn').addEventListener('click', () => {
  store.dispatch(actions.swapStrike());
  sound.playDot();
});

$('pad-undo-btn').addEventListener('click', () => {
  store.dispatch(actions.undoLast());
  sound.playDot();
});

$('undo-header-btn').addEventListener('click', () => {
  store.dispatch(actions.undoLast());
  sound.playDot();
});

$('redo-header-btn').addEventListener('click', () => {
  store.dispatch(actions.redoLast());
  sound.playDot();
});

$('sound-toggle-btn').addEventListener('click', () => {
  const enabled = sound.toggle();
  $('sound-toggle-btn').textContent = enabled ? '🔊' : '🔇';
});

$('reset-btn').addEventListener('click', () => {
  if (confirm('Start a new match? Current ongoing match will be reset.')) {
    store.dispatch(actions.resetMatch());
  }
});

// ─── Wicket Modal Handling ──────────────────────────────────────────
let selectedDismissalType = 'Bowled';
let runOutTarget = 'striker';

$('pad-wicket-btn').addEventListener('click', () => {
  const state = store.getState();
  const battingKey = state.currentInnings === 1 ? state.battingFirst : state.bowlingFirst;
  const battingTeam = state.teams[battingKey];

  // Populate next batter dropdown
  const availableBatters = (battingTeam.batters || []).filter(
    b => b.status === 'YET_TO_BAT' && b.name !== state.currentStriker && b.name !== state.currentNonStriker
  );

  const select = $('next-batter-select');
  select.innerHTML = '';

  availableBatters.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.name;
    opt.textContent = b.name;
    select.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '+ Enter new batter name...';
  select.appendChild(customOpt);

  select.onchange = () => {
    $('next-batter-custom-input').style.display = select.value === '__custom__' ? 'block' : 'none';
  };
  $('next-batter-custom-input').style.display = 'none';
  $('next-batter-custom-input').value = '';

  openModal('wicket-modal');
});

$$('#dismissal-type-chips .chip-btn').forEach(chip => {
  chip.addEventListener('click', () => {
    $$('#dismissal-type-chips .chip-btn').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedDismissalType = chip.dataset.type;

    $('wicket-fielder-group').style.display = (selectedDismissalType === 'Caught' || selectedDismissalType === 'Stumped') ? 'block' : 'none';
    $('wicket-runout-group').style.display = selectedDismissalType === 'Run Out' ? 'block' : 'none';
  });
});

$('runout-striker-btn').addEventListener('click', () => {
  runOutTarget = 'striker';
  $('runout-striker-btn').classList.add('active');
  $('runout-nonstriker-btn').classList.remove('active');
});

$('runout-nonstriker-btn').addEventListener('click', () => {
  runOutTarget = 'nonstriker';
  $('runout-nonstriker-btn').classList.add('active');
  $('runout-striker-btn').classList.remove('active');
});

$('cancel-wicket-btn').addEventListener('click', () => closeModal('wicket-modal'));

$('confirm-wicket-btn').addEventListener('click', () => {
  const state = store.getState();
  let dismissedBatter = state.currentStriker;
  if (selectedDismissalType === 'Run Out' && runOutTarget === 'nonstriker') {
    dismissedBatter = state.currentNonStriker;
  }

  const fielder = $('wicket-fielder-input').value.trim();
  const runsCompleted = selectedDismissalType === 'Run Out' ? (parseInt($('runout-runs-input').value, 10) || 0) : 0;

  let nextBatter = $('next-batter-select').value;
  if (nextBatter === '__custom__') {
    nextBatter = $('next-batter-custom-input').value.trim() || `Batter ${(state.teams[state.currentInnings === 1 ? state.battingFirst : state.bowlingFirst].wickets + 3)}`;
  }

  store.dispatch(actions.recordWicket({
    dismissalType: selectedDismissalType,
    dismissedBatter,
    fielder,
    bowlerCredit: selectedDismissalType !== 'Run Out',
    runsCompleted,
    nextBatter
  }));

  sound.playWicket();
  fireConfetti(45, ['#ef4444', '#f87171', '#ffffff']);
  closeModal('wicket-modal');
});

// ─── Extras Modal Handling ──────────────────────────────────────────
let selectedExtraType = 'WIDE';
let selectedExtraRuns = 1;

$('pad-extras-btn').addEventListener('click', () => {
  openModal('extras-modal');
});

$$('#extra-type-chips .chip-btn').forEach(chip => {
  chip.addEventListener('click', () => {
    $$('#extra-type-chips .chip-btn').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedExtraType = chip.dataset.extra;
  });
});

$$('#extra-runs-chips .chip-btn').forEach(chip => {
  chip.addEventListener('click', () => {
    $$('#extra-runs-chips .chip-btn').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedExtraRuns = parseInt(chip.dataset.runs, 10);
  });
});

$('cancel-extras-btn').addEventListener('click', () => closeModal('extras-modal'));

$('confirm-extras-btn').addEventListener('click', () => {
  store.dispatch(actions.recordExtra(selectedExtraType, selectedExtraRuns));
  sound.playBuzzer();
  closeModal('extras-modal');
});

// ─── Change Bowler Modal Handling ───────────────────────────────────
function promptBowlerModal() {
  const state = store.getState();
  const bowlingKey = state.currentInnings === 1 ? state.bowlingFirst : state.battingFirst;
  const bowlingTeam = state.teams[bowlingKey];

  const select = $('bowler-select-input');
  select.innerHTML = '';

  const squad = (bowlingTeam.batters || []).map(b => b.name);
  const bowlers = bowlingTeam.bowlers || [];

  squad.forEach(name => {
    const existing = bowlers.find(bw => bw.name.toLowerCase() === name.toLowerCase());
    const oversBowled = existing ? existing.ballsBowled / 6 : 0;
    const isPrev = name.toLowerCase() === (state.previousBowler || '').toLowerCase();
    const isMax = oversBowled >= state.maxOversPerBowler;

    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${existing ? `${formatOvers(existing.ballsBowled)} ov, ${existing.wickets}/${existing.runsConceded}` : '0 ov'})`;
    if (isPrev) opt.textContent += ' [Last Bowled]';
    if (isMax) opt.textContent += ' [Max Overs Reached]';
    if (isPrev || isMax) opt.disabled = true;

    select.appendChild(opt);
  });

  $('custom-bowler-input').value = '';
  openModal('bowler-modal');
}

$('quick-change-bowler-btn').addEventListener('click', promptBowlerModal);
$('cancel-bowler-btn').addEventListener('click', () => closeModal('bowler-modal'));

$('confirm-bowler-btn').addEventListener('click', () => {
  const custom = $('custom-bowler-input').value.trim();
  const selected = $('bowler-select-input').value;
  const bowlerName = custom || selected;

  if (!bowlerName) {
    alert('Please select or enter a bowler name.');
    return;
  }

  store.dispatch(actions.changeBowler(bowlerName));
  closeModal('bowler-modal');
});

// ─── Quick Bowler Selector Strip ──────────────────────────────────
function renderQuickBowlerStrip(state, bowlingTeam) {
  const strip = $('quick-bowler-strip');
  const chipsContainer = $('quick-bowler-chips');
  if (!strip || !chipsContainer) return;

  if (!isSpectatorMode && !state.currentBowler && (state.phase === 'INNINGS_1' || state.phase === 'INNINGS_2')) {
    strip.style.display = 'block';

    const squad = (bowlingTeam.batters || []).map(b => b.name);
    const bowlers = bowlingTeam.bowlers || [];

    chipsContainer.innerHTML = squad.map(name => {
      const existing = bowlers.find(bw => bw.name.toLowerCase() === name.toLowerCase());
      const oversBowled = existing ? existing.ballsBowled / 6 : 0;
      const isPrev = name.toLowerCase() === (state.previousBowler || '').toLowerCase();
      const isMax = oversBowled >= state.maxOversPerBowler;
      const figures = existing ? `${formatOvers(existing.ballsBowled)} ov, ${existing.wickets}/${existing.runsConceded}` : '0 ov';

      return `
        <button class="bowler-chip-btn" data-name="${name}" ${isPrev || isMax ? 'disabled' : ''} title="${isPrev ? 'Last bowled (consecutive over not allowed)' : (isMax ? 'Max overs limit reached' : 'Select Bowler')}">
          <span>${name}</span>
          <span class="bowler-chip-stats">(${figures})</span>
          ${isPrev ? '<span style="font-size:0.65rem; color:#f87171;">[Last]</span>' : ''}
          ${isMax ? '<span style="font-size:0.65rem; color:#fbbf24;">[Max]</span>' : ''}
        </button>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.bowler-chip-btn:not(:disabled)').forEach(chip => {
      chip.onclick = () => {
        const name = chip.dataset.name;
        if (name) {
          store.dispatch(actions.changeBowler(name));
          sound.playRun(1);
        }
      };
    });
  } else {
    strip.style.display = 'none';
  }
}

const stripCustomBtn = $('strip-custom-bowler-btn');
if (stripCustomBtn) {
  stripCustomBtn.addEventListener('click', promptBowlerModal);
}

// ─── Innings Break Continue Handler ─────────────────────────────────
$('continue-btn').addEventListener('click', () => {
  const striker = $('break-striker-select').value;
  const nonStriker = $('break-non-striker-select').value;
  const bowler = $('break-bowler-select').value;

  if (!striker || !nonStriker || striker === nonStriker) {
    alert('Please select two distinct opening batters for the 2nd innings.');
    return;
  }
  if (!bowler) {
    alert('Please select an opening bowler.');
    return;
  }

  store.dispatch(actions.continueInnings(striker, nonStriker, bowler));
});

// ─── Reset Match & Host Termination Handlers ─────────────────────────
function handleHostResetMatch() {
  const isMatchActive = store.getState().phase !== 'SETUP';
  const msg = isMatchActive
    ? 'Are you sure you want to end and reset the current match? This will close the live stream for all connected spectators.'
    : 'Reset match settings?';

  if (confirm(msg)) {
    if (isMatchActive) {
      // Broadcast MATCH_ENDED to all spectators over cloud and local channels
      broadcastMatchEnded(activeBroadcastMatchId);
    }

    // Generate fresh match code for next match
    activeBroadcastMatchId = generateMatchId();
    setActiveBroadcastId(activeBroadcastMatchId);

    // Reset store
    store.dispatch(actions.resetMatch());

    // Ensure setup screen is active
    $$('.screen').forEach(s => s.classList.remove('active'));
    const setup = $('setup-screen');
    if (setup) setup.classList.add('active');
  }
}

$('reset-btn').addEventListener('click', handleHostResetMatch);
$('result-new-match-btn').addEventListener('click', handleHostResetMatch);

$('export-img-btn').addEventListener('click', () => exportScorecardImage(store.getState()));
$('result-export-img-btn').addEventListener('click', () => exportScorecardImage(store.getState()));

$('copy-text-btn').addEventListener('click', () => {
  const text = getWhatsAppScorecardText(store.getState());
  navigator.clipboard.writeText(text).then(() => alert('Scorecard summary copied to clipboard! 📋'));
});
$('result-copy-text-btn').addEventListener('click', () => {
  const text = getWhatsAppScorecardText(store.getState());
  navigator.clipboard.writeText(text).then(() => alert('Scorecard summary copied to clipboard! 📋'));
});

$('export-json-btn').addEventListener('click', () => {
  const data = JSON.stringify(store.getState(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `match-${Date.now()}.json`;
  a.click();
});

// ─── Match Tabs Switching ───────────────────────────────────────────
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const targetId = btn.dataset.tab;
    const targetEl = $(targetId);
    if (targetEl) targetEl.classList.add('active');

    // Trigger chart canvas redraw if charts tab opened
    if (targetId === 'tab-charts') {
      renderWormChart($('worm-chart-canvas'), store.getState());
      renderManhattanChart($('manhattan-chart-canvas'), store.getState());
    }
  });
});

// ─── Shortcuts Modal Handlers ───────────────────────────────────────
$('shortcuts-btn').addEventListener('click', () => openModal('shortcuts-modal'));
$('close-shortcuts-btn').addEventListener('click', () => closeModal('shortcuts-modal'));

// ─── Archive Modal Handlers ─────────────────────────────────────────
$('archive-btn').addEventListener('click', () => {
  renderArchiveList();
  openModal('archive-modal');
});
$('close-archive-btn').addEventListener('click', () => closeModal('archive-modal'));

function renderArchiveList() {
  const listEl = $('archive-matches-list');
  const matches = getArchivedMatches();

  if (matches.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">No saved matches found</div>';
    return;
  }

  listEl.innerHTML = matches.map(m => `
    <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-glass); border-radius:var(--radius-md); padding:12px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong style="color:#38bdf8;">${m.teamA} (${m.scoreA}) vs ${m.teamB} (${m.scoreB})</strong>
        <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(m.date).toLocaleString()} • ${m.summary}</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="icon-btn load-archive-item" data-id="${m.id}" title="View Scorecard">👁️</button>
        <button class="icon-btn delete-archive-item" data-id="${m.id}" title="Delete Match" style="color:#ef4444;">🗑️</button>
      </div>
    </div>
  `).join('');

  $$('.load-archive-item').forEach(b => {
    b.addEventListener('click', () => {
      const match = matches.find(x => x.id === b.dataset.id);
      if (match && match.fullState) {
        store.dispatch(actions.loadMatchState(match.fullState));
        closeModal('archive-modal');
      }
    });
  });

  $$('.delete-archive-item').forEach(b => {
    b.addEventListener('click', () => {
      deleteArchivedMatch(b.dataset.id);
      renderArchiveList();
    });
  });
}

// ─── Keyboard Shortcuts ─────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

  const state = store.getState();
  if (state.phase !== 'INNINGS_1' && state.phase !== 'INNINGS_2') return;

  if (['0', '1', '2', '3', '4', '6'].includes(e.key)) {
    const runs = parseInt(e.key, 10);
    store.dispatch(actions.recordBall(runs));
    if (runs === 0) sound.playDot();
    else if (runs === 4) { sound.playFour(); fireConfetti(35); }
    else if (runs === 6) { sound.playSix(); fireConfetti(60); }
    else sound.playRun(runs);
  } else if (e.key.toLowerCase() === 'w') {
    $('pad-wicket-btn').click();
  } else if (e.key.toLowerCase() === 'x') {
    $('pad-extras-btn').click();
  } else if (e.key.toLowerCase() === 's') {
    $('pad-swap-strike-btn').click();
  } else if (e.key.toLowerCase() === 'b') {
    promptBowlerModal();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    store.dispatch(actions.undoLast());
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    store.dispatch(actions.redoLast());
  } else if (e.key.toLowerCase() === 'm') {
    $('sound-toggle-btn').click();
  }
});

// ─── Scorecard Innings Toggle ───────────────────────────────────────
let activeScorecardInnings = 1;

$('sc-tab-inn1').addEventListener('click', () => {
  activeScorecardInnings = 1;
  $('sc-tab-inn1').classList.add('active');
  $('sc-tab-inn2').classList.remove('active');
  renderDetailedScorecard(store.getState());
});

$('sc-tab-inn2').addEventListener('click', () => {
  activeScorecardInnings = 2;
  $('sc-tab-inn2').classList.add('active');
  $('sc-tab-inn1').classList.remove('active');
  renderDetailedScorecard(store.getState());
});

// ─── Master Reactive Render ─────────────────────────────────────────
function render(state, prevState) {
  // Screen routing
  $$('.screen').forEach(s => s.classList.remove('active'));
  const activeScreen = screens[state.phase];
  if (activeScreen) {
    activeScreen.classList.add('active');
  }

  // Phase Specific Rendering
  switch (state.phase) {
    case 'TOSS':
      renderTossScreen(state);
      break;
    case 'OPENING_PLAYERS':
      renderOpeningPlayersScreen(state);
      break;
    case 'INNINGS_1':
    case 'INNINGS_2':
      renderScoringScreen(state, prevState);
      break;
    case 'INNINGS_BREAK':
      renderBreakScreen(state);
      break;
    case 'RESULT':
      renderResultScreen(state);
      break;
  }
}

function renderTossScreen(state) {
  $('toss-team-a-name').textContent = state.teams.teamA.name;
  $('toss-team-b-name').textContent = state.teams.teamB.name;
}

function renderOpeningPlayersScreen(state) {
  const battingKey = state.battingFirst;
  const bowlingKey = state.bowlingFirst;
  const battingTeam = state.teams[battingKey];
  const bowlingTeam = state.teams[bowlingKey];

  const strikerSel = $('striker-select');
  const nonStrikerSel = $('non-striker-select');
  const bowlerSel = $('opening-bowler-select');

  strikerSel.innerHTML = '';
  nonStrikerSel.innerHTML = '';
  bowlerSel.innerHTML = '';

  (battingTeam.batters || []).forEach((b, idx) => {
    const opt1 = new Option(b.name, b.name);
    const opt2 = new Option(b.name, b.name);
    if (idx === 0) opt1.selected = true;
    if (idx === 1) opt2.selected = true;
    strikerSel.add(opt1);
    nonStrikerSel.add(opt2);
  });

  (bowlingTeam.batters || []).forEach((bw, idx) => {
    const opt = new Option(bw.name, bw.name);
    if (idx === bowlingTeam.batters.length - 1) opt.selected = true;
    bowlerSel.add(opt);
  });
}

function renderScoringScreen(state, prevState) {
  const battingKey = state.currentInnings === 1 ? state.battingFirst : state.bowlingFirst;
  const bowlingKey = state.currentInnings === 1 ? state.bowlingFirst : state.battingFirst;
  const battingTeam = state.teams[battingKey];
  const bowlingTeam = state.teams[bowlingKey];

  // 1. Hero Scoreboard
  $('batting-team-name').textContent = battingTeam.name;
  $('innings-badge').textContent = state.currentInnings === 1 ? '1st Innings' : '2nd Innings';
  $('total-runs').textContent = battingTeam.score;
  $('total-wickets').textContent = battingTeam.wickets;
  $('overs-display').textContent = formatOvers(battingTeam.ballsFaced);
  $('max-overs-display').textContent = state.totalOvers;
  $('run-rate').textContent = calcRunRate(battingTeam.score, battingTeam.ballsFaced);

  // Free hit badge
  $('freehit-indicator').style.display = state.freeHit ? 'inline-flex' : 'none';

  // Target Equation Bar (2nd Innings)
  if (state.currentInnings === 2 && state.target != null) {
    $('target-equation-bar').style.display = 'flex';
    $('target-score').textContent = state.target;
    const runsNeeded = Math.max(0, state.target - battingTeam.score);
    const totalBalls = state.totalOvers * 6;
    const ballsLeft = Math.max(0, totalBalls - battingTeam.ballsFaced);
    $('runs-needed').textContent = runsNeeded;
    $('balls-remaining').textContent = ballsLeft;
    $('required-rate').textContent = calcRequiredRunRate(state.target, battingTeam.score, state.totalOvers, battingTeam.ballsFaced);
  } else {
    $('target-equation-bar').style.display = 'none';
  }

  // 2. Batters Live Card
  const striker = (battingTeam.batters || []).find(b => b.name === state.currentStriker) || { name: state.currentStriker, runs: 0, balls: 0, fours: 0, sixes: 0 };
  const nonStriker = (battingTeam.batters || []).find(b => b.name === state.currentNonStriker) || { name: state.currentNonStriker, runs: 0, balls: 0, fours: 0, sixes: 0 };

  $('striker-name').textContent = striker.name;
  $('striker-runs').textContent = striker.runs;
  $('striker-balls').textContent = striker.balls;
  $('striker-fours').textContent = `${striker.fours}x4`;
  $('striker-sixes').textContent = `${striker.sixes}x6`;
  $('striker-sr').textContent = `SR ${calcStrikeRate(striker.runs, striker.balls)}`;

  $('non-striker-name').textContent = nonStriker.name;
  $('non-striker-runs').textContent = nonStriker.runs;
  $('non-striker-balls').textContent = nonStriker.balls;
  $('non-striker-fours').textContent = `${nonStriker.fours}x4`;
  $('non-striker-sixes').textContent = `${nonStriker.sixes}x6`;
  $('non-striker-sr').textContent = `SR ${calcStrikeRate(nonStriker.runs, nonStriker.balls)}`;

  // 3. Bowler Live Card & Quick Strip
  let displayBowler = null;
  const isBowlerPending = !state.currentBowler;

  if (state.currentBowler) {
    displayBowler = (bowlingTeam.bowlers || []).find(b => b.name === state.currentBowler) || {
      name: state.currentBowler, ballsBowled: 0, maidens: 0, runsConceded: 0, wickets: 0, dots: 0
    };
  } else if (state.previousBowler) {
    displayBowler = (bowlingTeam.bowlers || []).find(b => b.name === state.previousBowler) || {
      name: state.previousBowler, ballsBowled: 0, maidens: 0, runsConceded: 0, wickets: 0, dots: 0
    };
  } else {
    displayBowler = { name: 'Select Bowler', ballsBowled: 0, maidens: 0, runsConceded: 0, wickets: 0, dots: 0 };
  }

  if (isBowlerPending && isSpectatorMode && state.previousBowler) {
    $('current-bowler-name').innerHTML = `${displayBowler.name} <span style="font-size:0.75rem; color:#facc15; font-weight:600;">(Over Finished)</span>`;
  } else if (isBowlerPending && !isSpectatorMode) {
    $('current-bowler-name').innerHTML = `<span style="color:#38bdf8;">Select Next Bowler ⚡</span>`;
  } else {
    $('current-bowler-name').textContent = displayBowler.name;
  }

  $('bowler-figures-stat').textContent = `${formatOvers(displayBowler.ballsBowled)}-${displayBowler.maidens}-${displayBowler.runsConceded}-${displayBowler.wickets}`;
  $('bowler-econ-stat').textContent = calcEconomy(displayBowler.runsConceded, displayBowler.ballsBowled);
  $('bowler-dots-stat').textContent = displayBowler.dots;

  // Manage Quick Bowler Selector Strip
  renderQuickBowlerStrip(state, bowlingTeam);

  // 4. This Over Ribbon
  const overBalls = state.currentOver.balls || [];
  if (overBalls.length === 0) {
    $('current-over-balls').innerHTML = '<span style="font-size:0.85rem; color:var(--text-muted);">Start bowling...</span>';
  } else {
    $('current-over-balls').innerHTML = overBalls.map((b, i) => {
      return `<span class="ball-badge ${getBallClass(b)}" style="animation-delay:${i * 0.04}s">${getBallLabel(b)}</span>`;
    }).join('');
  }

  // 5. Overlays on new boundary / wicket
  if (prevState && state.currentOver.balls.length > prevState.currentOver.balls.length) {
    const lastBall = state.currentOver.balls[state.currentOver.balls.length - 1];
    if (lastBall.type === 'RUN' && lastBall.value === 4) showEventOverlay('four');
    else if (lastBall.type === 'RUN' && lastBall.value === 6) showEventOverlay('six');
    else if (lastBall.type === 'WICKET') showEventOverlay('wicket');
  }

  // Render Scorecard & Commentary Tabs
  renderDetailedScorecard(state);
  renderLiveCommentary(state);
}

function renderDetailedScorecard(state) {
  const innKey = activeScorecardInnings === 1 ? state.battingFirst : state.bowlingFirst;
  const oppKey = activeScorecardInnings === 1 ? state.bowlingFirst : state.battingFirst;
  const team = state.teams[innKey];
  const oppTeam = state.teams[oppKey];
  if (!team) return;

  $('sc-team-title').textContent = `${team.name} — ${activeScorecardInnings === 1 ? '1st Innings' : '2nd Innings'}`;

  // Batters Tbody
  const tbody = $('sc-batting-tbody');
  tbody.innerHTML = (team.batters || []).map(b => {
    let statusText = 'Yet to bat';
    if (b.status === 'BATTING') statusText = '<span style="color:#4ade80; font-weight:700;">Batting *</span>';
    else if (b.status === 'OUT') statusText = `<span class="sc-dismissal">${b.dismissal?.description || 'out'}</span>`;
    else if (b.status === 'RETIRED') statusText = '<span class="sc-dismissal">Retired Hurt</span>';

    return `
      <tr>
        <td><span class="sc-batter-name">${b.name}</span></td>
        <td>${statusText}</td>
        <td class="num"><strong>${b.runs}</strong></td>
        <td class="num">${b.balls}</td>
        <td class="num">${b.fours}</td>
        <td class="num">${b.sixes}</td>
        <td class="num" style="color:#38bdf8;">${calcStrikeRate(b.runs, b.balls)}</td>
      </tr>
    `;
  }).join('');

  // Extras
  const ext = team.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 };
  $('sc-extras-summary').textContent = `${ext.total} (wd ${ext.wides}, nb ${ext.noBalls}, b ${ext.byes}, lb ${ext.legByes}, pen ${ext.penalty})`;
  $('sc-total-summary').textContent = `${team.score}/${team.wickets} (${formatOvers(team.ballsFaced)} ov)`;

  // FOW
  const fowList = $('sc-fow-list');
  const fows = team.fallOfWickets || [];
  if (fows.length === 0) {
    fowList.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted);">No wickets fallen yet</span>';
  } else {
    fowList.innerHTML = fows.map(f => `
      <span class="fow-badge">${f.wicketNumber}-${f.score} (${f.batterName}, ${f.overStr} ov)</span>
    `).join('');
  }

  // Bowlers Tbody
  const bwTbody = $('sc-bowling-tbody');
  const bowlers = oppTeam ? oppTeam.bowlers || [] : [];
  bwTbody.innerHTML = bowlers.map(bw => `
    <tr>
      <td><strong>${bw.name}</strong></td>
      <td class="num">${formatOvers(bw.ballsBowled)}</td>
      <td class="num">${bw.maidens}</td>
      <td class="num">${bw.runsConceded}</td>
      <td class="num" style="color:#f87171; font-weight:700;">${bw.wickets}</td>
      <td class="num">${calcEconomy(bw.runsConceded, bw.ballsBowled)}</td>
      <td class="num">${bw.dots}</td>
      <td class="num">${bw.wides}</td>
      <td class="num">${bw.noBalls}</td>
    </tr>
  `).join('');
}

function renderLiveCommentary(state) {
  const list = $('live-commentary-list');
  const comms = state.commentary || [];
  if (comms.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Commentary will appear as balls are bowled.</div>';
    return;
  }

  list.innerHTML = comms.slice(0, 50).map(c => `
    <div class="comm-item comm-${c.highlight || 'normal'}">
      <span class="comm-ball-num">${c.ballStr}</span>
      <span class="comm-text">${c.text}</span>
    </div>
  `).join('');
}

function renderBreakScreen(state) {
  const bat1Key = state.battingFirst;
  const bat2Key = state.bowlingFirst;
  const team1 = state.teams[bat1Key];
  const team2 = state.teams[bat2Key];

  $('break-team-name').textContent = team1.name;
  $('break-score').textContent = `${team1.score}/${team1.wickets}`;
  $('break-overs').textContent = `(${formatOvers(team1.ballsFaced)} / ${state.totalOvers} Overs)`;
  $('break-chasing-team').textContent = team2.name;
  $('break-target-score').textContent = state.target;

  // Populate 2nd innings opener dropdowns
  const strikerSel = $('break-striker-select');
  const nonStrikerSel = $('break-non-striker-select');
  const bowlerSel = $('break-bowler-select');

  strikerSel.innerHTML = '';
  nonStrikerSel.innerHTML = '';
  bowlerSel.innerHTML = '';

  (team2.batters || []).forEach((b, idx) => {
    const opt1 = new Option(b.name, b.name);
    const opt2 = new Option(b.name, b.name);
    if (idx === 0) opt1.selected = true;
    if (idx === 1) opt2.selected = true;
    strikerSel.add(opt1);
    nonStrikerSel.add(opt2);
  });

  (team1.batters || []).forEach((bw, idx) => {
    const opt = new Option(bw.name, bw.name);
    if (idx === team1.batters.length - 1) opt.selected = true;
    bowlerSel.add(opt);
  });
}

function renderResultScreen(state) {
  if (!state.matchResult) return;

  const bat1Key = state.battingFirst;
  const bat2Key = state.bowlingFirst;
  const team1 = state.teams[bat1Key];
  const team2 = state.teams[bat2Key];

  if (state.matchResult.winner) {
    $('result-text').textContent = `🏆 ${state.matchResult.winnerName} Wins!`;
    fireConfetti(100, ['#facc15', '#38bdf8', '#4ade80', '#f43f5e']);
    sound.playMilestone();
  } else {
    $('result-text').textContent = 'Match Tied! 🤝';
  }

  $('result-summary').innerHTML = `
    <div style="font-size:1.15rem; color:#f8fafc; font-weight:700; margin-bottom:12px;">${state.matchResult.summary}</div>
    <div style="display:flex; justify-content:space-around; background:rgba(255,255,255,0.03); padding:14px; border-radius:var(--radius-md); border:1px solid var(--border-glass);">
      <div>
        <div style="color:#38bdf8; font-weight:700;">${team1.name}</div>
        <div style="font-family:var(--font-mono); font-size:1.5rem; font-weight:800;">${team1.score}/${team1.wickets}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">(${formatOvers(team1.ballsFaced)} ov)</div>
      </div>
      <div style="align-self:center; font-weight:900; color:var(--text-muted);">VS</div>
      <div>
        <div style="color:#22c55e; font-weight:700;">${team2.name}</div>
        <div style="font-family:var(--font-mono); font-size:1.5rem; font-weight:800;">${team2.score}/${team2.wickets}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">(${formatOvers(team2.ballsFaced)} ov)</div>
      </div>
    </div>
  `;

  // MVP
  const mvp = calculateMVP(state);
  if (mvp) {
    $('mvp-award-card').style.display = 'block';
    $('mvp-player-name').textContent = `${mvp.name} (${mvp.team})`;
    let statsTxt = '';
    if (mvp.runs > 0) statsTxt += `${mvp.runs} runs (${mvp.balls}b) `;
    if (mvp.wickets > 0) statsTxt += `• ${mvp.wickets} wickets for ${mvp.runsConceded}`;
    $('mvp-player-stats').textContent = statsTxt || 'All-round contribution';
  } else {
    $('mvp-award-card').style.display = 'none';
  }
}

// ─── Subscribe Store & Initial Render ───────────────────────────────
store.subscribe(render);
render(store.getState(), null);

// ─── Live Broadcasting & Firebase Realtime Synchronization ─────────
// Connection Status Monitor
onConnectionStatusChange((status, label) => {
  const statusEl = $('spectator-status-text');
  if (statusEl && isSpectatorMode) {
    statusEl.textContent = status === 'connected' ? '● Connected to Live Match Stream' : `● ${label}`;
  }
});

// Live Spectator Presence & Reactions
function updateViewerCount(count) {
  const headerBadge = $('header-viewer-badge');
  const headerText = $('viewer-count-text');
  if (headerBadge && headerText) {
    headerBadge.style.display = 'inline-flex';
    headerText.textContent = count === 1 ? '1 Watching' : `${count} Watching`;
  }
  const statusEl = $('spectator-status-text');
  if (statusEl && isSpectatorMode) {
    statusEl.textContent = `● Live • 👀 ${count} Watching`;
  }
}

// Floating Emoji Animation Generator
function triggerFloatingEmoji(emoji) {
  const container = $('floating-reactions-layer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'floating-reaction-item';
  el.textContent = emoji;

  const leftPercent = 15 + Math.random() * 70;
  const rotDeg = -25 + Math.random() * 50;
  el.style.left = `${leftPercent}%`;
  el.style.setProperty('--rot', `${rotDeg}deg`);

  container.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// Listen to incoming live reactions
onReaction((payload) => {
  if (payload && payload.emoji) {
    triggerFloatingEmoji(payload.emoji);
    const countEl = $(`count-${payload.reactionType}`);
    if (countEl) {
      const current = parseInt(countEl.textContent || '0', 10) || 0;
      countEl.textContent = current + 1;
    }
  }
});

// Wire up reaction button click handlers
$$('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.dataset.emoji;
    const type = btn.dataset.type;
    const matchId = activeWatchingMatchId || activeBroadcastMatchId;

    broadcastReaction(matchId, emoji, type);
  });
});

// Store subscription: publish state if we are an authorized match scorer
store.subscribe((state) => {
  if (!isSpectatorMode && state.phase !== 'SETUP') {
    broadcastMatchState(activeBroadcastMatchId, state);
    startPresenceTracking(activeBroadcastMatchId, updateViewerCount);
  }
});

// Enable Spectator Mode
function enableSpectatorMode(matchId) {
  activeWatchingMatchId = matchId;
  startPresenceTracking(matchId, updateViewerCount);

  // If this device is already an authorized scorer for this match, don't lock into spectator mode
  if (isDeviceAuthorizedScorer(matchId)) {
    isSpectatorMode = false;
    document.body.classList.remove('spectator-view');
    const banner = $('spectator-mode-banner');
    if (banner) banner.style.display = 'none';
  } else {
    isSpectatorMode = true;
    document.body.classList.add('spectator-view');
    const banner = $('spectator-mode-banner');
    if (banner) banner.style.display = 'flex';
  }

  // Switch to scoring screen view directly
  $$('.screen').forEach(s => s.classList.remove('active'));
  const scoringScreen = $('scoring-screen');
  if (scoringScreen) scoringScreen.classList.add('active');

  const loadingOverlay = $('spectator-loading-overlay');
  const codeEl = $('loading-match-code');
  if (codeEl) codeEl.textContent = matchId;
  if (loadingOverlay) loadingOverlay.style.display = 'block';

  // Listen to remote updates
  subscribeToLiveMatch(matchId, (remoteState, payload) => {
    if (payload?.isEnded || payload?.status === 'MATCH_CLOSED' || remoteState?.phase === 'MATCH_ENDED' || remoteState?.phase === 'SETUP') {
      console.log('[LiveSync] Match ended or closed by host.');
      handleRemoteMatchEnded();
      return;
    }
    if (remoteState) {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      store.dispatch(actions.loadMatchState(remoteState));
    }
  });
}

function handleRemoteMatchEnded() {
  unsubscribeFromLiveMatch();
  isSpectatorMode = false;
  document.body.classList.remove('spectator-view');

  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);

  const banner = $('spectator-mode-banner');
  if (banner) banner.style.display = 'none';
  const loadingOverlay = $('spectator-loading-overlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';

  // Reset store to fresh state
  store.dispatch(actions.resetMatch());

  // Show Match Ended modal
  openModal('match-ended-modal');
  setTimeout(() => {
    closeModal('match-ended-modal');
    $$('.screen').forEach(s => s.classList.remove('active'));
    const setupScreen = $('setup-screen');
    if (setupScreen) setupScreen.classList.add('active');
  }, 2200);
}

const closeMatchEndedBtn = $('close-match-ended-btn');
if (closeMatchEndedBtn) {
  closeMatchEndedBtn.addEventListener('click', () => {
    closeModal('match-ended-modal');
    stopPresenceTracking();
    unsubscribeFromLiveMatch();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.replace(cleanUrl);
  });
}

// ─── Scorer PIN Unlock Modal Handlers ──────────────────────────────
const unlockPinBtn = $('spectator-unlock-pin-btn');
const unlockPinModal = $('unlock-scorer-modal');
const unlockPinInput = $('unlock-pin-input');
const unlockPinError = $('unlock-pin-error');
const submitUnlockPinBtn = $('submit-unlock-pin-btn');
const cancelUnlockPinBtn = $('cancel-unlock-pin-btn');

if (unlockPinBtn) {
  unlockPinBtn.addEventListener('click', () => {
    if (unlockPinInput) unlockPinInput.value = '';
    if (unlockPinError) unlockPinError.style.display = 'none';
    openModal('unlock-scorer-modal');
    setTimeout(() => { if (unlockPinInput) unlockPinInput.focus(); }, 150);
  });
}

if (cancelUnlockPinBtn) {
  cancelUnlockPinBtn.addEventListener('click', () => closeModal('unlock-scorer-modal'));
}

// ─── Exit Spectator Mode Handler ──────────────────────────────────
const spectatorExitBtn = $('spectator-exit-btn');
if (spectatorExitBtn) {
  spectatorExitBtn.addEventListener('click', () => {
    if (confirm('Leave live match spectator view and return to the main screen?')) {
      stopPresenceTracking();
      unsubscribeFromLiveMatch();
      isSpectatorMode = false;
      document.body.classList.remove('spectator-view');

      // Clear all keys from localStorage and sessionStorage
      try {
        localStorage.clear();
      } catch (e) {
        console.warn('[Storage] Error clearing localStorage', e);
      }
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn('[Storage] Error clearing sessionStorage', e);
      }

      // Hard redirect to clean URL to reset state and store completely
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.replace(cleanUrl);
    }
  });
}

function handleUnlockScorerSubmit() {
  const matchId = activeWatchingMatchId || activeBroadcastMatchId;
  const pin = unlockPinInput ? unlockPinInput.value.trim() : '';

  if (!pin) {
    if (unlockPinError) {
      unlockPinError.textContent = 'Please enter the 4-digit Scorer PIN.';
      unlockPinError.style.display = 'block';
    }
    return;
  }

  const result = verifyAndAuthorizeScorer(matchId, pin);
  if (result.success) {
    closeModal('unlock-scorer-modal');
    isSpectatorMode = false;
    document.body.classList.remove('spectator-view');
    const banner = $('spectator-mode-banner');
    if (banner) banner.style.display = 'none';
    const loadingOverlay = $('spectator-loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    activeBroadcastMatchId = matchId;
    setActiveBroadcastId(matchId);
    alert('🔓 Scorer mode unlocked! You now have official scoring controls on this device.');
  } else {
    if (unlockPinError) {
      unlockPinError.textContent = '❌ Incorrect PIN. Scoring controls remain locked.';
      unlockPinError.style.display = 'block';
    }
    if (unlockPinInput) {
      unlockPinInput.select();
      unlockPinInput.focus();
    }
  }
}

if (submitUnlockPinBtn) {
  submitUnlockPinBtn.addEventListener('click', handleUnlockScorerSubmit);
}
if (unlockPinInput) {
  unlockPinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUnlockScorerSubmit();
  });
}

// Check URL query parameters for ?match=MATCH_ID
const urlParams = new URLSearchParams(window.location.search);
const matchQueryParam = urlParams.get('match');
if (matchQueryParam) {
  const normalizedId = normalizeMatchId(matchQueryParam);
  enableSpectatorMode(normalizedId);
}

// ─── Share Live Match Modal Handlers ────────────────────────────────
function openShareModal() {
  const state = store.getState();
  const matchCode = activeBroadcastMatchId;
  const shareUrl = getShareableMatchUrl(matchCode);
  const scorerPin = getOrSetMatchPin(matchCode);

  $('modal-match-code').textContent = matchCode;
  $('modal-share-url').value = shareUrl;
  const pinEl = $('modal-scorer-pin');
  if (pinEl) pinEl.textContent = scorerPin;

  // Render QR Code onto Canvas
  const qrCanvas = $('qr-canvas');
  if (qrCanvas) {
    renderQRCode(qrCanvas, shareUrl, { size: 200, margin: 2 });
  }

  // Set WhatsApp button
  const waBtn = $('modal-whatsapp-share-btn');
  if (waBtn) {
    const teamA = state.teams?.teamA?.name || 'Team A';
    const teamB = state.teams?.teamB?.name || 'Team B';
    const msg = `🏏 Watch Live Cricket Match (${teamA} vs ${teamB}) Ball-by-Ball on your phone!\n🔗 Live Link: ${shareUrl}\n🔑 Match Code: ${matchCode}`;
    waBtn.onclick = () => {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };
  }

  openModal('share-live-modal');
}

$('live-share-header-btn').addEventListener('click', openShareModal);
$('close-share-modal-btn').addEventListener('click', () => closeModal('share-live-modal'));

// Copy Match Code Button
$('copy-match-code-btn').addEventListener('click', () => {
  const code = $('modal-match-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = $('copy-match-code-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied! ✓';
    setTimeout(() => { btn.textContent = originalText; }, 2000);
  });
});

// Copy Scorer PIN Button
const copyPinBtn = $('copy-scorer-pin-btn');
if (copyPinBtn) {
  copyPinBtn.addEventListener('click', () => {
    const pin = $('modal-scorer-pin')?.textContent || '';
    navigator.clipboard.writeText(pin).then(() => {
      const originalText = copyPinBtn.textContent;
      copyPinBtn.textContent = 'Copied! ✓';
      setTimeout(() => { copyPinBtn.textContent = originalText; }, 2000);
    });
  });
}

// Copy Share URL Button
$('copy-share-url-btn').addEventListener('click', () => {
  const url = $('modal-share-url').value;
  navigator.clipboard.writeText(url).then(() => {
    const btn = $('copy-share-url-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied! ✓';
    setTimeout(() => { btn.textContent = originalText; }, 2000);
  });
});

// ─── Join Live Match Input Handler ──────────────────────────────────
const joinBtn = $('join-match-btn');
const joinInput = $('join-match-code-input');

function handleJoinLiveMatch() {
  const code = normalizeMatchId(joinInput ? joinInput.value : '');
  if (!code || code.length < 3) {
    alert('Please enter a valid match code (e.g. CRIC-8492)');
    return;
  }

  enableSpectatorMode(code);
  const newUrl = getShareableMatchUrl(code);
  window.history.pushState(null, '', newUrl);
}

if (joinBtn) joinBtn.addEventListener('click', handleJoinLiveMatch);
if (joinInput) {
  joinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleJoinLiveMatch();
  });
}

// ─── Firebase Settings Modal Handlers ───────────────────────────────
$('firebase-settings-btn').addEventListener('click', () => {
  const cfg = getFirebaseConfig();
  $('fb-db-url-input').value = cfg.databaseURL || '';
  $('fb-api-key-input').value = cfg.apiKey || '';
  $('fb-project-id-input').value = cfg.projectId || '';
  $('fb-config-status').style.display = 'none';
  openModal('firebase-settings-modal');
});

$('close-firebase-modal-btn').addEventListener('click', () => closeModal('firebase-settings-modal'));

$('save-firebase-config-btn').addEventListener('click', () => {
  const dbUrl = $('fb-db-url-input').value.trim();
  const apiKey = $('fb-api-key-input').value.trim();
  const projectId = $('fb-project-id-input').value.trim();

  saveFirebaseConfig({
    databaseURL: dbUrl,
    apiKey,
    projectId,
    authDomain: projectId ? `${projectId}.firebaseapp.com` : '',
    storageBucket: projectId ? `${projectId}.appspot.com` : ''
  });

  const statusEl = $('fb-config-status');
  statusEl.style.display = 'block';
  statusEl.textContent = '✓ Configuration saved! Re-connecting...';

  setTimeout(() => {
    closeModal('firebase-settings-modal');
  }, 1200);
});

