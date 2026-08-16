/**
 * Pure Reducer — Complete Cricket Match Engine
 * Manages player rosters, striker rotation, bowling spells, dismissals,
 * extras breakdown, free hits, fall of wickets, commentary, and deep undo/redo.
 */

import { generateDefaultSquad } from './utils.js';
import { generateCommentary } from './commentary.js';

// ─── Factories ──────────────────────────────────────────────────────

export function createBatter(name) {
  return {
    name,
    status: 'YET_TO_BAT', // YET_TO_BAT | BATTING | OUT | RETIRED
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissal: null // { type, bowler, fielder, description }
  };
}

export function createBowler(name) {
  return {
    name,
    ballsBowled: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    wides: 0,
    noBalls: 0,
    dots: 0
  };
}

export function createTeam(name, squadNames = []) {
  const squad = squadNames.length > 0
    ? squadNames
    : generateDefaultSquad(name, 11);

  return {
    name,
    score: 0,
    wickets: 0,
    ballsFaced: 0, // legal deliveries
    oversHistory: [], // array of { runs, wickets, bowler, balls[] }
    batters: squad.map(n => createBatter(n)),
    bowlers: [], // dynamically added or initialized from squad
    fallOfWickets: [], // { wicketNumber, score, overStr, batterName }
    currentPartnership: { runs: 0, balls: 0, batter1: '', batter2: '' },
    partnerships: [],
    extras: {
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      penalty: 0,
      total: 0
    }
  };
}

export function createOver(bowler = '') {
  return {
    bowler,
    balls: [], // { type, value, legal, batter, bowler, commentary }
    legalDeliveries: 0,
    runs: 0,
    wickets: 0
  };
}

// ─── Initial State ──────────────────────────────────────────────────

export const initialState = {
  phase: 'SETUP', // SETUP | TOSS | OPENING_PLAYERS | INNINGS_1 | INNINGS_BREAK | INNINGS_2 | RESULT
  matchType: 'T20',
  totalOvers: 20,
  playersPerTeam: 11,
  maxOversPerBowler: 4,
  teams: {
    teamA: createTeam('Team A'),
    teamB: createTeam('Team B')
  },
  battingFirst: null, // 'teamA' or 'teamB'
  bowlingFirst: null,
  tossWinner: null,
  tossDecision: null, // 'bat' | 'bowl'
  currentInnings: 0,
  currentStriker: '',
  currentNonStriker: '',
  currentBowler: '',
  previousBowler: '',
  currentOver: createOver(),
  freeHit: false,
  target: null,
  matchResult: null, // { winner, winnerName, margin, summary }
  commentary: [],
  historyStack: [],
  redoStack: []
};

// ─── Helpers ────────────────────────────────────────────────────────

function getBattingKey(state) {
  return state.currentInnings === 1 ? state.battingFirst : state.bowlingFirst;
}

function getBowlingKey(state) {
  return state.currentInnings === 1 ? state.bowlingFirst : state.battingFirst;
}

function snapshotForHistory(state) {
  const { historyStack, redoStack, ...rest } = state;
  return JSON.parse(JSON.stringify(rest));
}

function ensureBowlerExists(bowlersList, bowlerName) {
  const exists = bowlersList.find(b => b.name.toLowerCase() === bowlerName.toLowerCase());
  if (exists) return bowlersList;
  return [...bowlersList, createBowler(bowlerName)];
}

function ensureBatterExists(battersList, batterName) {
  const exists = battersList.find(b => b.name.toLowerCase() === batterName.toLowerCase());
  if (exists) return battersList;
  return [...battersList, createBatter(batterName)];
}

