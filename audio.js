import React from 'react';
import htm from 'htm';
import { Play, RotateCw, History } from 'lucide-react';

const html = htm.bind(React.createElement);

export default function GameControls({ rollsLeft, maxRolls, rollDice, isRolling, gameOver, message, rollHistory = [] }) {
    const dots = Array.from({ length: maxRolls }, (_, i) => i + 1);
    
    return html`
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-gray-900/50 px-4 py-3 rounded-xl border border-gray-700">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Rolls Left</span>
                <div className="flex gap-2">
                    ${dots.map(i => html`
                        <div 
                            key=${i} 
                            className=${`w-3 h-3 rounded-full ${rollsLeft >= i ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-gray-700'}`} 
                        />
                    `)}
                </div>
            </div>

            <button
                onClick=${rollDice}
                disabled=${rollsLeft === 0 || isRolling || gameOver}
                className=${`
                    group relative overflow-hidden flex items-center justify-center gap-3 w-full py-5 rounded-2xl font-black text-xl uppercase tracking-tighter transition-all duration-300
                    ${rollsLeft === 0 || isRolling || gameOver
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-none'
                        : 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-gray-950 border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 hover:brightness-110'}
                `}
            >
                ${isRolling ? html`
                    <${RotateCw} className="animate-spin" size=${28} />
                ` : html`
                    <${Play} fill="currentColor" size=${28} className="group-hover:translate-x-1 transition-transform" />
                    Roll Dice
                `}
            </button>
            
            ${rollsLeft === 0 && !gameOver && html`
                <p className="text-center text-xs text-yellow-500/80 animate-pulse font-medium">
                    No rolls left! Select a category to score.
                </p>
            `}

            ${rollHistory.length > 0 && html`
                <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <${History} size=${12} />
                        Recent Rolls
                    </div>
                    <div className="flex flex-col gap-2">
                        ${rollHistory.map((roll, idx) => html`
                            <div 
                                key=${idx} 
                                className=${`flex justify-center gap-1.5 p-2 rounded-lg bg-black/40 border border-gray-800/50 ${idx === 0 ? 'opacity-100' : 'opacity-40'}`}
                            >
                                ${roll.map((val, i) => html`
                                    <div key=${i} className="w-5 h-5 flex items-center justify-center bg-gray-900 border border-gray-700 rounded text-[10px] font-bold text-gray-300">
                                        ${val}
                                    </div>
                                `)}
                            </div>
                        `)}
                    </div>
                </div>
            `}
        </div>
    `;
}
