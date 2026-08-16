/**
 * Action creators for Cricket Scorer.
 * Complete action set covering all match events, player management, and undo/redo.
 */

export const startMatch = (config) => ({
  type: 'START_MATCH',
  payload: config // { teamA, teamB, totalOvers, playersPerTeam, maxOversPerBowler, squadA, squadB, matchType }
});

export const setToss = (battingFirstKey, elected) => ({
  type: 'SET_TOSS',
  payload: { battingFirstKey, elected }
});

export const setOpeningPlayers = (strikerName, nonStrikerName, bowlerName) => ({
  type: 'SET_OPENING_PLAYERS',
  payload: { strikerName, nonStrikerName, bowlerName }
});

export const recordBall = (runs) => ({
  type: 'RECORD_BALL',
  payload: { runs }
});

export const recordExtra = (extraType, runs = 1, isLegal = false) => ({
  type: 'RECORD_EXTRA',
  payload: { extraType, runs, isLegal } // extraType: 'WIDE' | 'NOBALL' | 'BYE' | 'LEGBYE' | 'PENALTY'
});

export const recordWicket = (wicketData) => ({
  type: 'RECORD_WICKET',
  payload: wicketData // { dismissalType, dismissedBatter, fielder, bowlerCredit, runsCompleted, nextBatter }
});

export const swapStrike = () => ({
  type: 'SWAP_STRIKE'
});

export const changeBowler = (bowlerName) => ({
  type: 'CHANGE_BOWLER',
  payload: { bowlerName }
});

export const retireBatter = (batterName, reason = 'Retired Hurt') => ({
  type: 'RETIRE_BATTER',
  payload: { batterName, reason }
});

export const continueInnings = (strikerName, nonStrikerName, bowlerName) => ({
  type: 'CONTINUE_INNINGS',
  payload: { strikerName, nonStrikerName, bowlerName }
});

export const undoLast = () => ({
  type: 'UNDO_LAST'
});

export const redoLast = () => ({
  type: 'REDO_LAST'
});

export const resetMatch = () => ({
  type: 'RESET_MATCH'
});

export const loadMatchState = (savedState) => ({
  type: 'LOAD_MATCH_STATE',
  payload: savedState
});
