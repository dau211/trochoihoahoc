
// Web Audio API Synthesizer to avoid external assets
// Advanced synthesis to mimic TV Studio sounds (Orchestral/Brass/Percussion)

class AudioService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private suspenseNodes: { osc: OscillatorNode, gain: GainNode, filter?: BiquadFilterNode }[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeakingSequence: boolean = false;

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
    if (!this.masterGain || !this.ctx) return;
    this.isMuted = !this.isMuted;
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.5, this.ctx.currentTime);
  }

  // --- TTS LOGIC (GIỌNG ĐỌC) ---

  /**
   * Chuyển đổi văn bản hóa học thô thành văn bản nói tự nhiên tiếng Việt
   */
  private formatTextForVietnameseTTS(text: string): string {
    let t = text;

    // 1. Xử lý các ký hiệu mũi tên và phản ứng
    t = t.replace(/->/g, " tạo thành ");
    t = t.replace(/=>/g, " suy ra ");
    t = t.replace(/⇌/g, " phản ứng thuận nghịch ");
    
    // 2. Xử lý trạng thái vật chất
    t = t.replace(/\(s\)/g, " ở thể rắn ");
    t = t.replace(/\(l\)/g, " ở thể lỏng ");
    t = t.replace(/\(g\)/g, " ở thể khí ");
    t = t.replace(/\(aq\)/g, " dung dịch ");

    // 3. Xử lý các ký hiệu toán học/hóa học cơ bản
    t = t.replace(/\+/g, " cộng "); 
    t = t.replace(/°C/g, " độ Cê ");
    t = t.replace(/%/g, " phần trăm ");
    t = t.replace(/\.\.\./g, " vân vân ");

    // 4. Xử lý phát âm nguyên tố/công thức hóa học (Cơ bản)
    // Tách số ra khỏi chữ để đọc rõ: H2O -> H 2 O (đọc là Hát hai Ô)
    t = t.replace(/([a-zA-Z])(\d+)/g, "$1 $2 ");
    
    // Một số mapping phát âm phổ biến cho chữ cái hóa học khi đứng một mình hoặc trong công thức
    // Lưu ý: IUPAC đọc tên tiếng Anh, nhưng công thức thì thường đọc theo chữ cái Việt Nam
    t = t.replace(/\bH\b/g, " Hát ");
    t = t.replace(/\bO\b/g, " Ô ");
    t = t.replace(/\bN\b/g, " Nờ ");
    t = t.replace(/\bC\b/g, " Cê ");
    t = t.replace(/\bP\b/g, " Pê ");
    t = t.replace(/\bS\b/g, " Ét-xì "); // Sulfuric acid -> S thường đọc là Ét
    
    return t;
  }

  public speakMixed(text: string, onEnd?: () => void) {
    if (!window.speechSynthesis) {
        if (onEnd) onEnd();
        return;
    }

    this.cancelSpeech(); 

    // Xử lý văn bản để giọng đọc Tiếng Việt tự nhiên hơn
    const safeText = this.formatTextForVietnameseTTS(text);

    const startSpeaking = () => {
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = null;

        // Ưu tiên giọng Google Tiếng Việt hoặc Microsoft Tiếng Việt
        // Thứ tự ưu tiên: Google vi-VN -> Microsoft vi-VN -> Bất kỳ vi-VN nào
        selectedVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('vi'));
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.name.includes('Microsoft') && v.lang.includes('vi'));
        }
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VN'));
        }

        if (selectedVoice) {
            const utterance = new SpeechSynthesisUtterance(safeText);
            utterance.voice = selectedVoice;
            utterance.lang = 'vi-VN'; // Bắt buộc Tiếng Việt

            // --- Tinh chỉnh MC ---
            utterance.rate = 1.1; // Hơi nhanh để tạo kịch tính
            utterance.pitch = 1.0; 
            utterance.volume = 1.0;
    
            utterance.onend = () => {
                this.isSpeakingSequence = false;
                if (onEnd) onEnd();
            };
    
            utterance.onerror = (e) => {
                 this.isSpeakingSequence = false;
                 // Ignore interruption errors
                 if (e.error !== 'interrupted' && e.error !== 'canceled' && onEnd) {
                     onEnd();
                 }
            };
    
            this.isSpeakingSequence = true;
            this.currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        } else {
            // Không tìm thấy giọng đọc Tiếng Việt -> Tắt giọng đọc (Skip reading)
            // Gọi callback ngay để game tiếp tục mà không đọc
            console.warn("Không tìm thấy giọng đọc Tiếng Việt. Bỏ qua phần đọc.");
            if (onEnd) onEnd();
        }
    };

    // Chrome cần load voices bất đồng bộ
    if (window.speechSynthesis.getVoices().length === 0) {
         window.speechSynthesis.onvoiceschanged = () => {
             startSpeaking();
             // Xóa event listener để tránh memory leak
             window.speechSynthesis.onvoiceschanged = null;
         };
         // Thêm timeout phòng trường hợp onvoiceschanged không fire (ví dụ Safari/Firefox trong một số trường hợp)
         setTimeout(() => {
            if (window.speechSynthesis.getVoices().length === 0) {
               // Nếu vẫn chưa có giọng nào, coi như không đọc được
               if (onEnd) onEnd();
            }
         }, 2000);
    } else {
        startSpeaking();
    }
  }

  public cancelSpeech() {
    this.isSpeakingSequence = false;
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
  }

  // --- AUDIO SYNTHESIS HELPERS (Music/SFX) ---

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

  public playReadingBackground() {
    if (!this.ctx || !this.masterGain) return;
    this.stopSuspense();
    const t = this.ctx.currentTime;

    // Deep Drone - Dramatic background for MC reading
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(60, t); // Low frequency
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.15, t + 1);
    
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);

    // High shimmer
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(300, t);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.02, t + 2);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t);

    this.suspenseNodes = [
        { osc: osc1, gain: gain1 },
        { osc: osc2, gain: gain2 }
    ];
  }

  public stopSuspense() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.suspenseNodes.forEach(node => {
        try {
            node.gain.gain.cancelScheduledValues(t);
            node.gain.gain.setValueAtTime(node.gain.gain.value, t);
            node.gain.gain.linearRampToValueAtTime(0, t + 0.5);
            node.osc.stop(t + 0.5);
        } catch (e) { }
    });
    this.suspenseNodes = [];
  }

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
    
    // Metallic Tick
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.05);
    
    oscGain.gain.setValueAtTime(0.1, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);

    // Low Thud (Heartbeat style)
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(60, t);
    thud.frequency.linearRampToValueAtTime(40, t + 0.1);
    
    thudGain.gain.setValueAtTime(0.3, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.2);
  }

  public playCorrect() {
    this.stopSuspense();
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
    this.stopSuspense();
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
    this.stopSuspense();
    for(let i=0; i<3; i++) {
        this.playSynthTone(800, i * 0.2, 0.1, 0.3, 'square');
    }
    this.playWrong(); 
  }
  
  public playWin() {
    this.stopSuspense();
    const now = 0;
    const beat = 0.2;
    this.playSynthTone(523.25, now, beat, 0.4); 
    this.playSynthTone(523.25, now + beat, beat, 0.4); 
    this.playSynthTone(523.25, now + beat*2, beat, 0.4); 
    this.playSynthTone(659.25, now + beat*3, beat*2, 0.4); 
    this.playSynthTone(783.99, now + beat*4, 2.0, 0.6); 
    this.playSynthTone(130.81, now, 3.0, 0.6, 'square'); 
  }
}

export const audioService = new AudioService();
