import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CanvasLayer } from './components/CanvasLayer';
import { MaskConfig, DEFAULT_MASK_CONFIG, MaskType } from './types';
import { Image as ImageIcon, Upload, Download, Sparkles, Layers, Undo2, Redo2, X, ZoomIn, ZoomOut, ArrowUpDown, Loader2, Maximize, RotateCcw, Scan, Target } from 'lucide-react';
import { generateBackgroundImage, upscaleImage } from './services/geminiService';

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function App() {
  const [maskConfig, setMaskConfig] = useState<MaskConfig>(DEFAULT_MASK_CONFIG);
  const [img1, setImg1] = useState<HTMLImageElement | null>(null);
  const [img2, setImg2] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight * 0.6 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [upscalingLayer, setUpscalingLayer] = useState<1 | 2 | null>(null);
  const [prompt, setPrompt] = useState('');
  const [showGenModal, setShowGenModal] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  
  // Viewport Transform State
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<HTMLDivElement>(null);
  
  // Interaction Refs for High-Performance Pan/Zoom
  const pointersRef = useRef<Map<number, { x: number, y: number }>>(new Map());
  const gestureStartRef = useRef<{ 
    transform: Transform, 
    center: { x: number, y: number }, 
    distance: number 
  } | null>(null);
  const transformRef = useRef(transform); // Keep a ref synced for event handlers
  const lastTapRef = useRef<number>(0);

  // Sync ref with state
  useEffect(() => { transformRef.current = transform; }, [transform]);

  // History State
  const [past, setPast] = useState<MaskConfig[]>([]);
  const [future, setFuture] = useState<MaskConfig[]>([]);

  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);
  const fileInputBothRef = useRef<HTMLInputElement>(null);

  // Initial Fit
  useEffect(() => {
      const updateSize = () => {
          if (!img1 && !img2) {
             const maxWidth = window.innerWidth;
             const maxHeight = window.innerHeight * 0.7; 
             setCanvasSize({ width: maxWidth, height: maxHeight });
             // Center empty canvas
             setTransform(prev => ({
                 ...prev,
                 x: (window.innerWidth - maxWidth) / 2,
                 y: (window.innerHeight * 0.6 - maxHeight) / 2 
             }));
          }
      };
      window.addEventListener('resize', updateSize);
      updateSize();
      return () => window.removeEventListener('resize', updateSize);
  }, [img1, img2]);

  // --- Robust Viewport Logic ---

  const getCentroid = (points: {x: number, y: number}[]) => {
      let x = 0, y = 0;
      points.forEach(p => { x += p.x; y += p.y });
      const center = { x: x / points.length, y: y / points.length };
      
      let distance = 0;
      if (points.length > 1) {
          points.forEach(p => distance += Math.hypot(p.x - center.x, p.y - center.y));
          distance /= points.length;
      }
      return { center, distance };
  };

  const updateGestureStart = () => {
      if (pointersRef.current.size === 0) {
          gestureStartRef.current = null;
          return;
      }
      const points = Array.from(pointersRef.current.values()) as { x: number; y: number }[];
      const { center, distance } = getCentroid(points);
      
      gestureStartRef.current = {
          transform: transformRef.current,
          center,
          distance
      };
  };

  const centerImage = useCallback((width: number, height: number) => {
      const paddingX = 48; 
      const paddingY = 140;
      const availableWidth = window.innerWidth - paddingX;
      const availableHeight = window.innerHeight - paddingY;
      
      const scaleX = availableWidth / width;
      const scaleY = availableHeight / height;
      const fitScale = Math.min(scaleX, scaleY, 1); 
      
      const x = (window.innerWidth - width * fitScale) / 2;
      const y = (window.innerHeight - height * fitScale) / 2;

      setTransform({ x, y, scale: fitScale });
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (isGenerating || showGenModal) return;

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const delta = -Math.sign(e.deltaY); 
    const ZOOM_SPEED = 0.15;
    const multiplier = Math.exp(delta * ZOOM_SPEED);
    
    const currentScale = transformRef.current.scale;
    const newScale = Math.min(Math.max(currentScale * multiplier, 0.05), 20);
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // World point under mouse should stay under mouse
    const worldX = (mouseX - transformRef.current.x) / currentScale;
    const worldY = (mouseY - transformRef.current.y) / currentScale;
    
    const newX = mouseX - worldX * newScale;
    const newY = mouseY - worldY * newScale;
    
    setTransform({ x: newX, y: newY, scale: newScale });
  }, [isGenerating, showGenModal]);

  useEffect(() => {
      const el = viewportRef.current;
      if (el) {
          el.addEventListener('wheel', handleWheel, { passive: false });
          return () => el.removeEventListener('wheel', handleWheel);
      }
  }, [handleWheel]);

  const handlePointerDown = (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      updateGestureStart();
      
      // Double Tap Logic
      if (pointersRef.current.size === 1) {
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
              if (transformRef.current.scale < 1) {
                  // Zoom to 100% at tap location
                  const rect = viewportRef.current?.getBoundingClientRect();
                  if (rect) {
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      const wx = (x - transformRef.current.x) / transformRef.current.scale;
                      const wy = (y - transformRef.current.y) / transformRef.current.scale;
                      setTransform({ x: x - wx, y: y - wy, scale: 1 });
                  }
              } else {
                  handleFitToScreen();
              }
          }
          lastTapRef.current = now;
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      const gesture = gestureStartRef.current;
      if (!gesture) return;

      const pointersCount = pointersRef.current.size;
      
      // If 1 pointer, only pan if Tool is HAND
      // If >1 pointers, always zoom/pan (Pinch)
      if (pointersCount === 1 && maskConfig.type !== MaskType.HAND) {
          // Let child handle drawing, do not pan
          return;
      }

      e.preventDefault();
      
      const current = getCentroid(Array.from(pointersRef.current.values()) as { x: number; y: number }[]);
      const { center: startCenter, distance: startDist, transform: startTransform } = gesture;
      
      // 1. Scale
      let newScale = startTransform.scale;
      if (pointersCount > 1 && startDist > 0) {
          newScale = startTransform.scale * (current.distance / startDist);
      }
      newScale = Math.min(Math.max(newScale, 0.05), 20);
      
      // 2. Translate
      const rect = viewportRef.current?.getBoundingClientRect();
      const offsetX = rect ? rect.left : 0;
      const offsetY = rect ? rect.top : 0;
      
      const scX = startCenter.x - offsetX;
      const scY = startCenter.y - offsetY;
      const ccX = current.center.x - offsetX;
      const ccY = current.center.y - offsetY;
      
      const worldX = (scX - startTransform.x) / startTransform.scale;
      const worldY = (scY - startTransform.y) / startTransform.scale;
      
      const newX = ccX - worldX * newScale;
      const newY = ccY - worldY * newScale;
      
      setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      (e.target as Element).releasePointerCapture(e.pointerId);
      pointersRef.current.delete(e.pointerId);
      updateGestureStart();
  };

  // --- End Viewport Logic ---

  const saveHistory = () => {
    setPast(prev => [...prev, maskConfig]);
    setFuture([]);
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(prev => [maskConfig, ...prev]);
    setMaskConfig(previous);
    setPast(newPast);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, maskConfig]);
    setMaskConfig(next);
    setFuture(newFuture);
  };

  const handleClearMask = () => {
    saveHistory();
    const currentType = maskConfig.type;
    const currentShape = (currentType === MaskType.BRUSH || currentType === MaskType.PEN) 
        ? MaskType.NONE 
        : maskConfig.shape;
    
    setMaskConfig(prev => ({
        ...DEFAULT_MASK_CONFIG,
        type: currentType,
        shape: currentShape,
        brushSize: prev.brushSize,
        fontSize: prev.fontSize,
        brushPoints: [] 
    }));
  };

  const handleSwapLayers = () => {
    saveHistory();
    setImg1(img2);
    setImg2(img1);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 1 | 2) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          if (target === 1) {
            setImg1(img);
            setCanvasSize({ width: img.width, height: img.height });
            centerImage(img.width, img.height);
          } else {
            setImg2(img);
            if (!img1) {
                setCanvasSize({ width: img.width, height: img.height });
                centerImage(img.width, img.height);
            }
          }
          setShowLayers(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const loadFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
  };

  const handleDualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    
    try {
        const image1 = await loadFile(files[0] as File);
        setImg1(image1);
        setCanvasSize({ width: image1.width, height: image1.height });
        centerImage(image1.width, image1.height);

        if (files.length > 1) {
            const image2 = await loadFile(files[1] as File);
            setImg2(image2);
        }
        setShowLayers(false);
    } catch (err) {
        console.error("Error loading images", err);
    }
  };

  const getImageBase64 = (img: HTMLImageElement): string => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png");
    }
    return "";
  }

  const handleUpscaleLayer = async (target: 1 | 2) => {
     const img = target === 1 ? img1 : img2;
     if (!img) return;

     setUpscalingLayer(target);
     
     try {
        const base64 = getImageBase64(img);
        if (base64) {
            const result = await upscaleImage(base64);
            if (result) {
                const newImg = new Image();
                newImg.onload = () => {
                    if (target === 1) {
                        setImg1(newImg);
                        const ratio = newImg.width / img.width;
                        setCanvasSize({ width: newImg.width, height: newImg.height });
                        
                        setMaskConfig(prev => ({
                            ...prev,
                            fontSize: prev.fontSize * ratio,
                            brushSize: prev.brushSize * ratio,
                            brushPoints: prev.brushPoints.map(stroke => 
                                stroke.map(p => ({ x: p.x * ratio, y: p.y * ratio }))
                            )
                        }));
                        setTransform(prev => ({ ...prev, scale: prev.scale / ratio }));
                    }
                    else setImg2(newImg);
                    setUpscalingLayer(null);
                }
                newImg.src = result;
            } else {
                alert("Upscale failed. Please try again.");
                setUpscalingLayer(null);
            }
        }
     } catch (e) {
         console.error(e);
         setUpscalingLayer(null);
     }
  };

  const handleGenerateBackground = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    const base64 = await generateBackgroundImage(prompt);
    if (base64) {
      const img = new Image();
      img.onload = () => {
        setImg2(img);
        setIsGenerating(false);
        setShowGenModal(false);
      };
      img.src = base64;
    } else {
        setIsGenerating(false);
        alert("Failed.");
    }
  };

  const handleExport = () => {
      const canvas = document.querySelector('canvas');
      if(canvas) {
          const link = document.createElement('a');
          link.download = 'mask-master.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
      }
  }

  const handleZoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.25, 20) }));
  const handleZoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.05) }));
  
  const handleFitToScreen = () => {
    centerImage(canvasSize.width, canvasSize.height);
  };

  const handleResetView = () => {
      setMaskConfig(prev => ({ ...prev, rotation: 0 }));
  };

  const handleCenterView = () => {
      const centerX = (window.innerWidth - canvasSize.width * transform.scale) / 2;
      const centerY = (window.innerHeight - canvasSize.height * transform.scale) / 2;
      setTransform(prev => ({ ...prev, x: centerX, y: centerY }));
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-200 overflow-hidden relative select-none">
      
      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 h-10 bg-slate-950/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-2.5 z-50 opacity-[0.35]">
         <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowGenModal(true)}
                className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/30 active:scale-95 transition-transform"
            >
                <Sparkles size={12} className="text-white" />
            </button>
         </div>
         <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-full border border-white/5">
            <button onClick={undo} disabled={past.length === 0} className="p-1 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors">
                <Undo2 size={12} />
            </button>
            <div className="w-px h-3 bg-white/10"></div>
            <button onClick={redo} disabled={future.length === 0} className="p-1 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors">
                <Redo2 size={12} />
            </button>
         </div>
         <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowLayers(!showLayers)}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${showLayers ? 'bg-white text-black' : 'bg-slate-800 text-slate-300'}`}
            >
                <Layers size={12} />
            </button>
            <button 
                onClick={handleExport}
                className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 border border-indigo-500/30"
            >
                <Download size={12} />
            </button>
         </div>
      </div>

      {/* Layers Modal */}
      {showLayers && (
          <div className="fixed top-11 right-2 z-50 bg-slate-900 border border-white/10 rounded-lg shadow-2xl p-1.5 w-48 animate-in slide-in-from-top-5 duration-200 origin-top-right opacity-[0.35]">
              <h3 className="text-[8px] font-bold text-slate-500 uppercase mb-1.5 flex justify-between items-center">
                  <span>Layers</span>
                  <span className="text-[6px] text-amber-500/80">PRO TOOLS</span>
              </h3>
              <div className="relative flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 bg-slate-800 rounded-sm p-1 group">
                      <button 
                        onClick={() => fileInput1Ref.current?.click()}
                        className="flex-1 flex items-center gap-2 hover:bg-slate-700 rounded-sm transition-colors min-w-0"
                      >
                          <div className="w-6 h-6 bg-indigo-500/20 rounded flex items-center justify-center text-indigo-400 overflow-hidden relative shrink-0">
                              {img1 ? (
                                <img src={img1.src} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon size={12} />
                              )}
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload size={10} className="text-white"/>
                              </div>
                          </div>
                          <div className="text-left truncate">
                              <div className="text-[9px] font-bold text-white leading-tight truncate">Foreground</div>
                              <div className="text-[7px] text-slate-400 leading-tight truncate">{img1 ? 'Change' : 'Upload'}</div>
                          </div>
                      </button>
                      {img1 && (
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleUpscaleLayer(1); }}
                             disabled={upscalingLayer === 1}
                             className="h-5 px-1.5 gap-0.5 flex items-center justify-center rounded bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500 hover:to-orange-500 border border-amber-500/30 hover:border-amber-500 text-amber-500 hover:text-white transition-all shrink-0 active:scale-95"
                          >
                             {upscalingLayer === 1 ? <Loader2 size={10} className="animate-spin" /> : (
                                 <>
                                  <Sparkles size={8} />
                                  <span className="text-[6px] font-bold uppercase">4K</span>
                                 </>
                             )}
                          </button>
                      )}
                  </div>

                   <div className="absolute top-1/2 left-6 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                      <div className="w-4 h-4 flex items-center justify-center pointer-events-auto">
                        <button 
                            onClick={handleSwapLayers}
                            className="w-4 h-4 bg-slate-900 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-indigo-500 hover:bg-indigo-600 shadow-sm transition-all active:scale-90"
                        >
                            <ArrowUpDown size={8} />
                        </button>
                      </div>
                   </div>

                  <div className="flex items-center gap-1.5 bg-slate-800 rounded-sm p-1 group">
                      <button 
                        onClick={() => fileInput2Ref.current?.click()}
                        className="flex-1 flex items-center gap-2 hover:bg-slate-700 rounded-sm transition-colors min-w-0"
                      >
                           <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center text-purple-400 overflow-hidden relative shrink-0">
                              {img2 ? (
                                  <img src={img2.src} className="w-full h-full object-cover" />
                              ) : (
                                  <ImageIcon size={12} />
                              )}
                               <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Upload size={10} className="text-white"/>
                              </div>
                          </div>
                          <div className="text-left truncate">
                              <div className="text-[9px] font-bold text-white leading-tight truncate">Background</div>
                              <div className="text-[7px] text-slate-400 leading-tight truncate">{img2 ? 'Change' : 'Upload'}</div>
                          </div>
                      </button>
                       {img2 && (
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleUpscaleLayer(2); }}
                             disabled={upscalingLayer === 2}
                             className="h-5 px-1.5 gap-0.5 flex items-center justify-center rounded bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500 hover:to-orange-500 border border-amber-500/30 hover:border-amber-500 text-amber-500 hover:text-white transition-all shrink-0 active:scale-95"
                          >
                             {upscalingLayer === 2 ? <Loader2 size={10} className="animate-spin" /> : (
                                 <>
                                  <Sparkles size={8} />
                                  <span className="text-[6px] font-bold uppercase">4K</span>
                                 </>
                             )}
                          </button>
                      )}
                  </div>
                  
                  <div className="h-px bg-white/5 my-0.5"></div>
                  <button 
                      onClick={() => fileInputBothRef.current?.click()}
                      className="w-full py-2 flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-dashed border-slate-700/50 hover:border-slate-500/50 rounded-sm transition-all group"
                  >
                       <div className="flex -space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                           <div className="w-3 h-3 rounded-full bg-indigo-500/20 border border-indigo-500/50"></div>
                           <div className="w-3 h-3 rounded-full bg-purple-500/20 border border-purple-500/50"></div>
                       </div>
                       <span className="text-[9px] font-bold text-slate-400 group-hover:text-white">Replace Pair</span>
                  </button>
              </div>
          </div>
      )}

      {/* Main Workspace with Infinite Canvas */}
      <div 
        ref={viewportRef}
        className="flex-1 relative bg-[#050505] overflow-hidden cursor-default"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
         
         {/* Floating Right Tools */}
         <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none">
             <div className="pointer-events-auto flex flex-col gap-2.5 opacity-[0.35]">
                 <button 
                    onClick={handleCenterView}
                    className="w-9 h-9 bg-[#1e1e2e]/90 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white shadow-lg active:scale-95 transition-all"
                    title="Center View"
                 >
                    <Target size={16} />
                 </button>

                 <div className="flex flex-col items-center bg-[#1e1e2e]/90 backdrop-blur-xl border border-white/10 rounded-full py-2 px-0.5 shadow-xl gap-1 w-9">
                    <button 
                        onClick={handleFitToScreen} 
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-full text-indigo-400 hover:text-indigo-300 transition-colors active:scale-95" 
                        title="Fit to Screen"
                    >
                        <Scan size={14} />
                    </button>
                    
                    <button onClick={handleZoomIn} className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-full text-slate-300 active:text-white transition-colors active:scale-95">
                        <ZoomIn size={14} />
                    </button>
                    
                    <div className="text-[9px] font-bold text-slate-500 select-none py-0.5">
                        {Math.round(transform.scale * 100)}%
                    </div>
                    
                    <button onClick={handleZoomOut} className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-full text-slate-300 active:text-white transition-colors active:scale-95">
                        <ZoomOut size={14} />
                    </button>
                    
                    <button 
                        onClick={handleResetView} 
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-full text-amber-500 hover:text-amber-400 transition-colors active:scale-95" 
                        title="Reset Rotation"
                    >
                        <RotateCcw size={12} />
                    </button>
                 </div>
             </div>
         </div>

         {/* Canvas Content */}
         <div 
            style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
                width: canvasSize.width,
                height: canvasSize.height,
                willChange: 'transform'
            }}
            className={`relative origin-top-left ${maskConfig.type === MaskType.HAND ? 'cursor-grab active:cursor-grabbing' : ''}`}
         >
            {(!img1 && !img2) ? (
               <div className="flex flex-col items-center justify-center w-full h-full animate-in fade-in duration-500 opacity-[0.35] border border-white/5 rounded-xl bg-slate-900/30 backdrop-blur-sm p-8">
                    
                    <div className="grid grid-cols-2 gap-4 w-64">
                        <button 
                            onClick={() => fileInput1Ref.current?.click()}
                            className="group relative flex flex-col items-center justify-center aspect-square bg-slate-900/50 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-900/80 rounded-xl transition-all active:scale-95"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                                <ImageIcon size={24} className="text-slate-400 group-hover:text-indigo-400" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-300 group-hover:text-white">Image 1</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Foreground</span>
                        </button>

                        <button 
                            onClick={() => fileInput2Ref.current?.click()}
                            className="group relative flex flex-col items-center justify-center aspect-square bg-slate-900/50 border-2 border-dashed border-slate-700 hover:border-purple-500 hover:bg-slate-900/80 rounded-xl transition-all active:scale-95"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                                <ImageIcon size={24} className="text-slate-400 group-hover:text-purple-400" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-300 group-hover:text-white">Image 2</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Background</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-64 my-4">
                        <div className="h-px bg-slate-800 flex-1"></div>
                        <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">Or</span>
                        <div className="h-px bg-slate-800 flex-1"></div>
                    </div>

                    <button 
                        onClick={() => fileInputBothRef.current?.click()}
                        className="w-64 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                    >
                        <div className="flex -space-x-1.5">
                             <div className="w-5 h-5 rounded-full bg-slate-600 border-2 border-slate-800"></div>
                             <div className="w-5 h-5 rounded-full bg-slate-500 border-2 border-slate-800"></div>
                        </div>
                        Select Pair
                    </button>
               </div>
            ) : (
               <div className="shadow-2xl shadow-black rounded-lg bg-slate-900 overflow-hidden w-full h-full">
                    <CanvasLayer 
                       width={canvasSize.width} 
                       height={canvasSize.height} 
                       imgForeground={img1}
                       imgBackground={img2}
                       maskConfig={maskConfig}
                       onUpdateMaskConfig={setMaskConfig}
                       onHistorySave={saveHistory}
                   />
               </div>
            )}
         </div>
      </div>

      {/* Floating Controls */}
      <PropertiesPanel 
        config={maskConfig}
        onChange={setMaskConfig}
        onHistorySave={saveHistory}
        onClear={handleClearMask}
      />

      <Toolbar 
        currentMask={maskConfig.type} 
        onSelectMask={(type) => {
            saveHistory();
            const isBrushTool = type === MaskType.BRUSH || type === MaskType.PEN;
            const isHandTool = type === MaskType.HAND;
            
            setMaskConfig(prev => ({
                ...prev,
                type: type,
                shape: isHandTool ? prev.shape : (isBrushTool ? MaskType.NONE : type),
                brushPoints: isHandTool ? prev.brushPoints : [],
                x: isHandTool ? prev.x : 0.5,
                y: isHandTool ? prev.y : 0.5,
                scale: isHandTool ? prev.scale : DEFAULT_MASK_CONFIG.scale,
                rotation: isHandTool ? prev.rotation : 0
            }));
        }} 
      />

      {/* Hidden Inputs */}
      <input type="file" ref={fileInput1Ref} className="hidden" onChange={(e) => handleImageUpload(e, 1)} accept="image/*" />
      <input type="file" ref={fileInput2Ref} className="hidden" onChange={(e) => handleImageUpload(e, 2)} accept="image/*" />
      <input type="file" ref={fileInputBothRef} className="hidden" onChange={handleDualUpload} accept="image/*" multiple />

      {/* AI Modal */}
      {showGenModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-slate-900 w-full sm:max-w-xs rounded-t-2xl sm:rounded-xl overflow-hidden animate-in slide-in-from-bottom-10 duration-300 opacity-[0.35]">
                  <div className="p-3.5">
                      <div className="flex justify-between items-center mb-3.5">
                          <h3 className="text-[11px] font-bold text-white flex items-center gap-1.5">
                              <Sparkles size={12} className="text-purple-400" />
                              AI Background
                          </h3>
                          <button onClick={() => setShowGenModal(false)} className="p-1.5 bg-slate-800 rounded-full text-slate-400">
                              <X size={12} />
                          </button>
                      </div>
                      
                      <textarea 
                        className="w-full h-20 bg-slate-950 border border-slate-700 rounded-md p-2.5 text-[10px] text-white mb-2.5 outline-none focus:border-purple-500 transition-colors"
                        placeholder="Describe your dream background..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />

                      <button 
                        onClick={handleGenerateBackground}
                        disabled={isGenerating || !prompt}
                        className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-md text-white font-bold text-[11px] shadow-lg shadow-purple-900/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                          {isGenerating ? 'Dreaming...' : 'Generate'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}