/** Complete and archive an over, update maidens, switch strike, and check innings finish */
function completeOver(state) {
  const battingKey = getBattingKey(state);
  const bowlingKey = getBowlingKey(state);
  const battingTeam = state.teams[battingKey];
  const bowlingTeam = state.teams[bowlingKey];

  const isMaiden = state.currentOver.runs === 0 && state.currentOver.legalDeliveries === 6;

  // Update bowler maidens
  const updatedBowlers = (bowlingTeam.bowlers || []).map(bw => {
    if (bw.name === state.currentBowler && isMaiden) {
      return { ...bw, maidens: bw.maidens + 1 };
    }
    return bw;
  });

  const overSummary = {
    overNumber: battingTeam.oversHistory.length + 1,
    runs: state.currentOver.runs,
    wickets: state.currentOver.wickets,
    bowler: state.currentBowler,
    balls: [...state.currentOver.balls]
  };

  const updatedBattingTeam = {
    ...battingTeam,
    oversHistory: [...battingTeam.oversHistory, overSummary]
  };

  const updatedBowlingTeam = {
    ...bowlingTeam,
    bowlers: updatedBowlers
  };

  // Switch strike at end of over
  const nextStriker = state.currentNonStriker;
  const nextNonStriker = state.currentStriker;

  const newState = {
    ...state,
    teams: {
      ...state.teams,
      [battingKey]: updatedBattingTeam,
      [bowlingKey]: updatedBowlingTeam
    },
    previousBowler: state.currentBowler,
    currentBowler: '', // prompt for next bowler
    currentStriker: nextStriker,
    currentNonStriker: nextNonStriker,
    currentOver: createOver()
  };

  // Check if all scheduled overs are bowled
  if (updatedBattingTeam.oversHistory.length >= state.totalOvers) {
    return endInnings(newState);
  }

  return newState;
}

/** End an innings (either all out or overs completed) */
function endInnings(state) {
  const battingKey = getBattingKey(state);
  const battingTeam = state.teams[battingKey];
  let updatedBattingTeam = battingTeam;

  // Archive partial over if any balls
  if (state.currentOver.balls.length > 0) {
    const overSummary = {
      overNumber: battingTeam.oversHistory.length + 1,
      runs: state.currentOver.runs,
      wickets: state.currentOver.wickets,
      bowler: state.currentBowler,
      balls: [...state.currentOver.balls]
    };
    updatedBattingTeam = {
      ...battingTeam,
      oversHistory: [...battingTeam.oversHistory, overSummary]
    };
  }

  // Archive current partnership
  const closedPartnerships = [...(updatedBattingTeam.partnerships || [])];
  if (updatedBattingTeam.currentPartnership.runs > 0 || updatedBattingTeam.currentPartnership.balls > 0) {
    closedPartnerships.push({ ...updatedBattingTeam.currentPartnership });
  }

  updatedBattingTeam = {
    ...updatedBattingTeam,
    partnerships: closedPartnerships
  };

  const updatedState = {
    ...state,
    teams: {
      ...state.teams,
      [battingKey]: updatedBattingTeam
    },
    currentOver: createOver(),
    freeHit: false
  };

  if (state.currentInnings === 1) {
    return {
      ...updatedState,
      phase: 'INNINGS_BREAK',
      currentInnings: 2,
      target: updatedBattingTeam.score + 1,
      currentStriker: '',
      currentNonStriker: '',
      currentBowler: '',
      previousBowler: ''
    };
  } else {
    return endMatch(updatedState);
  }
}

