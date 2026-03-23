import React from 'react';
import htm from 'htm';
import DiceCanvas from './DiceCanvas.js';

const html = htm.bind(React.createElement);

export default function DiceDisplay({ dice, held, toggleHold, isRolling }) {
    return html`
        <div className="flex flex-col gap-2 mb-8">
            <div className="relative group bg-black/30 rounded-3xl overflow-hidden border border-white/5 shadow-inner">
                <${DiceCanvas} 
                    dice=${dice} 
                    held=${held} 
                    toggleHold=${toggleHold} 
                    isRolling=${isRolling} 
                />
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl flex items-center gap-3">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">
                            Click Dices to Hold
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    `;
}
