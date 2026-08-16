/**
 * Firebase Realtime Database Live Match Sync Engine
 * Enables multi-device live match broadcasting, real-time spectator synchronization,
 * and cross-tab BroadcastChannel local synchronization.
 */

// Default / fallback Firebase configuration storage key
const FIREBASE_CONFIG_KEY = 'cric_firebase_custom_config_v2';
const ACTIVE_BROADCAST_MATCH_KEY = 'cric_active_broadcast_id';

let firebaseApp = null;
let firebaseDb = null;
let broadcastChannel = null;
let currentSubscribedMatchId = null;
let unsubscribeListener = null;

// Initialize cross-tab BroadcastChannel for zero-latency local / same-browser testing
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('cric_live_broadcast_channel');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment');
}

/**
 * Get active Firebase Config from localStorage or environment
 */
export function getFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load custom Firebase config:', e);
  }

  // Built-in default configuration placeholder
  return {
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  };
}

export function saveFirebaseConfig(config) {
  try {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    // Reset instances to reload
    firebaseApp = null;
    firebaseDb = null;
    return true;
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
    return false;
  }
}

export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig();
  return Boolean(cfg && cfg.databaseURL && cfg.databaseURL.trim().length > 0);
}

/**
 * Initialize Firebase dynamically via CDN modular SDK
 */
export async function getFirebaseDbInstance() {
  if (firebaseDb) return firebaseDb;

  const config = getFirebaseConfig();
  if (!config.databaseURL) {
    return null; // Local-only mode using BroadcastChannel
  }

  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

    const apps = getApps();
    firebaseApp = apps.length > 0 ? apps[0] : initializeApp(config);
    firebaseDb = getDatabase(firebaseApp);
    return firebaseDb;
  } catch (err) {
    console.warn('Firebase Realtime DB initialization notice (using BroadcastChannel sync):', err.message);
    return null;
  }
}

/**
 * Generate clean, human-readable 6-character Match Code
 */
export function generateMatchId(prefix = 'CRIC') {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomCode = '';
  for (let i = 0; i < 4; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomCode}`;
}

export function normalizeMatchId(raw) {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/**
 * Publish latest match state to Cloud & Local channels
 */
export async function broadcastMatchState(matchId, matchState) {
  if (!matchId || !matchState) return;

  const payload = {
    matchId,
    lastUpdated: Date.now(),
    isLive: matchState.phase !== 'RESULT' && matchState.phase !== 'SETUP',
    matchState: matchState
  };

  // 1. Broadcast locally across browser tabs / windows
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'MATCH_UPDATE', payload });
    } catch (e) {}
  }

  // 2. Publish to Firebase Realtime Database
  try {
    const db = await getFirebaseDbInstance();
    if (db) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
      const matchRef = ref(db, `matches/${matchId}`);
      await set(matchRef, payload);
    }
  } catch (err) {
    console.warn('Firebase publish error (state saved locally):', err);
  }
}

/**
 * Subscribe to real-time live updates for a match
 */
export async function subscribeToLiveMatch(matchId, onUpdate) {
  if (!matchId || typeof onUpdate !== 'function') return;

  currentSubscribedMatchId = matchId;

  // 1. Listen on BroadcastChannel for instant local updates
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'MATCH_UPDATE' && event.data?.payload?.matchId === matchId) {
        onUpdate(event.data.payload.matchState, event.data.payload);
      }
    };
  }

  // 2. Listen on Firebase Realtime Database
  try {
    const db = await getFirebaseDbInstance();
    if (db) {
      const { ref, onValue, off } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
      const matchRef = ref(db, `matches/${matchId}`);

      // Unsubscribe existing
      if (unsubscribeListener) {
        unsubscribeListener();
      }

      const callback = (snapshot) => {
        const data = snapshot.val();
        if (data && data.matchState) {
          onUpdate(data.matchState, data);
        }
      };

      onValue(matchRef, callback);
      unsubscribeListener = () => off(matchRef, 'value', callback);
    }
  } catch (err) {
    console.warn('Firebase listener notice:', err.message);
  }
}

export function unsubscribeFromLiveMatch() {
  if (unsubscribeListener) {
    try { unsubscribeListener(); } catch (e) {}
    unsubscribeListener = null;
  }
  currentSubscribedMatchId = null;
}

/**
 * Construct complete shareable match link
 */
export function getShareableMatchUrl(matchId) {
  const origin = window.location.origin + window.location.pathname;
  return `${origin}?match=${encodeURIComponent(matchId)}&view=live`;
}

/**
 * Manage Active Broadcast Match ID
 */
export function getActiveBroadcastId() {
  return localStorage.getItem(ACTIVE_BROADCAST_MATCH_KEY) || null;
}

export function setActiveBroadcastId(matchId) {
  if (matchId) {
    localStorage.setItem(ACTIVE_BROADCAST_MATCH_KEY, matchId);
  } else {
    localStorage.removeItem(ACTIVE_BROADCAST_MATCH_KEY);
  }
}
