import React, { useEffect, useRef } from 'react';
import { MONEY_TREE } from '../types';

interface MoneyLadderProps {
  currentQuestionIndex: number;
}

const MoneyLadder: React.FC<MoneyLadderProps> = ({ currentQuestionIndex }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reverse shallow copy to display highest prize at top
  const reversedTree = [...MONEY_TREE].reverse();

  useEffect(() => {
    if (scrollRef.current) {
      // Logic to auto scroll if needed, though usually whole ladder fits on desktop
    }
  }, [currentQuestionIndex]);

  return (
    <div className="bg-transparent w-full md:w-80 h-full overflow-y-auto p-4 flex flex-col items-center select-none" ref={scrollRef}>
      {reversedTree.map((level) => {
        const isActive = level.level === currentQuestionIndex + 1;
        
        // VTV Style Colors
        // Current: Orange Background, Black Text (or White)
        // Milestones (5, 10, 15): White Text
        // Others: Gold/Orange Text
        
        let containerClass = "mb-1 w-full rounded px-2 py-1 flex justify-between items-center transition-all duration-200";
        let levelNumClass = "";
        let amountClass = "";

        if (isActive) {
            containerClass += " bg-[#FF9900] shadow-[0_0_10px_#FF9900] scale-105 border border-white z-10";
            levelNumClass = "text-black font-bold";
            amountClass = "text-black font-bold";
        } else {
            if (level.milestone) {
                levelNumClass = "text-white font-bold";
                amountClass = "text-white font-bold";
            } else {
                levelNumClass = "text-[#eab308]"; // Gold
                amountClass = "text-[#eab308]"; // Gold
            }
            containerClass += " hover:bg-white/10";
        }

        // Add index numbers on the left? No, just the level number from data
        return (
          <div key={level.level} className={containerClass}>
            <span className={`text-lg w-8 ${levelNumClass}`}>{level.level}</span>
            <span className={`text-lg tracking-wider ${amountClass}`}>
              {level.amount}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MoneyLadder;