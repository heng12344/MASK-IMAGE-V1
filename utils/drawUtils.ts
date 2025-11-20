import { MaskType, Point } from '../types';

export const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
};

export const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
  const topCurveHeight = height * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y + topCurveHeight);
  // top left curve
  ctx.bezierCurveTo(
    x, y, 
    x - width / 2, y, 
    x - width / 2, y + topCurveHeight
  );
  // bottom left curve
  ctx.bezierCurveTo(
    x - width / 2, y + (height + topCurveHeight) / 2, 
    x, y + (height + topCurveHeight) / 2, 
    x, y + height
  );
  // bottom right curve
  ctx.bezierCurveTo(
    x, y + (height + topCurveHeight) / 2, 
    x + width / 2, y + (height + topCurveHeight) / 2, 
    x + width / 2, y + topCurveHeight
  );
  // top right curve
  ctx.bezierCurveTo(
    x + width / 2, y, 
    x, y, 
    x, y + topCurveHeight
  );
  ctx.closePath();
  ctx.fill();
};

export const drawFilmstrip = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw 3 frames
    const frameWidth = width * 0.8;
    const frameHeight = height * 0.25;
    const gap = height * 0.05;
    const startY = (height - (frameHeight * 3 + gap * 2)) / 2;

    ctx.beginPath();
    // Frame 1
    ctx.rect((width - frameWidth) / 2, startY, frameWidth, frameHeight);
    // Frame 2
    ctx.rect((width - frameWidth) / 2, startY + frameHeight + gap, frameWidth, frameHeight);
    // Frame 3
    ctx.rect((width - frameWidth) / 2, startY + (frameHeight + gap) * 2, frameWidth, frameHeight);
    
    // Add sprocket holes
    const holeSize = 10;
    const holesPerSide = 8;
    const holeGap = height / holesPerSide;
    
    for(let i=0; i<holesPerSide; i++) {
        ctx.rect(10, i * holeGap + 10, holeSize, holeSize);
        ctx.rect(width - 10 - holeSize, i * holeGap + 10, holeSize, holeSize);
    }

    ctx.fill();
}

export const drawMaskShape = (
  ctx: CanvasRenderingContext2D, 
  type: MaskType, 
  width: number, 
  height: number, 
  text: string,
  fontSize: number,
  brushPoints: Point[][],
  brushSize: number
) => {
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  switch (type) {
    case MaskType.NONE:
    case MaskType.HAND:
      // Draw nothing
      break;
    case MaskType.CIRCLE:
      ctx.beginPath();
      ctx.arc(cx, cy, minDim / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case MaskType.RECTANGLE:
      ctx.fillRect(0, 0, width, height);
      break;
    case MaskType.SPLIT:
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      break;
    case MaskType.STAR:
      drawStar(ctx, cx, cy, 5, minDim / 2, minDim / 4);
      break;
    case MaskType.HEART:
      drawHeart(ctx, cx, cy - minDim/2, minDim, minDim);
      break;
    case MaskType.TEXT:
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy);
      break;
    case MaskType.FILMSTRIP:
      drawFilmstrip(ctx, width, height);
      break;
    case MaskType.BRUSH:
    case MaskType.PEN:
      const size = type === MaskType.PEN ? 4 : brushSize;
      ctx.lineWidth = size;
      brushPoints.forEach(stroke => {
        if (stroke.length < 1) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      });
      break;
  }
};