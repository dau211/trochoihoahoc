export interface Question {
  question: string;
  answers: string[];
  correctIndex: number; // 0-3
  explanation?: string;
}

export type GameState = 'MENU' | 'SETUP' | 'LOADING' | 'PLAYING' | 'VICTORY' | 'GAME_OVER' | 'OLYMPIA_SUMMARY';

export type GameMode = 'MILLIONAIRE' | 'OLYMPIA';

export interface LifelineState {
  fiftyFifty: boolean;
  phoneFriend: boolean;
  askAudience: boolean;
}

export const MONEY_TREE = [
  { level: 1, amount: "200.000" },
  { level: 2, amount: "400.000" },
  { level: 3, amount: "600.000" },
  { level: 4, amount: "1.000.000" },
  { level: 5, amount: "2.000.000", milestone: true },
  { level: 6, amount: "3.000.000" },
  { level: 7, amount: "6.000.000" },
  { level: 8, amount: "10.000.000" },
  { level: 9, amount: "14.000.000" },
  { level: 10, amount: "22.000.000", milestone: true },
  { level: 11, amount: "30.000.000" },
  { level: 12, amount: "40.000.000" },
  { level: 13, amount: "60.000.000" },
  { level: 14, amount: "85.000.000" },
  { level: 15, amount: "150.000.000", milestone: true },
];