import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, HelpCircle, Volume2, VolumeX, Sparkles, AlertTriangle, 
  RotateCcw, Info, ArrowRight, CheckCircle2, ChevronRight, Zap
} from 'lucide-react';
import { LockConfig, GameStats } from '../types';
import { playPinClick, playUnlockSound, playSuccessJingle, playBreakSound } from '../audio';
import { TUTORIAL_PINS } from '../data';

interface PinTumblerGameProps {
  lock: LockConfig;
  stats: GameStats;
  onSuccess: (score: number) => void;
  onPickBreak: () => void;
  onBack: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

interface PinState {
  id: number;
  targetY: number; // Correct height range where pin sets (e.g. 50-60)
  currentY: number; // Current height pushed
  isSet: boolean;    // Is successfully caught on the shear line
  isOverset: boolean; // Pushed past the shear line, jammed
  label: string;
}

export const PinTumblerGame: React.FC<PinTumblerGameProps> = ({
  lock,
  stats,
  onSuccess,
  onPickBreak,
  onBack,
  soundEnabled,
  toggleSound
}) => {
  // We model a 5-pin tumbler lock
  const [pins, setPins] = useState<PinState[]>([]);
  const [pickPositionX, setPickPositionX] = useState<number>(0); // 0 to 100 representing position from pin 1 to 5
  const [pickLift, setPickLift] = useState<number>(0); // 0 to 100 height of the lockpick tip
  const [bindingOrder, setBindingOrder] = useState<number[]>([]); // Chamber indices sequence like [2, 0, 4, 1, 3]
  const [currentBindingIndex, setCurrentBindingIndex] = useState<number>(0); // Which item in bindingOrder we are setting
  
  const [pickHealth, setPickHealth] = useState<number>(100);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [tensionApplied, setTensionApplied] = useState<boolean>(true); // For simplicity, tension is held down
  const [feedbackMsg, setFeedbackMsg] = useState<string>('テンションレンチがセットされています。ピン探りを行いましょう。');
  const [activePinIndex, setActivePinIndex] = useState<number>(-1); // Which pin the pick is currently touching

  const lastActivePinRef = useRef<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize Pins and secret binding sequence
  useEffect(() => {
    // Determine pin target settings based on lock ID or random seed
    const numPins = 5;
    const computedPins: PinState[] = [
      { id: 1, targetY: 42, currentY: 0, isSet: false, isOverset: false, label: '第1ピン' },
      { id: 2, targetY: 65, currentY: 0, isSet: false, isOverset: false, label: '第2ピン' },
      { id: 3, targetY: 30, currentY: 0, isSet: false, isOverset: false, label: '第3ピン' },
      { id: 4, targetY: 55, currentY: 0, isSet: false, isOverset: false, label: '第4ピン' },
      { id: 5, targetY: 48, currentY: 0, isSet: false, isOverset: false, label: '第5ピン' },
    ];

    // Seed binding order based on lock name length or shuffle simple sequence
    // A classic binding order like: 3 -> 1 -> 5 -> 2 -> 4 (0-indexed: [2, 0, 4, 1, 3])
    const order = [2, 0, 4, 1, 3]; // Pin 3 (index 2) is first, etc.
    
    setPins(computedPins);
    setBindingOrder(order);
    setCurrentBindingIndex(0);
    setPickHealth(100);
    setIsUnlocked(false);
  }, [lock]);

  // Handle Pick Left/Right position
  const handleXMove = (val: number) => {
    if (isUnlocked) return;
    const targetX = Math.max(0, Math.min(100, val));
    setPickPositionX(targetX);

    // Grid coordinates: determine which pin (0 to 4) is closest
    // 0-20 runs pin 1, 20-40 pin 2, etc.
    const pinIdx = Math.min(4, Math.floor(targetX / 20));
    setActivePinIndex(pinIdx);

    if (pinIdx !== lastActivePinRef.current) {
      // Small scrape tick as pick passes chambers
      playPinClick(false);
      lastActivePinRef.current = pinIdx;
    }
  };

  // Handle lifting the pick
  const handleLift = (height: number) => {
    if (isUnlocked || pins.length === 0) return;
    const clampedHeight = Math.max(0, Math.min(100, height));
    setPickLift(clampedHeight);

    // Apply height to active pin if not already set, plus neighbors slightly (elasticity)
    setPins((prevPins) => {
      return prevPins.map((pin, idx) => {
        if (pin.isSet) return pin; // Already set in secure lock line

        if (idx === activePinIndex) {
          // Check binding conditions
          const currentBindingPinIdx = bindingOrder[currentBindingIndex];
          const isCurrentBinding = idx === currentBindingPinIdx;
          
          let updatedY = clampedHeight;
          let isSet = false;
          let isOverset = false;

          // Target boundaries
          const tolerance = 6;
          const targetMin = pin.targetY - tolerance;
          const targetMax = pin.targetY + tolerance;

          if (updatedY >= targetMin && updatedY <= targetMax) {
            // Reached target!
            if (isCurrentBinding) {
              isSet = true;
              updatedY = pin.targetY; // Locks to target
            }
          } else if (updatedY > targetMax) {
            isOverset = true;
          }

          // Trigger effects on state changes
          if (isSet && !pin.isSet) {
            // Pin set click sound!
            setTimeout(() => {
              playPinClick(true);
            }, 5);
            
            // Increment the binding chain
            const nextIdx = currentBindingIndex + 1;
            setCurrentBindingIndex(nextIdx);
            
            if (nextIdx >= pins.length) {
              // ALL PINS SET! LOCK OPENS
              triggerUnlock();
            } else {
              setFeedbackMsg(`${pin.label}が「カチッ」と設定位置で固定されました！次の硬いピンを探してください。`);
            }
          }

          if (isOverset && !pin.isOverset) {
            // Overset damages pick slightly and locks the cylinder
            setPickHealth(p => {
              const updated = p - 10;
              if (updated <= 0) {
                triggerBreak();
              }
              return Math.max(0, updated);
            });
            setFeedbackMsg(`${pin.label}を押し込みすぎました！シリンダーが固着し、ピックを痛めています。`);
          }

          return {
            ...pin,
            currentY: updatedY,
            isSet: pin.isSet || isSet,
            isOverset: isOverset
          };
        }
        
        return pin;
      });
    });
  };

  // Reset lock pick lift when key/mouse is released
  const releasePick = () => {
    if (isUnlocked) return;
    setPickLift(0);
    setPins((prevPins) => {
      return prevPins.map((pin) => {
        // If pin is set, it stays. Otherwise, it drops back down
        return pin.isSet ? pin : { ...pin, currentY: 0, isOverset: false };
      });
    });
  };

  const triggerUnlock = () => {
    setIsUnlocked(true);
    playUnlockSound();
    playSuccessJingle();
    setFeedbackMsg('全ピンの噛み合わせが並び、シリンダーが回転しました！');
    setTimeout(() => {
      onSuccess(lock.scoreBonus * 1.2); // extra multiplier for realistic pin puzzle
    }, 2000);
  };

  const triggerBreak = () => {
    playBreakSound();
    setPickLift(0);
    // Release all non-set pins
    setPins(p => p.map(pin => ({ ...pin, currentY: pin.isSet ? pin.targetY : 0, isOverset: false })));
    onPickBreak();
  };

  const handleResetLockObj = () => {
    // Release all pins and reset order
    setPins(p => p.map(pin => ({ ...pin, currentY: 0, isSet: false, isOverset: false })));
    setCurrentBindingIndex(0);
    setPickPositionX(0);
    setPickLift(0);
    setIsUnlocked(false);
    setPickHealth(100);
    setFeedbackMsg('南京錠をリセットしました。第3ピンが一番最初に引っかかります。');
  };

  return (
    <div className="flex flex-col flex-1 bg-[#09090b] text-[#e2e2e7] overflow-hidden" id="pin-tumbler-screen">
      
      {/* 1. Upper status HUD */}
      <div className="flex items-center justify-between p-4 bg-[#09090b] border-b border-zinc-850">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-xs transition duration-200 cursor-pointer flex items-center gap-2 border border-zinc-800"
          >
            ← 一覧に戻る
          </button>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-amber-100 font-sans">
              パズル：{lock.name} (カットモデル透視)
            </h1>
            <p className="text-[10px] text-zinc-500 mt-0.5">ピンタンブラー式。各ピンを一つずつ押し上げて、正しい位置（シアライン）に揃えましょう。</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleResetLockObj}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 active:rotate-180 border border-zinc-800 transition-all rounded text-zinc-400 hover:text-white"
            title="ロックを初期化"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={toggleSound}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded text-zinc-300 cursor-pointer"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-5xl mx-auto w-full">
        
        {/* Cutaway visualization of the Lock Cylinder and Pins */}
        <div className="w-full bg-zinc-950 border border-zinc-850 rounded p-6 shadow-2xl relative">
          
          {/* Header Legend */}
          <div className="flex justify-between items-center mb-6 text-xs text-zinc-500 border-b border-zinc-900 pb-3">
            <span className="flex items-center gap-1.5"><Info size={13} className="text-amber-100" /> ルール: 硬いピン（バインディングピン）を順にカチッとなるまで押し上げます。</span>
            <span className="font-mono bg-amber-950/15 text-amber-100 px-2.5 py-0.5 rounded border border-amber-900/30">
              バインド状況: {currentBindingIndex} / 5 ピン開錠
            </span>
          </div>

          <div className="relative h-64 w-full flex items-end justify-around border-b border-zinc-900 pb-12 pt-6 bg-[#09090b] rounded overflow-hidden border-t border-x border-zinc-850 px-4">
            
            {/* Shear line dashed wire guide */}
            <div className="absolute left-0 right-0 h-px border-t border-dashed border-amber-600/30" style={{ bottom: 'calc(3rem + 50%)' }}>
              <span className="absolute -top-3.5 left-3 text-[10px] text-amber-100/70 font-mono tracking-wider flex items-center gap-1">
                剪断線 (シアライン - SHEAR LINE) <Zap size={8} />
              </span>
            </div>

            {/* Pins Render loop */}
            {pins.map((pin, idx) => {
              const isActive = idx === activePinIndex;
              const currentBindingPinIdx = bindingOrder[currentBindingIndex];
              const isBinding = idx === currentBindingPinIdx && !pin.isSet;
              
              // Pin structural height representation
              // Pushing from bottom shifts Driver pin and Key pin upwards
              const liftY = pin.currentY; // 0 to 100
              
              return (
                <div key={pin.id} className="relative w-12 flex flex-col items-center h-full group">
                  {/* Outer Brass housing column */}
                  <div className="absolute inset-x-0 top-0 bottom-0 bg-zinc-900/60 border-x border-zinc-800/40 rounded flex flex-col justify-between pointer-events-none">
                    <span className="text-[9px] text-zinc-600 font-mono mt-1 text-center">{idx + 1}</span>
                  </div>

                  {/* Spring Representation */}
                  <div className="absolute top-1 w-2 bg-gradient-to-b from-zinc-600 to-zinc-500 rounded-sm" 
                       style={{ height: `${30 - liftY * 0.25}px` }} 
                  />

                  {/* Red Driver Pin (Top segment) */}
                  <div 
                    className={`absolute w-7 h-10 rounded-sm shadow-md transition-transform duration-75 text-center flex items-center justify-center ${
                      pin.isSet 
                        ? 'bg-zinc-600 border border-zinc-500' 
                        : pin.isOverset
                          ? 'bg-rose-500 border border-rose-400'
                          : isBinding 
                            ? 'bg-amber-600 border border-amber-400 animate-pulse'
                            : 'bg-zinc-400 border border-zinc-300'
                    }`}
                    style={{ 
                      bottom: `calc(40px + ${liftY * 0.9}px)`, 
                      height: '35px',
                    }}
                  >
                    <span className="text-[8px] text-black font-extrabold">{pin.isSet ? 'SET' : 'D'}</span>
                  </div>

                  {/* Yellow Key Pin (Bottom segment) */}
                  <div 
                    className={`absolute w-7 rounded-sm shadow-md transition-transform duration-75 text-center flex items-end justify-center pb-1 ${
                      pin.isSet 
                        ? 'bg-cyan-500 border border-cyan-400' 
                        : isActive 
                          ? 'bg-amber-400 border border-amber-300' 
                          : 'bg-yellow-500 border border-yellow-400'
                    }`}
                    style={{ 
                      bottom: `calc(1px + ${liftY * 0.9}px)`, 
                      height: '38px',
                    }}
                  >
                    <span className="text-[8px] text-slate-950 font-bold">K</span>
                  </div>

                  {/* Active lockpick hovering helper bubble */}
                  {isActive && (
                    <motion.div 
                      layoutId="active-marker"
                      className="absolute -bottom-8 px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] rounded font-bold uppercase tracking-wider"
                    >
                      PICK
                    </motion.div>
                  )}
                </div>
              );
            })}

            {/* Lockpick SVG Hook lying at keyhole bottom, tracking pickPositionX and pickLift */}
            <div 
              style={{ 
                left: `${pickPositionX}%`,
                bottom: `calc(10px + ${pickLift * 0.9}px)`,
                transform: 'translateX(-50%)'
              }}
              className="absolute w-24 h-8 transition-all duration-75 pointer-events-none flex items-start"
            >
              <svg viewBox="0 0 100 30" className="w-full h-full filter drop-shadow">
                {/* Pick shaft */}
                <path d="M 0 25 L 80 25 Q 90 25 95 15" stroke="#71717a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                {/* Pick tip highlight */}
                <circle cx="95" cy="15" r="3" fill="#bb944d" className={pickLift > 10 ? "animate-ping" : ""} />
              </svg>
            </div>
            
          </div>

          {/* System status feedback line */}
          <div className="mt-4 p-3 bg-[#09090b] rounded border border-zinc-850 text-center text-xs text-amber-100 font-mono font-medium">
            {feedbackMsg}
          </div>
        </div>

        {/* Double-slider console to move and lift pins */}
        <div className="w-full max-w-xl flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Position slider */}
            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded text-xs">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-zinc-400 font-sans">ピックの挿入深度</span>
                <span className="font-mono text-amber-200 font-semibold text-[11px]">Chamber {activePinIndex + 1}</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={pickPositionX}
                onChange={(e) => handleXMove(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-900 rounded appearance-none cursor-ew-resize accent-amber-500"
                disabled={isUnlocked}
              />
              <div className="flex justify-between text-[9px] text-zinc-550 mt-1 font-mono">
                <span>手前 (第1ピン)</span>
                <span>奥側 (第5ピン)</span>
              </div>
            </div>

            {/* Lifting Slide controller */}
            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded text-xs">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-zinc-400 font-sans">ピン押し上げ力 (リフター)</span>
                <span className="font-mono text-amber-500 font-semibold text-[11px]">{Math.round(pickLift)}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="95"
                value={pickLift}
                onChange={(e) => handleLift(Number(e.target.value))}
                onMouseUp={releasePick}
                onTouchEnd={releasePick}
                className="w-full h-1.5 bg-zinc-900 rounded appearance-none cursor-ns-resize accent-amber-500"
                disabled={isUnlocked}
              />
              <div className="flex justify-between text-[9px] text-zinc-550 mt-1 font-mono">
                <span>離してリセット</span>
                <span>高く押し上げる</span>
              </div>
            </div>

          </div>

          {/* Quick help instruction */}
          <div className="bg-zinc-950/40 border border-zinc-850 p-3 rounded text-center">
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              <strong className="text-amber-100">ヒント:</strong> バインディングピン以外のピンを押し上げても跳ね返るだけで固定されません。一番バネ応力の感触が硬いピン（押し上げたときに他よりわずかに反発があり、シアラインに到達すると固定されるピン）を順に見つけましょう。
            </p>
          </div>

          {/* Durability status meter */}
          <div className="bg-zinc-950 border border-zinc-850 px-4 py-3 rounded flex items-center justify-between shadow-sm">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">ピックの耐久率: </span>
            <div className="flex items-center gap-3 w-2/3">
              <div className="flex-1 bg-zinc-900 h-2 rounded overflow-hidden border border-zinc-800">
                <div style={{ width: `${pickHealth}%` }} className={`h-full ${pickHealth > 30 ? 'bg-zinc-400' : 'bg-rose-600'}`} />
              </div>
              <span className="font-mono text-xs font-bold text-zinc-300">{pickHealth}%</span>
            </div>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {isUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-16 mx-auto max-w-md bg-zinc-950/95 border border-zinc-800 p-5 rounded shadow-2xl flex items-center justify-between gap-4 z-50 backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-950/20 rounded-full flex items-center justify-center text-amber-200">
                <CheckCircle2 size={20} />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">Puzzle Solved</h4>
                <p className="text-xs text-[#e2e2e7] mt-0.5 font-sans">全てのピンが綺麗にシアラインで噛み合いました。</p>
              </div>
            </div>
            <span className="text-amber-400 font-mono text-sm font-bold flex items-center gap-1">
              +{Math.round(lock.scoreBonus * 1.2)} pts
            </span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
