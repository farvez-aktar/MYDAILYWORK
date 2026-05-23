/**
 * ═══════════════════════════════════════════════════════
 *  TIC-TAC-TOE — AI Game Engine
 *  Algorithm: Minimax with Alpha-Beta Pruning
 * ═══════════════════════════════════════════════════════
 *
 *  Minimax Overview:
 *  - Recursively evaluates all possible game states
 *  - Maximizer (AI/O) tries to MAXIMIZE the score
 *  - Minimizer (Human/X) tries to MINIMIZE the score
 *  - Terminal scores: Win=+10, Lose=-10, Draw=0
 *  - Depth penalty applied so AI prefers quicker wins
 *
 *  Alpha-Beta Pruning:
 *  - alpha = best score Maximizer can guarantee (starts at -∞)
 *  - beta  = best score Minimizer can guarantee (starts at +∞)
 *  - Branch pruned when alpha >= beta (no point exploring further)
 *  - Reduces O(b^d) to O(b^(d/2)) in the best case
 */

'use strict';

/* ══════════════════════════════════════════════
   GAME STATE
   ══════════════════════════════════════════════ */
const HUMAN = 'X';
const AI    = 'O';

let board       = Array(9).fill(null);  // null | 'X' | 'O'
let gameActive  = false;
let currentTurn = HUMAN;               // whose turn is it
let difficulty  = 'hard';             // 'easy' | 'hard'
let firstMove   = 'human';            // 'human' | 'ai'
let scores      = { human: 0, ai: 0, draws: 0 };
let aiThinking  = false;

// Win combinations: [index, index, index]
const WIN_LINES = [
  [0,1,2], [3,4,5], [6,7,8],   // rows
  [0,3,6], [1,4,7], [2,5,8],   // cols
  [0,4,8], [2,4,6]             // diagonals
];


/* ══════════════════════════════════════════════
   MINIMAX WITH ALPHA-BETA PRUNING
   ══════════════════════════════════════════════ */

/**
 * Evaluate terminal board state.
 * @param {Array} b - board array
 * @returns {number|null} +10 if AI wins, -10 if Human wins, 0 if draw, null if ongoing
 */
function evaluate(b) {
  for (const [a, c, d] of WIN_LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return b[a] === AI ? 10 : -10;
    }
  }
  if (b.every(cell => cell !== null)) return 0; // draw
  return null; // game ongoing
}

/**
 * Minimax with Alpha-Beta Pruning.
 *
 * @param {Array}   b           - board state (9-element array)
 * @param {number}  depth       - current search depth (for depth penalty)
 * @param {boolean} isMaximizing - true if it's AI's (maximizer) turn
 * @param {number}  alpha       - best score Maximizer can guarantee
 * @param {number}  beta        - best score Minimizer can guarantee
 * @returns {number} heuristic score of this board state
 */
