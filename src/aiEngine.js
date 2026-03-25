export function getAiMove(strategy, playerChoice, history, rewardPool) {
    console.log("Strategy:", strategy);
    console.log("Player choice:", playerChoice);
    console.log("AI Strategy:", strategy);
    console.log("History:", history);

    const lastRound = history[0];

    switch (strategy) {

        // 🎲 RANDOM (baseline)
        case "random":
            return Math.random() < 0.5 ? "Split" : "Steal";


        // 🤝 TIT FOR TAT (Game Theory classic)
        case "tit-for-tat":
            if (!lastRound) return "Split";
            return lastRound.playerChoice === "Steal" ? "Steal" : "Split";


        // 🧠 GREEDY (reward-based AI)
        case "greedy":
            if (rewardPool > 150) return "Steal";
            return Math.random() < 0.6 ? "Split" : "Steal";


        // 🔥 ADAPTIVE (BEST – your main AI)
        case "adaptive":
            if (history.length < 2) return "Split";

            const playerSteals = history.filter(r => r.playerChoice === "Steal").length;
            const playerSplits = history.filter(r => r.playerChoice === "Split").length;

            const total = history.length;
            const stealRate = playerSteals / total;

            // 🚨 If player is aggressive → punish
            if (stealRate > 0.6) {
                return "Steal";
            }

            // 🤝 If player is cooperative → trust but sometimes betray
            if (stealRate < 0.3) {
                return Math.random() < 0.8 ? "Split" : "Steal";
            }

            // ⚖️ Balanced → mixed strategy
            return Math.random() < 0.5 ? "Split" : "Steal";


        default:
            return "Split";
    }
}