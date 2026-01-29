
import { 
  GameMode, PlayerType, CoinType, CoinState, GamePhase, 
  Vector2, Entity, GameSettings, GameScore, Difficulty, PlayMode 
} from '../types';
import { 
  BOARD_SIZE, POCKET_RADIUS, CUSHION_WIDTH, PLAY_AREA_PADDING, 
  STRIKER_RADIUS, COIN_RADIUS, FRICTION, MAX_POWER, MIN_VELOCITY, 
  COLORS, WALL_BOUNCE, TURN_TIME_LIMIT, COLLISION_ITERATIONS 
} from '../constants';
import { resolveCollision, distance, normalize, scale, subtract, dot } from '../utils/physics';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; 
  decay: number;
  size: number;
  color: string;
  type: 'SPARK' | 'GHOST';
  ghostType?: CoinType;
}

export class CarromEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private entities: Entity[] = [];
  private striker: Entity;
  
  public phase: GamePhase = GamePhase.PLACING;
  public turn: CoinType = CoinType.WHITE;
  public score: GameScore = { white: 0, black: 0, queenPocketedBy: null, queenCovered: false, winner: null };
  public settings: GameSettings;
  
  private isDragging: boolean = false;
  private dragStart: Vector2 = { x: 0, y: 0 };
  private dragCurrent: Vector2 = { x: 0, y: 0 };
  
  private pocketedThisTurn: Entity[] = [];
  private pendingQueen: boolean = false;
  private queenPocketedThisTurn: boolean = false;
  private foulCommitted: boolean = false;
  
  private timeLeft: number = TURN_TIME_LIMIT;
  private lastTime: number = 0;
  private timerPaused: boolean = false;
  
  private particles: Particle[] = [];
  private surfacePattern: CanvasPattern | null = null;
  private framePattern: CanvasPattern | null = null;
  
  private hitSound: HTMLAudioElement;
  private pocketSound: HTMLAudioElement;

  private onGameStateChange: (state: { score: GameScore, turn: CoinType, phase: GamePhase, timeLeft: number, message?: string }) => void;
  // Added network sync callback property to store the network handler
  private onNetworkSync?: (type: string, payload: any) => void;

  // Updated constructor to accept 4 arguments to fix signature mismatch in GameCanvas.tsx
  constructor(
    canvas: HTMLCanvasElement, 
    settings: GameSettings, 
    onGameStateChange: (state: { score: GameScore, turn: CoinType, phase: GamePhase, timeLeft: number, message?: string }) => void,
    onNetworkSync?: (type: string, payload: any) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.settings = settings;
    this.onGameStateChange = onGameStateChange;
    this.onNetworkSync = onNetworkSync;

    this.hitSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-billiard-balls-impact-2294.mp3');
    this.pocketSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3');

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = BOARD_SIZE * dpr;
    this.canvas.height = BOARD_SIZE * dpr;
    this.ctx.scale(dpr, dpr);

    this.initPatterns();
    this.striker = this.createStriker();
    this.resetBoard();
    this.lastTime = performance.now();
  }

  private initPatterns() {
      const createPatternCanvas = (color: string, isDark: boolean) => {
          const pCanvas = document.createElement('canvas');
          pCanvas.width = 256;
          pCanvas.height = 256;
          const pCtx = pCanvas.getContext('2d')!;
          pCtx.fillStyle = color;
          pCtx.fillRect(0, 0, 256, 256);
          
          // Better wood grain
          pCtx.strokeStyle = isDark ? 'rgba(0,0,0,0.15)' : 'rgba(139, 69, 19, 0.05)';
          pCtx.lineWidth = 1;
          for(let i=0; i<40; i++) {
              pCtx.beginPath();
              const x = Math.random() * 256;
              pCtx.moveTo(x, 0);
              pCtx.bezierCurveTo(x + 20, 80, x - 20, 160, x + (Math.random()-0.5)*50, 256);
              pCtx.stroke();
          }
          return this.ctx.createPattern(pCanvas, 'repeat');
      };
      this.surfacePattern = createPatternCanvas(COLORS.BOARD_BG, false);
      this.framePattern = createPatternCanvas(COLORS.BOARD_BORDER, true);
  }

  private createStriker(): Entity {
    return {
      id: 'striker',
      type: CoinType.STRIKER,
      pos: { x: BOARD_SIZE / 2, y: BOARD_SIZE - CUSHION_WIDTH - PLAY_AREA_PADDING },
      vel: { x: 0, y: 0 },
      radius: STRIKER_RADIUS,
      mass: 3.5,
      state: CoinState.ACTIVE,
      color: COLORS.STRIKER
    };
  }

  private notifyUI(message?: string) {
    this.onGameStateChange({
      score: { ...this.score },
      turn: this.turn,
      phase: this.phase,
      timeLeft: this.timeLeft,
      message
    });
  }

  public resetBoard() {
    this.entities = [];
    this.particles = [];
    const cx = BOARD_SIZE / 2;
    const cy = BOARD_SIZE / 2;

    const addCoin = (type: CoinType, x: number, y: number) => {
      this.entities.push({
        id: Math.random().toString(36).substr(2, 9),
        type, pos: { x, y }, vel: { x: 0, y: 0 },
        radius: COIN_RADIUS, mass: 1.2, state: CoinState.ACTIVE,
        color: type === CoinType.WHITE ? COLORS.WHITE_COIN : 
               type === CoinType.BLACK ? COLORS.BLACK_COIN : COLORS.QUEEN
      });
    };

    addCoin(CoinType.QUEEN, cx, cy);
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60) * (Math.PI / 180);
      const dist = COIN_RADIUS * 2.05;
      const type = i % 2 === 0 ? CoinType.WHITE : CoinType.BLACK;
      addCoin(type, cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * (Math.PI / 180);
      const dist = COIN_RADIUS * 4.05; 
      let type = CoinType.WHITE;
      if ([1, 4, 5, 7, 10, 11].includes(i)) type = CoinType.BLACK;
      addCoin(type, cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
    }

    this.turn = CoinType.WHITE;
    this.score = { white: 0, black: 0, queenPocketedBy: null, queenCovered: false, winner: null };
    this.pendingQueen = false;
    this.resetBoardState();
  }

  private resetBoardState() {
    this.phase = GamePhase.PLACING;
    this.pocketedThisTurn = [];
    this.queenPocketedThisTurn = false;
    this.foulCommitted = false;
    this.timeLeft = TURN_TIME_LIMIT;
    this.timerPaused = false;
    this.lastTime = performance.now();
    
    const yPos = this.turn === CoinType.WHITE ? 
        BOARD_SIZE - CUSHION_WIDTH - PLAY_AREA_PADDING : 
        CUSHION_WIDTH + PLAY_AREA_PADDING;
    
    this.striker.pos = { x: BOARD_SIZE / 2, y: yPos };
    this.striker.vel = { x: 0, y: 0 };
    this.striker.state = CoinState.ACTIVE;
    this.notifyUI();

    if (this.settings.playMode === PlayMode.AI && this.turn === CoinType.BLACK) {
        this.timerPaused = true;
        setTimeout(() => this.runAI(), 800);
    }
  }

  private resetTurn() {
    this.resetBoardState();
  }

  public update() {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.updateParticles();

    if (!this.timerPaused && (this.phase === GamePhase.PLACING || this.phase === GamePhase.AIMING)) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
            this.handleTimeout();
            return;
        }
    }

    if (this.phase === GamePhase.SHOOTING) {
      let isAnyMoving = false;
      const allEntities = [...this.entities, this.striker];

      const iterations = COLLISION_ITERATIONS;
      for (let step = 0; step < iterations; step++) {
          allEntities.forEach(e => {
            if (e.state !== CoinState.ACTIVE) return;
            const speedSq = e.vel.x * e.vel.x + e.vel.y * e.vel.y;
            if (speedSq > MIN_VELOCITY * MIN_VELOCITY) {
              isAnyMoving = true;
              e.pos.x += e.vel.x / iterations;
              e.pos.y += e.vel.y / iterations;
              e.vel.x *= Math.pow(FRICTION, 1 / iterations);
              e.vel.y *= Math.pow(FRICTION, 1 / iterations);

              const r = e.radius;
              const min = CUSHION_WIDTH + r;
              const max = BOARD_SIZE - CUSHION_WIDTH - r;
              if (e.pos.x < min) { e.pos.x = min; e.vel.x *= -WALL_BOUNCE; }
              if (e.pos.x > max) { e.pos.x = max; e.vel.x *= -WALL_BOUNCE; }
              if (e.pos.y < min) { e.pos.y = min; e.vel.y *= -WALL_BOUNCE; }
              if (e.pos.y > max) { e.pos.y = max; e.vel.y *= -WALL_BOUNCE; }
            } else {
              e.vel.x = 0; e.vel.y = 0;
            }
          });

          for (let i = 0; i < allEntities.length; i++) {
            for (let j = i + 1; j < allEntities.length; j++) {
                const e1 = allEntities[i], e2 = allEntities[j];
                if (e1.state === CoinState.ACTIVE && e2.state === CoinState.ACTIVE) {
                    if (resolveCollision(e1, e2)) {
                        const impact = Math.abs(e1.vel.x) + Math.abs(e1.vel.y) + Math.abs(e2.vel.x) + Math.abs(e2.vel.y);
                        if (impact > 5 && this.settings.soundEnabled) {
                            this.hitSound.currentTime = 0;
                            this.hitSound.play().catch(() => {});
                        }
                    }
                }
            }
          }

          const pockets = [
            { x: POCKET_RADIUS + 5, y: POCKET_RADIUS + 5 },
            { x: BOARD_SIZE - POCKET_RADIUS - 5, y: POCKET_RADIUS + 5 },
            { x: POCKET_RADIUS + 5, y: BOARD_SIZE - POCKET_RADIUS - 5 },
            { x: BOARD_SIZE - POCKET_RADIUS - 5, y: BOARD_SIZE - POCKET_RADIUS - 5 }
          ];

          allEntities.forEach(e => {
            if (e.state === CoinState.ACTIVE) {
                for (const p of pockets) {
                    if (distance(e.pos, p) < POCKET_RADIUS * 1.05) {
                        this.handlePocket(e, p);
                    }
                }
            }
          });
      }

      if (!isAnyMoving) {
        this.phase = GamePhase.SETTLING;
        setTimeout(() => this.handleTurnEnd(), 300);
      }
    }
  }

  private handleTimeout() {
      this.notifyUI("Time's Up!");
      this.timerPaused = true;
      setTimeout(() => {
          this.turn = this.turn === CoinType.WHITE ? CoinType.BLACK : CoinType.WHITE;
          this.resetTurn();
      }, 1500);
  }

  private handlePocket(e: Entity, pocketPos: Vector2) {
    if (this.settings.soundEnabled) {
        this.pocketSound.currentTime = 0;
        this.pocketSound.play().catch(() => {});
    }
    
    this.createPocketGhost(e, pocketPos);

    e.state = CoinState.POCKETED;
    e.vel = { x: 0, y: 0 };
    e.pos = { x: -500, y: -500 };

    if (e.type === CoinType.STRIKER) {
        this.foulCommitted = true;
    } else {
        this.pocketedThisTurn.push(e);
        if (e.type === CoinType.QUEEN) this.queenPocketedThisTurn = true;
    }
  }

  private handleTurnEnd() {
    let turnContinues = false;
    let message = "";
    const myColor = this.turn;
    const myCoinsPocketed = this.pocketedThisTurn.filter(c => c.type === myColor);

    if (this.foulCommitted) {
        message = "STRIKER FOUL!";
        const myPocketedTotal = this.entities.filter(c => c.type === myColor && c.state === CoinState.POCKETED && !this.pocketedThisTurn.includes(c));
        if (myPocketedTotal.length > 0) {
            const coin = myPocketedTotal[0];
            coin.state = CoinState.ACTIVE;
            coin.pos = { x: BOARD_SIZE/2, y: BOARD_SIZE/2 };
            if (myColor === CoinType.WHITE) this.score.white = Math.max(0, this.score.white - 20);
            else this.score.black = Math.max(0, this.score.black - 20);
        }
        if (this.queenPocketedThisTurn) {
            const q = this.entities.find(c => c.type === CoinType.QUEEN);
            if (q) { q.state = CoinState.ACTIVE; q.pos = { x: BOARD_SIZE/2, y: BOARD_SIZE/2 }; }
        }
        turnContinues = false;
    } else {
        if (myCoinsPocketed.length > 0) turnContinues = true;

        if (this.pendingQueen) {
            if (myCoinsPocketed.length > 0) {
                this.score.queenCovered = true;
                this.score.queenPocketedBy = myColor;
                if (myColor === CoinType.WHITE) this.score.white += 50;
                else this.score.black += 50;
                message = "QUEEN COVERED!";
                this.pendingQueen = false;
            } else {
                const q = this.entities.find(c => c.type === CoinType.QUEEN);
                if (q) { q.state = CoinState.ACTIVE; q.pos = { x: BOARD_SIZE/2, y: BOARD_SIZE/2 }; }
                message = "QUEEN RETURNED";
                this.pendingQueen = false;
                turnContinues = false;
            }
        } else if (this.queenPocketedThisTurn) {
             if (myCoinsPocketed.length > 0) {
                 this.score.queenCovered = true;
                 this.score.queenPocketedBy = myColor;
                 if (myColor === CoinType.WHITE) this.score.white += 50;
                 else this.score.black += 50;
                 message = "QUEEN COVERED!";
             } else {
                 this.pendingQueen = true;
                 message = "COVER THE QUEEN!";
                 turnContinues = true;
             }
        }

        // Apply normal coin points
        myCoinsPocketed.forEach(() => {
            if (myColor === CoinType.WHITE) this.score.white += 20;
            else this.score.black += 20;
        });
    }

    const whiteRemaining = this.entities.filter(c => c.type === CoinType.WHITE && c.state === CoinState.ACTIVE).length;
    const blackRemaining = this.entities.filter(c => c.type === CoinType.BLACK && c.state === CoinState.ACTIVE).length;
    
    if (whiteRemaining === 0 && !this.pendingQueen) this.score.winner = 'White';
    else if (blackRemaining === 0 && !this.pendingQueen) this.score.winner = 'Black';

    if (this.score.winner) {
        this.notifyUI();
        return;
    }

    if (!turnContinues) this.turn = this.turn === CoinType.WHITE ? CoinType.BLACK : CoinType.WHITE;
    
    if (message) this.notifyUI(message);
    setTimeout(() => this.resetTurn(), message ? 1500 : 0);
  }

  public draw() {
    this.ctx.fillStyle = this.framePattern || COLORS.BOARD_BORDER;
    this.ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);
    
    // Frame inner shadow/cushion
    this.ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(CUSHION_WIDTH, CUSHION_WIDTH, BOARD_SIZE - CUSHION_WIDTH*2, BOARD_SIZE - CUSHION_WIDTH*2);

    const surfaceX = CUSHION_WIDTH, surfaceY = CUSHION_WIDTH;
    const surfaceW = BOARD_SIZE - CUSHION_WIDTH * 2, surfaceH = BOARD_SIZE - CUSHION_WIDTH * 2;
    const cx = BOARD_SIZE / 2, cy = BOARD_SIZE / 2;

    this.ctx.fillStyle = this.surfacePattern || COLORS.BOARD_BG;
    this.ctx.fillRect(surfaceX, surfaceY, surfaceW, surfaceH);

    this.drawBoardDesign();
    this.drawEntities();
    this.drawParticles();

    if (this.phase === GamePhase.AIMING && this.isDragging) this.drawAimGuide();
  }

  private drawBoardDesign() {
    const cx = BOARD_SIZE / 2, cy = BOARD_SIZE / 2;
    this.ctx.strokeStyle = COLORS.LINES;
    this.ctx.lineWidth = 1.2;

    // Corner Pockets (Black Moons)
    const corners = [[0,0], [BOARD_SIZE,0], [0,BOARD_SIZE], [BOARD_SIZE,BOARD_SIZE]];
    corners.forEach(([x,y]) => {
        this.ctx.fillStyle = COLORS.POCKET;
        this.ctx.beginPath();
        this.ctx.arc(x, y, POCKET_RADIUS + 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Inner rim
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    });

    // Baselines and Circles
    const drawSideDesign = (angle: number) => {
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        this.ctx.translate(-cx, -cy);

        const y1 = BOARD_SIZE - CUSHION_WIDTH - PLAY_AREA_PADDING;
        const y2 = y1 + 30;
        const xStart = CUSHION_WIDTH + PLAY_AREA_PADDING;
        const xEnd = BOARD_SIZE - CUSHION_WIDTH - PLAY_AREA_PADDING;

        // Double Baselines
        this.ctx.strokeStyle = COLORS.LINES;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath(); this.ctx.moveTo(xStart, y1); this.ctx.lineTo(xEnd, y1); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(xStart, y2); this.ctx.lineTo(xEnd, y2); this.ctx.stroke();

        // Red End Circles
        this.ctx.fillStyle = COLORS.MARKING_RED;
        this.ctx.beginPath(); this.ctx.arc(xStart, y1 + 15, 14, 0, Math.PI*2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(xEnd, y1 + 15, 14, 0, Math.PI*2); this.ctx.fill();
        
        // Inner detail for circles
        this.ctx.strokeStyle = COLORS.LINES;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath(); this.ctx.arc(xStart, y1 + 15, 14, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.arc(xEnd, y1 + 15, 14, 0, Math.PI*2); this.ctx.stroke();

        this.ctx.restore();
    };
    [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach(drawSideDesign);

    // Center Rose Pattern
    this.ctx.strokeStyle = COLORS.LINES;
    this.ctx.lineWidth = 1;
    // Outer Center Circle
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, COIN_RADIUS * 4.5, 0, Math.PI*2);
    this.ctx.stroke();
    
    // Decorative Rose/Star
    for(let i=0; i<12; i++) {
        const a = (i * 30) * Math.PI / 180;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + Math.cos(a) * COIN_RADIUS * 4.4, cy + Math.sin(a) * COIN_RADIUS * 4.4);
        this.ctx.stroke();
    }

    // Inner Queen Spot
    this.ctx.fillStyle = COLORS.MARKING_RED;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, COIN_RADIUS, 0, Math.PI*2);
    this.ctx.fill();
    this.ctx.strokeStyle = COLORS.LINES;
    this.ctx.stroke();

    // Diagonal Arrows (The "Champion" look)
    const arrowLen = 140;
    const arrowStartOffset = COIN_RADIUS * 5.5;
    const drawArrow = (angle: number) => {
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        
        this.ctx.strokeStyle = COLORS.LINES;
        this.ctx.lineWidth = 1.2;
        
        // Main diagonal line
        this.ctx.beginPath();
        this.ctx.moveTo(arrowStartOffset, arrowStartOffset);
        this.ctx.lineTo(arrowStartOffset + arrowLen, arrowStartOffset + arrowLen);
        this.ctx.stroke();
        
        // Arrow head near pocket
        this.ctx.beginPath();
        this.ctx.arc(arrowStartOffset + arrowLen + 10, arrowStartOffset + arrowLen + 10, 20, Math.PI, Math.PI*1.5);
        this.ctx.stroke();

        this.ctx.restore();
    };
    [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach(drawArrow);
  }

  private drawEntities() {
    const all = [...this.entities, this.striker];
    all.forEach(e => {
        if (e.state !== CoinState.ACTIVE) return;
        
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 3;
        this.ctx.shadowOffsetY = 3;

        const grad = this.ctx.createRadialGradient(
            e.pos.x - e.radius * 0.3, e.pos.y - e.radius * 0.3, e.radius * 0.1, 
            e.pos.x, e.pos.y, e.radius
        );
        
        if (e.type === CoinType.WHITE) { 
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#e0e0e0'); 
        } else if (e.type === CoinType.BLACK) { 
            grad.addColorStop(0, '#444444'); grad.addColorStop(1, '#000000'); 
        } else if (e.type === CoinType.QUEEN) { 
            grad.addColorStop(0, '#ff4d4d'); grad.addColorStop(1, '#8b0000'); 
        } else { 
            // Striker Detail
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.8, '#f5f5f5'); grad.addColorStop(1, '#dcdcdc');
        }

        this.ctx.beginPath();
        this.ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        // Striker Ring detail
        if (e.type === CoinType.STRIKER) {
            this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            // Optional decal on striker
            this.ctx.fillStyle = 'rgba(0,0,0,0.05)';
            this.ctx.beginPath();
            this.ctx.arc(e.pos.x, e.pos.y, e.radius * 0.7, 0, Math.PI*2);
            this.ctx.stroke();
        }

        this.ctx.restore();
    });
  }

  private drawAimGuide() {
    const powerVector = subtract(this.dragStart, this.dragCurrent);
    const dir = normalize(powerVector);
    const pwr = distance(this.dragStart, this.dragCurrent);
    const len = Math.min(pwr * 4, 300); 
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(this.striker.pos.x, this.striker.pos.y);
    this.ctx.lineTo(this.striker.pos.x + dir.x * len, this.striker.pos.y + dir.y * len);
    
    const guideGrad = this.ctx.createLinearGradient(
        this.striker.pos.x, this.striker.pos.y,
        this.striker.pos.x + dir.x * len, this.striker.pos.y + dir.y * len
    );
    guideGrad.addColorStop(0, 'rgba(0,0,0,0)');
    guideGrad.addColorStop(1, COLORS.MARKING_RED);
    
    this.ctx.strokeStyle = guideGrad;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 8]);
    this.ctx.stroke();
    this.ctx.restore();
  }

  public handleInput(type: 'start' | 'move' | 'end', pos: Vector2) {
    if (this.settings.playMode === PlayMode.AI && this.turn === CoinType.BLACK) return;
    this.processInput(type, pos);
  }

  private processInput(type: 'start' | 'move' | 'end', pos: Vector2) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (pos.x - rect.left) * (BOARD_SIZE / rect.width);
    const y = (pos.y - rect.top) * (BOARD_SIZE / rect.height);
    const p = { x, y };

    if (type === 'start') {
        if (distance(p, this.striker.pos) < STRIKER_RADIUS * 3) {
            this.isDragging = true;
            this.dragStart = p;
        }
    } else if (type === 'move' && this.isDragging) {
        if (this.phase === GamePhase.PLACING) {
            const minX = CUSHION_WIDTH + PLAY_AREA_PADDING + STRIKER_RADIUS;
            const maxX = BOARD_SIZE - CUSHION_WIDTH - PLAY_AREA_PADDING - STRIKER_RADIUS;
            this.striker.pos.x = Math.max(minX, Math.min(maxX, x));
        } else if (this.phase === GamePhase.AIMING) {
            this.dragCurrent = p;
        }
    } else if (type === 'end' && this.isDragging) {
        this.isDragging = false;
        if (this.phase === GamePhase.PLACING) {
            this.phase = GamePhase.AIMING;
            this.notifyUI();
        } else if (this.phase === GamePhase.AIMING) {
            const powerVector = subtract(this.dragStart, this.dragCurrent);
            const pwr = Math.min(distance(this.dragStart, this.dragCurrent) * 0.2, MAX_POWER);
            if (pwr > 2.0) {
                this.striker.vel = scale(normalize(powerVector), pwr);
                this.phase = GamePhase.SHOOTING;
                this.notifyUI();
                // Call the network sync if available when a strike occurs
                if (this.onNetworkSync) {
                    this.onNetworkSync('STRIKE', { 
                      pos: { ...this.striker.pos }, 
                      vel: { ...this.striker.vel } 
                    });
                }
            } else {
                this.phase = GamePhase.PLACING;
                this.notifyUI();
            }
        }
    }
  }
  
  public undoAim() {
    if (this.phase === GamePhase.AIMING) {
        this.phase = GamePhase.PLACING;
        this.notifyUI();
    }
  }

  private runAI() {
    const targets = this.entities.filter(c => (c.type === CoinType.BLACK || c.type === CoinType.QUEEN) && c.state === CoinState.ACTIVE);
    if (!targets.length) return;
    
    // Choose a target and add slight randomness based on difficulty
    const t = targets[Math.floor(Math.random() * targets.length)];
    const dist = distance(this.striker.pos, t.pos);
    const dir = normalize(subtract(t.pos, this.striker.pos));
    
    // Position AI striker randomly within the baseline
    const minX = CUSHION_WIDTH + PLAY_AREA_PADDING + STRIKER_RADIUS;
    const maxX = BOARD_SIZE - CUSHION_WIDTH - PLAY_AREA_PADDING - STRIKER_RADIUS;
    this.striker.pos.x = minX + Math.random() * (maxX - minX);

    this.striker.vel = scale(dir, Math.min(dist * 0.12 + 10, MAX_POWER));
    this.phase = GamePhase.SHOOTING;
    this.notifyUI();
  }

  private updateParticles() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx; p.y += p.vy; p.life -= p.decay;
          if (p.life <= 0) this.particles.splice(i, 1);
      }
  }

  private drawParticles() {
      this.particles.forEach(p => {
          this.ctx.globalAlpha = p.life;
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size * (p.type === 'GHOST' ? p.life : 1), 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.globalAlpha = 1.0;
      });
  }

  private createPocketGhost(e: Entity, pocketPos: Vector2) {
    const dir = normalize(subtract(pocketPos, e.pos));
    this.particles.push({
        x: e.pos.x, y: e.pos.y,
        vx: dir.x * 2, vy: dir.y * 2,
        life: 1.0, decay: 0.08,
        size: e.radius, color: e.color, type: 'GHOST', ghostType: e.type
    });
  }

  private serialize() { return { entities: this.entities, striker: this.striker, score: this.score, turn: this.turn, phase: this.phase, timeLeft: this.timeLeft }; }
}
