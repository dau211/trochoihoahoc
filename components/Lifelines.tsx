import React from 'react';
import { LifelineState } from '../types';

interface LifelinesProps {
  lifelines: LifelineState;
  onUse: (type: keyof LifelineState) => void;
  disabled: boolean;
}

const Lifelines: React.FC<LifelinesProps> = ({ lifelines, onUse, disabled }) => {
  const getButtonClass = (isActive: boolean) => `
    relative w-20 h-12 md:w-28 md:h-16 rounded-[50%] border-2 
    flex items-center justify-center transition-all duration-200 transform
    ${isActive 
      ? 'border-blue-300 bg-[radial-gradient(ellipse_at_center,_#2563eb_0%,_#1e3a8a_100%)] shadow-[0_0_10px_rgba(37,99,235,0.6)] text-white cursor-pointer hover:scale-110 hover:shadow-[0_0_15px_rgba(37,99,235,0.9)]' 
      : 'border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed'}
  `;

  return (
    <div className="flex gap-4 md:gap-8 justify-center mb-4 z-20">
      {/* 50:50 */}
      <button
        onClick={() => onUse('fiftyFifty')}
        disabled={!lifelines.fiftyFifty || disabled}
        className={getButtonClass(lifelines.fiftyFifty)}
        title="50:50"
      >
        <span className="font-bold text-lg md:text-2xl drop-shadow-md text-orange-400">50:50</span>
        {!lifelines.fiftyFifty && <div className="absolute inset-0 flex items-center justify-center text-red-600 text-4xl font-bold drop-shadow-lg opacity-80">✕</div>}
      </button>

      {/* Phone a Friend */}
      <button
        onClick={() => onUse('phoneFriend')}
        disabled={!lifelines.phoneFriend || disabled}
        className={getButtonClass(lifelines.phoneFriend)}
        title="Gọi điện cho người thân"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 md:w-8 md:h-8 drop-shadow-md text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
        </svg>
        {!lifelines.phoneFriend && <div className="absolute inset-0 flex items-center justify-center text-red-600 text-4xl font-bold drop-shadow-lg opacity-80">✕</div>}
      </button>

      {/* Ask Audience */}
      <button
        onClick={() => onUse('askAudience')}
        disabled={!lifelines.askAudience || disabled}
        className={getButtonClass(lifelines.askAudience)}
        title="Hỏi ý kiến khán giả"
      >
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 md:w-8 md:h-8 drop-shadow-md text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
        {!lifelines.askAudience && <div className="absolute inset-0 flex items-center justify-center text-red-600 text-4xl font-bold drop-shadow-lg opacity-80">✕</div>}
      </button>
    </div>
  );
};

export default Lifelines;