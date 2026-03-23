import React, { useState, useEffect, useCallback } from 'react';
import { Dices, RotateCcw, Award, Info, HelpCircle, BarChart2, Trash2, Undo2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import htm from 'htm';
import ScoreBoard from './components/ScoreBoard.js';
import GameControls from './components/GameControls.js';
import DiceDisplay from './components/DiceDisplay.js';
import { calculateScore, ROWS, COLUMNS, getNextAllowedRow, calculateColumnStats, DIFFICULTIES } from './utils/gameLogic.js';
import { playRollSound, playHoldSound, playScoreSound, playWinSound, setVolume, getVolume } from './utils/audio.js';
import { Volume2, VolumeX } from 'lucide-react';

const html = htm.bind(React.createElement);

const INITIAL_SCORES = {
    [COLUMNS.TOP_DOWN]: Array(ROWS.length).fill(null),
    [COLUMNS.LIBRE]: Array(ROWS.length).fill(null),
    [COLUMNS.BOTTOM_UP]: Array(ROWS.length).fill(null),
    [COLUMNS.FIRST_MOVE]: Array(ROWS.length).fill(null)
};

export default function App() {
    const [difficulty, setDifficulty] = useState('NORMAL');
    const maxRolls = DIFFICULTIES[difficulty].rolls;
    
    const [dice, setDice] = useState([1, 1, 1, 1, 1]);
    const [held, setHeld] = useState([false, false, false, false, false]);
    const [rollsLeft, setRollsLeft] = useState(maxRolls);
    const [isRolling, setIsRolling] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [message, setMessage] = useState('Welcome! Roll the dice to start.');
    const [showInstructions, setShowInstructions] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState({ totalGames: 0, totalScore: 0 });
    const [playerName, setPlayerName] = useState('Player 1');
    const [finalScore, setFinalScore] = useState(0);
    const [winnerMessage, setWinnerMessage] = useState('');
    const [leaderboard, setLeaderboard] = useState([]);
    const [matchHistory, setMatchHistory] = useState([]);
    const [history, setHistory] = useState([]);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [finalPlayerResults, setFinalPlayerResults] = useState([]);
    const [showMatchHistory, setShowMatchHistory] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [showPlayerSetup, setShowPlayerSetup] = useState(true);
    const [rollHistory, setRollHistory] = useState([]);
    const [volume, setVolumeState] = useState(getVolume());

    const handleVolumeChange = (e) => {
        const value = parseFloat(e.target.value);
        setVolume(value);
        setVolumeState(value);
    };

    // Derived Advanced Stats
    const advancedStats = React.useMemo(() => {
        if (!matchHistory.length) return null;
        
        const totalMatches = matchHistory.length;
        const difficulties = {};
        let bestScore = 0;
        let playerWins = 0;
        
        matchHistory.forEach(match => {
            // Favorite difficulty
            difficulties[match.difficulty] = (difficulties[match.difficulty] || 0) + 1;
            
            // Best score
            match.players.forEach(p => {
                if (p.score > bestScore) bestScore = p.score;
            });
            
            // Player wins (if player name matches any in match history winners)
            const maxScore = Math.max(...match.players.map(p => p.score));
            const winners = match.players.filter(p => p.score === maxScore).map(p => p.name);
            if (winners.includes(playerName)) {
                playerWins++;
            }
        });
        
        const diffEntries = Object.entries(difficulties);
        const favDiff = diffEntries.length > 0 ? diffEntries.sort((a,b) => b[1] - a[1])[0][0] : 'N/A';
        const winRate = ((playerWins / totalMatches) * 100).toFixed(0);
        
        return { bestScore, favDiff, winRate, playerWins };
    }, [matchHistory, playerName]);

    // Multiplayer State
    const [numPlayers, setNumPlayers] = useState(1);
    const [currentPlayer, setCurrentPlayer] = useState(0);
    const [playerNames, setPlayerNames] = useState(['Player 1', 'Player 2']);
    const [playerScores, setPlayerScores] = useState([
        JSON.parse(JSON.stringify(INITIAL_SCORES)),
        JSON.parse(JSON.stringify(INITIAL_SCORES))
    ]);

    const scores = playerScores[currentPlayer];

    useEffect(() => {
        try {
            const savedLeaderboard = JSON.parse(localStorage.getItem('yan_dice_leaderboard') || '[]');
            setLeaderboard(Array.isArray(savedLeaderboard) ? savedLeaderboard : []);
            
            const savedMatchHistory = JSON.parse(localStorage.getItem('yan_dice_matches') || '[]');
            setMatchHistory(Array.isArray(savedMatchHistory) ? savedMatchHistory : []);
            
            const savedStatsStr = localStorage.getItem('yan_dice_stats');
            if (savedStatsStr) {
                const savedStats = JSON.parse(savedStatsStr);
                setStats(savedStats || { totalGames: 0, totalScore: 0 });
            }
            
            const savedDiff = localStorage.getItem('yan_dice_difficulty');
            if (savedDiff && DIFFICULTIES[savedDiff]) {
                setDifficulty(savedDiff);
                setRollsLeft(DIFFICULTIES[savedDiff].rolls);
            }
        } catch (e) {
            console.error("Failed to load local storage:", e);
        }
    }, []);

    const changeDifficulty = (newDiff) => {
        setDifficulty(newDiff);
        localStorage.setItem('yan_dice_difficulty', newDiff);
        resetGameWithDiff(newDiff);
    };

    const updateStats = (scoreVal) => {
        const newStats = {
            totalGames: stats.totalGames + 1,
            totalScore: stats.totalScore + scoreVal
        };
        setStats(newStats);
        localStorage.setItem('yan_dice_stats', JSON.stringify(newStats));
    };

    const saveScore = (scoreVal, name) => {
        updateStats(scoreVal);
        const newLeaderboard = [...leaderboard, { 
            score: scoreVal, 
            name: name || 'Anonymous',
            difficulty: DIFFICULTIES[difficulty].label,
            date: new Date().toLocaleDateString(),
            id: Date.now() 
        }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
        
        setLeaderboard(newLeaderboard);
        localStorage.setItem('yan_dice_leaderboard', JSON.stringify(newLeaderboard));
    };

    const clearStats = () => {
        const clearedStats = { totalGames: 0, totalScore: 0 };
        setStats(clearedStats);
        localStorage.setItem('yan_dice_stats', JSON.stringify(clearedStats));
        localStorage.setItem('yan_dice_leaderboard', JSON.stringify([]));
        localStorage.setItem('yan_dice_matches', JSON.stringify([]));
        setLeaderboard([]);
        setMatchHistory([]);
    };

    const startGame = () => {
        setGameStarted(true);
        setShowPlayerSetup(false);
        resetBoard();
    };

    const resetBoard = () => {
        setPlayerScores([
            JSON.parse(JSON.stringify(INITIAL_SCORES)),
            JSON.parse(JSON.stringify(INITIAL_SCORES))
        ]);
        setCurrentPlayer(0);
        setDice([1, 1, 1, 1, 1]);
        setHeld([false, false, false, false, false]);
        setRollsLeft(maxRolls);
        setGameOver(false);
        setFinalScore(0);
        setHistory([]);
        setRollHistory([]);
        setMessage('New game started! Good luck.');
    };

    const resetGame = () => {
        setShowPlayerSetup(true);
        setGameStarted(false);
    };

    const recordMatch = (results, names) => {
        const newMatch = {
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            numPlayers: numPlayers,
            players: names.slice(0, numPlayers).map((name, i) => ({
                name,
                score: results[i]
            })),
            difficulty: DIFFICULTIES[difficulty].label
        };
        
        const newHistory = [newMatch, ...matchHistory].slice(0, 20); // Keep last 20 matches
        setMatchHistory(newHistory);
        localStorage.setItem('yan_dice_matches', JSON.stringify(newHistory));
    };

    const resetGameWithDiff = (diffKey) => {
        setDifficulty(diffKey);
        resetBoard();
        setRollsLeft(DIFFICULTIES[diffKey].rolls);
        setMessage(`New game on ${DIFFICULTIES[diffKey].label} difficulty!`);
    };

    const undoMove = () => {
        if (history.length === 0) return;
        
        const lastState = history[history.length - 1];
        setPlayerScores(lastState.playerScores);
        setCurrentPlayer(lastState.currentPlayer);
        setDice(lastState.dice);
        setHeld(lastState.held);
        setRollsLeft(lastState.rollsLeft);
        setHistory(prev => prev.slice(0, -1));
        setMessage('Last move undone.');
    };

    const saveStateToHistory = () => {
        setHistory(prev => [...prev, {
            playerScores: JSON.parse(JSON.stringify(playerScores)),
            currentPlayer: currentPlayer,
            dice: [...dice],
            held: [...held],
            rollsLeft: rollsLeft
        }].slice(-10)); // Keep only last 10 moves
    };

    const rollDice = useCallback(() => {
        if (rollsLeft === 0 || isRolling) return;

        setIsRolling(true);
        playRollSound();
        setTimeout(() => {
            setDice(prevDice => {
                const nextDice = prevDice.map((d, i) => held[i] ? d : Math.floor(Math.random() * 6) + 1);
                
                // Add to roll history
                setRollHistory(prevHistory => [nextDice, ...prevHistory].slice(0, 5));
                
                return nextDice;
            });

            const nextRolls = rollsLeft - 1;
            setRollsLeft(nextRolls);
            setIsRolling(false);
            
            if (nextRolls === maxRolls - 1) {
                setMessage('First move! You can score in Column 4 (x4) or roll again.');
            } else if (nextRolls > 0) {
                setMessage(`${maxRolls - nextRolls} rolls in. Column 4 is now locked.`);
            } else if (nextRolls === 0) {
                setMessage('Final move! Choose where to score or cross out.');
            }
        }, 1500);
    }, [rollsLeft, held, isRolling, maxRolls]);

    const toggleHold = useCallback((index) => {
        if (rollsLeft === maxRolls || rollsLeft === 0 || isRolling) return;
        setHeld(prev => {
            const next = [...prev];
            next[index] = !next[index];
            playHoldSound(next[index]);
            return next;
        });
    }, [rollsLeft, maxRolls, isRolling]);

    const handleScore = (colKey, rowIndex) => {
        if (rollsLeft === maxRolls || isRolling || scores[colKey][rowIndex] !== null) return;

        // Validation based on column rules
        if (colKey === COLUMNS.TOP_DOWN) {
            const nextRow = getNextAllowedRow(scores[colKey], true);
            if (rowIndex !== nextRow) return;
        }

        if (colKey === COLUMNS.BOTTOM_UP) {
            const nextRow = getNextAllowedRow(scores[colKey], false);
            if (rowIndex !== nextRow) return;
        }

        if (colKey === COLUMNS.FIRST_MOVE && rollsLeft !== maxRolls - 1) return;

        const scoreValue = calculateScore(dice, rowIndex, scores[colKey], colKey);
        
        // Special case for MIN/MAX validation
        if (rowIndex === 6) { // MIN
            if (dice.reduce((a, b) => a + b, 0) < 18) {
                setMessage('MIN must be at least 18! If not, you must cross it out.');
                return;
            }
            const maxVal = scores[colKey][7];
            if (maxVal !== null && maxVal !== -1 && scoreValue >= maxVal) {
                setMessage(`MIN (${scoreValue}) must be lower than MAX (${maxVal})!`);
                return;
            }
        }
        if (rowIndex === 7) { // MAX
            if (dice.reduce((a, b) => a + b, 0) < 19) {
                setMessage('MAX must be at least 19! If not, you must cross it out.');
                return;
            }
            const minVal = scores[colKey][6];
            if (minVal !== null && minVal !== -1 && scoreValue <= minVal) {
                setMessage(`MAX (${scoreValue}) must be higher than MIN (${minVal})!`);
                return;
            }
        }

        saveStateToHistory();
        playScoreSound();
        const newPlayerScores = [...playerScores];
        const newBoard = { ...playerScores[currentPlayer] };
        newBoard[colKey] = [...newBoard[colKey]];
        newBoard[colKey][rowIndex] = scoreValue;
        newPlayerScores[currentPlayer] = newBoard;
        setPlayerScores(newPlayerScores);

        // Check if all players completed the game
        const isGameOverForAll = newPlayerScores.slice(0, numPlayers).every(pScore => 
            Object.values(pScore).every(col => col.every(cell => cell !== null))
        );

        if (isGameOverForAll) {
            const finalScores = newPlayerScores.slice(0, numPlayers).map(pScore => {
                return Object.keys(pScore).reduce((acc, key) => {
                    return acc + calculateColumnStats(pScore[key], key).totalFinal;
                }, 0);
            });
            const maxScore = Math.max(...finalScores);
            setFinalScore(maxScore);
            setFinalPlayerResults(finalScores);
            
            if (numPlayers > 1) {
                if (finalScores[0] === finalScores[1]) {
                    setWinnerMessage("It's a tie!");
                } else {
                    const winnerIdx = finalScores.indexOf(maxScore);
                    setWinnerMessage(`${playerNames[winnerIdx]} Wins!`);
                }
            } else {
                setWinnerMessage('Game Over!');
            }

            setGameOver(true);
            playWinSound();
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        } else if (numPlayers > 1) {
            // Switch turn if multiple players with transition
            setIsTransitioning(true);
            setTimeout(() => {
                const nextPlayer = (currentPlayer + 1) % numPlayers;
                setCurrentPlayer(nextPlayer);
                setRollsLeft(maxRolls);
                setHeld([false, false, false, false, false]);
                setIsTransitioning(false);
                setMessage(`Turn complete. ${playerNames[nextPlayer]}'s turn!`);
            }, 1500); // 1.5s delay to see the score placed
        } else {
            setRollsLeft(maxRolls);
            setHeld([false, false, false, false, false]);
            setMessage('Roll the dice for your next move.');
        }
    };

    const crossOut = (colKey, rowIndex) => {
         if (rollsLeft === maxRolls || isRolling || scores[colKey][rowIndex] !== null) return;
         
         // Same column logic applies for crossing out
         if (colKey === COLUMNS.TOP_DOWN) {
            const nextRow = getNextAllowedRow(scores[colKey], true);
            if (rowIndex !== nextRow) return;
        }

        if (colKey === COLUMNS.BOTTOM_UP) {
            const nextRow = getNextAllowedRow(scores[colKey], false);
            if (rowIndex !== nextRow) return;
        }

        if (colKey === COLUMNS.FIRST_MOVE && rollsLeft !== maxRolls - 1) return;

        saveStateToHistory();
        const newPlayerScores = [...playerScores];
        const newBoard = { ...playerScores[currentPlayer] };
        newBoard[colKey] = [...newBoard[colKey]];
        newBoard[colKey][rowIndex] = -1;
        newPlayerScores[currentPlayer] = newBoard;
        setPlayerScores(newPlayerScores);
        
        // Check if all players completed the game
        const isGameOverForAll = newPlayerScores.slice(0, numPlayers).every(pScore => 
            Object.values(pScore).every(col => col.every(cell => cell !== null))
        );

        if (isGameOverForAll) {
            const finalScores = newPlayerScores.slice(0, numPlayers).map(pScore => {
                return Object.keys(pScore).reduce((acc, key) => {
                    return acc + calculateColumnStats(pScore[key], key).totalFinal;
                }, 0);
            });
            const maxScore = Math.max(...finalScores);
            setFinalScore(maxScore);
            setFinalPlayerResults(finalScores);
            
            if (numPlayers > 1) {
                if (finalScores[0] === finalScores[1]) {
                    setWinnerMessage("It's a tie!");
                } else {
                    const winnerIdx = finalScores.indexOf(maxScore);
                    setWinnerMessage(`${playerNames[winnerIdx]} Wins!`);
                }
            } else {
                setWinnerMessage('Game Over!');
            }

            setGameOver(true);
            playWinSound();
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        } else if (numPlayers > 1) {
             setIsTransitioning(true);
             setTimeout(() => {
                 const nextPlayer = (currentPlayer + 1) % numPlayers;
                 setCurrentPlayer(nextPlayer);
                 setRollsLeft(maxRolls);
                 setHeld([false, false, false, false, false]);
                 setIsTransitioning(false);
                 setMessage(`Category crossed out. ${playerNames[nextPlayer]}'s turn!`);
             }, 1500);
        } else {
            setRollsLeft(maxRolls);
            setHeld([false, false, false, false, false]);
            setMessage('Category crossed out. Roll again.');
        }
    };

    const handleGameOverSubmit = () => {
        saveScore(finalScore, playerName);
        recordMatch(finalPlayerResults, playerNames);
        resetGame();
    };

    return html`
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <header className="flex flex-col items-center mb-8">
                <div className="flex items-center justify-center mb-6">
                    <img src="assets/transparent.png" alt="Yan Logo" className="h-24 md:h-32 object-contain" />
                </div>
                
                <div className="flex flex-wrap justify-center gap-6 mb-6">
                    ${gameStarted && html`
                        <button 
                            onClick=${resetGame}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest"
                        >
                            <${RotateCcw} size=${14} /> New Game
                        </button>
                    `}
                    <button 
                        onClick=${() => setShowInstructions(true)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest"
                    >
                        <${HelpCircle} size=${14} /> Rules
                    </button>
                    <button 
                        onClick=${() => setShowStats(true)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest"
                    >
                        <${BarChart2} size=${14} /> Stats
                    </button>
                    <button 
                        onClick=${() => setShowMatchHistory(true)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest"
                    >
                        <${History} size=${14} /> History
                    </button>
                    <div className="flex items-center gap-2 bg-gray-950/50 px-3 py-1.5 rounded-full border border-gray-800">
                        ${volume === 0 ? html`<${VolumeX} size=${14} className="text-gray-600" />` : html`<${Volume2} size=${14} className="text-gray-600" />`}
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value=${volume} 
                            onChange=${handleVolumeChange}
                            className="w-16 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                    </div>
                    ${gameStarted && history.length > 0 && html`
                        <button 
                            onClick=${undoMove}
                            className="flex items-center gap-1 text-xs text-yellow-500 hover:text-yellow-400 transition-colors font-bold uppercase tracking-widest"
                        >
                            <${Undo2} size=${14} /> Undo
                        </button>
                    `}
                </div>
            </header>

            <${AnimatePresence} mode="wait">
                ${!gameStarted ? html`
                    <${motion.div} 
                        key="setup"
                        initial=${{ opacity: 0, y: 20 }}
                        animate=${{ opacity: 1, y: 0 }}
                        exit=${{ opacity: 0, scale: 0.95 }}
                        className="max-w-xl mx-auto bg-black/60 border border-green-800/50 p-8 rounded-3xl shadow-2xl backdrop-blur-md"
                    >
                        <div className="text-center mb-10">
                            <div className="flex items-center justify-center mb-6">
                                <img src="assets/transparent.png" alt="Yan Logo" className="h-28 md:h-36 object-contain brightness-110 drop-shadow-2xl" />
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight italic mb-2">Grand Tournament</h2>
                            <p className="text-green-400 text-xs font-medium uppercase tracking-widest">Prepare your strategy and enter names</p>
                        </div>

                        <div className="space-y-8">
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Game Mode</span>
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">${numPlayers} Players</span>
                                </div>
                                <div className="flex bg-gray-950/80 p-1.5 rounded-2xl border border-gray-800 shadow-inner">
                                    <button
                                        onClick=${() => setNumPlayers(1)}
                                        className=${`flex-1 px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${numPlayers === 1 ? 'bg-blue-600 text-white shadow-lg transform scale-[1.02]' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        Solo
                                    </button>
                                    <button
                                        onClick=${() => setNumPlayers(2)}
                                        className=${`flex-1 px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${numPlayers === 2 ? 'bg-blue-600 text-white shadow-lg transform scale-[1.02]' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        2 Players
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Player Identities</span>
                                ${Array(numPlayers).fill(0).map((_, i) => html`
                                    <div key=${i} className="relative group">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                                            <span className="text-[10px] font-black text-gray-600 group-focus-within:text-yellow-500 transition-colors uppercase">P${i + 1}</span>
                                        </div>
                                        <input 
                                            type="text"
                                            value=${playerNames[i]}
                                            onChange=${(e) => {
                                                const newNames = [...playerNames];
                                                newNames[i] = e.target.value;
                                                setPlayerNames(newNames);
                                            }}
                                            className="w-full bg-gray-950/50 border border-gray-700 rounded-2xl pl-12 pr-6 py-5 text-white focus:outline-none focus:border-yellow-500 transition-all font-black text-sm uppercase tracking-wider"
                                            placeholder="Enter warrior name..."
                                        />
                                    </div>
                                `)}
                            </div>

                            <div className="flex flex-col gap-4">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Challenge Level</span>
                                <div className="flex flex-wrap justify-center gap-3">
                                    ${Object.entries(DIFFICULTIES).map(([key, diff]) => html`
                                        <button
                                            key=${key}
                                            onClick=${() => setDifficulty(key)}
                                            className=${`flex-1 min-w-[100px] px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${difficulty === key ? 'bg-yellow-500 text-gray-950 border-yellow-500 shadow-lg transform scale-105' : 'bg-gray-900/50 text-gray-500 border-gray-800 hover:text-white hover:border-gray-700'}`}
                                        >
                                            ${diff.label}
                                        </button>
                                    `)}
                                </div>
                            </div>

                            <button 
                                onClick=${startGame}
                                className="group relative w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-gray-950 font-black py-6 rounded-2xl transition-all uppercase tracking-[0.3em] text-sm shadow-2xl transform active:scale-95 flex items-center justify-center gap-3 mt-4"
                            >
                                <${Dices} size=${20} className="group-hover:rotate-12 transition-transform" /> 
                                Roll To Start
                            </button>
                        </div>
                    </${motion.div}>
                ` : html`
                    <${motion.div} 
                        key="game"
                        initial=${{ opacity: 0 }}
                        animate=${{ opacity: 1 }}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative"
                    >
                        ${isTransitioning && html`
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none">
                                <${motion.div} 
                                    initial=${{ opacity: 0, scale: 0.8 }}
                                    animate=${{ opacity: 1, scale: 1 }}
                                    className="bg-yellow-500 text-gray-950 px-8 py-4 rounded-2xl font-black uppercase tracking-[0.3em] shadow-2xl border-4 border-gray-950"
                                >
                                    Switching Turn...
                                </${motion.div}>
                            </div>
                        `}
                        
                        <div className="lg:col-span-4 flex flex-col gap-8 sticky top-8">
                            <div className="bg-black/60 p-6 rounded-2xl border border-green-800/50 backdrop-blur-md shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Active Player</span>
                                        <span className="text-xl font-black text-white italic uppercase">${playerNames[currentPlayer]}</span>
                                    </div>
                                    <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
                                        <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">${difficulty}</span>
                                    </div>
                                </div>
                                <${DiceDisplay} 
                                    dice=${dice} 
                                    held=${held} 
                                    toggleHold=${toggleHold} 
                                    isRolling=${isRolling}
                                />
                                <${GameControls} 
                                    rollsLeft=${rollsLeft} 
                                    maxRolls=${maxRolls}
                                    rollDice=${rollDice} 
                                    isRolling=${isRolling} 
                                    gameOver=${gameOver}
                                    message=${message}
                                    rollHistory=${rollHistory}
                                />
                            </div>

                            <div className="bg-green-950/40 p-4 rounded-xl border border-green-500/30 backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-green-400 mb-2">
                                    <${Info} size=${18} />
                                    <span className="font-semibold uppercase text-xs tracking-wider">Game Status</span>
                                </div>
                                <p className="text-sm text-green-100/80 leading-relaxed">
                                    ${message}
                                </p>
                            </div>
                        </div>

                        <div className="lg:col-span-8 flex flex-col gap-6">
                            ${numPlayers === 1 ? html`
                                <${ScoreBoard} 
                                    scores=${playerScores[0]} 
                                    handleScore=${handleScore} 
                                    crossOut=${crossOut}
                                    rollsLeft=${rollsLeft}
                                    maxRolls=${maxRolls}
                                    currentDice=${dice}
                                    playerName=${playerNames[0]}
                                    isActive=${true}
                                    isTransitioning=${isTransitioning}
                                />
                            ` : html`
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    ${playerScores.slice(0, numPlayers).map((pScores, idx) => html`
                                        <${ScoreBoard} 
                                            key=${idx}
                                            scores=${pScores} 
                                            handleScore=${handleScore} 
                                            crossOut=${crossOut}
                                            rollsLeft=${idx === currentPlayer ? rollsLeft : maxRolls}
                                            maxRolls=${maxRolls}
                                            currentDice=${dice}
                                            playerName=${playerNames[idx]}
                                            isActive=${idx === currentPlayer}
                                            isTransitioning=${isTransitioning}
                                        />
                                    `)}
                                </div>
                            `}
                        </div>
                    </${motion.div}>
                `}
            </${AnimatePresence}>

            <${AnimatePresence}>
                ${showInstructions && html`
                    <${motion.div} 
                        initial=${{ opacity: 0 }}
                        animate=${{ opacity: 1 }}
                        exit=${{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                        onClick=${() => setShowInstructions(false)}
                    >
                        <${motion.div} 
                            initial=${{ scale: 0.9, y: 20 }}
                            animate=${{ scale: 1, y: 0 }}
                            exit=${{ scale: 0.9, y: 20 }}
                            className="bg-gray-800 border border-gray-700 p-8 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto table-container shadow-2xl"
                            onClick=${e => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-4 text-yellow-500">How to Play Yan Dice</h2>
                            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
                                <section>
                                    <h3 className="text-white font-bold uppercase tracking-wider text-xs mb-1">Column Rules</h3>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><strong>Top Down (x2):</strong> Fill rows in order from 1 down to YAN.</li>
                                        <li><strong>Libre (x1):</strong> Fill in any order.</li>
                                        <li><strong>Bottom Up (x3):</strong> Fill rows in reverse order from YAN up to 1.</li>
                                        <li><strong>First Move (x4):</strong> Only playable after the very first roll of a turn. Any order.</li>
                                    </ul>
                                </section>
                                <section>
                                    <h3 className="text-white font-bold uppercase tracking-wider text-xs mb-1">Scoring Categories</h3>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><strong>1-6:</strong> Sum of dice of that kind. (60+ pts bonus in upper part).</li>
                                        <li><strong>MIN:</strong> At least 18. Must be lower than MAX.</li>
                                        <li><strong>MAX:</strong> Must be higher than MIN.</li>
                                        <li><strong>2 PAIR:</strong> Sum + 10p bonus.</li>
                                        <li><strong>FULL HOUSE:</strong> Sum + 20p bonus.</li>
                                        <li><strong>STRAIGHT:</strong> 1-2-3-4-5 or 2-3-4-5-6. Sum + 30p bonus.</li>
                                        <li><strong>FOUR:</strong> 4 of a kind. Sum + 40p bonus.</li>
                                        <li><strong>YAN:</strong> 5 of a kind. Sum + 50p (1-4), +70p (5), +80p (6) bonus.</li>
                                    </ul>
                                </section>
                            </div>
                            <button 
                                onClick=${() => setShowInstructions(false)}
                                className="mt-8 w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl transition-colors uppercase tracking-widest text-sm"
                            >
                                Let's Play
                            </button>
                        </${motion.div}>
                    </${motion.div}>
                `}
            </${AnimatePresence}>

            <${AnimatePresence}>
                ${showMatchHistory && html`
                    <${motion.div} 
                        initial=${{ opacity: 0 }}
                        animate=${{ opacity: 1 }}
                        exit=${{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                        onClick=${() => setShowMatchHistory(false)}
                    >
                        <${motion.div} 
                            initial=${{ scale: 0.9, y: 20 }}
                            animate=${{ scale: 1, y: 0 }}
                            exit=${{ scale: 0.9, y: 20 }}
                            className="bg-gray-800 border border-gray-700 p-8 rounded-2xl max-w-xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
                            onClick=${e => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-6 text-yellow-500 flex items-center gap-2">
                                <${History} size=${24} /> Match History
                            </h2>
                            
                            <div className="space-y-4">
                                ${matchHistory.map(match => {
                                    const maxScore = Math.max(...match.players.map(p => p.score));
                                    const winners = match.players.filter(p => p.score === maxScore).map(p => p.name);
                                    
                                    return html`
                                        <div key=${match.id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex flex-col gap-3">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                <span>${match.date} @ ${match.time}</span>
                                                <span className="text-yellow-500/50">${match.difficulty}</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 gap-2">
                                                ${match.players.map((p, i) => html`
                                                    <div key=${i} className=${`flex justify-between items-center px-3 py-2 rounded-lg ${p.score === maxScore ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-800/50 border border-gray-700/50'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className=${`font-bold text-sm ${p.score === maxScore ? 'text-white' : 'text-gray-400'}`}>
                                                                ${p.name}
                                                            </span>
                                                            ${p.score === maxScore && html`<${Award} size=${12} className="text-yellow-500" />`}
                                                        </div>
                                                        <span className=${`font-mono font-black ${p.score === maxScore ? 'text-yellow-500' : 'text-gray-500'}`}>
                                                            ${p.score}
                                                        </span>
                                                    </div>
                                                `)}
                                            </div>
                                        </div>
                                    `;
                                })}
                                
                                ${matchHistory.length === 0 && html`
                                    <div className="text-center py-12 text-gray-500 italic">
                                        No match history recorded yet.
                                    </div>
                                `}
                            </div>

                            <button 
                                onClick=${() => setShowMatchHistory(false)}
                                className="mt-8 w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors uppercase tracking-widest text-xs"
                            >
                                Close
                            </button>
                        </${motion.div}>
                    </${motion.div}>
                `}
            </${AnimatePresence}>

            <${AnimatePresence}>
                ${showStats && html`
                    <${motion.div} 
                        initial=${{ opacity: 0 }}
                        animate=${{ opacity: 1 }}
                        exit=${{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                        onClick=${() => setShowStats(false)}
                    >
                        <${motion.div} 
                            initial=${{ scale: 0.9, y: 20 }}
                            animate=${{ scale: 1, y: 0 }}
                            exit=${{ scale: 0.9, y: 20 }}
                            className="bg-gray-800 border border-gray-700 p-8 rounded-2xl max-w-md w-full shadow-2xl"
                            onClick=${e => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-6 text-yellow-500 flex items-center gap-2">
                                <${BarChart2} size=${24} /> Career Statistics
                            </h2>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Games</p>
                                        <p className="text-3xl font-black text-white">${stats.totalGames}</p>
                                    </div>
                                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Average Score</p>
                                        <p className="text-3xl font-black text-white">
                                            ${stats.totalGames > 0 ? (stats.totalScore / stats.totalGames).toFixed(1) : '0'}
                                        </p>
                                    </div>
                                </div>
                                
                                ${advancedStats && html`
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-900/50 p-4 rounded-xl border border-blue-900/30">
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Win Rate</p>
                                            <p className="text-3xl font-black text-white">${advancedStats.winRate}%</p>
                                        </div>
                                        <div className="bg-gray-900/50 p-4 rounded-xl border border-yellow-900/30">
                                            <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">Best Score</p>
                                            <p className="text-3xl font-black text-white">${advancedStats.bestScore}</p>
                                        </div>
                                        <div className="bg-gray-900/50 p-4 rounded-xl border border-green-900/30">
                                            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Favorite Diff</p>
                                            <p className="text-lg font-black text-white uppercase">${advancedStats.favDiff}</p>
                                        </div>
                                        <div className="bg-gray-900/50 p-4 rounded-xl border border-purple-900/30">
                                            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Total Wins</p>
                                            <p className="text-3xl font-black text-white">${advancedStats.playerWins}</p>
                                        </div>
                                    </div>
                                `}

                                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Lifetime Total Points</p>
                                    <p className="text-3xl font-black text-white">${stats.totalScore}</p>
                                </div>
                                
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] text-center">Top Performers</p>
                                    ${leaderboard.slice(0, 3).map((entry, idx) => html`
                                        <div key=${entry.id} className="flex justify-between items-center bg-gray-900/40 px-4 py-3 rounded-xl border border-gray-800">
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-600 font-mono text-xs">${idx + 1}</span>
                                                <span className="text-white font-bold text-sm">${entry.name}</span>
                                            </div>
                                            <span className="text-yellow-500 font-black">${entry.score}</span>
                                        </div>
                                    `)}
                                    ${leaderboard.length === 0 && html`
                                        <p className="text-gray-600 italic text-xs text-center py-2">No hall of fame entries yet.</p>
                                    `}
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button 
                                    onClick=${() => setShowStats(false)}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors uppercase tracking-widest text-xs"
                                >
                                    Close
                                </button>
                                <button 
                                    onClick=${() => { if(confirm('Are you sure you want to clear all stats and leaderboard history?')) clearStats(); }}
                                    className="flex items-center justify-center px-4 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl transition-colors"
                                    title="Clear Statistics"
                                >
                                    <${Trash2} size=${18} />
                                </button>
                            </div>
                        </${motion.div}>
                    </${motion.div}>
                `}
            </${AnimatePresence}>

            <${AnimatePresence}>
                ${gameOver && html`
                    <${motion.div} 
                        initial=${{ opacity: 0 }}
                        animate=${{ opacity: 1 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
                    >
                        <${motion.div} 
                            initial=${{ scale: 0.8, y: 50 }}
                            animate=${{ scale: 1, y: 0 }}
                            className="bg-gray-800 border-2 border-yellow-500 p-8 rounded-3xl text-center max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <${Award} className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tight">${winnerMessage}</h2>
                            
                            <div className="flex flex-col gap-3 mb-8 bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
                                <h3 className="text-yellow-500 text-xs font-black uppercase tracking-[0.2em] mb-2">Final Standings</h3>
                                ${finalPlayerResults.map((score, idx) => html`
                                    <div key=${idx} className=${`flex justify-between items-center p-3 rounded-xl border ${idx === finalPlayerResults.indexOf(finalScore) ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className=${`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === finalPlayerResults.indexOf(finalScore) ? 'bg-yellow-500 text-gray-950' : 'bg-gray-700 text-gray-400'}`}>
                                                ${idx + 1}
                                            </span>
                                            <span className=${`font-bold ${idx === finalPlayerResults.indexOf(finalScore) ? 'text-white' : 'text-gray-400'}`}>
                                                ${playerNames[idx]}
                                            </span>
                                        </div>
                                        <span className=${`text-xl font-black ${idx === finalPlayerResults.indexOf(finalScore) ? 'text-yellow-500' : 'text-gray-300'}`}>
                                            ${score}
                                        </span>
                                    </div>
                                `)}
                            </div>
                            
                            <div className="mb-8 text-left">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Your Name</label>
                                <input 
                                    type="text" 
                                    value=${playerName}
                                    onChange=${(e) => setPlayerName(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
                                    placeholder="Enter your name..."
                                />
                            </div>

                            <div className="bg-gray-900/50 rounded-2xl p-6 mb-8 border border-gray-700">
                                <h3 className="text-yellow-500 text-xs font-black uppercase tracking-[0.2em] mb-4 text-center">Local Hall of Fame</h3>
                                <div className="space-y-2">
                                    ${leaderboard.map((entry, idx) => html`
                                        <div key=${entry.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                                            <div className="flex flex-col text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-500 font-mono text-xs">${idx + 1}.</span>
                                                    <span className="text-white font-bold text-sm">${entry.name}</span>
                                                </div>
                                                <span className="text-gray-500 text-[9px] ml-5">${entry.date}</span>
                                            </div>
                                            <span className="text-yellow-500 font-black text-lg">${entry.score}</span>
                                        </div>
                                    `)}
                                    ${leaderboard.length === 0 && html`
                                        <p className="text-gray-600 italic text-sm py-4 text-center">No scores yet. Be the first!</p>
                                    `}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick=${resetGame}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick=${handleGameOverSubmit}
                                    className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-gray-950 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-lg transform active:scale-95"
                                >
                                    Save & Restart
                                </button>
                            </div>
                        </${motion.div}>
                    </${motion.div}>
                `}
            </${AnimatePresence}>
        </div>
    `;
}
