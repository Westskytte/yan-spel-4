import React from 'react';
import htm from 'htm';
import { motion } from 'framer-motion';
import { COLUMNS, ROWS, calculateColumnStats, getNextAllowedRow, calculateScore } from '../utils/gameLogic.js';
import { X, Trophy } from 'lucide-react';

const html = htm.bind(React.createElement);

export default function ScoreBoard({ scores, handleScore, crossOut, rollsLeft, maxRolls, currentDice, playerName, isActive, isTransitioning }) {
    const columnKeys = [COLUMNS.TOP_DOWN, COLUMNS.LIBRE, COLUMNS.BOTTOM_UP, COLUMNS.FIRST_MOVE];
    const columnLabels = ['↓ Down', 'Libre', '↑ Up', '1st Move'];
    const columnMultipliers = ['x2', 'x1', 'x3', 'x4'];

    const totalGameScore = columnKeys.reduce((acc, key) => {
        return acc + calculateColumnStats(scores[key], key).totalFinal;
    }, 0);

    const isCellPlayable = (colKey, rowIndex) => {
        if (!isActive || isTransitioning || rollsLeft === maxRolls || scores[colKey][rowIndex] !== null) return false;

        if (colKey === COLUMNS.TOP_DOWN) {
            return rowIndex === getNextAllowedRow(scores[colKey], true);
        }
        if (colKey === COLUMNS.BOTTOM_UP) {
            return rowIndex === getNextAllowedRow(scores[colKey], false);
        }
        if (colKey === COLUMNS.FIRST_MOVE) {
            return rollsLeft === maxRolls - 1; // Always after 1st roll
        }
        
        return true; // Libre is always playable if empty
    };

    return html`
        <${motion.div} 
            layout
            animate=${{ 
                scale: isActive ? 1.02 : 1.0,
                zIndex: isActive ? 10 : 0
            }}
            className=${`
                bg-black/70 rounded-2xl border transition-all duration-300 overflow-hidden shadow-2xl backdrop-blur-md
                ${isActive ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-800 opacity-60 grayscale-[0.5]'}
            `}
        >
            <div className=${`px-4 py-2 border-b border-gray-800 flex justify-between items-center ${isActive ? 'bg-green-950/40' : 'bg-black/40'}`}>
                <span className=${`text-xs font-black uppercase tracking-widest ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
                    ${playerName}
                </span>
                ${isActive && html`
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                `}
            </div>
            <div className="table-container overflow-x-auto">
                <table className="w-full text-center border-collapse">
                    <thead>
                        <tr className="bg-black/60 text-[10px] font-black tracking-widest text-gray-500 border-b border-gray-800">
                            <th className="px-3 py-4 text-left font-bold uppercase w-24">Category</th>
                            ${columnLabels.map((label, idx) => html`
                                <th key=${idx} className="px-2 py-4 border-l border-gray-800/50">
                                    <div className="flex flex-col items-center">
                                        <span className="text-gray-300 text-xs">${label}</span>
                                        <span className="text-yellow-500/60 font-mono mt-0.5">${columnMultipliers[idx]}</span>
                                    </div>
                                </th>
                            `)}
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        ${ROWS.map((row, rowIndex) => html`
                            <${React.Fragment} key=${row.key}>
                                ${rowIndex === 6 && html`
                                    <tr className="bg-gray-900/50 border-y border-gray-700">
                                        <td className="px-3 py-1.5 text-left text-[10px] text-gray-500 font-bold uppercase">Upper Bonus</td>
                                        ${columnKeys.map(key => {
                                            const stats = calculateColumnStats(scores[key], key);
                                            return html`
                                                <td key=${key} className="px-2 py-1.5 border-l border-gray-700/50 font-mono text-[10px]">
                                                    ${stats.upperBonus > 0 ? html`
                                                        <span className="text-green-500">+${stats.upperBonus}</span>
                                                    ` : html`
                                                        <span className="text-gray-600">0</span>
                                                    `}
                                                </td>
                                            `;
                                        })}
                                    </tr>
                                `}

                                <tr className="border-b border-gray-700 group">
                                    <td className="px-3 py-3 text-left font-bold text-gray-300 group-hover:text-white transition-colors bg-gray-900/20">
                                        <div className="flex flex-col">
                                            <span className="text-xs uppercase tracking-tight">${row.label}</span>
                                            ${row.key === 'min' && html`<span className="text-[9px] text-gray-500 font-normal">Min 18p</span>`}
                                            ${row.key === 'max' && html`<span className="text-[9px] text-gray-500 font-normal">Max roll</span>`}
                                        </div>
                                    </td>
                                    ${columnKeys.map(colKey => {
                                        const score = scores[colKey][rowIndex];
                                        const playable = isCellPlayable(colKey, rowIndex);
                                        const potentialScore = playable ? calculateScore(currentDice, rowIndex, scores[colKey], colKey) : null;

                                        return html`
                                            <td 
                                                key=${colKey}
                                                className=${`
                                                    relative px-2 py-3 border-l border-gray-700/50 transition-all duration-200
                                                    ${playable ? 'cell-active cursor-pointer' : ''}
                                                    ${colKey === COLUMNS.FIRST_MOVE && playable ? 'bg-yellow-500/10' : ''}
                                                `}
                                                onClick=${() => playable && handleScore(colKey, rowIndex)}
                                            >
                                                ${score !== null ? (
                                                    score === -1 ? html`
                                                        <${X} className="mx-auto text-red-500/50" size=${16} />
                                                    ` : html`
                                                        <span className="text-yellow-400 font-black text-base">${score}</span>
                                                    `
                                                ) : (
                                                    playable ? html`
                                                        <div className="flex flex-col items-center group/cell">
                                                            <span className=${`
                                                                font-bold 
                                                                ${colKey === COLUMNS.FIRST_MOVE ? 'text-yellow-400/50 group-hover/cell:text-yellow-400' : 'text-blue-400/30 group-hover/cell:text-blue-400'}
                                                            `}>
                                                                ${potentialScore}
                                                            </span>
                                                            <button 
                                                                onClick=${(e) => {
                                                                    e.stopPropagation();
                                                                    crossOut(colKey, rowIndex);
                                                                }}
                                                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded bg-red-900/30 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                                title="Cross out"
                                                            >
                                                                <${X} size=${10} />
                                                            </button>
                                                        </div>
                                                    ` : html`
                                                        <span className="text-gray-800">·</span>
                                                    `
                                                )}
                                            </td>
                                        `;
                                    })}
                                </tr>
                            </${React.Fragment}>
                        `)}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-900 border-t-2 border-gray-700">
                            <td className="px-3 py-3 text-left text-[10px] text-gray-500 font-bold uppercase tracking-wider">Raw Sum</td>
                            ${columnKeys.map(key => {
                                const stats = calculateColumnStats(scores[key], key);
                                return html`
                                    <td key=${key} className="px-2 py-3 border-l border-gray-700/50">
                                        <span className="text-gray-400 font-mono text-xs">${stats.totalRaw}</span>
                                    </td>
                                `;
                            })}
                        </tr>
                        <tr className="bg-gray-950 border-t border-gray-800">
                            <td className="px-3 py-4 text-left text-[10px] text-yellow-500 font-black uppercase tracking-[0.2em] italic">Final Total</td>
                            ${columnKeys.map(key => {
                                const stats = calculateColumnStats(scores[key], key);
                                return html`
                                    <td key=${key} className="px-2 py-4 border-l border-gray-700/50 bg-yellow-500/5">
                                        <div className="flex flex-col items-center">
                                            <span className="text-white text-lg font-black leading-none">${stats.totalFinal}</span>
                                            <span className="text-yellow-600 text-[8px] font-bold mt-1 uppercase">${columnMultipliers[columnKeys.indexOf(key)]}</span>
                                        </div>
                                    </td>
                                `;
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <${Trophy} className="text-yellow-500" size=${24} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Grand Total Score</p>
                        <p className="text-3xl font-black text-white leading-tight">${totalGameScore}</p>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    ${columnKeys.map((key, i) => {
                        const filledCount = scores[key].filter(s => s !== null).length;
                        const progress = (filledCount / ROWS.length) * 100;
                        return html`
                            <div key=${key} className="flex flex-col gap-1 w-12">
                                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-yellow-500 transition-all duration-500" 
                                        style=${{ width: `${progress}%` }}
                                    />
                                </div>
                                <span className="text-[8px] text-gray-500 text-center font-bold">${columnMultipliers[i]}</span>
                            </div>
                        `;
                    })}
                </div>
            </div>
        </div>
    `;
}
