// Web Audio API Procedural Sound Effects Generator for Lockpick Simulator

let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let isMuted: boolean = false;
let globalVolume: number = 0.5;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.setValueAtTime(globalVolume, audioCtx.currentTime);
    masterGainNode.connect(audioCtx.destination);

    // Setup auto-resume on first user gesture to unlock Web Audio API restriction
    const resume = () => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          console.log("AudioContext successfully resumed on user gesture");
        });
      }
      window.removeEventListener('click', resume);
      window.removeEventListener('touchstart', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('click', resume);
    window.addEventListener('touchstart', resume);
    window.addEventListener('keydown', resume);
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => { /* silent */ });
  }
  return audioCtx;
}

export const setMuted = (muted: boolean) => {
  isMuted = muted;
  if (masterGainNode && audioCtx) {
    masterGainNode.gain.setValueAtTime(muted ? 0 : globalVolume, audioCtx.currentTime);
  }
};

export const setVolume = (volume: number) => {
  globalVolume = Math.max(0, Math.min(1, volume));
  if (masterGainNode && audioCtx && !isMuted) {
    masterGainNode.gain.setValueAtTime(globalVolume, audioCtx.currentTime);
  }
};

// 1. Lockpick scrape/move sound (Subtle metallic grinding)
let scratchOsc: OscillatorNode | null = null;
let scratchFilter: BiquadFilterNode | null = null;
let scratchGain: GainNode | null = null;

export const startScrapeSound = () => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (scratchOsc) return; // Already playing

    // Base noise and oscillator
    scratchOsc = ctx.createOscillator();
    scratchOsc.type = 'sawtooth';
    scratchOsc.frequency.setValueAtTime(100, ctx.currentTime);

    // Filter to make it metallic/thin
    scratchFilter = ctx.createBiquadFilter();
    scratchFilter.type = 'bandpass';
    scratchFilter.frequency.setValueAtTime(1800, ctx.currentTime);
    scratchFilter.Q.setValueAtTime(15, ctx.currentTime);

    // Gain node for safe volumes
    scratchGain = ctx.createGain();
    scratchGain.gain.setValueAtTime(0, ctx.currentTime);

    scratchOsc.connect(scratchFilter);
    scratchFilter.connect(scratchGain);
    if (masterGainNode) scratchGain.connect(masterGainNode);

    scratchOsc.start();
  } catch (e) {
    console.error('Failed to start scrape sound', e);
  }
};

export const updateScrapeSound = (velocity: number) => {
  if (isMuted || !scratchGain || !scratchOsc || !scratchFilter) return;
  try {
    const ctx = getAudioContext();
    const v = Math.min(1, Math.abs(velocity) * 1.5);
    
    // Smoothly transition volume and frequency based on scrape velocity
    scratchGain.gain.setValueAtTime(v * 0.05, ctx.currentTime);
    
    const randomFreq = 1800 + (Math.random() - 0.5) * 600 * v;
    scratchFilter.frequency.setValueAtTime(randomFreq, ctx.currentTime);
    scratchOsc.frequency.setValueAtTime(80 + v * 120, ctx.currentTime);
  } catch (e) {
    // Fail silently
  }
};

export const stopScrapeSound = () => {
  try {
    if (scratchOsc) {
      scratchOsc.stop();
      scratchOsc.disconnect();
      scratchOsc = null;
    }
    if (scratchFilter) {
      scratchFilter.disconnect();
      scratchFilter = null;
    }
    if (scratchGain) {
      scratchGain.disconnect();
      scratchGain = null;
    }
  } catch (e) {
    console.error(e);
  }
};

// 2. Play a sharp, small "dial click" (Lockpick adjusting/feeling pins)
export const playPickClick = (intensity: number = 1.0) => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + intensity * 600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.03);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1500, now);

    gain.gain.setValueAtTime(0.04 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(filter);
    filter.connect(gain);
    if (masterGainNode) gain.connect(masterGainNode);

    osc.start();
    osc.stop(now + 0.04);
  } catch (e) {
    console.error(e);
  }
};

// 3. Play a metallic creak/resistance sound (Vibrating when pick is stressed)
let creakOsc: OscillatorNode | null = null;
let creakGain: GainNode | null = null;