/** Finish match and determine result / winner */
function endMatch(state) {
  const battingKey = getBattingKey(state);
  const battingTeam = state.teams[battingKey];
  let updatedBattingTeam = battingTeam;

  if (state.currentOver.balls.length > 0) {
    const overSummary = {
      overNumber: battingTeam.oversHistory.length + 1,
      runs: state.currentOver.runs,
      wickets: state.currentOver.wickets,
      bowler: state.currentBowler,
      balls: [...state.currentOver.balls]
    };
    updatedBattingTeam = {
      ...battingTeam,
      oversHistory: [...battingTeam.oversHistory, overSummary]
    };
  }

  const teams = { ...state.teams, [battingKey]: updatedBattingTeam };
  const bat1Key = state.battingFirst;
  const bat2Key = state.bowlingFirst;
  const team1 = teams[bat1Key];
  const team2 = teams[bat2Key];

  let matchResult;
  const maxWickets = state.playersPerTeam - 1;

  if (team2.score > team1.score) {
    const wicketsLeft = maxWickets - team2.wickets;
    matchResult = {
      winner: bat2Key,
      winnerName: team2.name,
      margin: `${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`,
      summary: `${team2.name} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}!`
    };
  } else if (team1.score > team2.score) {
    const runDiff = team1.score - team2.score;
    matchResult = {
      winner: bat1Key,
      winnerName: team1.name,
      margin: `${runDiff} run${runDiff !== 1 ? 's' : ''}`,
      summary: `${team1.name} won by ${runDiff} run${runDiff !== 1 ? 's' : ''}!`
    };
  } else {
    matchResult = {
      winner: null,
      winnerName: null,
      margin: null,
      summary: 'Match Tied! 🤝 (Super Over Eligible)'
    };
  }

  return {
    ...state,
    teams,
    phase: 'RESULT',
    matchResult,
    currentOver: createOver()
  };
}

// ─── Main Reducer ───────────────────────────────────────────────────

