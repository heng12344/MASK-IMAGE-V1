import React, { useState, useEffect } from 'react';
import { MaskConfig, MaskType } from '../types';
import { 
  Sliders, Type as TypeIcon, Move, Paintbrush, ChevronUp, ChevronDown, 
  RotateCw, Trash2, Droplets, Scan, Palette
} from 'lucide-react';

interface PropertiesPanelProps {
  config: MaskConfig;
  onChange: (config: MaskConfig) => void;
  onHistorySave: () => void;
  onClear?: () => void;
}

type PropertyMode = 'scale' | 'rotate' | 'opacity' | 'size' | 'color';

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ config, onChange, onHistorySave, onClear }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Determine available modes based on tool type
  const isBrush = config.type === MaskType.BRUSH || config.type === MaskType.PEN;
  const isText = config.type === MaskType.TEXT;
  const isShape = !isBrush && !isText && config.type !== MaskType.HAND && config.type !== MaskType.NONE;

  const [activeMode, setActiveMode] = useState<PropertyMode>(isBrush || isText ? 'size' : 'scale');

  // Reset mode when tool changes
  useEffect(() => {
      if (isBrush) setActiveMode('size');
      else if (isText) setActiveMode('size');
      else if (isShape) setActiveMode('scale');
  }, [config.type]);

  const handleChange = (key: keyof MaskConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const getLabel = () => {
      switch (activeMode) {
          case 'scale': return 'Scale Shape';
          case 'rotate': return 'Rotation';
          case 'opacity': return 'Opacity';
          case 'size': return isBrush ? 'Brush Size' : 'Text Size';
          default: return 'Settings';
      }
  };

  const getValueDisplay = () => {
      switch (activeMode) {
          case 'scale': return `${Math.round(config.scale * 100)}%`;
          case 'rotate': return `${Math.round(config.rotation)}°`;
          case 'opacity': return `${Math.round((config.opacity ?? 1) * 100)}%`;
          case 'size': return `${isBrush ? config.brushSize : config.fontSize}px`;
          default: return '';
      }
  };

  const renderSlider = () => {
      const commonProps = {
          className: "w-full h-0.5 bg-slate-700/50 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-110 transition-all",
          onMouseDown: onHistorySave,
          onTouchStart: onHistorySave
      };

      switch (activeMode) {
          case 'scale':
              return (
                  <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.01"
                      value={config.scale}
                      onChange={(e) => handleChange('scale', parseFloat(e.target.value))}
                      {...commonProps}
                  />
              );
          case 'rotate':
              return (
                  <input
                      type="range"
                      min="0"
                      max="360"
                      value={config.rotation}
                      onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
                      {...commonProps}
                  />
              );
          case 'opacity':
               return (
                  <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={config.opacity ?? 1}
                      onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
                      {...commonProps}
                  />
              );
          case 'size':
               return (
                  <input
                      type="range"
                      min={isBrush ? "1" : "10"}
                      max={isBrush ? "100" : "300"}
                      value={isBrush ? config.brushSize : config.fontSize}
                      onChange={(e) => handleChange(isBrush ? 'brushSize' : 'fontSize', parseInt(e.target.value))}
                      {...commonProps}
                  />
              );
          default: return null;
      }
  };

  if (config.type === MaskType.NONE || config.type === MaskType.HAND) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-14 z-40 w-[90%] max-w-[280px] transition-all duration-300 ease-out opacity-[0.35]">
       <div className={`bg-[#1e1e2e]/95 backdrop-blur-2xl border border-white/10 shadow-xl shadow-black/50 overflow-hidden transition-all duration-300 ${isExpanded ? 'rounded-[24px]' : 'rounded-[24px]'}`}>
          
          {/* Header Row */}
          <div className="flex items-center justify-between px-3 py-2.5 gap-2">
             
             {/* Mode Toggles */}
             <div className="flex items-center gap-0.5 bg-black/30 p-0.5 rounded-full border border-white/5">
                {isShape && (
                    <>
                        <button 
                            onClick={() => setActiveMode('scale')}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${activeMode === 'scale' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-300 hover:bg-white/5'}`}
                        >
                            <Scan size={13} />
                        </button>
                        <button 
                            onClick={() => setActiveMode('rotate')}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${activeMode === 'rotate' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-300 hover:bg-white/5'}`}
                        >
                            <RotateCw size={13} />
                        </button>
                    </>
                )}
                {(isBrush || isText) && (
                    <button 
                        onClick={() => setActiveMode('size')}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${activeMode === 'size' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-300 hover:bg-white/5'}`}
                    >
                        {isBrush ? <Paintbrush size={13} /> : <TypeIcon size={13} />}
                    </button>
                )}
                
                <button 
                    onClick={() => setActiveMode('opacity')}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${activeMode === 'opacity' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-300 hover:bg-white/5'}`}
                >
                    <Droplets size={13} />
                </button>
             </div>

             {/* Label & Value */}
             <div className="flex-1 flex flex-col items-center min-w-0 px-1">
                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.1em] truncate w-full text-center leading-tight">
                    {getLabel()}
                </span>
                <span className="text-base font-black text-white tabular-nums leading-none mt-0.5">
                    {getValueDisplay()}
                </span>
             </div>

             {/* Actions */}
             <div className="flex items-center gap-1">
                <button 
                    onClick={onClear}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    <Trash2 size={13} />
                </button>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-white transition-colors ${isExpanded ? 'bg-white/10 text-white' : ''}`}
                >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                </button>
             </div>
          </div>

          {/* Slider Area - Always Visible for Quick Access */}
          <div className="px-3 pb-3 pt-0">
             {renderSlider()}
          </div>

          {/* Expanded Settings */}
          {isExpanded && (
             <div className="px-3 pb-3 pt-1 bg-black/20 animate-in slide-in-from-top-2 duration-200 border-t border-white/5">
                {isText && (
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Text Content</label>
                        <input 
                            type="text" 
                            value={config.text}
                            onFocus={onHistorySave}
                            onChange={(e) => handleChange('text', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600"
                            placeholder="Enter text..."
                        />
                     </div>
                )}
                <div className="text-[9px] text-slate-500 text-center mt-1.5 font-medium">
                    {isBrush ? "Draw on canvas to create mask" : "Drag shape to position"}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};