/**
 * Match Scorecard Export & Share Engine
 * Provides image canvas snapshot generator, WhatsApp text formatting, and JSON export.
 */

import { formatOvers, calcRunRate } from './utils.js';

export function getWhatsAppScorecardText(state) {
  const bat1Key = state.battingFirst;
  const bat2Key = state.bowlingFirst;
  const team1 = state.teams[bat1Key];
  const team2 = state.teams[bat2Key];

  let text = `🏏 *CRICKET MATCH SCORECARD* 🏏\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📍 *${team1.name}* vs *${team2.name}*\n`;
  text += `⏱️ Format: ${state.totalOvers} Overs\n\n`;

  // 1st Innings
  text += `🔹 *1st Innings — ${team1.name}*\n`;
  text += `Score: *${team1.score}/${team1.wickets}* (${formatOvers(team1.ballsFaced)}/${state.totalOvers} ov, RR: ${calcRunRate(team1.score, team1.ballsFaced)})\n`;

  // Top Batters Innings 1
  const topBatters1 = (team1.batters || [])
    .filter(b => b.balls > 0 || b.status === 'BATTING' || b.status === 'OUT')
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 3);
  if (topBatters1.length > 0) {
    text += `Top Batters:\n`;
    topBatters1.forEach(b => {
      text += `  • ${b.name}: ${b.runs} (${b.balls}) [${b.fours}x4, ${b.sixes}x6]\n`;
    });
  }

  // Top Bowlers Innings 1
  const topBowlers1 = (team2.bowlers || [])
    .filter(bw => bw.ballsBowled > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
    .slice(0, 2);
  if (topBowlers1.length > 0) {
    text += `Top Bowlers:\n`;
    topBowlers1.forEach(bw => {
      text += `  • ${bw.name}: ${bw.wickets}/${bw.runsConceded} (${formatOvers(bw.ballsBowled)} ov)\n`;
    });
  }

  // 2nd Innings (if started)
  if (state.currentInnings === 2 || state.phase === 'RESULT') {
    text += `\n🔹 *2nd Innings — ${team2.name}*\n`;
    text += `Score: *${team2.score}/${team2.wickets}* (${formatOvers(team2.ballsFaced)}/${state.totalOvers} ov, RR: ${calcRunRate(team2.score, team2.ballsFaced)})\n`;

    const topBatters2 = (team2.batters || [])
      .filter(b => b.balls > 0 || b.status === 'BATTING' || b.status === 'OUT')
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 3);
    if (topBatters2.length > 0) {
      text += `Top Batters:\n`;
      topBatters2.forEach(b => {
        text += `  • ${b.name}: ${b.runs} (${b.balls}) [${b.fours}x4, ${b.sixes}x6]\n`;
      });
    }

    const topBowlers2 = (team1.bowlers || [])
      .filter(bw => bw.ballsBowled > 0)
      .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
      .slice(0, 2);
    if (topBowlers2.length > 0) {
      text += `Top Bowlers:\n`;
      topBowlers2.forEach(bw => {
        text += `  • ${bw.name}: ${bw.wickets}/${bw.runsConceded} (${formatOvers(bw.ballsBowled)} ov)\n`;
      });
    }
  }

  // Result
  if (state.matchResult) {
    text += `\n🏆 *RESULT: ${state.matchResult.summary}*\n`;
  }
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Scored on Cricket Scorer App ⚡`;

  return text;
}

export function exportScorecardImage(state) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const width = 800;
  const height = 900;

  canvas.width = width * 2;
  canvas.height = height * 2;
  ctx.scale(2, 2);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#070b14');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#070b14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Header border glow
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏏 MATCH SCORECARD SUMMARY', width / 2, 60);

  const bat1Key = state.battingFirst;
  const bat2Key = state.bowlingFirst;
  const team1 = state.teams[bat1Key];
  const team2 = state.teams[bat2Key];

  // Match info
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px Outfit, sans-serif';
  ctx.fillText(`${team1.name} vs ${team2.name} • ${state.totalOvers} Overs Match`, width / 2, 85);

  // Result Banner
  if (state.matchResult) {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fillRect(40, 105, width - 80, 45);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 105, width - 80, 45);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText(`🏆 ${state.matchResult.summary}`, width / 2, 134);
  }

  // Draw Innings 1 Card
  let y = 175;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(40, y, width - 80, 310);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.strokeRect(40, y, width - 80, 310);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px Outfit, sans-serif';
  ctx.fillText(`1st Innings: ${team1.name}`, 60, y + 30);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText(`${team1.score}/${team1.wickets} (${formatOvers(team1.ballsFaced)} ov)`, width - 60, y + 30);

  // Table header
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText('BATTER', 60, y + 65);
  ctx.textAlign = 'right';
  ctx.fillText('R', width - 260, y + 65);
  ctx.fillText('B', width - 200, y + 65);
  ctx.fillText('4s', width - 150, y + 65);
  ctx.fillText('6s', width - 100, y + 65);
  ctx.fillText('SR', width - 60, y + 65);

  let by = y + 90;
  (team1.batters || []).slice(0, 6).forEach(b => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '13px Outfit, sans-serif';
    ctx.fillText(`${b.name} ${b.status === 'OUT' ? `(${b.dismissal?.type || 'out'})` : b.status === 'BATTING' ? '*' : ''}`, 60, by);

    ctx.textAlign = 'right';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillText(String(b.runs), width - 260, by);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(String(b.balls), width - 200, by);
    ctx.fillText(String(b.fours), width - 150, by);
    ctx.fillText(String(b.sixes), width - 100, by);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0', width - 60, by);
    by += 26;
  });

  // Innings 2 Card
  y = 510;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(40, y, width - 80, 310);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.strokeRect(40, y, width - 80, 310);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 18px Outfit, sans-serif';
  ctx.fillText(`2nd Innings: ${team2.name}`, 60, y + 30);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText(`${team2.score}/${team2.wickets} (${formatOvers(team2.ballsFaced)} ov)`, width - 60, y + 30);

  // Table header
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText('BATTER', 60, y + 65);
  ctx.textAlign = 'right';
  ctx.fillText('R', width - 260, y + 65);
  ctx.fillText('B', width - 200, y + 65);
  ctx.fillText('4s', width - 150, y + 65);
  ctx.fillText('6s', width - 100, y + 65);
  ctx.fillText('SR', width - 60, y + 65);

  by = y + 90;
  (team2.batters || []).slice(0, 6).forEach(b => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '13px Outfit, sans-serif';
    ctx.fillText(`${b.name} ${b.status === 'OUT' ? `(${b.dismissal?.type || 'out'})` : b.status === 'BATTING' ? '*' : ''}`, 60, by);

    ctx.textAlign = 'right';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillText(String(b.runs), width - 260, by);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(String(b.balls), width - 200, by);
    ctx.fillText(String(b.fours), width - 150, by);
    ctx.fillText(String(b.sixes), width - 100, by);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0', width - 60, by);
    by += 26;
  });

  // Footer branding
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = '12px Outfit, sans-serif';
  ctx.fillText('Generated by Cricket Scorer • Ball-by-Ball Match Tracker', width / 2, height - 35);

  // Trigger Download
  const link = document.createElement('a');
  link.download = `scorecard-${team1.name}-vs-${team2.name}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