export const startCreakSound = (stressLevel: number) => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    if (creakOsc) {
      // Just adjust properties if already playing
      if (creakGain) {
        creakGain.gain.setValueAtTime(stressLevel * 0.12, now);
      }
      if (creakOsc) {
        creakOsc.frequency.setValueAtTime(45 + Math.sin(now * 300) * 15, now);
      }
      return;
    }

    creakOsc = ctx.createOscillator();
    creakOsc.type = 'sawtooth';
    creakOsc.frequency.setValueAtTime(50, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.Q.setValueAtTime(8, now);

    creakGain = ctx.createGain();
    creakGain.gain.setValueAtTime(stressLevel * 0.12, now);

    creakOsc.connect(filter);
    filter.connect(creakGain);
    if (masterGainNode) creakGain.connect(masterGainNode);

    creakOsc.start();
  } catch (e) {
    console.error(e);
  }
};

export const updateCreakSound = (stressLevel: number) => {
  if (isMuted || !creakGain || !creakOsc) {
    if (stressLevel > 0.05) startCreakSound(stressLevel);
    return;
  }
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // High stress produces raspy frequency oscillations and higher volume
    creakGain.gain.setTargetAtTime(stressLevel * 0.15, now, 0.05);
    
    const jitter = Math.sin(now * 150) * 20 * stressLevel;
    creakOsc.frequency.setTargetAtTime(45 + jitter, now, 0.05);
  } catch (e) {
    // Fail silently
  }
};

export const stopCreakSound = () => {
  try {
    if (creakOsc) {
      creakOsc.stop();
      creakOsc.disconnect();
      creakOsc = null;
    }
    if (creakGain) {
      creakGain.disconnect();
      creakGain = null;
    }
  } catch (e) {
    console.error(e);
  }
};

// 4. Shattering / Snapping Sound (Pick breaking)
export const playBreakSound = () => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // High pitched ring (the "tink" of spring steel breaking)
    const ringOsc = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(2500, now);
    ringOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    
    ringGain.gain.setValueAtTime(0.25, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    ringOsc.connect(ringGain);
    if (masterGainNode) ringGain.connect(masterGainNode);

    // Lower crunch sound
    const crunchOsc = ctx.createOscillator();
    const crunchGain = ctx.createGain();
    const crunchFilter = ctx.createBiquadFilter();

    crunchOsc.type = 'triangle';
    crunchOsc.frequency.setValueAtTime(150, now);
    crunchOsc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    crunchFilter.type = 'lowpass';
    crunchFilter.frequency.setValueAtTime(300, now);

    crunchGain.gain.setValueAtTime(0.3, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    crunchOsc.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    if (masterGainNode) crunchGain.connect(masterGainNode);

    ringOsc.start();
    ringOsc.stop(now + 0.2);

    crunchOsc.start();
    crunchOsc.stop(now + 0.4);
  } catch (e) {
    console.error(e);
  }
};

// 5. Heavy lock slide and metal clank sound (Unlock Success)
export const playUnlockSound = () => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Heavy direct hit
    const clankOsc = ctx.createOscillator();
    const clankGain = ctx.createGain();
    clankOsc.type = 'sawtooth';
    clankOsc.frequency.setValueAtTime(120, now);
    clankOsc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

    clankGain.gain.setValueAtTime(0.3, now);
    clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(250, now);

    clankOsc.connect(bpf);
    bpf.connect(clankGain);
    if (masterGainNode) clankGain.connect(masterGainNode);

    // Spring ping echo
    const metalOsc = ctx.createOscillator();
    const metalGain = ctx.createGain();
    metalOsc.type = 'sine';
    metalOsc.frequency.setValueAtTime(1400, now);
    metalOsc.frequency.setValueAtTime(900, now + 0.08); // double click feel

    metalGain.gain.setValueAtTime(0.18, now);
    metalGain.gain.setValueAtTime(0.12, now + 0.08);
    metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    metalOsc.connect(metalGain);
    if (masterGainNode) metalGain.connect(masterGainNode);

    clankOsc.start();
    clankOsc.stop(now + 0.5);

    metalOsc.start();
    metalOsc.stop(now + 0.5);
  } catch (e) {
    console.error(e);
  }
};

// 6. Ascending success jingle
export const playSuccessJingle = () => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      
      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
      
      osc.connect(gain);
      if (masterGainNode) gain.connect(masterGainNode);
      
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.55);
    });
  } catch (e) {
    console.error(e);
  }
};

// 7. Small pin click sound (for tumbler mode)
export const playPinClick = (isSet: boolean) => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isSet ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isSet ? 1800 : 800, now);
    osc.frequency.exponentialRampToValueAtTime(isSet ? 1200 : 100, now + 0.04);

    gain.gain.setValueAtTime(isSet ? 0.08 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    if (masterGainNode) gain.connect(masterGainNode);

    osc.start();
    osc.stop(now + 0.05);
  } catch (e) {
    console.error(e);
  }
};

