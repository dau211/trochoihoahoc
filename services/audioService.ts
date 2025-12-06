
// Web Audio API Synthesizer to avoid external assets
// Advanced synthesis to mimic TV Studio sounds (Orchestral/Brass/Percussion)

class AudioService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private musicLoopNode: OscillatorNode | null = null; // Simple placeholder for loop state

  constructor() {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5; // Master volume
        this.masterGain.connect(this.ctx.destination);
      }
    } catch (e) {
      console.error("Web Audio API not supported", e);
    }
  }

  public async init() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public toggleMute() {
    if (!this.masterGain) return;
    this.isMuted = !this.isMuted;
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.5, this.ctx!.currentTime);
  }

  // --- HELPER SYNTH FUNCTIONS ---

  private createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2.0; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playSynthTone(freq: number, startTime: number, duration: number, vol: number = 0.5, type: OscillatorType = 'sawtooth') {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + startTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.05); 
    filter.frequency.exponentialRampToValueAtTime(1000, t + duration); 

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.05); 
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration); 

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration + 0.1);
  }

  // --- PUBLIC GAME SOUNDS ---

  public playHover() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playSelect() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3); 
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playTick() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.frequency.setValueAtTime(800, t);
    oscGain.gain.setValueAtTime(0.1, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playCorrect() {
    const t = 0; 
    const duration = 1.5;
    
    this.playSynthTone(261.63, t, duration, 0.4);      
    this.playSynthTone(329.63, t + 0.05, duration, 0.4); 
    this.playSynthTone(392.00, t + 0.1, duration, 0.4);  
    this.playSynthTone(523.25, t, duration, 0.5);      

    setTimeout(() => this.playHover(), 100);
    setTimeout(() => this.playHover(), 200);
  }

  public playWrong() {
    if(this.ctx && this.masterGain) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 1); 
        
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 1);
    }
  }

  public playTimeout() {
    for(let i=0; i<3; i++) {
        this.playSynthTone(800, i * 0.2, 0.1, 0.3, 'square');
    }
    this.playWrong(); 
  }
  
  public playWin() {
    const now = 0;
    const beat = 0.2;
    this.playSynthTone(523.25, now, beat, 0.4); 
    this.playSynthTone(523.25, now + beat, beat, 0.4); 
    this.playSynthTone(523.25, now + beat*2, beat, 0.4); 
    this.playSynthTone(659.25, now + beat*3, beat*2, 0.4); 
    this.playSynthTone(783.99, now + beat*4, 2.0, 0.6); 
    
    this.playSynthTone(130.81, now, 3.0, 0.6, 'square'); 
  }

  // Fast paced beat for Olympia
  public playOlympiaBeat() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    // Kick drum synthesis
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
    
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}

export const audioService = new AudioService();