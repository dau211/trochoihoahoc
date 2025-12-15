
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateQuestions } from './services/geminiService';
import { audioService } from './services/audioService';
import { Question, GameState, LifelineState, MONEY_TREE, GameMode } from './types';
import MoneyLadder from './components/MoneyLadder';
import Lifelines from './components/Lifelines';

const MILLIONAIRE_DURATION = 30; 
const OLYMPIA_DURATION = 60; // 60 seconds total for Warm-up

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [topic, setTopic] = useState<string>("Hóa 10 - Bài: Cấu tạo vỏ nguyên tử");
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  
  // Millionaire Specific
  const [lifelines, setLifelines] = useState<LifelineState>({
    fiftyFifty: true,
    phoneFriend: true,
    askAudience: true
  });
  const [hiddenAnswers, setHiddenAnswers] = useState<number[]>([]);
  
  // Olympia Specific
  const [olympiaScore, setOlympiaScore] = useState<number>(0);

  const [modalMessage, setModalMessage] = useState<{title: string, content: string} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showMoneyLadderMobile, setShowMoneyLadderMobile] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- AUDIO & TIMER LOGIC ---

  useEffect(() => {
    const handleInteraction = () => {
      audioService.init();
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  // GAME RESET / INIT QUESTION LOGIC
  useEffect(() => {
      if (gameState === 'PLAYING' && !modalMessage && !isAnswerChecked) {
          const q = questions[currentQIndex];
          if (!q) return;

          // Millionaire mode: Reset timer for each question
          if (gameMode === 'MILLIONAIRE') {
             setTimeLeft(MILLIONAIRE_DURATION);
             // No voice reading anymore, just start immediately
          } 
          // Olympia: Global timer handled in startGame/timer effect
      }
      return () => {
          audioService.cancelSpeech();
          audioService.stopSuspense();
      };
  }, [currentQIndex, gameState, gameMode, questions, modalMessage, isAnswerChecked]);

  // Timer Countdown Logic
  useEffect(() => {
    if (gameState === 'PLAYING' && !modalMessage) {
      
      // Stop timer if answered
      if (gameMode === 'MILLIONAIRE') {
          if (isAnswerChecked) return;
      }

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          
          // Audio Logic for Ticking
          if (gameMode === 'MILLIONAIRE' && prev <= 30) {
              audioService.playTick(); 
          }
          if (gameMode === 'OLYMPIA' && prev % 2 === 0) {
              audioService.playTick(); 
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, isAnswerChecked, modalMessage, gameMode]);

  const handleTimeout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    audioService.playTimeout();
    
    if (gameMode === 'MILLIONAIRE') {
        setGameState('GAME_OVER');
    } else if (gameMode === 'OLYMPIA') {
        setGameState('OLYMPIA_SUMMARY');
        audioService.playWin(); // Finish sound
    }
  };

  const startGame = async (mode: GameMode) => {
    if (!topic.trim()) return;
    setGameMode(mode);
    audioService.init();
    audioService.playSelect();
    setGameState('LOADING');
    setErrorMsg("");
    try {
      const qs = await generateQuestions(topic, mode);
      setQuestions(qs);
      setGameState('PLAYING');
      setCurrentQIndex(0);
      
      // Init based on mode
      if (mode === 'MILLIONAIRE') {
          setLifelines({ fiftyFifty: true, phoneFriend: true, askAudience: true });
          resetMillionaireQuestion(); 
      } else {
          // Olympia
          setOlympiaScore(0);
          resetOlympiaQuestion();
          setTimeLeft(OLYMPIA_DURATION);
      }

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
         setErrorMsg("Hệ thống AI đang quá tải (Lỗi 429). Vui lòng đợi 30 giây rồi thử lại!");
      } else {
         setErrorMsg("Không thể tạo câu hỏi. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.");
      }
      setGameState('SETUP');
    }
  };

  const resetMillionaireQuestion = () => {
    setSelectedAns(null);
    setIsAnswerChecked(false);
    setIsCorrect(false);
    setHiddenAnswers([]);
    setModalMessage(null);
  };

  const resetOlympiaQuestion = () => {
      setSelectedAns(null);
      setIsAnswerChecked(false);
      setIsCorrect(false);
      setHiddenAnswers([]);
      // Do NOT reset TimeLeft for Olympia, it's global
  };

  const handleAnswerSelect = (index: number) => {
    if (gameState !== 'PLAYING') return;
    if (gameMode === 'MILLIONAIRE' && (isAnswerChecked || hiddenAnswers.includes(index))) return;
    if (gameMode === 'OLYMPIA' && isAnswerChecked) return;
    
    audioService.playSelect();
    setSelectedAns(index);

    if (gameMode === 'MILLIONAIRE') {
        // Suspense delay
        setTimeout(() => checkAnswer(index), 2000);
    } else {
        // Olympia: Instant check
        checkAnswer(index);
    }
  };

  const checkAnswer = (index: number) => {
    const correctIndex = questions[currentQIndex].correctIndex;
    const correct = index === correctIndex;
    
    setIsAnswerChecked(true);
    setIsCorrect(correct);

    if (correct) {
      audioService.playCorrect();
      
      if (gameMode === 'MILLIONAIRE') {
          setTimeout(() => {
            if (currentQIndex === 14) {
              audioService.playWin();
              setGameState('VICTORY');
            } else {
               setTimeout(() => {
                 setCurrentQIndex(prev => prev + 1);
                 resetMillionaireQuestion();
               }, 1000);
            }
          }, 1500);
      } else {
          // Olympia
          setOlympiaScore(prev => prev + 10);
          setTimeout(() => nextOlympiaQuestion(), 800);
      }

    } else {
      audioService.playWrong();
      if (gameMode === 'MILLIONAIRE') {
          setTimeout(() => {
             // MC Reads explanation before Game Over (Optional, for now just text)
             setGameState('GAME_OVER');
          }, 1500);
      } else {
          // Olympia just moves on
          setTimeout(() => nextOlympiaQuestion(), 800);
      }
    }
  };

  const nextOlympiaQuestion = () => {
      if (currentQIndex < questions.length - 1) {
          setCurrentQIndex(prev => prev + 1);
          resetOlympiaQuestion();
      } else {
          setGameState('OLYMPIA_SUMMARY');
          audioService.playWin();
      }
  };

  const skipQuestionOlympia = () => {
      if (gameMode !== 'OLYMPIA' || isAnswerChecked) return;
      audioService.playSelect();
      nextOlympiaQuestion();
  };

  // --- Millionaire Lifelines Logic ---
  const useFiftyFifty = () => {
    if (!lifelines.fiftyFifty) return;
    audioService.playSelect();
    const correct = questions[currentQIndex].correctIndex;
    const wrongIndices = [0, 1, 2, 3].filter(i => i !== correct);
    wrongIndices.sort(() => Math.random() - 0.5);
    const toHide = wrongIndices.slice(0, 2);
    setHiddenAnswers(toHide);
    setLifelines(prev => ({ ...prev, fiftyFifty: false }));
  };

  const usePhoneFriend = () => {
    if (!lifelines.phoneFriend) return;
    
    audioService.playSelect();
    const q = questions[currentQIndex];
    const difficulty = currentQIndex < 5 ? 0.9 : currentQIndex < 10 ? 0.7 : 0.4;
    const willBeCorrect = Math.random() < difficulty;
    let suggestedIndex = q.correctIndex;
    if (!willBeCorrect) {
        const wrongs = [0, 1, 2, 3].filter(i => i !== q.correctIndex);
        suggestedIndex = wrongs[Math.floor(Math.random() * wrongs.length)];
    }
    const answerChar = String.fromCharCode(65 + suggestedIndex);
    const content = `Tôi nghĩ đáp án đúng là phương án ${answerChar}. ${q.answers[suggestedIndex]}. Chắc chắn đấy!`;
    
    setModalMessage({
        title: "GỌI ĐIỆN NGƯỜI THÂN",
        content: content
    });
    
    // Disabled voice for advice as well
    // audioService.speakMixed(content);

    setLifelines(prev => ({ ...prev, phoneFriend: false }));
  };

  const useAskAudience = () => {
    if (!lifelines.askAudience) return;
    audioService.playSelect();
    const correct = questions[currentQIndex].correctIndex;
    let pCorrect = 0;
    if (currentQIndex < 5) pCorrect = Math.floor(Math.random() * 30) + 60; 
    else if (currentQIndex < 10) pCorrect = Math.floor(Math.random() * 30) + 40; 
    else pCorrect = Math.floor(Math.random() * 30) + 20; 
    
    const remaining = 100 - pCorrect;
    let pOthers = [0, 0, 0].map(() => Math.random());
    const sum = pOthers.reduce((a, b) => a + b, 0);
    pOthers = pOthers.map(v => Math.floor((v / sum) * remaining));
    const currentSum = pCorrect + pOthers.reduce((a,b)=>a+b, 0);
    if(currentSum < 100) pOthers[0] += (100 - currentSum);

    const chartData = [0,0,0,0];
    let otherIdx = 0;
    for(let i=0; i<4; i++) {
        if(i === correct) chartData[i] = pCorrect;
        else {
            chartData[i] = pOthers[otherIdx];
            otherIdx++;
        }
    }
    const chartContent = chartData.map((val, idx) => `${String.fromCharCode(65+idx)}: ${val}%`).join('\n');
    setModalMessage({
        title: "Ý KIẾN KHÁN GIẢ",
        content: `Kết quả khảo sát:\n${chartContent}`
    });
    setLifelines(prev => ({ ...prev, askAudience: false }));
  };

  const getMillionairePrize = () => {
    if (currentQIndex === 0) return "0";
    if (gameState === 'GAME_OVER') {
        if (currentQIndex >= 10) return MONEY_TREE[9].amount; 
        if (currentQIndex >= 5) return MONEY_TREE[4].amount; 
        return "0";
    }
    return "150.000.000";
  };

  const getCurrentLevelMoney = () => MONEY_TREE[currentQIndex].amount;

  // --- FORMATTING HELPERS ---
  const formatChemicalText = (text: string): React.ReactNode => {
    if (!text) return "";
    
    // Split text into potential chemical words and normal text
    // We split by space but keep delimiters to reconstruct
    const parts = text.split(/(\s+|[,.;:!?])/g);
    
    return parts.map((part, idx) => {
        // Skip pure whitespace/punctuation
        if (/^[\s,.;:!?]+$/.test(part)) return <span key={idx}>{part}</span>;
        
        const word = part;

        // Detection Heuristic:
        // 1. Must contain at least one Uppercase letter [A-Z].
        // 2. AND (Contains a Digit OR Contains + or - at the end).
        // 3. OR it is exactly a 2-letter element symbol like "Fe", "Cu".
        
        const isChemical = 
            (/[A-Z]/.test(word) && (/[\d]/.test(word) || /[+-]$/.test(word))) || 
            (/^[A-Z][a-z]?$/.test(word)); // Standard symbols like O, N, Fe
            
        if (!isChemical) {
            return <span key={idx}>{word}</span>;
        }

        // --- CHEMICAL PARSING LOGIC ---
        
        // 1. Extract Ionic Charge (Superscript) if it exists at the VERY END.
        // Look for pattern: Digit(optional) + Sign (+ or -) at the end. 
        // Example: "Fe3+", "SO42-", "Cl-", "Na+"
        let charge = "";
        let body = word;
        
        const chargeMatch = word.match(/(\d*[+-])$/);
        if (chargeMatch) {
            // Be careful not to match simple oxidation states inside brackets if logic fails, 
            // but for standard formulas this works.
            charge = chargeMatch[0];
            body = word.substring(0, word.length - charge.length);
        }

        // 2. Format the body: Digits become Subscripts.
        // We split by digits to isolate them.
        const bodyParts = body.split(/(\d+)/);

        return (
            <span key={idx} className="inline-block whitespace-nowrap">
                {bodyParts.map((p, i) => {
                    // If p is a number, it is a subscript (e.g., 2 in H2O)
                    // UNLESS it is a coefficient at the start? No, typically H2O, numbers are subs.
                    // Coefficients usually separate by space "2 H2O".
                    if (/^\d+$/.test(p)) {
                        return <sub key={i} className="text-[75%] align-sub">{p}</sub>;
                    }
                    return <span key={i}>{p}</span>;
                })}
                {charge && <sup className="text-[75%] align-super font-bold">{charge}</sup>}
            </span>
        );
    });
  };

  // --- RENDER HELPERS ---
  const renderTVHexagon = (text: string, label: string | null, onClick: () => void, state: 'normal' | 'selected' | 'correct' | 'wrong', disabled: boolean, hidden: boolean, isQuestion: boolean = false) => {
    if (hidden) return <div className="h-full w-full opacity-0"></div>;

    let innerClass = isQuestion ? "question" : "";
    if (state === 'selected') innerClass += " selected";
    if (state === 'correct') innerClass += " correct";
    if (state === 'wrong') innerClass += " wrong";

    let labelColor = "text-orange-400";
    if (state === 'selected') labelColor = "text-black";
    if (state === 'correct' || state === 'wrong') labelColor = "text-white";

    let textColor = "text-white";
    if (state === 'selected') textColor = "text-black";

    let fontClass = "text-sm md:text-lg"; 
    if (isQuestion) {
        if (text.length > 150) fontClass = "text-sm md:text-base leading-tight";
        else if (text.length > 100) fontClass = "text-base md:text-lg leading-snug";
        else fontClass = "text-lg md:text-2xl leading-normal";
    } else {
        if (text.length > 60) fontClass = "text-[10px] md:text-xs leading-tight";
        else if (text.length > 35) fontClass = "text-xs md:text-sm leading-tight";
        else fontClass = "text-sm md:text-lg leading-normal";
    }

    return (
        <div 
            onClick={!disabled && !isQuestion ? onClick : undefined}
            onMouseEnter={() => !disabled && !isQuestion && audioService.playHover()}
            className={`tv-hex-container w-full h-full relative ${disabled || isQuestion ? '' : 'hover:cursor-pointer group'}`}
        >
            <div className={`tv-hex-border ${isQuestion ? 'question' : ''} ${gameMode === 'OLYMPIA' ? '!bg-blue-300' : ''}`}>
                <div className={`tv-hex-inner ${innerClass} ${gameMode === 'OLYMPIA' && !state.match(/selected|correct|wrong/) ? '!bg-gradient-to-b !from-blue-600 !to-blue-900' : ''}`}>
                    <div className={`flex items-center w-full h-full px-6 md:px-10 ${isQuestion ? 'justify-center' : 'justify-start'}`}>
                        {label && (
                            <span className={`font-bold text-xl md:text-2xl mr-3 flex-shrink-0 ${labelColor}`}>{label}:</span>
                        )}
                        <span className={`font-medium ${isQuestion ? 'text-center' : 'text-left'} w-full ${textColor} ${fontClass} break-words`}>
                            {formatChemicalText(text)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // --- SCREENS ---
  if (gameState === 'MENU') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-studio-gradient relative overflow-hidden">
            <div className="studio-rays"></div>
            <div className="studio-grid"></div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-orange-300 to-orange-600 mb-12 uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tighter relative z-10 text-center">
                Đấu Trường<br/>Hóa Học
            </h1>

            <div className="flex flex-col md:flex-row gap-8 relative z-10 w-full max-w-4xl">
                <div onClick={() => setGameState('SETUP')} className="flex-1 group cursor-pointer">
                    <div className="bg-blue-900/40 backdrop-blur-md border border-blue-500/50 p-8 rounded-2xl h-full transform transition-all duration-300 group-hover:scale-105 group-hover:bg-blue-800/60 shadow-2xl flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-black border-4 border-orange-500 mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(234,88,12,0.5)]">
                            <span className="text-3xl">💰</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">AI LÀ TRIỆU PHÚ</h2>
                        <p className="text-blue-200">15 câu hỏi. 3 quyền trợ giúp. Chiến thuật và kiến thức sâu rộng.</p>
                    </div>
                </div>

                <div onClick={() => { setGameMode('OLYMPIA'); setGameState('SETUP'); }} className="flex-1 group cursor-pointer">
                    <div className="bg-blue-900/40 backdrop-blur-md border border-blue-500/50 p-8 rounded-2xl h-full transform transition-all duration-300 group-hover:scale-105 group-hover:bg-blue-800/60 shadow-2xl flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-900 border-4 border-white mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                            <span className="text-3xl">🌿</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">ĐƯỜNG LÊN ĐỈNH OLYMPIA</h2>
                        <p className="text-blue-200">60 giây. Tốc độ. Trả lời càng nhiều càng tốt. Vòng thi Khởi Động.</p>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  if (gameState === 'SETUP') {
    const isOlympia = gameMode === 'OLYMPIA';
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-studio-gradient relative overflow-hidden">
         <div className="studio-rays"></div>
         <div className="absolute inset-0 bg-black/40 z-0"></div>

         <div className="bg-blue-900/40 backdrop-blur-md p-8 rounded-xl shadow-2xl border border-blue-500/50 max-w-lg w-full text-center relative z-10">
          <button onClick={() => {setGameState('MENU'); setGameMode(null);}} className="absolute top-4 left-4 text-blue-300 hover:text-white">← Quay lại</button>
          
          <div className="mb-8 mt-6">
            <h1 className={`text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b ${isOlympia ? 'from-cyan-300 to-blue-500' : 'from-orange-300 to-orange-600'} mb-2 uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}>
                {isOlympia ? 'Phần Thi Khởi Động' : 'Ai Là Triệu Phú'}
            </h1>
            <h2 className="text-xl text-blue-200 font-light tracking-wide uppercase">Chuyên đề Hóa Học GDPT 2018</h2>
          </div>
          
          <div className="mb-8 text-left space-y-2">
            <label className="block text-blue-300 text-sm font-bold uppercase tracking-wider">Nhập chủ đề kiến thức:</label>
            <input 
              type="text" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-4 rounded-lg bg-black/50 border border-blue-500/50 text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all placeholder-blue-600/70"
              placeholder="Ví dụ: Alkane, Pin điện hóa, Halogen..."
            />
          </div>

          {errorMsg && <p className="text-red-400 mb-4 bg-red-900/30 p-2 rounded text-sm">{errorMsg}</p>}

          <button 
            onClick={() => startGame(isOlympia ? 'OLYMPIA' : 'MILLIONAIRE')}
            disabled={!topic}
            className={`w-full bg-gradient-to-r ${isOlympia ? 'from-cyan-700 to-blue-900 hover:from-cyan-600' : 'from-blue-700 to-blue-900 hover:from-blue-600'} text-white font-bold py-4 rounded-lg shadow-lg transform transition hover:scale-[1.02] border border-blue-400/50 uppercase tracking-widest`}
          >
            BẮT ĐẦU
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'LOADING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-studio-gradient">
        <div className="relative w-24 h-24 mb-6">
             <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
        <p className="text-2xl font-light text-blue-100 animate-pulse uppercase tracking-widest text-center px-4">Đang soạn bộ câu hỏi...</p>
      </div>
    );
  }

  if (gameState === 'GAME_OVER' || gameState === 'VICTORY' || gameState === 'OLYMPIA_SUMMARY') {
    const isOlympia = gameMode === 'OLYMPIA';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-studio-gradient relative overflow-hidden">
        <div className="studio-rays"></div>
        <div className="relative z-10 max-w-2xl w-full">
            <h1 className={`text-5xl md:text-7xl font-bold mb-6 uppercase ${gameState === 'VICTORY' || (isOlympia && olympiaScore > 50) ? 'text-yellow-400' : 'text-white'}`}>
                {gameState === 'VICTORY' ? 'NHÀ VÔ ĐỊCH!' : (isOlympia ? 'KẾT THÚC' : 'RẤT TIẾC!')}
            </h1>
            
            <div className="bg-gradient-to-b from-blue-900/80 to-black/80 p-8 rounded-2xl border border-orange-500/50 mb-10 shadow-[0_0_30px_rgba(234,88,12,0.3)]">
                {isOlympia ? (
                     <>
                        <p className="text-blue-300 uppercase tracking-widest text-sm mb-2">Tổng điểm của bạn</p>
                        <p className="text-6xl font-bold text-cyan-400 tracking-tight">{olympiaScore}</p>
                        <p className="text-gray-400 mt-2 text-sm">Số câu đúng: {olympiaScore/10} câu</p>
                     </>
                ) : (
                    <>
                        <p className="text-blue-300 uppercase tracking-widest text-sm mb-2">Tiền thưởng của bạn</p>
                        <p className="text-5xl font-bold text-orange-500 tracking-tight">{getMillionairePrize()} VNĐ</p>
                    </>
                )}
            </div>
            
            {!isOlympia && (questions[currentQIndex]?.explanation || gameState === 'GAME_OVER') && (
                <div className="bg-gray-900/90 p-6 rounded-lg mb-8 text-left border-l-4 border-orange-500 shadow-xl">
                    <p className="text-orange-400 font-bold mb-2 text-lg uppercase">Đáp án & Giải thích:</p>
                    <p className="text-white text-lg">
                        Đáp án đúng: <span className="font-bold text-green-400">{formatChemicalText(questions[currentQIndex].answers[questions[currentQIndex].correctIndex])}</span>
                    </p>
                    <p className="text-gray-300 mt-2 italic">{formatChemicalText(questions[currentQIndex].explanation || "")}</p>
                </div>
            )}

            <div className="flex gap-4 justify-center">
                <button 
                    onClick={() => { setGameMode(null); setGameState('MENU'); }}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full transition-all uppercase tracking-wider"
                >
                    Menu Chính
                </button>
                <button 
                    onClick={() => setGameState('SETUP')}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-10 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all transform hover:scale-105 uppercase tracking-wider"
                >
                    Chơi Lại
                </button>
            </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];

  return (
    <div className="h-screen w-full flex overflow-hidden relative font-roboto bg-black">
      <div className="absolute inset-0 pointer-events-none z-0 bg-studio-gradient"></div>
      <div className="studio-rays z-0 opacity-40"></div>
      <div className="studio-grid z-0 opacity-20"></div>

      <div className="flex-1 flex flex-col h-full relative z-10">
        
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 bg-black/60 border-2 border-blue-500/50 rounded-full px-8 py-2 shadow-lg backdrop-blur-md flex gap-8 items-center">
             {gameMode === 'MILLIONAIRE' ? (
                 <>
                    <span className="text-blue-200 uppercase text-xs font-bold tracking-wider">Câu {currentQIndex + 1}</span>
                    <span className="text-orange-400 font-bold text-xl md:text-2xl drop-shadow-md">{getCurrentLevelMoney()} VNĐ</span>
                 </>
             ) : (
                 <>
                    <span className="text-cyan-200 uppercase text-xs font-bold tracking-wider">Câu {currentQIndex + 1}</span>
                    <span className="text-white font-bold text-2xl drop-shadow-md">{olympiaScore} Điểm</span>
                 </>
             )}
        </div>

        {gameMode === 'MILLIONAIRE' && (
            <div className="md:hidden flex justify-between items-center p-4 absolute top-0 left-0 right-0 z-50">
                <div className="w-10"></div>
                <button onClick={() => setShowMoneyLadderMobile(!showMoneyLadderMobile)} className="text-white border border-white/30 px-3 py-1 rounded bg-black/50 text-xs uppercase">
                    Tháp Tiền
                </button>
            </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
             <div className={`absolute w-[400px] h-[400px] ${gameMode === 'OLYMPIA' ? 'bg-cyan-500/20' : 'bg-blue-500/20'} rounded-full blur-[60px] pointer-events-none`}></div>
             
             <div className={`w-48 h-48 md:w-64 md:h-64 rounded-full border-4 ${gameMode === 'OLYMPIA' ? 'border-cyan-400/30' : 'border-blue-400/30'} flex items-center justify-center bg-radial-gradient from-blue-900 to-black shadow-2xl z-10 relative overflow-hidden`}>
                 
                 {(!isAnswerChecked || gameMode === 'OLYMPIA') && (
                   <svg className="absolute inset-0 w-full h-full -rotate-90 p-2" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#1e3a8a" strokeWidth="4" />
                      <circle 
                        cx="50" cy="50" r="45" fill="none" stroke={timeLeft < 10 ? "#ef4444" : (gameMode === 'OLYMPIA' ? '#22d3ee' : "#eab308")} strokeWidth="4"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (283 * (gameMode === 'MILLIONAIRE' ? timeLeft : timeLeft)) / (gameMode === 'OLYMPIA' ? OLYMPIA_DURATION : MILLIONAIRE_DURATION)}
                        className={`transition-all duration-1000 ease-linear opacity-100`}
                      />
                   </svg>
                 )}

                 <div className="text-center relative z-10">
                    {gameMode === 'MILLIONAIRE' && isAnswerChecked ? (
                        <div className="animate-pulse">
                           <h1 className="text-3xl font-bold text-orange-500">CHỐT!</h1>
                        </div>
                    ) : (
                        <>
                             <h1 className={`text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-b ${gameMode === 'OLYMPIA' ? 'from-cyan-200 to-blue-500' : 'from-orange-300 to-orange-600'} uppercase tracking-tighter leading-none drop-shadow-lg mb-2`}>
                                 {gameMode === 'OLYMPIA' ? 'KHỞI ĐỘNG' : 'TRIỆU PHÚ'}
                             </h1>
                             <div className={`text-5xl font-mono font-bold tabular-nums ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                 {timeLeft}
                             </div>
                        </>
                    )}
                 </div>
             </div>
             
             {gameMode === 'OLYMPIA' && (
                 <button 
                    onClick={skipQuestionOlympia}
                    disabled={isAnswerChecked}
                    className="mt-8 bg-gray-700/80 hover:bg-gray-600 text-white px-6 py-2 rounded-full border border-gray-500 uppercase font-bold tracking-wider text-sm transition-all hover:scale-105"
                 >
                     Bỏ qua ►
                 </button>
             )}
        </div>

        <div className="w-full pb-2 md:pb-6 px-2 md:px-8 flex flex-col items-center relative">
            
            {gameMode === 'MILLIONAIRE' && (
                <Lifelines 
                    lifelines={lifelines} 
                    onUse={(type) => {
                        if(type === 'fiftyFifty') useFiftyFifty();
                        if(type === 'phoneFriend') usePhoneFriend();
                        if(type === 'askAudience') useAskAudience();
                    }} 
                    disabled={isAnswerChecked} 
                />
            )}

            <div className="absolute top-[80px] left-0 w-full h-[2px] bg-blue-500/30 hidden md:block shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>

            <div className="w-full max-w-5xl mb-1 relative z-10">
                 <div className="h-20 md:h-28 w-full">
                    {renderTVHexagon(currentQ.question, null, () => {}, 'normal', false, false, true)}
                 </div>
                 <div className="absolute left-0 right-0 -bottom-4 h-8 flex justify-between px-[20%] pointer-events-none">
                     <div className="w-[2px] h-full bg-[#aebcc9]"></div>
                     <div className="w-[2px] h-full bg-[#aebcc9]"></div>
                 </div>
                 <div className="absolute left-0 right-0 -bottom-4 top-[100%] h-[2px] bg-[#aebcc9] mx-4 pointer-events-none"></div>
            </div>

            <div className="h-4 w-full"></div>

            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 relative z-10">
                {currentQ.answers.map((ans, idx) => {
                    const isHidden = gameMode === 'MILLIONAIRE' && hiddenAnswers.includes(idx);
                    let state: 'normal' | 'selected' | 'correct' | 'wrong' = 'normal';
                    
                    if (selectedAns === idx) state = 'selected';
                    if (isAnswerChecked) {
                        if (idx === currentQ.correctIndex) state = 'correct';
                        else if (idx === selectedAns) state = 'wrong';
                    }

                    return (
                        <div key={idx} className="h-14 md:h-16 w-full flex items-center relative">
                            <div className={`hidden md:block absolute h-[2px] bg-[#aebcc9] w-8 ${idx % 2 === 0 ? '-right-4' : '-left-4'}`}></div>
                            {renderTVHexagon(
                                ans, 
                                String.fromCharCode(65 + idx), 
                                () => handleAnswerSelect(idx), 
                                state, 
                                isAnswerChecked,
                                isHidden
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {gameMode === 'MILLIONAIRE' && (
          <div className="hidden lg:block h-full relative z-20 border-l border-blue-800/20 bg-black/20 backdrop-blur-sm">
             <MoneyLadder currentQuestionIndex={currentQIndex} />
          </div>
      )}

      {showMoneyLadderMobile && gameMode === 'MILLIONAIRE' && (
        <div className="fixed inset-0 z-40 bg-black/90 flex flex-col items-center justify-center p-8 md:hidden" onClick={() => setShowMoneyLadderMobile(false)}>
            <div className="h-[80vh] w-full" onClick={e => e.stopPropagation()}>
                 <MoneyLadder currentQuestionIndex={currentQIndex} />
            </div>
            <button className="mt-4 text-white border border-white px-6 py-2 rounded" onClick={() => setShowMoneyLadderMobile(false)}>Đóng</button>
        </div>
      )}

      {modalMessage && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModalMessage(null)}>
                <div className="bg-blue-900 border-2 border-orange-500 p-0 rounded-xl max-w-md w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="bg-orange-600 p-2 text-center">
                        <h3 className="text-xl font-bold text-white uppercase tracking-widest">{modalMessage.title}</h3>
                    </div>
                    <div className="p-6 text-center">
                         <p className="text-white font-medium text-lg leading-relaxed whitespace-pre-wrap">{formatChemicalText(modalMessage.content)}</p>
                    </div>
                    <div className="p-4 bg-black/20 flex justify-center">
                        <button onClick={() => setModalMessage(null)} className="px-8 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded font-bold uppercase text-sm tracking-wider">Đã hiểu</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;
