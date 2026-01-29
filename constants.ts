
export const BOARD_SIZE = 800;
export const POCKET_RADIUS = 35;
export const CUSHION_WIDTH = 45; // Slightly thicker for a premium feel
export const PLAY_AREA_PADDING = 65; 

export const STRIKER_RADIUS = 22;
export const COIN_RADIUS = 15;

export const FRICTION = 0.985; // Slightly less friction for a "powdered" board feel
export const WALL_BOUNCE = 0.7; // Professional boards have good rebound
export const COIN_BOUNCE = 0.85; 

export const MAX_POWER = 28;
export const MIN_VELOCITY = 0.15;

export const TURN_TIME_LIMIT = 20; 

export const COLORS = {
  BOARD_BG: '#F3E5AB', // Authentic Birch Plywood Cream
  BOARD_BORDER: '#2D1B14', // Deep Rosewood/Walnut
  BOARD_BORDER_HIGHLIGHT: '#422A20', 
  LINES: '#1A1A1A', // Crisp Black Ink
  POCKET: '#050505',
  WHITE_COIN: '#FFFFFF',
  BLACK_COIN: '#222222',
  QUEEN: '#C62828', // Proper Crimson Red
  STRIKER: '#F8F8F8', // Ivory finish
  GUIDE_LINE: 'rgba(0, 0, 0, 0.25)',
  POWER_LINE: 'rgba(198, 40, 40, 0.7)',
  MARKING_RED: '#D32F2F' // Standard marking red
};

export const COLLISION_ITERATIONS = 6; // Increased for even better physics accuracy
