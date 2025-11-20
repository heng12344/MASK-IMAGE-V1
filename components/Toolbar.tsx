import React from 'react';
import { MaskType } from '../types';
import { 
  Circle, Square, Star, Heart, Type, SplitSquareHorizontal, 
  Film, Brush, PenTool, Hand
} from 'lucide-react';

interface ToolbarProps {
  currentMask: MaskType;
  onSelectMask: (mask: MaskType) => void;
}

const tools = [
  { type: MaskType.HAND, icon: Hand, label: 'Pan' },
  { type: MaskType.CIRCLE, icon: Circle, label: 'Circle' },
  { type: MaskType.RECTANGLE, icon: Square, label: 'Rect' },
  { type: MaskType.HEART, icon: Heart, label: 'Heart' },
  { type: MaskType.STAR, icon: Star, label: 'Star' },
  { type: MaskType.BRUSH, icon: Brush, label: 'Brush' },
  { type: MaskType.PEN, icon: PenTool, label: 'Pen' },
  { type: MaskType.TEXT, icon: Type, label: 'Text' },
  { type: MaskType.SPLIT, icon: SplitSquareHorizontal, label: 'Split' },
  { type: MaskType.FILMSTRIP, icon: Film, label: 'Film' },
];

export const Toolbar: React.FC<ToolbarProps> = ({ currentMask, onSelectMask }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 pb-safe safe-area-bottom opacity-[0.35]">
      <div className="flex items-center justify-center gap-1 p-1 overflow-x-auto custom-scrollbar touch-pan-x">
        {tools.map((tool) => (
          <button
            key={tool.type}
            onClick={() => onSelectMask(tool.type)}
            className={`
              flex-shrink-0 flex flex-col items-center justify-center w-8 h-8 rounded-md transition-all duration-200 active:scale-95
              ${currentMask === tool.type 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 translate-y-[-0.5px]' 
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
              }
            `}
          >
            <tool.icon 
              size={13} 
              className={`mb-0.5 ${currentMask === tool.type ? 'fill-current opacity-20' : ''}`} 
              strokeWidth={currentMask === tool.type ? 2.5 : 2}
            />
            <span className="text-[6px] font-semibold tracking-wide leading-none">
              {tool.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};