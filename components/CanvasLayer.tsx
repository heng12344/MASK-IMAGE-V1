import React, { useRef, useEffect, useState } from 'react';
import { MaskConfig, MaskType, Point } from '../types';
import { drawMaskShape } from '../utils/drawUtils';

interface CanvasLayerProps {
  width: number;
  height: number;
  imgForeground: HTMLImageElement | null;
  imgBackground: HTMLImageElement | null;
  maskConfig: MaskConfig;
  onUpdateMaskConfig: (config: MaskConfig) => void;
  onHistorySave: () => void;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  width,
  height,
  imgForeground,
  imgBackground,
  maskConfig,
  onUpdateMaskConfig,
  onHistorySave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<Point>({ x: 0, y: 0 });

  // Helper to get mouse position relative to canvas, accounting for CSS scaling
  const getPos = (e: React.PointerEvent | PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors between CSS pixels and internal Canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // 1. If Hand tool, ignore so parent can Pan
    if (maskConfig.type === MaskType.HAND) return;

    // 2. If not primary pointer (e.g. second finger for pinch), ignore
    if (!e.isPrimary) return;

    // 3. Drawing/Shape Interaction
    // Don't stop propagation so parent can track this pointer for potential pinch logic later
    // But capture it to ensure we keep drawing if we leave the canvas bounds
    (e.target as Element).setPointerCapture(e.pointerId);
    
    onHistorySave();

    const pos = getPos(e);
    setIsDragging(true);
    setLastPos(pos);

    if (maskConfig.type === MaskType.BRUSH || maskConfig.type === MaskType.PEN) {
      const newStrokes = [...maskConfig.brushPoints, [pos]];
      onUpdateMaskConfig({ ...maskConfig, brushPoints: newStrokes });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    // Prevent default to stop browser gestures
    e.preventDefault();
    
    const pos = getPos(e);

    if (maskConfig.type === MaskType.BRUSH || maskConfig.type === MaskType.PEN) {
      const strokes = [...maskConfig.brushPoints];
      const lastStroke = strokes[strokes.length - 1];
      if (lastStroke) {
          lastStroke.push(pos);
          onUpdateMaskConfig({ ...maskConfig, brushPoints: strokes });
      }
    } else {
      const dx = (pos.x - lastPos.x) / width;
      const dy = (pos.y - lastPos.y) / height;
      
      onUpdateMaskConfig({
        ...maskConfig,
        x: maskConfig.x + dx,
        y: maskConfig.y + dy,
      });
      setLastPos(pos);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
        setIsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
    }
  };

  // Main Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background (Image 2) or Checkerboard
    if (imgBackground) {
      // Scale to cover
      const scale = Math.max(width / imgBackground.width, height / imgBackground.height);
      const x = (width / 2) - (imgBackground.width / 2) * scale;
      const y = (height / 2) - (imgBackground.height / 2) * scale;
      ctx.drawImage(imgBackground, x, y, imgBackground.width * scale, imgBackground.height * scale);
    } else {
       // Checkerboard pattern
       const cellSize = 20;
       ctx.fillStyle = '#1e293b'; // Slate 800
       ctx.fillRect(0,0, width, height);
       ctx.fillStyle = '#334155'; // Slate 700
       for(let r=0; r<height; r+=cellSize) {
           for(let c=0; c<width; c+=cellSize) {
               if((r/cellSize + c/cellSize) % 2 === 0) ctx.fillRect(c,r,cellSize,cellSize);
           }
       }
    }

    if (!imgForeground) return;

    // 2. Prepare the Mask (Shape + Brush)
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    // A. Draw Shape
    maskCtx.save();
    const cx = maskConfig.x * width;
    const cy = maskConfig.y * height;
    maskCtx.translate(cx, cy);
    maskCtx.rotate((maskConfig.rotation * Math.PI) / 180);
    maskCtx.scale(maskConfig.scale, maskConfig.scale);
    maskCtx.translate(-width/2, -height/2);
    
    drawMaskShape(
        maskCtx, 
        maskConfig.shape || MaskType.CIRCLE, 
        width, 
        height, 
        maskConfig.text, 
        maskConfig.fontSize, 
        [], 
        0
    );
    maskCtx.restore();

    // B. Draw Brush Strokes
    if (maskConfig.brushPoints.length > 0) {
         const brushStyle = maskConfig.type === MaskType.PEN ? MaskType.PEN : MaskType.BRUSH;
         drawMaskShape(
             maskCtx, 
             brushStyle, 
             width, 
             height, 
             "", 
             0, 
             maskConfig.brushPoints, 
             maskConfig.brushSize
         );
    }

    // 3. Create Masked Foreground Layer
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = width;
    layerCanvas.height = height;
    const layerCtx = layerCanvas.getContext('2d');
    if (!layerCtx) return;

    // Draw Foreground Image
    const fgScale = Math.max(width / imgForeground.width, height / imgForeground.height);
    const fgX = (width / 2) - (imgForeground.width / 2) * fgScale;
    const fgY = (height / 2) - (imgForeground.height / 2) * fgScale;
    layerCtx.drawImage(imgForeground, fgX, fgY, imgForeground.width * fgScale, imgForeground.height * fgScale);

    // Apply Combined Mask
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.drawImage(maskCanvas, 0, 0);

    // 4. Composite to Main Canvas
    ctx.save();
    ctx.globalAlpha = maskConfig.opacity ?? 1;
    ctx.drawImage(layerCanvas, 0, 0);
    ctx.restore();

  }, [width, height, imgForeground, imgBackground, maskConfig]);

  return (
    <div className="relative bg-slate-950 shadow-2xl rounded-lg overflow-hidden cursor-crosshair touch-none max-w-full max-h-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block max-w-full max-h-full w-auto h-auto object-contain"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
};