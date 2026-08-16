/**
 * Redux-style store with LocalStorage Auto-Save & Match Archive Middleware.
 */

const ACTIVE_MATCH_KEY = 'cric_active_match_v2';
const MATCH_ARCHIVE_KEY = 'cric_match_history_v2';

export function getArchivedMatches() {
  try {
    const raw = localStorage.getItem(MATCH_ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to parse archived matches:', e);
    return [];
  }
}

export function saveMatchToArchive(matchState) {
  try {
    const list = getArchivedMatches();
    const matchId = `match_${Date.now()}`;
    const archiveItem = {
      id: matchId,
      date: new Date().toISOString(),
      teamA: matchState.teams.teamA.name,
      teamB: matchState.teams.teamB.name,
      scoreA: `${matchState.teams.teamA.score}/${matchState.teams.teamA.wickets}`,
      scoreB: `${matchState.teams.teamB.score}/${matchState.teams.teamB.wickets}`,
      summary: matchState.matchResult?.summary || 'Match Finished',
      fullState: matchState
    };
    list.unshift(archiveItem);
    localStorage.setItem(MATCH_ARCHIVE_KEY, JSON.stringify(list.slice(0, 30)));
    return matchId;
  } catch (e) {
    console.warn('Failed to archive match:', e);
  }
}

export function deleteArchivedMatch(id) {
  try {
    const list = getArchivedMatches().filter(m => m.id !== id);
    localStorage.setItem(MATCH_ARCHIVE_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn('Failed to delete archived match:', e);
  }
}

export function createStore(reducer, initialState) {
  let loadedInitial = initialState;

  // Attempt to restore active session from localStorage
  try {
    const saved = localStorage.getItem(ACTIVE_MATCH_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.phase && parsed.phase !== 'SETUP') {
        loadedInitial = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to restore active match:', e);
  }

  let state = reducer(loadedInitial, { type: '@@INIT' });
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    dispatch(action) {
      const prevState = state;
      state = reducer(state, action);

      if (state !== prevState) {
        // Auto-save to LocalStorage
        try {
          if (state.phase === 'SETUP') {
            localStorage.removeItem(ACTIVE_MATCH_KEY);
          } else {
            localStorage.setItem(ACTIVE_MATCH_KEY, JSON.stringify(state));
          }

          // If match just reached RESULT phase, save into archive
          if (state.phase === 'RESULT' && prevState.phase !== 'RESULT') {
            saveMatchToArchive(state);
          }
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }

        listeners.forEach(fn => fn(state, prevState));
      }
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    clearActiveStorage() {
      try {
        localStorage.removeItem(ACTIVE_MATCH_KEY);
      } catch (e) {}
    }
  };
}