function minimax(b, depth, isMaximizing, alpha, beta) {
  const score = evaluate(b);

  // Terminal state reached
  if (score !== null) {
    // Subtract depth so the AI wins fast and loses slowly
    return score === 0 ? 0 : score > 0 ? score - depth : score + depth;
  }

  if (isMaximizing) {
    // AI's turn: maximize
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = AI;
        const val = minimax(b, depth + 1, false, alpha, beta);
        b[i] = null;
        best = Math.max(best, val);
        alpha = Math.max(alpha, best);
        // Alpha-Beta Prune: Minimizer won't choose this branch
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    // Human's turn: minimize
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = HUMAN;
        const val = minimax(b, depth + 1, true, alpha, beta);
        b[i] = null;
        best = Math.min(best, val);
        beta = Math.min(beta, best);
        // Alpha-Beta Prune: Maximizer won't choose this branch
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

/**
 * Determine the best move for the AI using Minimax + Alpha-Beta.
 * @param {Array} b - current board
 * @returns {number} index of the best move
 */
function getBestMove(b) {
  // Easy mode: 40% chance of random move
  if (difficulty === 'easy' && Math.random() < 0.4) {
    const empty = b.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
    return empty[Math.floor(Math.random() * empty.length)];
  }

  let bestVal  = -Infinity;
  let bestMove = -1;

  for (let i = 0; i < 9; i++) {
    if (b[i] === null) {
      b[i] = AI;
      const moveVal = minimax(b, 0, false, -Infinity, Infinity);
      b[i] = null;
      if (moveVal > bestVal) {
        bestVal  = moveVal;
        bestMove = i;
      }
    }
  }
  return bestMove;
}


/* ══════════════════════════════════════════════
   GAME CONTROL
   ══════════════════════════════════════════════ */

function initGame() {
  board      = Array(9).fill(null);
  gameActive = true;
  currentTurn = (firstMove === 'human') ? HUMAN : AI;
  aiThinking  = false;

  // Clear UI
  for (let i = 0; i < 9; i++) {
    const cell = document.getElementById(`cell-${i}`);
    cell.innerHTML = '';
    cell.className = 'cell';
  }

  // Clear win canvas
  const canvas = document.getElementById('winCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateTurnHighlight();

  if (currentTurn === AI) {
    setStatus('🤖', '<strong>AI</strong> goes first — thinking…');
    setTimeout(() => makeAIMove(), 700);
  } else {
    setStatus('🎮', `Your move — place your <strong>${HUMAN}</strong>`);
  }
}

function newGame() {
  // Animate board reset
  const boardEl = document.getElementById('board');
  boardEl.style.opacity = '0.5';
  boardEl.style.transform = 'scale(0.97)';
  setTimeout(() => {
    boardEl.style.opacity = '1';
    boardEl.style.transform = 'scale(1)';
    initGame();
  }, 200);
  boardEl.style.transition = 'opacity 0.2s, transform 0.2s';
}

function resetScores() {
  scores = { human: 0, ai: 0, draws: 0 };
  animateScoreUpdate('scorePlayer', 0);
  animateScoreUpdate('scoreAI', 0);
  animateScoreUpdate('scoreDraws', 0);
  newGame();
}

function setDifficulty(mode) {
  difficulty = mode;
  document.getElementById('btnEasy').classList.toggle('active', mode === 'easy');
  document.getElementById('btnHard').classList.toggle('active', mode === 'hard');
  newGame();
}

function setFirstMove(who) {
  firstMove = who;
  document.getElementById('btnYouFirst').classList.toggle('active', who === 'human');
  document.getElementById('btnAIFirst').classList.toggle('active', who === 'ai');
  newGame();
}


/* ══════════════════════════════════════════════
   MOVE HANDLING
   ══════════════════════════════════════════════ */

function handleCellClick(index) {
  if (!gameActive || currentTurn !== HUMAN || board[index] !== null || aiThinking) {
    // Shake effect on invalid click
    if (!gameActive || board[index] !== null) {
      const boardEl = document.getElementById('board');
      boardEl.classList.remove('board-shake');
      void boardEl.offsetWidth; // reflow to restart animation
      boardEl.classList.add('board-shake');
      setTimeout(() => boardEl.classList.remove('board-shake'), 400);
    }
    return;
  }

  placeSymbol(index, HUMAN);
  const result = checkGameEnd();
  if (!result) {
    currentTurn = AI;
    updateTurnHighlight();
    setStatus('🤖', '<strong>AI</strong> is thinking…');
    aiThinking = true;
    // Small delay so the human sees their move before AI responds
    setTimeout(() => makeAIMove(), 450);
  }
}

function makeAIMove() {
  if (!gameActive) return;

  const move = getBestMove(board);
  if (move === -1) return;

  placeSymbol(move, AI);
  aiThinking = false;
  const result = checkGameEnd();
  if (!result) {
    currentTurn = HUMAN;
    updateTurnHighlight();
    setStatus('🎮', `Your move — place your <strong>${HUMAN}</strong>`);
  }
}

function placeSymbol(index, player) {
  board[index] = player;
  const cell = document.getElementById(`cell-${index}`);
  cell.classList.add('taken');

  const sym = document.createElement('span');
  sym.className = `symbol ${player.toLowerCase()}`;
  sym.textContent = player;
  cell.appendChild(sym);
}


/* ══════════════════════════════════════════════
   WIN / DRAW DETECTION
   ══════════════════════════════════════════════ */

function checkGameEnd() {
  // Check for win
  for (const line of WIN_LINES) {
    const [a, b2, c] = line;
    if (board[a] && board[a] === board[b2] && board[a] === board[c]) {
      const winner = board[a];
      handleWin(winner, line);
      return 'win';
    }
  }

  // Check for draw
  if (board.every(cell => cell !== null)) {
    handleDraw();
    return 'draw';
  }

  return null;
}

function handleWin(winner, winLine) {
  gameActive = false;

  // Highlight winning cells
  const isHumanWin = winner === HUMAN;
  winLine.forEach(i => {
    const cell = document.getElementById(`cell-${i}`);
    cell.classList.add('win-cell', isHumanWin ? 'win-cell-x' : 'win-cell-o');
  });

  // Draw strike-through line
  drawWinLine(winLine);

  // Block all cells
  for (let i = 0; i < 9; i++) {
    document.getElementById(`cell-${i}`).classList.add('blocked');
  }

  // Update score
  if (isHumanWin) {
    scores.human++;
    animateScoreUpdate('scorePlayer', scores.human);
    setStatus('🏆', '<strong>You win!</strong> Incredible!', 'pulse-win');
    showResult('🏆', 'You Win!', "You beat the AI! That's impressive.", '#btnReset');
  } else {
    scores.ai++;
    animateScoreUpdate('scoreAI', scores.ai);
    setStatus('🤖', '<strong>AI wins!</strong> Better luck next time.', 'pulse-lose');
    showResult('🤖', 'AI Wins!', 'The AI played a perfect game. Try again!', null);
  }
}

function handleDraw() {
  gameActive = false;
  scores.draws++;
  animateScoreUpdate('scoreDraws', scores.draws);
  setStatus('🤝', "<strong>It's a draw!</strong> Well played.", 'pulse-draw');

  for (let i = 0; i < 9; i++) {
    document.getElementById(`cell-${i}`).classList.add('blocked');
  }
  showResult('🤝', "It's a Draw!", "Neither side yielded. Perfect play from both!", null);
}


/* ══════════════════════════════════════════════
   CANVAS WIN LINE DRAWING
   ══════════════════════════════════════════════ */

function drawWinLine(winLine) {
  const canvas = document.getElementById('winCanvas');
  const ctx    = canvas.getContext('2d');
  const size   = canvas.width;   // 360 (or responsive)
  const cellSz = size / 3;

  // Get center coords for start and end cell
  const startIdx = winLine[0];
  const endIdx   = winLine[2];

  const getCenter = (idx) => ({
    x: (idx % 3) * cellSz + cellSz / 2,
    y: Math.floor(idx / 3) * cellSz + cellSz / 2
  });

  const start = getCenter(startIdx);
  const end   = getCenter(endIdx);

  // Extend line a bit beyond the cells
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx*dx + dy*dy);
  const ux = dx / len;
  const uy = dy / len;
  const ext = 32;

  const x1 = start.x - ux * ext;
  const y1 = start.y - uy * ext;
  const x2 = end.x   + ux * ext;
  const y2 = end.y   + uy * ext;

  // Animated draw
  let progress = 0;
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0,   'rgba(167,139,250,0.9)');
  gradient.addColorStop(0.5, 'rgba(56,189,248,0.9)');
  gradient.addColorStop(1,   'rgba(167,139,250,0.9)');

  function drawFrame() {
    ctx.clearRect(0, 0, size, size);
    progress = Math.min(progress + 0.07, 1);

    const cx = x1 + (x2 - x1) * progress;
    const cy = y1 + (y2 - y1) * progress;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = gradient;
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';
    ctx.shadowColor = 'rgba(167,139,250,0.7)';
    ctx.shadowBlur  = 16;
    ctx.stroke();

    if (progress < 1) requestAnimationFrame(drawFrame);
  }
  requestAnimationFrame(drawFrame);
}


/* ══════════════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════════════ */

function setStatus(icon, text, bannerClass = '') {
  document.getElementById('statusIcon').textContent = icon;
  document.getElementById('statusText').innerHTML   = text;
  const banner = document.getElementById('statusBanner');
  banner.className = 'status-banner';
  if (bannerClass) banner.classList.add(bannerClass);
}

function updateTurnHighlight() {
  document.getElementById('scorePlayerCard').classList.toggle('active-turn', currentTurn === HUMAN);
  document.getElementById('scoreAICard').classList.toggle('active-turn',    currentTurn === AI);
}

function animateScoreUpdate(elemId, newValue) {
  const el = document.getElementById(elemId);
  el.textContent = newValue;
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');
  setTimeout(() => el.classList.remove('score-pop'), 400);
}

/* ── Result Overlay ── */
function showResult(emoji, title, subtitle) {
  document.getElementById('resultEmoji').textContent    = emoji;
  document.getElementById('resultTitle').textContent    = title;
  document.getElementById('resultSubtitle').textContent = subtitle;

  setTimeout(() => {
    document.getElementById('resultOverlay').classList.add('visible');
  }, 800);
}

function closeOverlay() {
  document.getElementById('resultOverlay').classList.remove('visible');
}

function closeOverlayAndNewGame() {
  closeOverlay();
  setTimeout(() => newGame(), 300);
}

/* ── Algorithm Panel ── */
function toggleAlgoPanel() {
  const content = document.getElementById('algoContent');
  const chevron = document.getElementById('algoChevron');
  content.classList.toggle('open');
  chevron.classList.toggle('open');
}

/* ── Background Particles ── */
function createParticles() {
  const container = document.getElementById('bgParticles');
  const colors    = ['#a78bfa', '#38bdf8', '#f472b6', '#4ade80', '#facc15'];
  const count     = 20;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = Math.random() * 15 + 10;
    const delay    = Math.random() * 15;
    const left     = Math.random() * 100;

    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${left}%;
      bottom: -20px;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      box-shadow: 0 0 ${size * 2}px ${color};
    `;
    container.appendChild(p);
  }
}


/* ══════════════════════════════════════════════
   INITIALISATION
   ══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  initGame();

  // Handle responsive canvas size
  function resizeCanvas() {
    const board  = document.getElementById('board');
    const canvas = document.getElementById('winCanvas');
    const rect   = board.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
});
