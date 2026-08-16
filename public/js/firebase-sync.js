/**
 * Universal Cloud Realtime Match Sync Engine
 * Powered by Zero-Config Cloud WebSockets (MQTT/WSS) + Optional Firebase Realtime DB + Local BroadcastChannel.
 * Enables instantaneous (<50ms) live scoring broadcast across any phone, laptop, or network worldwide.
 */

const FIREBASE_CONFIG_KEY = 'cric_firebase_custom_config_v2';
const ACTIVE_BROADCAST_MATCH_KEY = 'cric_active_broadcast_id';

// Cloud WebSocket Brokers (Public High-Availability MQTT over WebSockets)
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

let mqttClient = null;
let currentBrokerIndex = 0;
let broadcastChannel = null;
let subscribedTopic = null;
let updateCallback = null;
let connectionStatusCallback = null;
let lastPublishedPayload = null;

// Initialize cross-tab BroadcastChannel for zero-latency same-device tabs
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('cric_live_broadcast_channel');
  }
} catch (e) {
  console.warn('BroadcastChannel not available in this environment');
}

/**
 * Dynamically load MQTT client library with robust fallback
 */
async function loadMqttLibrary() {
  if (typeof window !== 'undefined' && window.mqtt && typeof window.mqtt.connect === 'function') {
    return window.mqtt;
  }

  return new Promise((resolve, reject) => {
    // Try vendor bundle first
    const script = document.createElement('script');
    script.src = 'js/vendor/mqtt.min.js';
    script.onload = () => {
      if (window.mqtt && typeof window.mqtt.connect === 'function') {
        resolve(window.mqtt);
      } else {
        loadCdnMqtt().then(resolve).catch(reject);
      }
    };
    script.onerror = () => {
      loadCdnMqtt().then(resolve).catch(reject);
    };
    document.head.appendChild(script);
  });
}

function loadCdnMqtt() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.3.5/dist/mqtt.min.js';
    script.onload = () => {
      if (window.mqtt && typeof window.mqtt.connect === 'function') {
        resolve(window.mqtt);
      } else {
        reject(new Error('MQTT library failed to initialize on window'));
      }
    };
    script.onerror = (e) => reject(new Error('Failed to load MQTT client from CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize or get active Cloud MQTT WebSocket Client
 */
export async function getCloudMqttClient() {
  if (mqttClient && mqttClient.connected) return mqttClient;

  try {
    const mqtt = await loadMqttLibrary();
    const brokerUrl = BROKERS[currentBrokerIndex];
    const clientId = `cric_${Math.random().toString(16).substring(2, 10)}`;

    if (mqttClient) {
      try { mqttClient.end(true); } catch (e) {}
    }

    notifyStatus('connecting', 'Connecting to Cloud Relay...');

    mqttClient = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
      keepalive: 30
    });

    mqttClient.on('connect', () => {
      console.log(`[LiveSync] Connected to Cloud WebSocket Relay: ${brokerUrl}`);
      notifyStatus('connected', 'Live Cloud Sync Active');

      // Re-subscribe if we had an active topic
      if (subscribedTopic) {
        mqttClient.subscribe(subscribedTopic, { qos: 1 }, (err) => {
          if (!err) console.log(`[LiveSync] Subscribed to topic: ${subscribedTopic}`);
        });
      }

      // If we are broadcasting, re-publish last retained state
      if (lastPublishedPayload && subscribedTopic) {
        mqttClient.publish(subscribedTopic, JSON.stringify(lastPublishedPayload), { qos: 1, retain: true });
      }
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const str = message.toString();
        const data = JSON.parse(str);
        if (data && data.matchState && typeof updateCallback === 'function') {
          console.log(`[LiveSync] Received live match packet for ${data.matchId} (${data.matchState.phase})`);
          updateCallback(data.matchState, data);
        }
      } catch (err) {
        console.warn('[LiveSync] Error parsing incoming match message:', err);
      }
    });

    mqttClient.on('error', (err) => {
      console.warn(`[LiveSync] Broker error on ${brokerUrl}:`, err.message);
      notifyStatus('error', 'Reconnecting...');
      // Try next broker
      currentBrokerIndex = (currentBrokerIndex + 1) % BROKERS.length;
    });

    mqttClient.on('offline', () => {
      notifyStatus('offline', 'Offline');
    });

    return mqttClient;
  } catch (err) {
    console.warn('[LiveSync] Failed to initialize Cloud MQTT Client:', err);
    notifyStatus('error', 'Using Local Channel');
    return null;
  }
}

function notifyStatus(status, label) {
  if (typeof connectionStatusCallback === 'function') {
    connectionStatusCallback(status, label);
  }
}