export function reducer(state = initialState, action) {
  switch (action.type) {

    // ── 1. Match Initialization ─────────────────────────────────────
    case 'START_MATCH': {
      const {
        teamA = 'Team A',
        teamB = 'Team B',
        totalOvers = 20,
        playersPerTeam = 11,
        maxOversPerBowler = 4,
        squadA = [],
        squadB = [],
        matchType = 'T20'
      } = action.payload || {};

      const overs = Math.max(1, parseInt(totalOvers, 10) || 20);
      const players = Math.max(2, parseInt(playersPerTeam, 10) || 11);
      const maxBowlerOvers = Math.max(1, parseInt(maxOversPerBowler, 10) || Math.ceil(overs / 5));

      return {
        ...initialState,
        phase: 'TOSS',
        matchType,
        totalOvers: overs,
        playersPerTeam: players,
        maxOversPerBowler: maxBowlerOvers,
        teams: {
          teamA: createTeam(teamA, squadA),
          teamB: createTeam(teamB, squadB)
        }
      };
    }

    // ── 2. Toss Selection ───────────────────────────────────────────
    case 'SET_TOSS': {
      const { battingFirstKey, elected = 'bat' } = action.payload;
      const bowlingFirstKey = battingFirstKey === 'teamA' ? 'teamB' : 'teamA';
      const tossWinner = battingFirstKey;

      return {
        ...state,
        phase: 'OPENING_PLAYERS',
        battingFirst: battingFirstKey,
        bowlingFirst: bowlingFirstKey,
        tossWinner,
        tossDecision: elected,
        currentInnings: 1
      };
    }

    // ── 3. Opening Players Setup ────────────────────────────────────
    case 'SET_OPENING_PLAYERS': {
      const { strikerName, nonStrikerName, bowlerName } = action.payload;
      const battingKey = getBattingKey(state);
      const bowlingKey = getBowlingKey(state);

      let battingTeam = state.teams[battingKey];
      let bowlingTeam = state.teams[bowlingKey];

      // Ensure batters exist & set status to BATTING
      let batters = ensureBatterExists(battingTeam.batters, strikerName);
      batters = ensureBatterExists(batters, nonStrikerName);

      batters = batters.map(b => {
        if (b.name === strikerName || b.name === nonStrikerName) {
          return { ...b, status: 'BATTING' };
        }
        return b;
      });

      // Ensure bowler exists
      const bowlers = ensureBowlerExists(bowlingTeam.bowlers || [], bowlerName);

      const updatedBattingTeam = {
        ...battingTeam,
        batters,
        currentPartnership: { runs: 0, balls: 0, batter1: strikerName, batter2: nonStrikerName }
      };

      const updatedBowlingTeam = {
        ...bowlingTeam,
        bowlers
      };

      return {
        ...state,
        phase: 'INNINGS_1',
        currentStriker: strikerName,
        currentNonStriker: nonStrikerName,
        currentBowler: bowlerName,
        teams: {
          ...state.teams,
          [battingKey]: updatedBattingTeam,
          [bowlingKey]: updatedBowlingTeam
        },
        currentOver: createOver(bowlerName)
      };
    }

    // ── 4. Record Ball (Runs off Bat / Dots / Boundaries) ────────────
    case 'RECORD_BALL': {
      if (state.phase !== 'INNINGS_1' && state.phase !== 'INNINGS_2') return state;

      const runs = parseInt(action.payload.runs, 10) || 0;
      const battingKey = getBattingKey(state);
      const bowlingKey = getBowlingKey(state);
      const battingTeam = state.teams[battingKey];
      const bowlingTeam = state.teams[bowlingKey];

      const history = [...state.historyStack, snapshotForHistory(state)].slice(-100);

      // Commentary
      const comm = generateCommentary({
        overNumber: battingTeam.oversHistory.length,
        ballNumber: state.currentOver.legalDeliveries + 1,
        bowlerName: state.currentBowler,
        batterName: state.currentStriker,
        ballType: 'RUN',
        runs,
        isFreeHit: state.freeHit
      });

      const ball = {
        type: 'RUN',
        value: runs,
        legal: true,
        batter: state.currentStriker,
        bowler: state.currentBowler,
        isFreeHit: state.freeHit
      };

      // Update Batter stats
      const updatedBatters = (battingTeam.batters || []).map(b => {
        if (b.name === state.currentStriker) {
          return {
            ...b,
            runs: b.runs + runs,
            balls: b.balls + 1,
            fours: b.fours + (runs === 4 ? 1 : 0),
            sixes: b.sixes + (runs === 6 ? 1 : 0)
          };
        }
        return b;
      });

      // Update Bowler stats
      const updatedBowlers = (bowlingTeam.bowlers || []).map(bw => {
        if (bw.name === state.currentBowler) {
          return {
            ...bw,
            ballsBowled: bw.ballsBowled + 1,
            runsConceded: bw.runsConceded + runs,
            dots: bw.dots + (runs === 0 ? 1 : 0)
          };
        }
        return bw;
      });

      // Update Partnership
      const updatedPartnership = {
        ...battingTeam.currentPartnership,
        runs: battingTeam.currentPartnership.runs + runs,
        balls: battingTeam.currentPartnership.balls + 1
      };

      const newOver = {
        ...state.currentOver,
        bowler: state.currentBowler,
        balls: [...state.currentOver.balls, ball],
        legalDeliveries: state.currentOver.legalDeliveries + 1,
        runs: state.currentOver.runs + runs
      };

      const newBattingTeam = {
        ...battingTeam,
        score: battingTeam.score + runs,
        ballsFaced: battingTeam.ballsFaced + 1,
        batters: updatedBatters,
        currentPartnership: updatedPartnership
      };

      const newBowlingTeam = {
        ...bowlingTeam,
        bowlers: updatedBowlers
      };

      // Strike rotation on odd runs (1, 3, 5)
      let newStriker = state.currentStriker;
      let newNonStriker = state.currentNonStriker;
      if (runs % 2 !== 0) {
        newStriker = state.currentNonStriker;
        newNonStriker = state.currentStriker;
      }

      let newState = {
        ...state,
        teams: {
          ...state.teams,
          [battingKey]: newBattingTeam,
          [bowlingKey]: newBowlingTeam
        },
        currentOver: newOver,
        currentStriker: newStriker,
        currentNonStriker: newNonStriker,
        freeHit: false, // consumed on legal delivery
        commentary: [comm, ...state.commentary].slice(0, 200),
        historyStack: history,
        redoStack: []
      };

      // Check 2nd innings target chased
      if (state.currentInnings === 2 && newBattingTeam.score >= state.target) {
        return endMatch(newState);
      }

      // Check Over completion
      if (newOver.legalDeliveries === 6) {
        newState = completeOver(newState);
      }

      return newState;
    }

    // ── 5. Record Extra (Wide, No-Ball, Byes, Leg Byes, Penalty) ────
    case 'RECORD_EXTRA': {
      if (state.phase !== 'INNINGS_1' && state.phase !== 'INNINGS_2') return state;

      const { extraType, runs = 1, isLegal = false } = action.payload;
      const battingKey = getBattingKey(state);
      const bowlingKey = getBowlingKey(state);
      const battingTeam = state.teams[battingKey];
      const bowlingTeam = state.teams[bowlingKey];

      const history = [...state.historyStack, snapshotForHistory(state)].slice(-100);

      const isWide = extraType === 'WIDE';
      const isNoBall = extraType === 'NOBALL';
      const isBye = extraType === 'BYE';
      const isLegBye = extraType === 'LEGBYE';
      const isPenalty = extraType === 'PENALTY';

      const isLegalBall = isBye || isLegBye;

      // Commentary
      const comm = generateCommentary({
        overNumber: battingTeam.oversHistory.length,
        ballNumber: state.currentOver.legalDeliveries + (isLegalBall ? 1 : 0),
        bowlerName: state.currentBowler,
        batterName: state.currentStriker,
        ballType: extraType,
        runs,
        isFreeHit: state.freeHit
      });

      const ball = {
        type: extraType,
        value: runs,
        legal: isLegalBall,
        batter: state.currentStriker,
        bowler: state.currentBowler
      };

      // Extras Breakdown
      const currentExtras = battingTeam.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 };
      const updatedExtras = {
        ...currentExtras,
        wides: currentExtras.wides + (isWide ? runs : 0),
        noBalls: currentExtras.noBalls + (isNoBall ? runs : 0),
        byes: currentExtras.byes + (isBye ? runs : 0),
        legByes: currentExtras.legByes + (isLegBye ? runs : 0),
        penalty: currentExtras.penalty + (isPenalty ? runs : 0),
        total: currentExtras.total + runs
      };

      // Batter stats (balls faced increases on Byes & Leg Byes, but runs do NOT go to batter)
      const updatedBatters = (battingTeam.batters || []).map(b => {
        if (b.name === state.currentStriker && isLegalBall) {
          return { ...b, balls: b.balls + 1 };
        }
        return b;
      });

      // Bowler stats (concedes runs on Wides and No-Balls, but NOT on Byes / Leg Byes / Penalty)
      const runsConcededByBowler = (isWide || isNoBall) ? runs : 0;
      const updatedBowlers = (bowlingTeam.bowlers || []).map(bw => {
        if (bw.name === state.currentBowler) {
          return {
            ...bw,
            ballsBowled: bw.ballsBowled + (isLegalBall ? 1 : 0),
            runsConceded: bw.runsConceded + runsConcededByBowler,
            wides: bw.wides + (isWide ? runs : 0),
            noBalls: bw.noBalls + (isNoBall ? 1 : 0)
          };
        }
        return bw;
      });

      // Strike rotation on odd running runs
      let newStriker = state.currentStriker;
      let newNonStriker = state.currentNonStriker;
      if (runs % 2 !== 0) {
        newStriker = state.currentNonStriker;
        newNonStriker = state.currentStriker;
      }

      const newOver = {
        ...state.currentOver,
        bowler: state.currentBowler,
        balls: [...state.currentOver.balls, ball],
        legalDeliveries: state.currentOver.legalDeliveries + (isLegalBall ? 1 : 0),
        runs: state.currentOver.runs + runs
      };

      const newBattingTeam = {
        ...battingTeam,
        score: battingTeam.score + runs,
        ballsFaced: battingTeam.ballsFaced + (isLegalBall ? 1 : 0),
        batters: updatedBatters,
        extras: updatedExtras,
        currentPartnership: {
          ...battingTeam.currentPartnership,
          runs: battingTeam.currentPartnership.runs + runs,
          balls: battingTeam.currentPartnership.balls + (isLegalBall ? 1 : 0)
        }
      };

      const newBowlingTeam = {
        ...bowlingTeam,
        bowlers: updatedBowlers
      };

      let newState = {
        ...state,
        teams: {
          ...state.teams,
          [battingKey]: newBattingTeam,
          [bowlingKey]: newBowlingTeam
        },
        currentOver: newOver,
        currentStriker: newStriker,
        currentNonStriker: newNonStriker,
        freeHit: isNoBall ? true : isLegalBall ? false : state.freeHit,
        commentary: [comm, ...state.commentary].slice(0, 200),
        historyStack: history,
        redoStack: []
      };

      // Check 2nd innings target chased
      if (state.currentInnings === 2 && newBattingTeam.score >= state.target) {
        return endMatch(newState);
      }

      // Check over completion
      if (newOver.legalDeliveries === 6) {
        newState = completeOver(newState);
      }

      return newState;
    }

    // ── 6. Record Wicket ────────────────────────────────────────────
    case 'RECORD_WICKET': {
      if (state.phase !== 'INNINGS_1' && state.phase !== 'INNINGS_2') return state;

      const {
        dismissalType = 'Bowled',
        dismissedBatter = state.currentStriker,
        fielder = '',
        bowlerCredit = true,
        runsCompleted = 0,
        nextBatter = ''
      } = action.payload || {};

      const battingKey = getBattingKey(state);
      const bowlingKey = getBowlingKey(state);
      const battingTeam = state.teams[battingKey];
      const bowlingTeam = state.teams[bowlingKey];

      const history = [...state.historyStack, snapshotForHistory(state)].slice(-100);

      // Description
      let dismissalDesc = dismissalType;
      if (dismissalType === 'Caught') {
        dismissalDesc = fielder ? `c ${fielder} b ${state.currentBowler}` : `c & b ${state.currentBowler}`;
      } else if (dismissalType === 'Bowled') {
        dismissalDesc = `b ${state.currentBowler}`;
      } else if (dismissalType === 'LBW') {
        dismissalDesc = `lbw b ${state.currentBowler}`;
      } else if (dismissalType === 'Stumped') {
        dismissalDesc = fielder ? `st ${fielder} b ${state.currentBowler}` : `st b ${state.currentBowler}`;
      } else if (dismissalType === 'Run Out') {
        dismissalDesc = fielder ? `run out (${fielder})` : `run out`;
      } else if (dismissalType === 'Hit Wicket') {
        dismissalDesc = `hit wicket b ${state.currentBowler}`;
      }

      const isBowlerWicket = bowlerCredit && dismissalType !== 'Run Out' && dismissalType !== 'Retired Hurt';

      // Commentary
      const comm = generateCommentary({
        overNumber: battingTeam.oversHistory.length,
        ballNumber: state.currentOver.legalDeliveries + 1,
        bowlerName: state.currentBowler,
        batterName: dismissedBatter,
        ballType: 'WICKET',
        runs: runsCompleted,
        dismissalType
      });

      const ball = {
        type: 'WICKET',
        value: runsCompleted,
        legal: true,
        runsScored: runsCompleted,
        batter: dismissedBatter,
        bowler: state.currentBowler,
        dismissal: { type: dismissalType, fielder, bowler: state.currentBowler, description: dismissalDesc }
      };

      // Update Batters
      let updatedBatters = (battingTeam.batters || []).map(b => {
        if (b.name === dismissedBatter) {
          return {
            ...b,
            status: 'OUT',
            runs: b.runs + (dismissedBatter === state.currentStriker ? runsCompleted : 0),
            balls: b.balls + 1,
            dismissal: { type: dismissalType, fielder, bowler: state.currentBowler, description: dismissalDesc }
          };
        }
        return b;
      });

      // If next batter provided, set them to BATTING
      if (nextBatter) {
        updatedBatters = ensureBatterExists(updatedBatters, nextBatter);
        updatedBatters = updatedBatters.map(b => {
          if (b.name === nextBatter) {
            return { ...b, status: 'BATTING' };
          }
          return b;
        });
      }

      // Update Bowlers
      const updatedBowlers = (bowlingTeam.bowlers || []).map(bw => {
        if (bw.name === state.currentBowler) {
          return {
            ...bw,
            ballsBowled: bw.ballsBowled + 1,
            runsConceded: bw.runsConceded + runsCompleted,
            wickets: bw.wickets + (isBowlerWicket ? 1 : 0),
            dots: bw.dots + (runsCompleted === 0 ? 1 : 0)
          };
        }
        return bw;
      });

      const newWickets = battingTeam.wickets + 1;
      const completedLegalBalls = battingTeam.ballsFaced + 1;
      const overStr = `${Math.floor(completedLegalBalls / 6)}.${completedLegalBalls % 6}`;

      // Fall of Wickets entry
      const fowEntry = {
        wicketNumber: newWickets,
        score: battingTeam.score + runsCompleted,
        overStr,
        batterName: dismissedBatter
      };

      // Archive partnership
      const updatedPartnerships = [...(battingTeam.partnerships || []), {
        ...battingTeam.currentPartnership,
        runs: battingTeam.currentPartnership.runs + runsCompleted,
        balls: battingTeam.currentPartnership.balls + 1
      }];

      // Determine remaining and incoming batters
      let newStriker = state.currentStriker;
      let newNonStriker = state.currentNonStriker;

      if (dismissedBatter === state.currentStriker) {
        newStriker = nextBatter;
      } else {
        newNonStriker = nextBatter;
      }

      // Strike rotation on odd runs before run out
      if (runsCompleted % 2 !== 0) {
        const temp = newStriker;
        newStriker = newNonStriker;
        newNonStriker = temp;
      }

      const newOver = {
        ...state.currentOver,
        bowler: state.currentBowler,
        balls: [...state.currentOver.balls, ball],
        legalDeliveries: state.currentOver.legalDeliveries + 1,
        runs: state.currentOver.runs + runsCompleted,
        wickets: state.currentOver.wickets + 1
      };

      const newBattingTeam = {
        ...battingTeam,
        score: battingTeam.score + runsCompleted,
        wickets: newWickets,
        ballsFaced: completedLegalBalls,
        batters: updatedBatters,
        fallOfWickets: [...(battingTeam.fallOfWickets || []), fowEntry],
        partnerships: updatedPartnerships,
        currentPartnership: { runs: 0, balls: 0, batter1: newStriker, batter2: newNonStriker }
      };

      const newBowlingTeam = {
        ...bowlingTeam,
        bowlers: updatedBowlers
      };

      let newState = {
        ...state,
        teams: {
          ...state.teams,
          [battingKey]: newBattingTeam,
          [bowlingKey]: newBowlingTeam
        },
        currentOver: newOver,
        currentStriker: newStriker,
        currentNonStriker: newNonStriker,
        freeHit: false,
        commentary: [comm, ...state.commentary].slice(0, 200),
        historyStack: history,
        redoStack: []
      };

      // Check all out (wickets reached maximum allowed)
      const maxWickets = state.playersPerTeam - 1;
      if (newWickets >= maxWickets) {
        return endInnings(newState);
      }

      // Check 2nd innings target chased
      if (state.currentInnings === 2 && newBattingTeam.score >= state.target) {
        return endMatch(newState);
      }

      // Check over completion
      if (newOver.legalDeliveries === 6) {
        newState = completeOver(newState);
      }

      return newState;
    }

    // ── 7. Manual Strike Swap ───────────────────────────────────────
    case 'SWAP_STRIKE': {
      if (state.phase !== 'INNINGS_1' && state.phase !== 'INNINGS_2') return state;
      const history = [...state.historyStack, snapshotForHistory(state)].slice(-100);

      return {
        ...state,
        currentStriker: state.currentNonStriker,
        currentNonStriker: state.currentStriker,
        historyStack: history,
        redoStack: []
      };
    }

    // ── 8. Change Bowler ────────────────────────────────────────────
    case 'CHANGE_BOWLER': {
      const { bowlerName } = action.payload;
      const bowlingKey = getBowlingKey(state);
      const bowlingTeam = state.teams[bowlingKey];
      const bowlers = ensureBowlerExists(bowlingTeam.bowlers || [], bowlerName);

      const history = [...state.historyStack, snapshotForHistory(state)].slice(-100);

      return {
        ...state,
        currentBowler: bowlerName,
        teams: {
          ...state.teams,
          [bowlingKey]: {
            ...bowlingTeam,
            bowlers
          }
        },
        currentOver: {
          ...state.currentOver,
          bowler: bowlerName
        },
        historyStack: history,
        redoStack: []
      };
    }

    // ── 9. Continue Innings (Start 2nd Innings) ──────────────────────
    case 'CONTINUE_INNINGS': {
      if (state.phase !== 'INNINGS_BREAK') return state;

      const { strikerName, nonStrikerName, bowlerName } = action.payload || {};
      const battingKey = getBattingKey(state);
      const bowlingKey = getBowlingKey(state);

      let battingTeam = state.teams[battingKey];
      let bowlingTeam = state.teams[bowlingKey];

      const sName = strikerName || battingTeam.batters[0]?.name || 'Batter 1';
      const nsName = nonStrikerName || battingTeam.batters[1]?.name || 'Batter 2';
      const bName = bowlerName || bowlingTeam.batters[0]?.name || 'Bowler 1';

      let batters = ensureBatterExists(battingTeam.batters, sName);
      batters = ensureBatterExists(batters, nsName);
      batters = batters.map(b => {
        if (b.name === sName || b.name === nsName) return { ...b, status: 'BATTING' };
        return b;
      });

      const bowlers = ensureBowlerExists(bowlingTeam.bowlers || [], bName);

      const updatedBattingTeam = {
        ...battingTeam,
        batters,
        currentPartnership: { runs: 0, balls: 0, batter1: sName, batter2: nsName }
      };

      const updatedBowlingTeam = {
        ...bowlingTeam,
        bowlers
      };

      return {
        ...state,
        phase: 'INNINGS_2',
        currentStriker: sName,
        currentNonStriker: nsName,
        currentBowler: bName,
        previousBowler: '',
        teams: {
          ...state.teams,
          [battingKey]: updatedBattingTeam,
          [bowlingKey]: updatedBowlingTeam
        },
        currentOver: createOver(bName)
      };
    }

    // ── 10. Deep Multi-Over Undo ────────────────────────────────────
    case 'UNDO_LAST': {
      if (state.historyStack.length === 0) return state;

      const prevSnapshot = state.historyStack[state.historyStack.length - 1];
      const remainingHistory = state.historyStack.slice(0, -1);
      const currentSnapshot = snapshotForHistory(state);

      return {
        ...prevSnapshot,
        historyStack: remainingHistory,
        redoStack: [currentSnapshot, ...state.redoStack].slice(0, 50)
      };
    }

    // ── 11. Redo ────────────────────────────────────────────────────
    case 'REDO_LAST': {
      if (state.redoStack.length === 0) return state;

      const nextSnapshot = state.redoStack[0];
      const remainingRedo = state.redoStack.slice(1);
      const currentSnapshot = snapshotForHistory(state);

      return {
        ...nextSnapshot,
        historyStack: [...state.historyStack, currentSnapshot],
        redoStack: remainingRedo
      };
    }

    // ── 12. Reset Match ─────────────────────────────────────────────
    case 'RESET_MATCH': {
      return { ...initialState };
    }

    // ── 13. Load Saved Match State ──────────────────────────────────
    case 'LOAD_MATCH_STATE': {
      return { ...action.payload };
    }

    default:
      return state;
  }
}
