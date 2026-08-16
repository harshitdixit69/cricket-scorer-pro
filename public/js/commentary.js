/**
 * Dynamic Cricket Commentary Generator
 * Generates broadcast-style live ball-by-ball descriptions.
 */

const COMMENTARY_TEMPLATES = {
  dot: [
    "{bowler} bowls full and straight, defended back down the pitch by {batter}.",
    "Good length outside off stump, {batter} shoulders arms, no run.",
    "Short of a length, punched straight to the cover fielder by {batter}.",
    "Beaten! Lovely seam movement from {bowler}, passes the outside edge!",
    "{bowler} darts one in on the pads, tapped to midwicket, no run.",
    "Slower ball on a good length, {batter} watches it closely into the keeper's gloves."
  ],
  single: [
    "Pushed into the gap at mid-on for a brisk single by {batter}.",
    "Guided down to third man with soft hands, easy single taken.",
    "Tucked off the hips towards deep square leg, {batter} trots through for one.",
    "Drives firmly to long-off, rotates the strike cleanly.",
    "Quick single called and taken! Direct hit would have been close."
  ],
  two: [
    "Nicely placed between deep point and third man, excellent running for TWO!",
    "Clipped through midwicket, good aggressive running puts pressure on the fielder, 2 runs!",
    "Drifting on the pads, whipped away into the deep for a comfortable couple."
  ],
  three: [
    "Cracking stroke through extra cover, good fielding on the rope saves the boundary, 3 runs!",
    "Superb placement into the vast gap in deep midwicket, batters sprint back for three!"
  ],
  four: [
    "🔥 FOUR! Bludgeoned through extra cover! Pure timing and placement from {batter}!",
    "⚡ FOUR! Short and punished! {batter} pulls it ferociously through square leg to the fence!",
    "🏏 FOUR! Classic straight drive! Right past the bowler, racing across the turf!",
    "💥 FOUR! Edged and flying past slip at the speed of light for a boundary!",
    "🎯 FOUR! Deft touch! Opens the face at the last second and guides it fine of third man!"
  ],
  six: [
    "🚀 SIX! HIGH, HANDSOME AND INTO THE STANDS! Massive hit from {batter}!",
    "💣 SIX! Smashed downtown! {bowler} pitches it up in the slot and pays the price!",
    "🌟 SIX! What a shot! Pick-up pull over deep square leg, cleared the roof!",
    "⚡ SIX! Dances down the track and lofts it cleanly over long-on for a MONSTER hit!",
    "🔥 SIX! Unbelievable power! That has gone all the way into the crowd!"
  ],
  wicket: [
    "OUT! 💥 TIMBER! {bowler} breaks through with a sensational delivery! {batter} has to walk!",
    "OUT! 🎯 In the air and CAUGHT! {batter} misjudges the shot and holes out in the deep!",
    "OUT! ⚡ Plumb in front! Huge appeal and the umpire raises the finger! LBW!",
    "OUT! 🏃 RUN OUT! Total chaos between the wickets and direct hit seals the dismissal!",
    "OUT! 🧤 EDGED AND TAKEN! Beautiful outswinger from {bowler}, keeper takes a neat catch!"
  ],
  wide: [
    "Wide ball signalled! Way too wide outside the off-stump from {bowler}.",
    "Fired down the leg-side, the umpire stretches the arms for a WIDE.",
    "Spilled down leg, extra run added to the total."
  ],
  noball: [
    "🚨 NO BALL! {bowler} oversteps the crease! FREE HIT coming up for {batter}!",
    "🚨 High full toss above the waist! Called a NO BALL! Free hit awarded next ball!"
  ],
  bye: [
    "Beats the bat and through the keeper's gloves, batters sneak a bye.",
    "Good bounce takes it over the keeper, byes conceded."
  ],
  legbye: [
    "Thuds into the front pad and deflects away to the leg side, single leg-bye taken.",
    "Off the thigh pad into the off side, batters scurry through for a leg-bye."
  ]
};

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateCommentary({
  overNumber,
  ballNumber,
  bowlerName,
  batterName,
  ballType,
  runs = 0,
  extraType = null,
  dismissalType = null,
  isFreeHit = false
}) {
  const bowler = bowlerName || 'Bowler';
  const batter = batterName || 'Batter';
  const ballStr = `${overNumber}.${ballNumber}`;

  let text = '';
  let highlight = 'normal';

  if (isFreeHit && ballType !== 'WICKET') {
    text = `[FREE HIT] `;
  }

  if (ballType === 'WICKET') {
    highlight = 'wicket';
    text += pickRandom(COMMENTARY_TEMPLATES.wicket);
  } else if (ballType === 'WIDE') {
    highlight = 'extra';
    text += pickRandom(COMMENTARY_TEMPLATES.wide);
    if (runs > 1) {
      text += ` + ${runs - 1} extra running runs!`;
    }
  } else if (ballType === 'NOBALL') {
    highlight = 'extra';
    text += pickRandom(COMMENTARY_TEMPLATES.noball);
    if (runs > 1) {
      text += ` + ${runs - 1} off the bat!`;
    }
  } else if (ballType === 'BYE') {
    highlight = 'extra';
    text += pickRandom(COMMENTARY_TEMPLATES.bye);
  } else if (ballType === 'LEGBYE') {
    highlight = 'extra';
    text += pickRandom(COMMENTARY_TEMPLATES.legbye);
  } else {
    if (runs === 0) {
      text += pickRandom(COMMENTARY_TEMPLATES.dot);
    } else if (runs === 1) {
      text += pickRandom(COMMENTARY_TEMPLATES.single);
    } else if (runs === 2) {
      text += pickRandom(COMMENTARY_TEMPLATES.two);
    } else if (runs === 3) {
      text += pickRandom(COMMENTARY_TEMPLATES.three);
    } else if (runs === 4) {
      highlight = 'four';
      text += pickRandom(COMMENTARY_TEMPLATES.four);
    } else if (runs === 6) {
      highlight = 'six';
      text += pickRandom(COMMENTARY_TEMPLATES.six);
    } else {
      text += `${runs} runs scored off the delivery by {batter}.`;
    }
  }

  const filledText = text
    .replace(/{bowler}/g, `<strong>${bowler}</strong>`)
    .replace(/{batter}/g, `<strong>${batter}</strong>`);

  return {
    ballStr,
    bowler,
    batter,
    text: filledText,
    highlight,
    timestamp: Date.now()
  };
}
