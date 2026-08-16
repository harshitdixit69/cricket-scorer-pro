/**
 * Pure utility / formatting helpers for Cricket Scorer.
 */

/** Convert total legal balls faced into cricket overs format: "4.3" */
export function formatOvers(legalBalls) {
  const completedOvers = Math.floor(legalBalls / 6);
  const remainingBalls = legalBalls % 6;
  return `${completedOvers}.${remainingBalls}`;
}

/** Current Run Rate = runs / (legalBalls converted to overs). */
export function calcRunRate(runs, legalBalls) {
  if (!legalBalls || legalBalls === 0) return '0.00';
  const overs = legalBalls / 6;
  return (runs / overs).toFixed(2);
}

/** Required Run Rate for 2nd innings chase. */
export function calcRequiredRunRate(target, currentScore, totalOvers, legalBallsBowled) {
  const totalBalls = totalOvers * 6;
  const remainingBalls = totalBalls - legalBallsBowled;
  if (remainingBalls <= 0) return '∞';
  const runsNeeded = target - currentScore;
  if (runsNeeded <= 0) return '0.00';
  const oversRemaining = remainingBalls / 6;
  return (runsNeeded / oversRemaining).toFixed(2);
}

/** Batter Strike Rate = (runs / balls) * 100 */
export function calcStrikeRate(runs, balls) {
  if (!balls || balls === 0) return '0.0';
  return ((runs / balls) * 100).toFixed(1);
}

/** Bowler Economy Rate = runs / overs */
export function calcEconomy(runs, ballsBowled) {
  if (!ballsBowled || ballsBowled === 0) return '0.00';
  const overs = ballsBowled / 6;
  return (runs / overs).toFixed(2);
}

/** Human-readable label for a single ball badge */
export function getBallLabel(ball) {
  if (!ball) return '?';
  if (ball.type === 'WICKET') {
    return ball.runsScored ? `W+${ball.runsScored}` : 'W';
  }
  if (ball.type === 'WIDE') {
    return ball.value > 1 ? `Wd+${ball.value - 1}` : 'Wd';
  }
  if (ball.type === 'NOBALL') {
    return ball.value > 1 ? `NB+${ball.value - 1}` : 'NB';
  }
  if (ball.type === 'BYE') {
    return `B${ball.value}`;
  }
  if (ball.type === 'LEGBYE') {
    return `LB${ball.value}`;
  }
  if (ball.type === 'PENALTY') {
    return `+${ball.value}P`;
  }
  return ball.value === 0 ? '•' : String(ball.value);
}

/** CSS class for color-coding a ball badge */
export function getBallClass(ball) {
  if (!ball) return '';
  switch (ball.type) {
    case 'RUN':
      if (ball.value === 0) return 'ball-dot';
      if (ball.value === 4) return 'ball-four';
      if (ball.value === 6) return 'ball-six';
      return 'ball-run';
    case 'WICKET':
      return 'ball-wicket';
    case 'WIDE':
    case 'NOBALL':
      return 'ball-extra';
    case 'BYE':
    case 'LEGBYE':
      return 'ball-bye';
    case 'PENALTY':
      return 'ball-penalty';
    default:
      return '';
  }
}

/** Generates default squad roster names if none entered */
export function generateDefaultSquad(teamName, count = 11) {
  const commonNames = {
    'India': ['Rohit', 'Gill', 'Kohli', 'Shreyas', 'Rahul', 'Hardik', 'Jadeja', 'Axar', 'Kuldeep', 'Bumrah', 'Siraj'],
    'Australia': ['Head', 'Warner', 'Smith', 'Labuschagne', 'Maxwell', 'Marsh', 'Carey', 'Cummins', 'Starc', 'Zampa', 'Hazlewood'],
    'England': ['Buttler', 'Salt', 'Root', 'Brook', 'Bairstow', 'Livingstone', 'Moeen', 'Curran', 'Rashid', 'Archer', 'Wood'],
    'Pakistan': ['Rizwan', 'Babar', 'Fakhar', 'Salman', 'Iftikhar', 'Shadab', 'Nawaz', 'Shaheen', 'Naseem', 'Rauf', 'Abrar'],
    'South Africa': ['de Kock', 'Bavuma', 'Markram', 'Klaasen', 'Miller', 'Jansen', 'Maharaj', 'Rabada', 'Nortje', 'Shamsi', 'Ngidi']
  };

  const matched = Object.keys(commonNames).find(k => teamName.toLowerCase().includes(k.toLowerCase()));
  if (matched) {
    return commonNames[matched].slice(0, count);
  }

  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push(`${teamName} Player ${i}`);
  }
  return list;
}

/** Calculate Player of the Match / MVP points */
export function calculateMVP(state) {
  const players = [];

  const processTeam = (teamKey) => {
    const team = state.teams[teamKey];
    if (!team) return;

    // Batters
    (team.batters || []).forEach(b => {
      let pts = b.runs * 1;
      pts += b.fours * 1;
      pts += b.sixes * 2;
      if (b.runs >= 50) pts += 15;
      if (b.runs >= 100) pts += 30;

      let p = players.find(x => x.name === b.name && x.team === team.name);
      if (!p) {
        p = { name: b.name, team: team.name, points: 0, runs: 0, balls: 0, wickets: 0, runsConceded: 0 };
        players.push(p);
      }
      p.points += pts;
      p.runs = b.runs;
      p.balls = b.balls;
    });

    // Bowlers
    (team.bowlers || []).forEach(bw => {
      let pts = bw.wickets * 25;
      pts += bw.maidens * 10;
      pts += bw.dots * 1;
      if (bw.wickets >= 3) pts += 15;
      if (bw.wickets >= 5) pts += 30;

      let p = players.find(x => x.name === bw.name && x.team === team.name);
      if (!p) {
        p = { name: bw.name, team: team.name, points: 0, runs: 0, balls: 0, wickets: 0, runsConceded: 0 };
        players.push(p);
      }
      p.points += pts;
      p.wickets = bw.wickets;
      p.runsConceded = bw.runsConceded;
    });
  };

  processTeam(state.battingFirst);
  processTeam(state.bowlingFirst);

  players.sort((a, b) => b.points - a.points);
  return players[0] || null;
}
