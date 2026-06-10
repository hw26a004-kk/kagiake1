import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, Award, Sliders, Play, Settings, RefreshCw, Volume2, VolumeX, Info,
  BookOpen, Trophy, ShieldCheck, Zap, Flame, Compass, Lock, CheckCircle2, AlertTriangle, Coffee, Sparkles,
  Music
} from 'lucide-react';
import { LockConfig, PlayMode, GameStats, Difficulty } from './types';
import { LOCK_PRESETS } from './data';
import { LockpickGame } from './components/LockpickGame';
import { PinTumblerGame } from './components/PinTumblerGame';
import { Instructions } from './components/Instructions';
import { playSuccessJingle, setMuted, setVolume, startBGM, stopBGM } from './audio';

export default function App() {
  // Global player states
  const [stats, setStats] = useState<GameStats>({
    lockpicks: 15,
    maxLockpicks: 15,
    picksBroken: 0,
    locksCleared: 0,
    totalTimePlayed: 0,
    highScore: 0,
    experience: 0,
    money: 1000
  });

  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(true);
  const [level, setLevel] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<PlayMode>('levels');
  const [unlockedStages, setUnlockedStages] = useState<string[]>(['tutorial-lock', 'leather-bag', 'simple-padlock']);
  
  // Automatically clear action messages
  useEffect(() => {
    if (lastActionMsg) {
      const timer = setTimeout(() => {
        setLastActionMsg(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [lastActionMsg]);

  // Active playing stage
  const [activeLock, setActiveLock] = useState<LockConfig | null>(null);
  const [activePlayStyle, setActivePlayStyle] = useState<'rotation' | 'tumbler'>('rotation');

  // Time Attack states
  const [timeAttackActive, setTimeAttackActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [timeAttackScore, setTimeAttackScore] = useState<number>(0);
  const [timeAttackLocksCleared, setTimeAttackLocksCleared] = useState<number>(0);

  // Custom Lock Creator States
  const [customLock, setCustomLock] = useState<LockConfig>({
    id: 'custom-lock',
    name: '特注の金属金庫錠',
    difficulty: 'adept',
    sweetSpotCenter: 90,
    sweetSpotWidth: 6,
    durabilityFactor: 1.2,
    description: 'スライダーで作られたオリジナルの安全シリンダー。',
    isUnlocked: true,
    scoreBonus: 500
  });

  // Calculate RPG titles based on Player Level
  const getLevelTitle = (lvl: number): string => {
    if (lvl >= 10) return '影のレジェンド';
    if (lvl >= 7) return '凄腕のチェスト破り';
    if (lvl >= 5) return '金庫クラッカー';
    if (lvl >= 3) return '錠前破りのマスター';
    if (lvl >= 2) return '駆け出しピッカー';
    return '見習い職人';
  };

  // Convert stats EXP to Level
  useEffect(() => {
    const calculatedLevel = Math.floor(Math.sqrt(stats.experience / 100)) + 1;
    if (calculatedLevel > level) {
      setLevel(calculatedLevel);
      playSuccessJingle();
    }
  }, [stats.experience, level]);

  // Audio system linkage
  useEffect(() => {
    setMuted(!soundEnabled);
    setVolume(0.5);
    
    if (soundEnabled && bgmEnabled) {
      startBGM();
    } else {
      stopBGM();
    }
    
    return () => {
      stopBGM();
    };
  }, [soundEnabled, bgmEnabled]);

  // ユーザーの最初のアクションでWeb Audioのサスペンドを安全に解除・BGMを再生するフォールバック
  useEffect(() => {
    const handleFirstGesture = () => {
      if (soundEnabled && bgmEnabled) {
        startBGM();
      }
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
    window.addEventListener('click', handleFirstGesture);
    window.addEventListener('touchstart', handleFirstGesture);
    window.addEventListener('keydown', handleFirstGesture);
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [soundEnabled, bgmEnabled]);

  // Backwards scheduler for Time Attack Countdown
  useEffect(() => {
    let timer: any = null;
    if (timeAttackActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Out of time! End game
            setTimeAttackActive(false);
            // Submit highscore check
            setStats(curr => ({
              ...curr,
              highScore: Math.max(curr.highScore, timeAttackScore)
            }));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timeAttackActive, timeLeft, timeAttackScore]);

  // Refill picks if empty or broken
  const handleRefillPicks = () => {
    if (stats.lockpicks >= stats.maxLockpicks) return;

    // Cost of 5 picks is ¥200
    const cost = 200;
    if (stats.money < cost && stats.lockpicks === 0) {
      // Emergency refill if they have 0 picks AND 0 money so they are never softlocked!
      // They get 3 emergency picks, but money stays at 0.
      setStats(prev => ({
        ...prev,
        lockpicks: Math.min(prev.lockpicks + 3, prev.maxLockpicks)
      }));
      setLastActionMsg("資金が不足しているため、応急救済措置としてピックが 3本 付与されました。");
      return;
    }

    setStats(prev => {
      if (prev.money < cost && prev.lockpicks > 0) {
        // They have some picks left but not enough money to buy more
        return prev;
      }

      const nextMoney = Math.max(0, prev.money - cost);
      return {
        ...prev,
        money: nextMoney,
        lockpicks: Math.min(prev.lockpicks + 5, prev.maxLockpicks)
      };
    });

    setLastActionMsg(`¥200 を支払い、ピックを 5本 購入しました。`);
  };

  // Handles successfully picking a lock
  const handleStageSuccess = (scoreReward: number) => {
    let rewardedMoney = 300; // default for custom or other locks
    if (activeLock) {
      const moneyRewardMap: Record<Difficulty, number> = {
        novice: 200,
        apprentice: 400,
        adept: 700,
        expert: 1200,
        master: 2000
      };
      rewardedMoney = moneyRewardMap[activeLock.difficulty] || 350;
    }

    setLastActionMsg(`開錠成功！報奨金 ¥${rewardedMoney} を獲得しました！`);

    // Stage update logs
    setStats(curr => {
      const nextExp = curr.experience + scoreReward;
      return {
        ...curr,
        locksCleared: curr.locksCleared + 1,
        experience: nextExp,
        money: curr.money + rewardedMoney
      };
    });

    if (activeLock) {
      // Unlock subsequent locks
      const currentIndex = LOCK_PRESETS.findIndex(l => l.id === activeLock.id);
      if (currentIndex !== -1 && currentIndex < LOCK_PRESETS.length - 1) {
        const nextLockId = LOCK_PRESETS[currentIndex + 1].id;
        if (!unlockedStages.includes(nextLockId)) {
          setUnlockedStages(prev => [...prev, nextLockId]);
        }
      }
    }

    // Time Attack scoring updates
    if (timeAttackActive) {
      setTimeAttackScore(prev => prev + scoreReward);
      setTimeAttackLocksCleared(prev => prev + 1);
      // Spawn new random lock in active window
      generateRandomTimeAttackLock();
    } else {
      setActiveLock(null);
    }
  };

  // Lockpick snaps counter
  const handlePickBreak = () => {
    setStats(curr => {
      const remaining = Math.max(0, curr.lockpicks - 1);
      const isRunOut = curr.lockpicks > 0 && remaining === 0;
      const penalty = isRunOut ? 300 : 0;
      
      if (isRunOut) {
        setLastActionMsg(`工具が全て破損しました！調達ペナルティとして ¥${penalty} 引かれました。`);
      }
      
      return {
        ...curr,
        lockpicks: remaining,
        picksBroken: curr.picksBroken + 1,
        money: Math.max(0, curr.money - penalty)
      };
    });
  };

  // Turn Sound on/off
  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  // Launch pre-configured game
  const startPresetStage = (lock: LockConfig, style: 'rotation' | 'tumbler') => {
    setActivePlayStyle(style);
    setActiveLock({ ...lock });
  };

  // Launch Custom Lock Pick Test
  const startCustomLockGame = (style: 'rotation' | 'tumbler') => {
    setActivePlayStyle(style);
    setActiveLock(customLock);
  };

  // Time Attack Initialization
  const startTimeAttack = () => {
    setTimeLeft(60);
    setTimeAttackScore(0);
    setTimeAttackLocksCleared(0);
    setTimeAttackActive(true);
    generateRandomTimeAttackLock();
  };

  const generateRandomTimeAttackLock = () => {
    // Generate randomized sweetspots and ranges
    const randomCenter = Math.floor(Math.random() * 150) + 15; // 15 to 165deg
    const randomWidth = Math.max(2.5, 12 - timeAttackLocksCleared * 1.5); // progressively tighter
    const difficultiesArr: Difficulty[] = ['novice', 'apprentice', 'adept', 'expert', 'master'];
    const diffIdx = Math.min(4, Math.floor(timeAttackLocksCleared / 2));
    
    const randomLock: LockConfig = {
      id: `timeattack-${Date.now()}`,
      name: `機密コンテナ第 ${timeAttackLocksCleared + 1} 重隔壁`,
      difficulty: difficultiesArr[diffIdx],
      sweetSpotCenter: randomCenter,
      sweetSpotWidth: randomWidth,
      durabilityFactor: 1.0 + timeAttackLocksCleared * 0.4,
      description: '時間制限付きの緊急ハッキング防壁シリンダー。',
      isUnlocked: true,
      scoreBonus: 150 + timeAttackLocksCleared * 100
    };

    setActivePlayStyle('rotation'); // timeattack matches traditional Skyrim rotators for speed
    setActiveLock(randomLock);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e2e2e7] flex flex-col font-sans selection:bg-amber-900/30 selection:text-amber-200" id="applet-viewport">
      
      {/* 1. Universal Top Navigation Bar */}
      <header className="border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-zinc-900 border border-zinc-850 text-amber-100 rounded rotate-3 text-center shadow-lg">
            <Key size={18} className="animate-pulse text-amber-200" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-sans font-bold block">Mechanical Trainer</span>
            <h1 className="text-lg md:text-xl tracking-tight italic font-serif text-amber-100">
              鍵開けシミュレーター
            </h1>
          </div>
        </div>

        {/* Player Profile Progress Badges */}
        <div className="flex items-center gap-4 bg-zinc-900/30 border border-zinc-800 px-4 py-2 rounded-lg flex-wrap justify-center sm:flex-nowrap">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Lv.{level} {getLevelTitle(level)}</p>
            <div className="w-24 bg-zinc-950 h-1 rounded-full mt-1.5 overflow-hidden border border-zinc-850">
              <div 
                className="h-full bg-amber-400 opacity-85"
                style={{ width: `${Math.min(100, (stats.experience % 100))}%` }}
              />
            </div>
          </div>
          <div className="w-px h-8 bg-zinc-800 hidden sm:block" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">所持金</p>
            <p className="text-xs font-mono font-bold mt-0.5 text-emerald-400">
              ¥{stats.money.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-950/20 px-2 rounded-lg border border-zinc-850/60 h-10 select-none">
            <button
              onClick={() => setBgmEnabled(!bgmEnabled)}
              className={`p-1.5 rounded transition cursor-pointer flex items-center justify-center ${
                bgmEnabled && soundEnabled
                  ? 'bg-amber-950/50 text-amber-200'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
              title={bgmEnabled ? "BGMを消音" : "BGMを再生"}
            >
              <Music size={13} className={bgmEnabled && soundEnabled ? 'animate-pulse' : ''} />
            </button>
            <div className="w-px h-4 bg-zinc-800" />
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded transition cursor-pointer flex items-center justify-center ${
                soundEnabled
                  ? 'bg-amber-950/50 text-amber-200'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
              title={soundEnabled ? "効果音OFF" : "効果音ON"}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
          </div>
          <div className="text-center bg-zinc-950/20 px-2.5 py-1 rounded border border-zinc-850/60">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">ピック</p>
            <p className={`text-xs font-mono font-bold mt-0.5 ${stats.lockpicks <= 3 ? 'text-rose-400 animate-pulse' : 'text-amber-100'}`}>
              {stats.lockpicks} <span className="text-zinc-500 font-normal text-[10px]">/ 15</span>
            </p>
          </div>
          {stats.lockpicks < 15 && (
            <button 
              onClick={handleRefillPicks}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded transition cursor-pointer flex items-center gap-1 ${
                stats.lockpicks === 0 
                  ? 'bg-rose-950/40 border border-rose-800 text-rose-300 hover:bg-rose-900/50 animate-bounce' 
                  : 'bg-zinc-900 border border-zinc-850 text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
              }`}
              title="ピック5本を購入します（価格: ¥200）"
            >
              補充する {stats.lockpicks === 0 ? '(¥200応急)' : '(¥200)'}
            </button>
          )}
        </div>
      </header>

      {/* Dynamic Toast Message Overlay */}
      <AnimatePresence>
        {lastActionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-auto px-4 pointer-events-none"
          >
            <div className="bg-zinc-950/95 border border-amber-900/30 text-amber-100/90 text-[11px] text-center py-3 px-4 rounded shadow-2xl backdrop-blur-md flex items-center justify-center gap-2 pointer-events-auto">
              <Sparkles size={13} className="text-amber-400 shrink-0 animate-pulse" />
              <span>{lastActionMsg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Main Switchboard Interface OR Playing Mode overlay */}
      <main className="flex-1 flex flex-col relative w-full overflow-y-auto">
        
        <AnimatePresence mode="wait">
          {activeLock ? (
            /* Current Gameplay View (Conditional render between Skyrim-rotation/Pin-tumbler style) */
            <motion.div 
              key="gameplay"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              {activePlayStyle === 'rotation' ? (
                <LockpickGame 
                  lock={activeLock}
                  stats={stats}
                  onSuccess={handleStageSuccess}
                  onPickBreak={handlePickBreak}
                  onBack={() => { setActiveLock(null); setTimeAttackActive(false); }}
                  soundEnabled={soundEnabled}
                  toggleSound={toggleSound}
                />
              ) : (
                <PinTumblerGame 
                  lock={activeLock}
                  stats={stats}
                  onSuccess={handleStageSuccess}
                  onPickBreak={handlePickBreak}
                  onBack={() => { setActiveLock(null); setTimeAttackActive(false); }}
                  soundEnabled={soundEnabled}
                  toggleSound={toggleSound}
                />
              )}

              {/* Time Attack HUD component if active */}
              {timeAttackActive && (
                <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex justify-between items-center z-40">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-rose-400 font-bold flex items-center gap-1.5 animate-pulse">
                      残り時間: {timeLeft}秒
                    </span>
                    <span className="text-xs text-slate-400">
                      開錠数: {timeAttackLocksCleared}個
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-amber-400 font-mono">
                    Time Attack Score: {timeAttackScore} pts
                  </span>
                </div>
              )}
            </motion.div>

          ) : (
            /* Main Menu & Controls Tabs Dashboard */
            <motion.div 
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 md:p-8 flex flex-col gap-8 max-w-5xl mx-auto w-full"
            >
              
              {/* Tabs list controls */}
              <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded max-w-lg mx-auto w-full shadow-lg">
                <button
                  onClick={() => setActiveTab('levels')}
                  className={`flex-1 py-2 rounded text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'levels' ? 'bg-[#09090b] text-amber-200 shadow border border-zinc-750' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Trophy size={13} /> 遺跡開錠ロード (Stages)
                </button>
                <button
                  onClick={() => setActiveTab('timeAttack')}
                  className={`flex-1 py-2 rounded text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'timeAttack' ? 'bg-[#09090b] text-amber-200 shadow border border-zinc-750' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Flame size={13} /> タイムアタック
                </button>
                <button
                  onClick={() => { setActiveTab('custom'); }}
                  className={`flex-1 py-2 rounded text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'custom' ? 'bg-[#09090b] text-amber-200 shadow border border-zinc-750' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Sliders size={13} /> カスタム
                </button>
                <button
                  onClick={() => setActiveTab('training')}
                  className={`flex-1 py-2 rounded text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'training' ? 'bg-[#09090b] text-amber-200 shadow border border-zinc-750' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <BookOpen size={13} /> 技術書
                </button>
              </div>

              {/* TAB CONTENTS VIEW */}
              <div className="flex-1 min-h-[400px]">
                
                {/* 1. LEVELS STAGE LOCK LIST */}
                {activeTab === 'levels' && (
                  <div className="flex flex-col gap-6" id="levels-view">
                    <div className="flex justify-between items-center border-b border-zinc-850 pb-4">
                      <div>
                        <h2 className="text-xl font-serif italic text-amber-100 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-amber-200" /> ステージ攻略モード
                        </h2>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mt-1">Select an active cylinder file to begin crack trial</span>
                      </div>
                      <div className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded font-mono">
                        全開錠: {stats.locksCleared} / 破損ピン数: {stats.picksBroken}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {LOCK_PRESETS.map((lock) => {
                        const isUnlocked = unlockedStages.includes(lock.id);
                        
                        const blockStyle = {
                          novice: 'text-emerald-400',
                          apprentice: 'text-cyan-400',
                          adept: 'text-amber-400',
                          expert: 'text-orange-400',
                          master: 'text-rose-400'
                        }[lock.difficulty];

                        const badgeStyle = {
                          novice: 'border-emerald-950 bg-emerald-950/10 text-emerald-400',
                          apprentice: 'border-cyan-950 bg-cyan-950/10 text-cyan-400',
                          adept: 'border-amber-950 bg-amber-950/10 text-amber-400',
                          expert: 'border-orange-950 bg-orange-950/10 text-orange-400',
                          master: 'border-rose-950 bg-rose-950/10 text-rose-400'
                        }[lock.difficulty];

                        return (
                          <div 
                            key={lock.id}
                            className={`relative bg-zinc-950 border border-zinc-850 hover:border-zinc-700 transition duration-300 p-5 rounded-lg flex flex-col justify-between overflow-hidden shadow-xl ${
                              !isUnlocked ? 'opacity-40 select-none cursor-not-allowed border-zinc-900' : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1.5 mb-3.5">
                                <span className={`px-2 py-0.5 rounded text-[8px] tracking-widest font-mono border uppercase font-bold ${badgeStyle}`}>
                                  {lock.difficulty}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">+{lock.scoreBonus} pts</span>
                              </div>

                              <div className="flex items-start gap-2.5">
                                <div className="text-zinc-500 mt-1">
                                  {isUnlocked ? <Key size={14} className="text-amber-200/60" /> : <Lock size={14} className="text-zinc-700" />}
                                </div>
                                <h3 className="text-sm font-bold text-zinc-200 tracking-wide font-sans leading-snug">{lock.name}</h3>
                              </div>
                              <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed font-sans">{lock.description}</p>
                            </div>

                            <div className="mt-5 pt-4 border-t border-zinc-900 flex flex-col gap-2">
                              {isUnlocked ? (
                                <div className="grid grid-cols-2 gap-2">
                                  
                                  <button
                                    onClick={() => startPresetStage(lock, 'rotation')}
                                    className="p-2 bg-amber-900/40 hover:bg-amber-800/50 text-amber-200 hover:text-white border border-amber-850 rounded text-xs font-semibold tracking-wide transition flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Compass size={12} /> 回転式 (実戦)
                                  </button>

                                  <button
                                    onClick={() => startPresetStage(lock, 'tumbler')}
                                    className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded text-xs font-semibold tracking-wide transition flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Sliders size={12} /> ピンパズル
                                  </button>
                                  
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 justify-center py-1">
                                  <Lock size={11} /> 前段階の鍵を解除してアンロック
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. TIME ATTACK THEMED PANEL */}
                {activeTab === 'timeAttack' && (
                  <div className="flex items-center justify-center py-6" id="time-attack-view">
                    <div className="max-w-md w-full bg-zinc-950 border border-zinc-850 p-6 md:p-8 rounded-lg shadow-xl flex flex-col items-center text-center gap-5">
                      
                      <div className="w-16 h-16 bg-rose-950/20 text-rose-400 rounded-full flex items-center justify-center animate-pulse border border-rose-900/50">
                        <Flame size={28} />
                      </div>

                      <div>
                        <h2 className="text-xl font-serif italic text-amber-100">60秒間、極限ハッキング</h2>
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mt-1">High stress security cracking drill</span>
                        <p className="text-xs text-zinc-400 mt-3.5 leading-relaxed">
                          制限時間は60秒。ランダムなスイートスポットを持った即興防壁が次々に出現します。あなたのハッキング記録を更新しましょう！
                        </p>
                      </div>

                      <div className="w-full bg-zinc-900/40 p-4 rounded flex justify-around text-center border border-zinc-850">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">ハイスコア</p>
                          <p className="text-lg font-extrabold text-amber-200 mt-1 font-mono">{stats.highScore} pts</p>
                        </div>
                        <div className="w-px h-10 bg-zinc-800" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">平均開錠効率</p>
                          <p className="text-lg font-extrabold text-zinc-300 mt-1 font-mono">15.4秒 / 錠</p>
                        </div>
                      </div>

                      <div className="bg-amber-950/20 border border-amber-900/35 text-amber-200/90 text-[10px] px-3.5 py-2.5 rounded text-left leading-relaxed">
                        <span>注意: タイムアタック中もピックは通常通り折れて消費されます。予備をしっかりと持った状態で始めましょう（残り: {stats.lockpicks}本）。</span>
                      </div>

                      <button
                        onClick={startTimeAttack}
                        className="w-full py-3.5 bg-gradient-to-r from-rose-950/60 to-amber-900/40 hover:from-rose-900/60 hover:to-amber-800/50 text-amber-200 border border-rose-850 font-bold rounded text-xs tracking-wider transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play size={14} /> タイムアタック開始
                      </button>

                    </div>
                  </div>
                )}

                {/* 3. CUSTOM LOCK BUILDER TAB */}
                {activeTab === 'custom' && (
                  <div className="flex flex-col gap-6" id="custom-lock-view">
                    
                    <div className="border-b border-zinc-850 pb-4">
                      <h2 className="text-xl font-serif italic text-amber-100 flex items-center gap-2">
                        <Sliders size={16} className="text-amber-200" /> オリジナルシリンダーを設計
                      </h2>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mt-1">Configure and simulate custom security barriers</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950 border border-zinc-850 rounded-lg p-5 md:p-6 shadow-xl">
                      
                      {/* Sliders Control block */}
                      <div className="flex flex-col gap-5">
                        
                        {/* Title input name */}
                        <div>
                          <label className="block text-xs text-zinc-400 font-semibold mb-2">カスタムシリンダーの名称</label>
                          <input 
                            type="text" 
                            value={customLock.name}
                            onChange={(e) => setCustomLock(prev => ({ ...prev, name: e.target.value.slice(0, 32) }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 accent-amber-500 focus:outline-none focus:border-amber-700/60"
                          />
                        </div>

                        {/* Sweetspot Center slider */}
                        <div>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                            <span className="font-semibold">スイートスポット位置（角度）</span>
                            <span className="font-mono text-amber-200">{customLock.sweetSpotCenter}°</span>
                          </div>
                          <input 
                            type="range"
                            min="15"
                            max="165"
                            value={customLock.sweetSpotCenter}
                            onChange={(e) => setCustomLock(prev => ({ ...prev, sweetSpotCenter: Number(e.target.value) }))}
                            className="w-full h-1 bg-zinc-900 rounded appearance-none cursor-ew-resize accent-amber-400"
                          />
                          <span className="text-[9px] text-zinc-500 block mt-1">鍵を開けるピックの傾け角度を指定します。</span>
                        </div>

                        {/* Sweetspot Width slider */}
                        <div>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                            <span className="font-semibold">許容幅 / スポット幅（難易度）</span>
                            <span className="font-mono text-cyan-400">{customLock.sweetSpotWidth}°</span>
                          </div>
                          <input 
                            type="range"
                            min="1"
                            max="30"
                            step="0.5"
                            value={customLock.sweetSpotWidth}
                            onChange={(e) => {
                              const w = Number(e.target.value);
                              let diff: Difficulty = 'adept';
                              if (w >= 15) diff = 'novice';
                              else if (w >= 10) diff = 'apprentice';
                              else if (w >= 5) diff = 'adept';
                              else if (w >= 3) diff = 'expert';
                              else diff = 'master';

                              setCustomLock(prev => ({ 
                                ...prev, 
                                sweetSpotWidth: w,
                                difficulty: diff
                              }));
                            }}
                            className="w-full h-1 bg-zinc-900 rounded appearance-none cursor-ew-resize accent-cyan-400"
                          />
                          <span className="text-[9px] text-zinc-500 block mt-1">許容角度。1.5°以下で極限マスター難度、15°以上で入門難度になります。</span>
                        </div>

                        {/* Break stress factor durability */}
                        <div>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                            <span className="font-semibold">ピッキング負荷指数 (ダメージ比率)</span>
                            <span className="font-mono text-rose-400">{customLock.durabilityFactor}x</span>
                          </div>
                          <input 
                            type="range"
                            min="0.2"
                            max="4.0"
                            step="0.2"
                            value={customLock.durabilityFactor}
                            onChange={(e) => setCustomLock(prev => ({ ...prev, durabilityFactor: Number(e.target.value) }))}
                            className="w-full h-1 bg-zinc-900 rounded appearance-none cursor-ew-resize accent-rose-500"
                          />
                          <span className="text-[9px] text-zinc-500 block mt-1">圧力を間違えたときのピック負荷の速さ。値が大きいほど一瞬で金属疲労が蓄積します。</span>
                        </div>

                      </div>

                      {/* Launch Playground Option pane (Right column of Custom Builder) */}
                      <div className="flex flex-col justify-around bg-zinc-900/20 p-5 rounded border border-zinc-850 text-center gap-4">
                        
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-amber-200/80 font-mono font-bold tracking-widest uppercase">DYNAMIC SPECIFICATION</span>
                          <h3 className="text-sm font-bold text-zinc-200">{customLock.name}</h3>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            角度: {customLock.sweetSpotCenter}° | スポット幅: {customLock.sweetSpotWidth}° | 負荷: {customLock.durabilityFactor}倍
                          </p>
                        </div>

                        <div className="flex flex-col gap-2.5 max-w-xs mx-auto w-full">
                          <button
                            onClick={() => startCustomLockGame('rotation')}
                            className="w-full py-3 bg-amber-900/40 hover:bg-amber-800/50 text-amber-200 hover:text-white border border-amber-850 text-xs font-semibold rounded tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                          >
                            <Compass size={13} /> 回転式 (実戦) でテスト
                          </button>
                          
                          <button
                            onClick={() => startCustomLockGame('tumbler')}
                            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 hover:text-white border border-zinc-800 text-xs font-semibold rounded tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sliders size={13} /> ピンパズルでテスト
                          </button>
                        </div>

                        <p className="text-[9px] text-zinc-500 p-2 border-t border-zinc-900/60 leading-relaxed">
                          ※ カスタムロックのテスト開錠時にもスコアや経験値（基準値 500pts）が加算。ピック耐久の練習用としても活用いただけます。
                        </p>
                      </div>

                    </div>

                  </div>
                )}

                {/* 4. LOCKPICK HANDBOOK TECHNICAL GUIDE */}
                {activeTab === 'training' && (
                  <Instructions />
                )}

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* 3. Humble footer (No AI credits or telemetry) */}
      <footer className="border-t border-zinc-900 bg-[#09090b] py-4 px-6 flex justify-between items-center text-[10px] text-zinc-500 select-none">
        <span className="font-mono">LOCKPICK SIMULATOR v1.4</span>
        <span className="flex items-center gap-1 font-sans">
          キーボード操作：矢印キー（ピック移動）／スペース（テンション）
        </span>
      </footer>

    </div>
  );
}
