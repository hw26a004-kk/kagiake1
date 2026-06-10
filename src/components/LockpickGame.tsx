import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, Shield, Zap, Sparkles, RefreshCw, Volume2, VolumeX, Info,
  Award, Play, CheckCircle, Flame, AlertCircle, Eye, EyeOff, Key
} from 'lucide-react';
import { LockConfig, GameStats } from '../types';
import { 
  startScrapeSound, updateScrapeSound, stopScrapeSound, 
  playPickClick, startCreakSound, updateCreakSound, stopCreakSound, 
  playBreakSound, playUnlockSound, playSuccessJingle 
} from '../audio';

interface LockpickGameProps {
  lock: LockConfig;
  stats: GameStats;
  onSuccess: (score: number) => void;
  onPickBreak: () => void;
  onBack: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const LockpickGame: React.FC<LockpickGameProps> = ({
  lock,
  stats,
  onSuccess,
  onPickBreak,
  onBack,
  soundEnabled,
  toggleSound
}) => {
  // Game states
  const [pickAngle, setPickAngle] = useState<number>(90); // 0 to 180 degrees. 90 is center
  const [tension, setTension] = useState<number>(0);       // 0 to 100 tension intensity
  const [lockRotation, setLockRotation] = useState<number>(0); // 0 to 90 degrees cylinder rotation
  const [pickHealth, setPickHealth] = useState<number>(100);   // Current lockpick durability
  const [isJammed, setIsJammed] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [xRayEnabled, setXRayEnabled] = useState<boolean>(lock.difficulty === 'novice'); // visual helper
  const [showStats, setShowStats] = useState<boolean>(true);
  const [pickBrokenAnim, setPickBrokenAnim] = useState<boolean>(false);
  const [showTensionWarning, setShowTensionWarning] = useState<boolean>(false);

  // Animation ref & locks
  const requestRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number | null>(null);
  const spacePressedRef = useRef<boolean>(false);
  const lastPickAngleRef = useRef<number>(90);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Core physical formulas
  const sweetSpotCenter = lock.sweetSpotCenter;
  const sweetSpotWidth = lock.sweetSpotWidth;
  const toleranceHalf = sweetSpotWidth / 2;

  // Compute maximum possible rotation of the lock based on pick angle
  const getLockLimit = useCallback((angle: number): number => {
    const error = Math.abs(angle - sweetSpotCenter) - toleranceHalf;
    if (error <= 0) {
      return 90; // Perfect angle, can rotate fully to unlock
    } else {
      // Linear falloff: Skyrim scale
      // Close to the spot -> rotates further (up to ~80 deg)
      // Far from the spot -> rotates barely anything (2-5 deg max)
      const allowed = Math.max(3, 90 * (1 - Math.min(1, error / 32)));
      return allowed;
    }
  }, [sweetSpotCenter, toleranceHalf]);

  // Handle Pick Angle movement with scratching audio
  const handlePickMove = (newAngle: number) => {
    if (isUnlocked || pickBrokenAnim) return;
    
    // Clamp to 0 - 180
    const clampedAngle = Math.max(0, Math.min(180, newAngle));
    
    const diff = Math.abs(clampedAngle - lastPickAngleRef.current);
    if (diff > 0.5) {
      // Play tick sound when passing certain divisions (feel the lock ticks)
      const prevTick = Math.floor(lastPickAngleRef.current / 4);
      const currTick = Math.floor(clampedAngle / 4);
      if (prevTick !== currTick) {
        // High click audio
        playPickClick(0.6 + (clampedAngle % 10) / 20);
      }
      
      // Update scrape sound
      updateScrapeSound(diff);
      
      lastPickAngleRef.current = clampedAngle;
      setPickAngle(clampedAngle);
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUnlocked || pickBrokenAnim) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        spacePressedRef.current = true;
      }
      
      // Left / Right arrow keys for fine adjustments of the pick (1 degree increments)
      const step = 1;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePickMove(lastPickAngleRef.current - step);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handlePickMove(lastPickAngleRef.current + step);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        spacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    startScrapeSound();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopScrapeSound();
      stopCreakSound();
    };
  }, [isUnlocked, pickBrokenAnim]);

  // Main physics gameloop
  useEffect(() => {
    const loop = (time: number) => {
      if (prevTimeRef.current !== undefined && prevTimeRef.current !== null) {
        const delta = (time - prevTimeRef.current) / 1000; // seconds
        
        // Target rotation based on passive keyboard tension
        const wantsTension = spacePressedRef.current;
        
        // Dynamic stats updates
        if (wantsTension && !isUnlocked && !pickBrokenAnim) {
          setTension((prev) => Math.min(100, prev + delta * 300));
        } else {
          setTension((prev) => Math.max(0, prev - delta * 400));
          stopCreakSound();
        }

        // Lock cylinder rotation physics
        const maxRotationAllowed = getLockLimit(pickAngle);
        const targetRotation = (tension / 100) * 90;
        
        if (targetRotation >= maxRotationAllowed) {
          // Lock jammed! Pick is meeting resistance
          setLockRotation(maxRotationAllowed);
          
          if (maxRotationAllowed < 89.5) {
            setIsJammed(true);
            const excessTension = tension - (maxRotationAllowed / 90) * 100;
            
            if (excessTension > 0) {
              // High tension = high pick stress!
              const stressRatio = Math.min(1.0, excessTension / 40);
              updateCreakSound(stressRatio);
              
              // Apply pick damage based on difficulty factors
              const damage = delta * 15 * lock.durabilityFactor * stressRatio;
              setPickHealth((prev) => {
                const updated = prev - damage;
                if (updated <= 0) {
                  // Pick snapped!
                  triggerPickBreak();
                  return 0;
                }
                return updated;
              });
            }
          } else if (!isUnlocked && tension > 95) {
            // Unlocked!
            triggerUnlock();
          }
        } else {
          // Rotating smoothly
          setLockRotation(targetRotation);
          setIsJammed(false);
          stopCreakSound();
        }
      }
      prevTimeRef.current = time;
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tension, pickAngle, isUnlocked, pickBrokenAnim, getLockLimit]);

  const triggerPickBreak = () => {
    stopCreakSound();
    playBreakSound();
    setPickBrokenAnim(true);
    spacePressedRef.current = false;
    setTension(0);
    setLockRotation(0);
    setIsJammed(false);

    // Let the shattering animation play before penalizing
    setTimeout(() => {
      onPickBreak();
      setPickHealth(100);
      setPickAngle(90);
      setPickBrokenAnim(false);
    }, 1200);
  };

  const triggerUnlock = () => {
    setIsUnlocked(true);
    stopCreakSound();
    playUnlockSound();
    playSuccessJingle();
    spacePressedRef.current = false;
    setTension(0);
    setLockRotation(90);
    
    // Give success callback after short celebratory delays
    setTimeout(() => {
      onSuccess(lock.scoreBonus);
    }, 2000);
  };

  // Convert mouse/touch coordinates to Angle of picking dial
  const handleLockInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || isUnlocked || pickBrokenAnim) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    
    // Calculate angle in radians, convert to degrees (0 to 180)
    // -dy / dx handles upper-half semicircle picking
    let rad = Math.atan2(-dy, dx);
    let deg = (rad * 180) / Math.PI;
    
    // Shift so 0 is left, 90 is top, 180 is right
    if (deg < 0) {
      // lower semi-circle, snap to edges
      deg = dx < 0 ? 0 : 180;
    }
    
    handlePickMove(deg);
  };

  const difficultyMeta = {
    novice: { color: 'bg-emerald-500 text-emerald-950', border: 'border-emerald-600', text: '見習い' },
    apprentice: { color: 'bg-cyan-500 text-cyan-950', border: 'border-cyan-600', text: '駆け出し' },
    adept: { color: 'bg-yellow-500 text-yellow-950 border-amber-600', border: 'border-amber-600', text: '熟練者' },
    expert: { color: 'bg-orange-500 text-orange-950 border-orange-600', border: 'border-orange-600', text: '達人' },
    master: { color: 'bg-rose-500 text-rose-950 border-rose-600', border: 'border-rose-600', text: 'グランドマスター' }
  }[lock.difficulty];

  return (
    <div className="flex flex-col flex-1 relative bg-[#09090b] text-[#e2e2e7] overflow-hidden" id="lockpick-game-screen">
      
      {/* 1. Upper status HUD */}
      <div className="flex items-center justify-between p-4 bg-[#09090b] border-b border-zinc-850">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-xs transition duration-200 cursor-pointer flex items-center gap-2 border border-zinc-800"
            id="back-btn"
          >
            ← 一覧に戻る
          </button>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-amber-100 font-sans">{lock.name}</h1>
            <p className="text-[10px] text-zinc-500 mt-0.5">{lock.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[9px] tracking-widest uppercase font-bold rounded ${difficultyMeta.color} ${difficultyMeta.border} border`}>
            {difficultyMeta.text}
          </span>
          <button
            onClick={() => setXRayEnabled(!xRayEnabled)}
            className={`p-2 rounded text-xs transition border cursor-pointer ${
              xRayEnabled 
                ? 'bg-amber-900/20 text-amber-200 border-amber-800/40' 
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="シリンダー透視 (練習用)"
          >
            {xRayEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={toggleSound}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded text-zinc-300 cursor-pointer"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      {/* Main Lockpicking Playground splits into 2-Column or Centered layout */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-8 relative max-w-6xl mx-auto w-full">
        
        {/* Left Side: Interactive SVG Dial Area */}
        <div className="flex flex-col items-center select-none w-full max-w-sm md:max-w-md">
          {/* Instructions Overlay or Indicator */}
          <div className="text-center text-xs text-slate-400 mb-4 h-6">
            {!spacePressedRef.current && !isUnlocked && (
              <span className="animate-pulse text-amber-500/80 font-medium">
                マウス操作または左右キーでピックを傾け、[スペース]キーで鍵を回す
              </span>
            )}
            {isJammed && !isUnlocked && (
              <span className="text-rose-400 font-bold flex items-center justify-center gap-1">
                <AlertCircle size={14} className="animate-bounce" /> ピックに過重負荷！壊れる前に離して！
              </span>
            )}
            {isUnlocked && (
              <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                <Sparkles size={14} className="animate-spin" /> 開錠成功！お見事！
              </span>
            )}
          </div>

          {/* Interactive Lock Stage */}
          <div 
            ref={containerRef}
            onMouseMove={handleLockInteraction}
            onTouchMove={handleLockInteraction}
            className="relative w-64 h-64 md:w-80 md:h-80 bg-radial from-zinc-900/40 to-zinc-950 rounded-full border border-zinc-800 flex items-center justify-center cursor-crosshair box-border shadow-2xl overflow-visible shadow-amber-950/10"
            id="lockpicking-interactive-box"
          >
            {/* Visual Indicator of sweet spot if XRAY helper is toggled */}
            {xRayEnabled && (
              <svg className="absolute inset-0 w-full h-full transform -rotate-180 pointer-events-none scale-95 overflow-visible">
                <path
                  d={`M ${160 + 130 * Math.cos((sweetSpotCenter - toleranceHalf) * Math.PI / 180)} ${160 - 130 * Math.sin((sweetSpotCenter - toleranceHalf) * Math.PI / 180)} 
                     A 130 130 0 0 1 ${160 + 130 * Math.cos((sweetSpotCenter + toleranceHalf) * Math.PI / 180)} ${160 - 130 * Math.sin((sweetSpotCenter + toleranceHalf) * Math.PI / 180)}`}
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.25)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <circle 
                  cx={160 + 130 * Math.cos((sweetSpotCenter) * Math.PI / 180)} 
                  cy={160 - 130 * Math.sin((sweetSpotCenter) * Math.PI / 180)} 
                  r="5" 
                  fill="#bb944d"
                  className="animate-ping"
                />
              </svg>
            )}

            {/* Lock Plate Outer Ring */}
            <div className="absolute w-56 h-56 md:w-72 md:h-72 rounded-full border border-zinc-850/60 bg-gradient-to-br from-zinc-900 to-[#09090b] shadow-inner flex items-center justify-center pointer-events-none">
              
              {/* Lock Cylinder (Interior Core) - Rotates by lockRotation */}
              <div 
                style={{ transform: `rotate(${lockRotation}deg)` }}
                className="relative w-36 h-36 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-zinc-900 via-amber-950/10 to-zinc-950 border-[3px] border-zinc-800 shadow-lg flex items-center justify-center transition-transform duration-75 ease-out pointer-events-none overflow-hidden"
              >
                {/* Metallic shine texture overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
                
                {/* Micro notches/engravings for depth */}
                <div className="absolute inset-4 rounded-full border border-zinc-850/50" />
                <div className="absolute inset-10 rounded-full border border-zinc-900" />

                {/* Keyhole slot in the center */}
                <div className="relative w-6 h-20 md:w-8 md:h-24 bg-zinc-950 rounded-sm border border-zinc-900 flex flex-col items-center justify-between py-2 shadow-inner">
                  {/* Internal metal sliding lock core representation */}
                  <div className="w-1.5 h-6 bg-amber-500/10 rounded" />
                  {/* Pin slots outline */}
                  <div className="flex flex-col gap-1 w-2">
                    <div className="h-1 bg-zinc-900 rounded" />
                    <div className="h-1 bg-zinc-900 rounded" />
                    <div className="h-1 bg-zinc-900 rounded" />
                    <div className="h-1 bg-zinc-900 rounded" />
                  </div>
                  <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full border border-zinc-850" />
                </div>

                {/* Insertion representation of Tension Wrench (stuck into bottom of lock slot) */}
                <svg className="absolute w-12 h-12 text-zinc-500 filter drop-shadow" style={{ bottom: '15%', left: '35%' }}>
                  <path d="M 0 0 L 15 20 L 40 20" stroke="#71717a" strokeWidth="3" strokeLinecap="round" fill="none" />
                </svg>
              </div>
            </div>

            {/* Lockpick element, pivots in the center of the cylinder */}
            {/* Pick Angle uses mathematical transform. It swings from 0 to 180 degrees */}
            <div 
              style={{ 
                transform: `rotate(${180 - pickAngle + (isJammed ? (Math.sin(Date.now() * 1.5) * (tension * 0.08)) : 0)}deg)`,
                pointerEvents: 'none'
              }}
              className="absolute w-2 h-44 md:w-2.5 md:h-52 origin-bottom transition-transform duration-75 ease-out"
              // The pivot is at the bottom center of the lock. Let's position correctly
              // Offset bottom by half length to match keyhole center
            >
              {/* Lockpick Visual Probe body */}
              <div className="relative w-full h-[85%] bg-gradient-to-t from-zinc-300 to-zinc-400 rounded-full flex flex-col items-center overflow-visible">
                {/* Pick hook top head style */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-300 rounded-tl-full border-l-2 border-zinc-500 transform -rotate-12" />
                
                {/* Pick texture details */}
                <div className="absolute top-4 w-0.5 h-[80%] bg-zinc-500/20" />

                {/* Broken state indicator line */}
                {pickBrokenAnim && (
                  <motion.div 
                    initial={{ opacity: 1, scaleY: 1 }}
                    animate={{ opacity: 0.1, y: -40, rotate: 45 }}
                    transition={{ duration: 0.5 }}
                    className="absolute -top-6 w-5 h-8 bg-zinc-400 rounded"
                  />
                )}
              </div>
            </div>

            {/* Visual stress sparks/particle rings */}
            {isJammed && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <span className="w-16 h-16 rounded-full border-2 border-rose-500/30 animate-ping absolute" />
                <span className="w-24 h-24 rounded-full border border-rose-600/20 animate-ping absolute opacity-75" />
              </div>
            )}
          </div>

          {/* Accessability Angle Slider underneath lock */}
          <div className="w-full mt-6 px-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>← 左に傾ける</span>
              <span className="font-mono text-amber-500">
                ピック角度: {Math.round(pickAngle)}°
              </span>
              <span>右に傾ける →</span>
            </div>
            <input 
              type="range"
              min="0"
              max="180"
              value={pickAngle}
              onChange={(e) => handlePickMove(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              disabled={isUnlocked || pickBrokenAnim}
            />
          </div>
        </div>

        {/* Right Side: Informative feedback panel & Tension Controllers */}
        <div className="flex-1 flex flex-col gap-5 w-full max-w-sm">
          
          {/* Pick Durability Bar */}
          <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-lg shadow-lg">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Wrench size={13} className="text-zinc-500" /> ピックの耐久値
              </span>
              <span className={`font-mono font-bold ${pickHealth < 30 ? 'text-rose-400 animate-pulse' : 'text-zinc-300'}`}>
                {Math.round(pickHealth)}%
              </span>
            </div>
            <div className="w-full bg-zinc-900 h-2 rounded overflow-hidden border border-zinc-800">
              <motion.div 
                animate={{ width: `${pickHealth}%` }}
                transition={{ duration: 0.08 }}
                className={`h-full ${
                  pickHealth > 50 
                    ? 'bg-zinc-400' 
                    : pickHealth > 25 
                      ? 'bg-amber-600/70' 
                      : 'bg-rose-600'
                }`}
              />
            </div>
          </div>

          {/* Real-time Game State Info (Stress, Angle comparison) */}
          <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-lg flex flex-col gap-3">
            <div className="border-b border-zinc-900 pb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Telemetry Gauges</span>
            </div>
            
            {/* Cylinder Rotation Progress */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-500">シリンダー回転角 (90°で開錠)</span>
                <span className="font-mono text-zinc-300">{Math.round((lockRotation / 90) * 100)}%</span>
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded overflow-hidden">
                <div style={{ width: `${(lockRotation / 90) * 100}%` }} className="h-full bg-amber-400/80 transition-all duration-75" />
              </div>
            </div>

            {/* Tension feedback */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-500">シリンダー圧力強度 (テンション)</span>
                <span className="font-mono text-zinc-300">{Math.round(tension)}%</span>
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded overflow-hidden">
                <div style={{ width: `${tension}%` }} className={`h-full transition-all duration-75 ${isJammed ? 'bg-rose-600' : 'bg-amber-500/50'}`} />
              </div>
            </div>
          </div>

          {/* Interactive Action Hold Button (Apply Tension Wrench) */}
          <div className="flex flex-col gap-2 mt-2">
            <button
              onMouseDown={() => { spacePressedRef.current = true; }}
              onMouseUp={() => { spacePressedRef.current = false; }}
              onMouseLeave={() => { spacePressedRef.current = false; }}
              onTouchStart={() => { spacePressedRef.current = true; }}
              onTouchEnd={() => { spacePressedRef.current = false; }}
              className={`w-full py-5 px-6 rounded font-semibold tracking-wide text-center transition duration-200 uppercase select-none cursor-pointer flex flex-col items-center justify-center border ${
                isUnlocked 
                  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 cursor-not-allowed'
                  : pickBrokenAnim
                    ? 'bg-rose-950/20 text-rose-400 border-rose-900/30 cursor-not-allowed'
                    : isJammed
                      ? 'bg-rose-950 hover:bg-rose-900 text-rose-200 border-rose-800 animate-pulse shadow-lg'
                      : 'bg-amber-900/30 hover:bg-amber-900/45 text-amber-200 border-amber-850 active:scale-[0.99]'
              }`}
              id="tension-wrench-button"
            >
              <div className="flex items-center gap-2 text-xs">
                <Key size={14} className={spacePressedRef.current && !isJammed ? "animate-spin" : ""} />
                {isUnlocked ? '開錠されました！' : pickBrokenAnim ? 'ピックが破損しました' : 'テンション圧をかける (長押し)'}
              </div>
              <span className="text-[9px] text-zinc-500 font-normal mt-1 block">
                キーボードの [スペースキー] 長押しでも操作できます
              </span>
            </button>
          </div>

          {/* Player stats reference card */}
          <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3 flex justify-between text-center mt-2 shadow-sm">
            <div>
              <p className="text-[10px] text-zinc-500">所持ピック数</p>
              <p className="text-sm font-bold text-zinc-200 mt-0.5 font-mono">{stats.lockpicks}本</p>
            </div>
            <div className="border-r border-zinc-850 w-px" />
            <div>
              <p className="text-[10px] text-zinc-500">破損ピック</p>
              <p className="text-sm font-bold text-rose-400/90 mt-0.5 font-mono">{stats.picksBroken}本</p>
            </div>
            <div className="border-r border-zinc-850 w-px" />
            <div>
              <p className="text-[10px] text-zinc-500">通算開錠</p>
              <p className="text-sm font-bold text-amber-100 mt-0.5 font-mono">{stats.locksCleared}回</p>
            </div>
          </div>

        </div>

      </div>

      {/* Floating full-screen alerts for pick breaking / unlocking successes */}
      <AnimatePresence>
        {pickBrokenAnim && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-x-0 top-1/3 mx-auto max-w-sm bg-rose-950/95 border border-rose-500 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 text-center z-50 backdrop-blur"
          >
            <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500">
              <AlertCircle size={28} />
            </div>
            <div>
              <h4 className="text-base font-bold text-rose-200">ピキッ！ ピックが壊れた！</h4>
              <p className="text-xs text-rose-300 mt-1">
                テンションを掛けすぎたため、鍵穴の中で金属ピンに多大な負荷がかかり破損しました。
              </p>
            </div>
          </motion.div>
        )}

        {isUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-16 mx-auto max-w-md bg-emerald-950/95 border border-emerald-500 p-5 rounded-2xl shadow-2xl flex items-center justify-between gap-4 z-50 backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                <CheckCircle size={24} />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-emerald-200">「ガチャリ」と音が鳴りました！</h4>
                <p className="text-xs text-emerald-400 mt-0.5">
                  シリンダー内部が完全に回転し、施錠が解除されました。
                </p>
              </div>
            </div>
            <span className="text-amber-400 font-mono text-sm font-bold flex items-center gap-1">
              +{lock.scoreBonus} pts
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