export function onConnectionStatusChange(fn) {
  connectionStatusCallback = fn;
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
 * Broadcast current match state to Cloud WebSockets & Local Channels
 */
export async function broadcastMatchState(matchId, matchState) {
  if (!matchId || !matchState) return;

  const normalizedId = normalizeMatchId(matchId);
  const topic = `cricket_scorer_pro/v2/${normalizedId}`;

  const payload = {
    matchId: normalizedId,
    lastUpdated: Date.now(),
    isLive: matchState.phase !== 'RESULT' && matchState.phase !== 'SETUP',
    matchState: matchState
  };

  lastPublishedPayload = payload;
  subscribedTopic = topic;

  // 1. Broadcast locally across same-browser tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'MATCH_UPDATE', payload });
    } catch (e) {}
  }

  // 2. Publish to Cloud WebSocket Relay (retained so new viewers get it immediately)
  try {
    const client = await getCloudMqttClient();
    if (client && client.connected) {
      client.publish(topic, JSON.stringify(payload), { qos: 1, retain: true });
    }
  } catch (err) {
    console.warn('[LiveSync] Error publishing to Cloud WebSocket:', err);
  }

  // 3. Publish to Optional Custom Firebase Realtime Database
  try {
    const fbDb = await getFirebaseDbInstance();
    if (fbDb) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
      const matchRef = ref(fbDb, `matches/${normalizedId}`);
      await set(matchRef, payload);
    }
  } catch (err) {
    console.warn('[LiveSync] Firebase publish error:', err);
  }
}

/**
 * Subscribe to real-time live updates for a match
 */
export async function subscribeToLiveMatch(matchId, onUpdate) {
  if (!matchId) return;
  const normalizedId = normalizeMatchId(matchId);
  const topic = `cricket_scorer_pro/v2/${normalizedId}`;

  subscribedTopic = topic;
  updateCallback = onUpdate;

  // 1. Listen on BroadcastChannel for instant local updates
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'MATCH_UPDATE' && event.data?.payload?.matchId === normalizedId) {
        console.log('[LiveSync] Local BroadcastChannel packet received');
        onUpdate(event.data.payload.matchState, event.data.payload);
      }
    };
  }

  // 2. Connect and subscribe to Cloud WebSocket Relay
  try {
    const client = await getCloudMqttClient();
    if (client) {
      if (client.connected) {
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (err) console.warn('[LiveSync] Subscription error:', err);
          else console.log(`[LiveSync] Subscribed to match stream: ${topic}`);
        });
      }
    }
  } catch (err) {
    console.warn('[LiveSync] Error subscribing to Cloud WebSocket:', err);
  }

  // 3. Listen on Optional Custom Firebase Realtime Database
  try {
    const fbDb = await getFirebaseDbInstance();
    if (fbDb) {
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
      const matchRef = ref(fbDb, `matches/${normalizedId}`);
      onValue(matchRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.matchState) {
          console.log('[LiveSync] Firebase Realtime DB packet received');
          onUpdate(data.matchState, data);
        }
      });
    }
  } catch (err) {
    console.warn('[LiveSync] Firebase listener error:', err);
  }
}

export function unsubscribeFromLiveMatch() {
  if (mqttClient && subscribedTopic) {
    try { mqttClient.unsubscribe(subscribedTopic); } catch (e) {}
  }
  subscribedTopic = null;
  updateCallback = null;
}

/**
 * Firebase Realtime Database Configuration Management
 */
export function getFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load custom Firebase config:', e);
  }

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

let firebaseDb = null;
async function getFirebaseDbInstance() {
  if (firebaseDb) return firebaseDb;
  const config = getFirebaseConfig();
  if (!config.databaseURL) return null;

  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp(config);
    firebaseDb = getDatabase(app);
    return firebaseDb;
  } catch (err) {
    console.warn('Firebase init error:', err);
    return null;
  }
}

/**
 * Helper: Shareable Link Constructor
 */
export function getShareableMatchUrl(matchId) {
  const origin = window.location.origin + window.location.pathname;
  return `${origin}?match=${encodeURIComponent(normalizeMatchId(matchId))}&view=live`;
}

/**
 * Active Match LocalStorage
 */
export function getActiveBroadcastId() {
  return localStorage.getItem(ACTIVE_BROADCAST_MATCH_KEY) || null;
}

export function setActiveBroadcastId(matchId) {
  if (matchId) {
    localStorage.setItem(ACTIVE_BROADCAST_MATCH_KEY, normalizeMatchId(matchId));
  } else {
    localStorage.removeItem(ACTIVE_BROADCAST_MATCH_KEY);
  }
}
