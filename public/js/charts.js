/**
 * Canvas Chart Engine for Cricket Analytics
 * Renders high-DPI Worm Chart, Manhattan Chart, and Partnerships.
 */

export function renderWormChart(canvas, state) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth || 500;
  const height = 260;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const padLeft = 45;
  const padRight = 25;
  const padTop = 25;
  const padBottom = 35;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const totalOvers = state.totalOvers || 20;
  const bat1Key = state.battingFirst;
  const bat2Key = state.bowlingFirst;
  const team1 = state.teams[bat1Key];
  const team2 = state.teams[bat2Key];

  // Calculate cumulative points
  const getPoints = (oversHistory, liveOver) => {
    const points = [{ over: 0, score: 0, wicket: false }];
    let cumRuns = 0;

    oversHistory.forEach((ov, idx) => {
      cumRuns += ov.runs;
      points.push({
        over: idx + 1,
        score: cumRuns,
        wicket: ov.wickets > 0
      });
    });

    if (liveOver && liveOver.balls && liveOver.balls.length > 0) {
      const partialBalls = liveOver.legalDeliveries || 0;
      if (partialBalls > 0) {
        points.push({
          over: oversHistory.length + partialBalls / 6,
          score: cumRuns + (liveOver.runs || 0),
          wicket: (liveOver.wickets || 0) > 0
        });
      }
    }
    return points;
  };

  const points1 = getPoints(
    team1.oversHistory,
    state.currentInnings === 1 ? state.currentOver : null
  );

  const points2 = bat2Key && state.currentInnings === 2
    ? getPoints(team2.oversHistory, state.currentOver)
    : [];

  const maxScore = Math.max(
    50,
    team1.score,
    team2 ? team2.score : 0,
    state.target || 0
  );
  const yCeil = Math.ceil(maxScore / 25) * 25 + 10;

  // Draw Grid & Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';

  // Y-axis grid
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = Math.round((yCeil / ySteps) * i);
    const y = padTop + chartH - (val / yCeil) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();
    ctx.fillText(String(val), padLeft - 8, y + 4);
  }

  // X-axis grid (Overs)
  ctx.textAlign = 'center';
  const xStepOvers = totalOvers <= 10 ? 2 : totalOvers <= 20 ? 5 : 10;
  for (let o = 0; o <= totalOvers; o += xStepOvers) {
    const x = padLeft + (o / totalOvers) * chartW;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + chartH);
    ctx.stroke();
    ctx.fillText(`${o} ov`, x, padTop + chartH + 18);
  }

  // Draw target line if in 2nd innings
  if (state.target) {
    const targetY = padTop + chartH - (state.target / yCeil) * chartH;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, targetY);
    ctx.lineTo(padLeft + chartW, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'right';
    ctx.fillText(`Target: ${state.target}`, padLeft + chartW - 5, targetY - 6);
  }

  // Helper to draw curve
  const drawLine = (pts, color, glowColor) => {
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    pts.forEach((p, idx) => {
      const x = padLeft + (p.over / totalOvers) * chartW;
      const y = padTop + chartH - (p.score / yCeil) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Draw Wicket markers
    pts.forEach(p => {
      if (p.wicket) {
        const x = padLeft + (p.over / totalOvers) * chartW;
        const y = padTop + chartH - (p.score / yCeil) * chartH;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  };

  // Draw Team 1 Line (Blue/Cyan)
  drawLine(points1, '#38bdf8', 'rgba(56, 189, 248, 0.5)');

  // Draw Team 2 Line (Green/Lime)
  if (points2.length > 0) {
    drawLine(points2, '#22c55e', 'rgba(34, 197, 94, 0.5)');
  }
}

export function renderManhattanChart(canvas, state) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth || 500;
  const height = 240;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const padLeft = 40;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const totalOvers = state.totalOvers || 20;
  const bat1Key = state.battingFirst;
  const bat2Key = state.bowlingFirst;
  const team1 = state.teams[bat1Key];
  const team2 = state.teams[bat2Key];

  const overs1 = team1.oversHistory || [];
  const overs2 = team2 ? team2.oversHistory || [] : [];

  let maxOverRuns = 15;
  [...overs1, ...overs2].forEach(ov => {
    if (ov.runs > maxOverRuns) maxOverRuns = ov.runs;
  });
  const yCeil = Math.ceil(maxOverRuns / 6) * 6 + 2;

  // Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';

  for (let r = 0; r <= yCeil; r += 6) {
    const y = padTop + chartH - (r / yCeil) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();
    ctx.fillText(String(r), padLeft - 6, y + 3);
  }

  const slotW = chartW / totalOvers;
  const barW = Math.max(4, slotW * 0.4);

  // Draw Bars for each over
  for (let o = 0; o < totalOvers; o++) {
    const slotX = padLeft + o * slotW;

    // Team 1 Over
    if (overs1[o]) {
      const ov = overs1[o];
      const barH = (ov.runs / yCeil) * chartH;
      const x = slotX + slotW * 0.08;
      const y = padTop + chartH - barH;

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x, y, barW, barH);

      // Wickets badge on bar
      if (ov.wickets > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x + barW / 2, y - 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Team 2 Over
    if (overs2[o]) {
      const ov = overs2[o];
      const barH = (ov.runs / yCeil) * chartH;
      const x = slotX + slotW * 0.08 + barW + 2;
      const y = padTop + chartH - barH;

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, y, barW, barH);

      if (ov.wickets > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x + barW / 2, y - 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // X Axis label
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    if ((o + 1) % (totalOvers > 20 ? 5 : 2) === 0 || o === 0) {
      ctx.fillText(String(o + 1), slotX + slotW / 2, padTop + chartH + 16);
    }
  }
}
