import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { getAiMove } from "./aiEngine";
import { db } from "./firebase";
import { ref, push, onValue } from "firebase/database";
const STORAGE_KEY = "split-steal-history-v2";

const rulesList = [
  "If both choose Split, both players share the reward.",
  "If you choose Steal and opponent chooses Split, you take the full reward.",
  "If you choose Split and opponent chooses Steal, opponent takes the full reward.",
  "If both choose Steal, nobody gets the reward.",
];

const signalPool = [
  "AI facial scan suggests cooperation.",
  "Opponent pulse looks unstable.",
  "Confidence spike detected.",
  "Trust pattern seems fake.",
  "AI hesitation detected.",
  "Aggression probability rising.",
  "Signal may be misleading.",
  "Opponent expression unreadable.",
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOutcome(playerChoice, opponentChoice, rewardPool, mode) {
  if (playerChoice === "Split" && opponentChoice === "Split") {
    return {
      title: "Mutual Trust",
      subtitle: "Both sides chose Split.",
      outcome: "win-both",
      playerGain: Math.floor(rewardPool / 2),
      opponentGain: Math.ceil(rewardPool / 2),
      explanation:
        mode === "pvp"
          ? "Both players stayed balanced and shared the reward."
          : "AI chose based on your previous behavior pattern.",
      rewardText: "Shared reward unlocked",
      coins: 2,
    };
  }

  if (playerChoice === "Steal" && opponentChoice === "Split") {
    return {
      title: mode === "pvp" ? "You Outplayed Player 2" : "You Outplayed the AI",
      subtitle: "You chose Steal while the opponent chose Split.",
      outcome: "win-player",
      playerGain: rewardPool,
      opponentGain: 0,
      explanation:
        mode === "pvp"
          ? "You took the high-risk line and captured the entire reward pool."
          : "The AI trusted the round, but you grabbed the full reward.",
      rewardText: "Jackpot secured by you",
      coins: 4,
    };
  }

  if (playerChoice === "Split" && opponentChoice === "Steal") {
    return {
      title: mode === "pvp" ? "Player 2 Outsmarted You" : "AI Outsmarted You",
      subtitle: "You chose Split while the opponent chose Steal.",
      outcome: "win-opponent",
      playerGain: 0,
      opponentGain: rewardPool,
      explanation:
        mode === "pvp"
          ? "You trusted the round, but Player 2 exploited it and took everything."
          : "You played cooperatively, but the AI exploited that trust and took everything.",
      rewardText: mode === "pvp" ? "Player 2 captured the pool" : "AI captured the pool",
      coins: 0,
    };
  }

  return {
    title: "Greed Destroyed the Reward",
    subtitle: "Both sides chose Steal.",
    outcome: "lose-both",
    playerGain: 0,
    opponentGain: 0,
    explanation:
      "Both sides chased the full reward, so the pool collapsed and nobody got anything.",
    rewardText: "Reward pool collapsed",
    coins: 0,
  };
}


function getSimulatedPlayer2Choice(roundNumber, rewardPool) {
  let stealChance = 0.45;
  if (roundNumber > 2) stealChance += 0.08;
  if (rewardPool >= 180) stealChance += 0.12;
  if (rewardPool >= 260) stealChance += 0.08;
  return Math.random() < stealChance ? "Steal" : "Split";
}

function getPlayStyleText(stats) {
  if (stats.total === 0) {
    return "No pattern detected yet. Play a few rounds to reveal your strategic behavior.";
  }
  if (stats.playerStealCount > stats.playerSplitCount) {
    return "Aggressive profile detected. You prefer risky plays and full-pool attempts.";
  }
  if (stats.playerSplitCount > stats.playerStealCount) {
    return "Cooperative profile detected. You lean toward trust, which can build reward momentum.";
  }
  return "Balanced profile detected. Your choices remain hard to predict.";
}

function getAvatarMoodConfig(state, mode) {
  switch (state) {
    case "thinking":
      return { label: "Calculating", className: "thinking" };
    case "cry":
      return { label: "Regret", className: "cry" };
    case "dance":
      return { label: mode === "pvp" ? "Celebrating" : "Cheer Mode", className: "dance" };
    case "happy":
      return { label: "Respect", className: "happy" };
    case "angry":
      return { label: "Angry", className: "angry" };
    default:
      return { label: "Observing", className: "idle" };
  }
}

export default function App() {
  const [strategy, setStrategy] = useState("adaptive");

  const saveGame = (roundData) => {
    console.log("Saving to Firebase:", roundData);
    push(ref(db, "games/"), roundData);
  };
  const [currentScreen, setCurrentScreen] = useState("home");
  const [mode, setMode] = useState("ai");
  const [history, setHistory] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [playerChoice, setPlayerChoice] = useState("");
  const [opponentChoice, setOpponentChoice] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [avatarState, setAvatarState] = useState("idle");
  const [showOverlay, setShowOverlay] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [flashClass, setFlashClass] = useState("");
  const [typedText, setTypedText] = useState("");
  const [bluffSignal, setBluffSignal] = useState("AI signal waiting...");
  const [rewardPool, setRewardPool] = useState(100);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(8);
  const [timerActive, setTimerActive] = useState(false);


  const audioContextRef = useRef(null);
  const bgIntervalRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      setHistory(saved.history || []);
      setRewardPool(saved.rewardPool || 100);
      setStreak(saved.streak || 0);
      setMode(saved.mode || "ai");
    }

    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        history,
        rewardPool,
        streak,
        mode,
      })
    );
  }, [history, rewardPool, streak, mode]);

  // ✅ FIREBASE REAL-TIME LOAD
  useEffect(() => {
    const gameRef = ref(db, "games/");

    onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded = Object.values(data);
        setHistory(loaded);
      }
    });
  }, []);

  useEffect(() => {
    if (currentScreen === "play" && !aiThinking && !showOverlay && !currentResult) {
      setTimeLeft(8);
      setTimerActive(true);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setTimerActive(false);
            handleTimedAutoChoice();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentScreen, aiThinking, showOverlay, currentResult]);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      if (bgIntervalRef.current) clearInterval(bgIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const stats = useMemo(() => {
    const total = history.length;
    const playerWins = history.filter((r) => r.outcome === "win-player").length;
    const opponentWins = history.filter((r) => r.outcome === "win-opponent").length;
    const mutualWins = history.filter((r) => r.outcome === "win-both").length;
    const mutualLosses = history.filter((r) => r.outcome === "lose-both").length;
    const playerSplitCount = history.filter((r) => r.playerChoice === "Split").length;
    const playerStealCount = history.filter((r) => r.playerChoice === "Steal").length;

    return {
      total,
      playerWins,
      opponentWins,
      mutualWins,
      mutualLosses,
      playerSplitCount,
      playerStealCount,
      winRate: total ? Math.round((playerWins / total) * 100) : 0,
    };
  }, [history]);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioContextRef.current = new AudioCtx();
    }
    return audioContextRef.current;
  };

  const playTone = (frequency, duration, type = "sine", volume = 0.1, delay = 0) => {
    if (!soundOn) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const startAt = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  };

  const startBackgroundMusic = () => {
    if (!soundOn) return;
    if (bgIntervalRef.current) return;

    const playLoop = () => {
      playTone(196, 0.9, "sine", 0.025, 0);
      playTone(247, 1.0, "triangle", 0.02, 0.18);
      playTone(294, 0.95, "sine", 0.018, 0.4);
      playTone(392, 1.1, "triangle", 0.016, 0.62);
    };

    playLoop();
    bgIntervalRef.current = setInterval(playLoop, 1800);
  };

  const stopBackgroundMusic = () => {
    if (bgIntervalRef.current) {
      clearInterval(bgIntervalRef.current);
      bgIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!soundOn) stopBackgroundMusic();
  }, [soundOn]);

  const playClickSound = () => {
    playTone(520, 0.08, "triangle", 0.18);
    playTone(760, 0.1, "sine", 0.12, 0.03);
  };

  const playThinkingSound = () => {
    playTone(260, 0.13, "sawtooth", 0.11);
    playTone(330, 0.13, "sawtooth", 0.11, 0.11);
    playTone(420, 0.14, "sawtooth", 0.11, 0.22);
  };

  const playWinPlayerSound = () => {
    playTone(520, 0.12, "triangle", 0.18);
    playTone(740, 0.14, "triangle", 0.18, 0.08);
    playTone(980, 0.18, "triangle", 0.18, 0.18);
  };

  const playWinOpponentSound = () => {
    playTone(560, 0.11, "square", 0.16);
    playTone(430, 0.14, "square", 0.16, 0.1);
    playTone(290, 0.2, "square", 0.16, 0.22);
  };

  const playMutualWinSound = () => {
    playTone(392, 0.11, "sine", 0.15);
    playTone(494, 0.12, "sine", 0.15, 0.08);
    playTone(620, 0.17, "sine", 0.15, 0.16);
  };

  const playMutualLoseSound = () => {
    playTone(230, 0.13, "sawtooth", 0.16);
    playTone(180, 0.16, "sawtooth", 0.16, 0.11);
    playTone(140, 0.2, "sawtooth", 0.16, 0.24);
  };

  const playOutcomeSound = (outcome) => {
    if (outcome === "win-player") playWinPlayerSound();
    else if (outcome === "win-opponent") playWinOpponentSound();
    else if (outcome === "win-both") playMutualWinSound();
    else playMutualLoseSound();
  };

  const typeText = (text) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    setTypedText("");
    let i = 0;

    typingIntervalRef.current = setInterval(() => {
      i += 1;
      setTypedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typingIntervalRef.current);
      }
    }, 20);
  };

  const triggerShake = () => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 480);
  };

  const triggerFlash = (outcome) => {
    setFlashClass(outcome);
    setTimeout(() => setFlashClass(""), 420);
  };

  const startNewPlayTurn = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeLeft(8);
    setTimerActive(true);
    setCurrentResult(null);
    setShowOverlay(false);
    setTypedText("");
    setPlayerChoice("");
    setOpponentChoice("");
    setBluffSignal(randomFrom(signalPool));
  };

  const handleTimedAutoChoice = () => {
    if (aiThinking || playerChoice) return;
    executeRound("Split", true);
  };

  const executeRound = (choice, autoChosen = false) => {
    if (aiThinking) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimerActive(false);

    startBackgroundMusic();
    playClickSound();

    setCurrentScreen("play");
    setPlayerChoice(autoChosen ? "Split (Auto)" : choice);
    setOpponentChoice("");
    setCurrentResult(null);
    setShowOverlay(false);
    setAiThinking(true);
    setAvatarState("thinking");
    playThinkingSound();

    const hint = randomFrom(signalPool);
    setBluffSignal(hint);

    const opponent =
      mode === "ai"
        ? getAiMove(strategy, choice, history, rewardPool)
        : getSimulatedPlayer2Choice(history.length + 1, rewardPool);

    setTimeout(() => {
      const result = getOutcome(choice, opponent, rewardPool, mode);

      let nextPool = rewardPool;
      let nextStreak = streak;

      if (choice === "Split" && opponent === "Split") {
        nextStreak += 1;
        nextPool = Math.min(400, rewardPool + 30 + nextStreak * 5);
      } else if (choice === "Steal" && opponent === "Split") {
        nextStreak = 0;
        nextPool = 100;
      } else if (choice === "Split" && opponent === "Steal") {
        nextStreak = 0;
        nextPool = Math.max(100, rewardPool - 20);
      } else {
        nextStreak = 0;
        nextPool = 100;
      }

      setRewardPool(nextPool);
      setStreak(nextStreak);

      if (result.outcome === "win-player") {
        setAvatarState("cry");
      } else if (result.outcome === "win-opponent") {
        setAvatarState("dance");
      } else if (result.outcome === "win-both") {
        setAvatarState("happy");
      } else {
        setAvatarState("angry");
      }

      playOutcomeSound(result.outcome);
      typeText(result.explanation);
      triggerFlash(result.outcome);

      if (
        result.outcome === "win-player" ||
        result.outcome === "win-opponent" ||
        result.outcome === "lose-both"
      ) {
        triggerShake();
      }

      const round = {
        id: Date.now(),
        mode,
        playerChoice: choice,
        opponentChoice: opponent,
        title: result.title,
        subtitle: result.subtitle,
        explanation: result.explanation,
        reward: `${result.playerGain} / ${result.opponentGain}`,
        rewardText: result.rewardText,
        outcome: result.outcome,
        coins: result.coins,
        signal: hint,
        rewardPoolBefore: rewardPool,
        playedAt: new Date().toISOString(),
      };

      const updatedHistory = [round, ...history];
      setHistory(updatedHistory);

      // ✅ SAVE TO FIREBASE
      saveGame(round);

      setOpponentChoice(opponent);
      setCurrentResult({
        ...result,
        reward: `${result.playerGain} / ${result.opponentGain}`,
      });
      setAiThinking(false);
      setShowOverlay(true);
    }, 1700);
  };

  const handleResetHistory = () => {
    playClickSound();
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
    setCurrentResult(null);
    setPlayerChoice("");
    setOpponentChoice("");
    setAvatarState("idle");
    setShowOverlay(false);
    setRewardPool(100);
    setStreak(0);
    setTypedText("");
    setBluffSignal("AI signal waiting...");
    setCurrentScreen("home");
  };

  const splitTendency = stats.total
    ? Math.round((stats.playerSplitCount / stats.total) * 100)
    : 0;

  const stealTendency = stats.total
    ? Math.round((stats.playerStealCount / stats.total) * 100)
    : 0;

  const avatarMood = getAvatarMoodConfig(avatarState, mode);

  return (
    <>
      {showSplash && (
        <div className="splash-screen">
          <div className="splash-core" />
          <div className="splash-ring splash-ring-one" />
          <div className="splash-ring splash-ring-two" />
          <div className="splash-text-wrap">
            <div className="splash-badge">GAME INITIALIZING</div>
            <h1 className="splash-title">Split or Steal</h1>
            <p className="splash-subtitle">Trust. Betray. Outsmart the opponent.</p>
          </div>
        </div>
      )}

      {showOverlay && currentResult && (
        <div className="result-overlay" onClick={() => {
          setShowOverlay(false);
          startNewPlayTurn();
        }}>
          <div
            className={`overlay-card ${currentResult.outcome}`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="overlay-tag">Round Complete</span>
            <h2>{currentResult.title}</h2>
            <p className="overlay-subtitle">{currentResult.subtitle}</p>

            <div className="overlay-reward-line">
              <span className="overlay-reward-pill">{currentResult.reward}</span>
              <span className="overlay-reward-text">{currentResult.rewardText}</span>
            </div>

            <p className="overlay-explanation">{typedText || currentResult.explanation}</p>

            <div className="overlay-confetti">
              {Array.from({
                length:
                  currentResult.outcome === "win-player" ||
                    currentResult.outcome === "win-both"
                    ? 30
                    : 18,
              }).map((_, i) => (
                <span
                  key={i}
                  className={`confetti-piece confetti-${(i % 4) + 1}`}
                  style={{
                    "--x": (Math.random() * 2 - 1).toFixed(2),
                    "--y": (Math.random() * 2 - 1).toFixed(2),
                    "--r": `${Math.floor(Math.random() * 720)}deg`,
                    animationDelay: `${(i % 10) * 0.025}s`,
                  }}
                />
              ))}
            </div>

            <button className="overlay-close-btn" onClick={() => {
              setShowOverlay(false);
              startNewPlayTurn();
            }}>
              Next Round
            </button>
          </div>
        </div>
      )}

      <div className={`app-shell ${screenShake ? "screen-shake" : ""} ${flashClass}`}>
        <div className="bg-orb orb-one" />
        <div className="bg-orb orb-two" />
        <div className="bg-orb orb-three" />
        <div className="noise-layer" />

        <header className="hero">
          <div className="topbar">
            <div className="hero-badge">Neon Strategy Arena</div>
            <button
              className="sound-btn"
              onClick={() => {
                playClickSound();
                setSoundOn((prev) => !prev);
              }}
            >
              {soundOn ? "Sound: ON" : "Sound: OFF"}
            </button>
          </div>

          <h1 className="hero-title">
            Split <span>or</span> Steal
          </h1>
          <p className="hero-subtitle">
            Dynamic reward pool, bluff signals, timer pressure, AI reactions, and simulated
            multiplayer. This round can flip in seconds.
          </p>

          <div className="hero-actions">
            <button
              className={`nav-btn ${currentScreen === "home" ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setCurrentScreen("home");
              }}
            >
              Home
            </button>
            <button
              className={`nav-btn ${currentScreen === "rules" ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setCurrentScreen("rules");
              }}
            >
              Rules
            </button>
            <button
              className={`nav-btn ${currentScreen === "play" ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setCurrentScreen("play");
                startNewPlayTurn();
              }}
            >
              Play
            </button>
          </div>

          <div className="mode-switch">
            <button
              className={`mode-btn ${mode === "ai" ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setMode("ai");
              }}
            >
              Solo vs AI
            </button>
            <button
              className={`mode-btn ${mode === "pvp" ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setMode("pvp");
              }}
            >
              Simulated Opponent Mode
            </button>
          </div>
        </header>

        <main className="main-grid">
          <section className="left-panel">
            <div className="glass-card feature-card">
              <div className="card-topline">Game Arena</div>

              {currentScreen === "home" && (
                <div className="screen-block fade-in">
                  <h2>Welcome Challenger</h2>
                  <p>
                    This is not a flat button demo anymore. Your choices now affect reward
                    growth, bluff pressure, timing, and future risk.
                  </p>

                  <div className="showcase-banner">
                    <div className="banner-glow" />
                    <div className="banner-content">
                      <span className="banner-mini">LIVE MATCH MODE</span>
                      <h3>Read the signal. Beat the bluff. Control the pool.</h3>
                      <p>
                        Split can build value. Steal can break trust. The pool evolves every
                        round.
                      </p>
                    </div>
                  </div>

                  <div className="choice-grid intro-grid">
                    <button className="choice-btn split-btn" onClick={() => executeRound("Split")}>
                      <span className="choice-label">Split</span>
                      <span className="choice-hint">Safer move. Can build streak value.</span>
                    </button>

                    <button className="choice-btn steal-btn" onClick={() => executeRound("Steal")}>
                      <span className="choice-label">Steal</span>
                      <span className="choice-hint">Risky move. Can claim the entire pool.</span>
                    </button>
                  </div>
                </div>
              )}

              {currentScreen === "rules" && (
                <div className="screen-block fade-in">
                  <h2>Rules of the Arena</h2>
                  <div className="rules-list">
                    {rulesList.map((rule, index) => (
                      <div className="rule-item" key={index}>
                        <span className="rule-number">0{index + 1}</span>
                        <p>{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="strategy-box">
                <h3 className="strategy-title">🎮 AI Strategy</h3>

                <div className="strategy-buttons">
                  <button
                    className={strategy === "adaptive" ? "active" : ""}
                    onClick={() => setStrategy("adaptive")}
                  >
                    🧠 Adaptive
                  </button>

                  <button
                    className={strategy === "random" ? "active" : ""}
                    onClick={() => setStrategy("random")}
                  >
                    🎲 Random
                  </button>

                  <button
                    className={strategy === "tit-for-tat" ? "active" : ""}
                    onClick={() => setStrategy("tit-for-tat")}
                  >
                    🔁 Tit-for-Tat
                  </button>

                  <button
                    className={strategy === "greedy" ? "active" : ""}
                    onClick={() => setStrategy("greedy")}
                  >
                    🔥 Greedy
                  </button>
                </div>

                {/* ✅ SELECTED STRATEGY DISPLAY */}
                <div className="selected-strategy">
                  {strategy === "adaptive" && "🧠 Adaptive Selected"}
                  {strategy === "random" && "🎲 Random Selected"}
                  {strategy === "tit-for-tat" && "🔁 Tit-for-Tat Selected"}
                  {strategy === "greedy" && "🔥 Greedy Selected"}
                </div>

                <p className="strategy-desc">
                  {strategy === "adaptive" && "Learns from your behavior."}
                  {strategy === "random" && "Completely unpredictable decisions."}
                  {strategy === "tit-for-tat" && "Copies your last move."}
                  {strategy === "greedy" && "Maximizes reward aggressively."}
                </p>
              </div>

              {currentScreen === "play" && (
                <div className="screen-block fade-in">
                  <div className="play-head">
                    <div>
                      <h2>Make Your Move</h2>
                      <p className="play-subtext">
                        Bluff signal may be real or fake. Decide before the timer hits zero.
                      </p>
                    </div>

                    <div className="reward-visual">
                      <span className="reward-title">Reward Pool</span>
                      <div className="reward-core">{rewardPool}</div>
                      <div className="coin-row">
                        <span className="coin coin-1">🪙</span>
                        <span className="coin coin-2">🪙</span>
                        <span className="coin coin-3">🪙</span>
                        <span className="coin coin-4">🪙</span>
                      </div>
                      <small className="reward-caption">
                        {currentResult ? currentResult.rewardText : "Current pot in play"}
                      </small>
                    </div>
                  </div>

                  <div className="pressure-row">
                    <div className="signal-box">
                      <span className="signal-title">Bluff Signal</span>
                      <p>{bluffSignal}</p>
                    </div>

                    <div className="timer-box">
                      <span className="timer-title">Decision Timer</span>
                      <div className={`timer-core ${timeLeft <= 3 ? "danger" : ""}`}>
                        {timerActive ? timeLeft : 0}
                      </div>
                    </div>
                  </div>

                  <div className="choice-grid">
                    <button
                      className={`choice-btn split-btn ${playerChoice.includes("Split") ? "selected" : ""
                        }`}
                      onClick={() => executeRound("Split")}
                      disabled={aiThinking}
                    >
                      <span className="choice-label">Split</span>
                      <span className="choice-hint">Trust the deal</span>
                    </button>

                    <button
                      className={`choice-btn steal-btn ${playerChoice === "Steal" ? "selected" : ""
                        }`}
                      onClick={() => executeRound("Steal")}
                      disabled={aiThinking}
                    >
                      <span className="choice-label">Steal</span>
                      <span className="choice-hint">Take the whole pot</span>
                    </button>
                  </div>

                  <div className="decision-panel">
                    <div className="decision-box player-box">
                      <span className="decision-label">Your Move</span>
                      <strong>{playerChoice || "Waiting..."}</strong>
                    </div>

                    <div className={`decision-box ai-box ${aiThinking ? "thinking" : ""}`}>
                      <span className="decision-label">
                        {mode === "ai" ? "AI Move" : "Player 2 Move"}
                      </span>
                      <strong>{aiThinking ? "Thinking..." : opponentChoice || "Hidden"}</strong>
                    </div>
                  </div>

                  <div className="streak-bar-wrap">
                    <div className="streak-label-row">
                      <span>Trust Streak</span>
                      <span>{streak}</span>
                    </div>
                    <div className="streak-bar">
                      <div
                        className="streak-fill"
                        style={{ width: `${Math.min(streak * 18, 100)}%` }}
                      />
                    </div>
                  </div>

                  {aiThinking && (
                    <div className="thinking-bar-wrap">
                      <div className="thinking-bar" />
                    </div>
                  )}

                  {currentResult && (
                    <div className={`result-card ${currentResult.outcome} pop-in`}>
                      <div className="result-header">
                        <div>
                          <span className="result-tag">Round Result</span>
                          <h3>{currentResult.title}</h3>
                          <p>{currentResult.subtitle}</p>
                        </div>
                        <div className="reward-pill">{currentResult.reward}</div>
                      </div>

                      <div className="result-explanation">
                        <h4>Explanation</h4>
                        <p>{typedText || currentResult.explanation}</p>
                      </div>

                      <div className="result-coins">
                        {Array.from({ length: currentResult.coins }).map((_, index) => (
                          <span key={index} className="win-coin">
                            🪙
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="glass-card history-card">
              <div className="section-head">
                <div>
                  <span className="card-topline">Leaderboard Archive</span>
                  <h3>Round History</h3>
                </div>
                <button className="ghost-btn" onClick={handleResetHistory}>
                  Reset
                </button>
              </div>

              {history.length === 0 ? (
                <div className="empty-state">
                  <p>No rounds played yet. Start the game and build your match record.</p>
                </div>
              ) : (
                <div className="history-list">
                  {history.map((round, index) => (
                    <div className={`history-item rank-${(index % 3) + 1}`} key={round.id}>
                      <div className="history-rank">#{history.length - index}</div>

                      <div className="history-content">
                        <div className="history-top">
                          <h4>{round.title}</h4>
                          <span>{formatTime(round.playedAt)}</span>
                        </div>
                        <p>
                          You: <strong>{round.playerChoice}</strong> |{" "}
                          {round.mode === "ai" ? "AI" : "P2"}:{" "}
                          <strong>{round.opponentChoice}</strong>
                        </p>
                        <small>{round.signal}</small>
                      </div>

                      <div className="history-reward">{round.reward}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="right-panel">
            <div className="glass-card ai-card">
              <span className="card-topline">
                {mode === "ai" ? "Opponent Analysis" : "Player 2 Analysis"}
              </span>
              <h3>{mode === "ai" ? "AI Avatar" : "Simulated Opponent"}</h3>
              <p>Player 2 is deciding the next move.</p>
              <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                Player 2 is AI-simulated for behavioral testing.
              </p>

              <div className="ai-avatar-wrap">
                <div className="avatar-mood-title">
                  {aiThinking ? "Processing" : avatarMood.label}
                </div>

                <div className={`ai-face-avatar ${avatarMood.className}`}>
                  <div className="face-ring" />
                  <div className="face-shell">
                    <div className="face-eye left-eye" />
                    <div className="face-eye right-eye" />
                    <div className="face-tear left-tear" />
                    <div className="face-tear right-tear" />
                    <div className="face-mouth" />
                    <div className="face-blush blush-left" />
                    <div className="face-blush blush-right" />
                  </div>
                  <div className="face-aura" />
                </div>
              </div>

              <div className="ai-status">
                <p>
                  {aiThinking
                    ? mode === "ai"
                      ? "The AI is calculating its move."
                      : "Player 2 is deciding the next move."
                    : "Emotion changes after the next round result."}
                </p>
              </div>
            </div>

            <div className="glass-card stats-card">
              <span className="card-topline">Performance</span>
              <h3>Stats Dashboard</h3>

              <div className="stats-grid">
                <div className="stat-box">
                  <span>Total Rounds</span>
                  <strong>{stats.total}</strong>
                </div>
                <div className="stat-box">
                  <span>Your Wins</span>
                  <strong>{stats.playerWins}</strong>
                </div>
                <div className="stat-box">
                  <span>{mode === "ai" ? "AI Wins" : "P2 Wins"}</span>
                  <strong>{stats.opponentWins}</strong>
                </div>
                <div className="stat-box">
                  <span>Mutual Splits</span>
                  <strong>{stats.mutualWins}</strong>
                </div>
                <div className="stat-box">
                  <span>Double Steals</span>
                  <strong>{stats.mutualLosses}</strong>
                </div>
                <div className="stat-box">
                  <span>Your Win Rate</span>
                  <strong>{stats.winRate}%</strong>
                </div>
              </div>

              <div className="meter-group">
                <div className="meter-row">
                  <span>Your Split Tendency</span>
                  <span>{splitTendency}%</span>
                </div>
                <div className="meter">
                  <div className="meter-fill split-meter" style={{ width: `${splitTendency}%` }} />
                </div>

                <div className="meter-row">
                  <span>Your Steal Tendency</span>
                  <span>{stealTendency}%</span>
                </div>
                <div className="meter">
                  <div className="meter-fill steal-meter" style={{ width: `${stealTendency}%` }} />
                </div>
              </div>
            </div>

            <div className="glass-card insight-card">
              <span className="card-topline">Live Insight</span>
              <h3>Play Style Analysis</h3>
              <p>{getPlayStyleText(stats)}</p>
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}