// ==========================================
// BGM Synthesizer (Cyberpunk/Epic Lo-Fi Techno)
// ==========================================
let bgmTimer: any = null;
let isBgmPlaying: boolean = false;
let nextNoteTime: number = 0;
let currentStep: number = 0; // 0 to 63 (4 bars / 64 steps)
let bgmGainNode: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

const BPM = 118;
const stepDuration = 60 / BPM / 4; // 16th note step length (approx 0.127s)

// Procedural chords and scales
// Col 0: Bass Root, Col 1-3: Pad Chord Triad, Col 4+: Lead scale choice
const CHORD_PROGRESSION = [
  // Bar 1: Dm (Dark suspense)
  { root: 73.42,  chord: [146.83, 174.61, 220.00], scale: [293.66, 349.23, 392.00, 440.00, 587.33] },
  // Bar 2: Bb (Spiritual / Lifting tension)
  { root: 58.27,  chord: [116.54, 146.83, 174.61], scale: [293.66, 349.23, 466.16, 523.25, 587.33] },
  // Bar 3: F (Heroic breakthrough feel)
  { root: 87.31,  chord: [130.81, 174.61, 220.00], scale: [349.23, 392.00, 440.00, 523.25, 698.46] },
  // Bar 4: C (Resolution / Mystique)
  { root: 65.41,  chord: [130.81, 164.81, 196.00], scale: [329.63, 392.00, 440.00, 523.25, 659.25] }
];

// Patterns (16 steps per bar, repeated or morphing over the 4-bar progression)
const KICK_PATTERN  = [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0];
const SNARE_PATTERN = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
const BASS_PATTERN  = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
const HAT_PATTERN   = [0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1];

// Sparkling arpeggiations for the Lead
const LEAD_PATTERN  = [
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, // Bar 1
  0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, // Bar 2
  0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, // Bar 3
  1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1  // Bar 4
];

// Noise buffer cache
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const bufferSize = ctx.sampleRate * 0.15; // 150ms of clean noise
    noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

// 1. Deep Analog Sub-Kick
function playBgmKick(ctx: AudioContext, time: number) {
  if (!bgmGainNode) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Deep swoop from 120Hz down to 45Hz
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.10);

    gain.gain.setValueAtTime(0.40, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(bgmGainNode);

    osc.start(time);
    osc.stop(time + 0.16);
  } catch (e) { /* silent */ }
}

// 2. Synthesized Clapping Snare
function playBgmSnare(ctx: AudioContext, time: number) {
  if (!bgmGainNode) return;
  try {
    // Noise snap
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1000, time);
    noiseFilter.Q.setValueAtTime(2.5, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.09, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(bgmGainNode);

    // Warm underlying body tone (combines with noise)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(180, time);
    bodyOsc.frequency.linearRampToValueAtTime(110, time + 0.08);

    bodyGain.gain.setValueAtTime(0.18, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.10);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(bgmGainNode);

    noise.start(time);
    noise.stop(time + 0.16);
    bodyOsc.start(time);
    bodyOsc.stop(time + 0.11);
  } catch (e) { /* silent */ }
}

// 3. Cybernetic Hi-hat Groove
function playBgmHat(ctx: AudioContext, time: number, level: number = 0.035) {
  if (!bgmGainNode) return;
  try {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(bgmGainNode);

    noise.start(time);
    noise.stop(time + 0.05);
  } catch (e) { /* silent */ }
}

// 4. Lush Polyphonic Ambient Pad (Harmony)
function playBgmPad(ctx: AudioContext, time: number, frequencies: number[]) {
  if (!bgmGainNode) return;
  try {
    frequencies.forEach((freq) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator(); // Detuned voice for lush chorus width
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'triangle';
      
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.006, time); // 10 cents detuned

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, time);
      filter.frequency.linearRampToValueAtTime(450, time + 1.2);
      filter.Q.setValueAtTime(1, time);

      // Warm orchestral pad envelope (Soft Attack, long Release)
      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.07, time + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.85);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(bgmGainNode);

      osc1.start(time);
      osc1.stop(time + 1.95);
      osc2.start(time);
      osc2.stop(time + 1.95);
    });
  } catch (e) { /* silent */ }
}

