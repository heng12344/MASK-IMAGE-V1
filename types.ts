export enum MaskType {
  NONE = 'None',
  HAND = 'Hand',
  CIRCLE = 'Circle',
  RECTANGLE = 'Rectangle',
  HEART = 'Heart',
  STAR = 'Stars',
  TEXT = 'Text',
  SPLIT = 'Split',
  FILMSTRIP = 'Filmstrip',
  BRUSH = 'Brush',
  PEN = 'Pen' // Thinner/harder brush
}

export interface Point {
  x: number;
  y: number;
}

export interface MaskConfig {
  type: MaskType; // Current active tool (Interaction Mode)
  shape: MaskType; // Current geometric shape (Rendering)
  x: number;
  y: number;
  scale: number;
  rotation: number;
  text: string;
  fontSize: number;
  brushPoints: Point[][]; // Array of strokes (each stroke is array of points)
  brushSize: number;
  opacity: number;
}

export interface AppState {
  foregroundImage: HTMLImageElement | null;
  backgroundImage: HTMLImageElement | null;
  maskConfig: MaskConfig;
  isDragging: boolean;
  isDrawing: boolean;
}

export const DEFAULT_MASK_CONFIG: MaskConfig = {
  type: MaskType.CIRCLE,
  shape: MaskType.CIRCLE,
  x: 0.5, // Normalized 0-1
  y: 0.5, // Normalized 0-1
  scale: 0.4,
  rotation: 0,
  text: "MASK",
  fontSize: 100,
  brushPoints: [],
  brushSize: 20,
  opacity: 1,
};