// 5. Analog Pulsing Bass
function playBgmBass(ctx: AudioContext, time: number, freq: number) {
  if (!bgmGainNode) return;
  try {
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    subOsc.type = 'triangle';

    osc.frequency.setValueAtTime(freq, time);
    subOsc.frequency.setValueAtTime(freq * 0.5, time); // Sub-bass octave below

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);
    filter.frequency.exponentialRampToValueAtTime(90, time + 0.14);
    filter.Q.setValueAtTime(2.2, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(bgmGainNode);

    osc.start(time);
    osc.stop(time + 0.20);
    subOsc.start(time);
    subOsc.stop(time + 0.20);
  } catch (e) { /* silent */ }
}

// 6. Echoic Shimmering Lead Melodies
function playBgmLead(ctx: AudioContext, time: number, freq: number) {
  if (!bgmGainNode) return;
  try {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const delay = ctx.createDelay();
    const delayGain = ctx.createGain();

    // Soft square wave for tech vibe
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, time);

    gain.gain.setValueAtTime(0.065, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    // Dynamic clean echo
    delay.delayTime.setValueAtTime(0.18, time); // Beautiful synced echo
    delayGain.gain.setValueAtTime(0.35, time);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bgmGainNode);

    // Echo loop structure
    gain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(bgmGainNode);
    delayGain.connect(delay);

    osc.start(time);
    osc.stop(time + 0.18);
  } catch (e) { /* silent */ }
}

// Dynamic 64-step Orchestral Scheduler
function scheduleNextNotes(ctx: AudioContext) {
  const lookahead = 0.12; // Buffer window

  if (nextNoteTime < ctx.currentTime) {
    nextNoteTime = ctx.currentTime;
  }

  while (nextNoteTime < ctx.currentTime + lookahead) {
    const time = nextNoteTime;
    const step = currentStep; // 0 to 63
    const barIndex = Math.floor(step / 16) % 4;
    const innerStep = step % 16;
    
    const currentChordInfo = CHORD_PROGRESSION[barIndex];

    // Play lush Chord Pads at the beginning of each bar (and mid-bar half note)
    if (innerStep === 0) {
      playBgmPad(ctx, time, currentChordInfo.chord);
    } else if (innerStep === 8) {
      // Gentle chord refresh
      playBgmPad(ctx, time, currentChordInfo.chord.map(f => f * 1.5)); // inverted version
    }

    // Drums Layer
    if (KICK_PATTERN[innerStep] === 1) {
      playBgmKick(ctx, time);
    }
    if (SNARE_PATTERN[innerStep] === 1) {
      playBgmSnare(ctx, time);
    }
    if (HAT_PATTERN[innerStep] === 1) {
      const isAccent = innerStep % 4 === 2;
      playBgmHat(ctx, time, isAccent ? 0.055 : 0.030);
    }

    // Sub-Bass Syncopation (follows chord roots dynamically)
    if (BASS_PATTERN[innerStep] === 1) {
      const rootFreq = currentChordInfo.root;
      // alternate index slightly on odd steps
      const freqMultiplier = (innerStep === 5 || innerStep === 13) ? 1.5 : 1.0;
      playBgmBass(ctx, time, rootFreq * freqMultiplier);
    }

    // Melodic sparkling lead lines
    if (LEAD_PATTERN[step] === 1) {
      const scale = currentChordInfo.scale;
      // Procedurally select notes based on step algorithm
      const noteIdx = (step * 3 + barIndex * 2) % scale.length;
      playBgmLead(ctx, time, scale[noteIdx]);
    }

    nextNoteTime += stepDuration;
    currentStep = (currentStep + 1) % 64;
  }
}

export const startBGM = () => {
  if (isMuted) return;
  if (isBgmPlaying) {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) { /* ignore */ }
    return;
  }

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    isBgmPlaying = true;
    bgmGainNode = ctx.createGain();
    // Optimized overall master volume for premium rich balance
    bgmGainNode.gain.setValueAtTime(1.10, ctx.currentTime);
    
    if (masterGainNode) {
      bgmGainNode.connect(masterGainNode);
    } else {
      bgmGainNode.connect(ctx.destination);
    }

    nextNoteTime = ctx.currentTime + 0.05;
    currentStep = 0;

    // Wake and schedule every 25ms
    bgmTimer = setInterval(() => {
      scheduleNextNotes(ctx);
    }, 25);
  } catch (e) {
    console.error("Failed to start BGM synthesizer:", e);
  }
};

export const stopBGM = () => {
  isBgmPlaying = false;
  try {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (bgmGainNode) {
      bgmGainNode.disconnect();
      bgmGainNode = null;
    }
  } catch (e) {
    console.error("Failed to stop BGM synthesizer:", e);
  }
};
