def evaluate_result(player, ai, reward):
    if player == "Split" and ai == "Split":
        return {
            "result": "Both Split",
            "player_gain": reward // 2,
            "ai_gain": reward // 2
        }

    if player == "Steal" and ai == "Split":
        return {
            "result": "Player Wins",
            "player_gain": reward,
            "ai_gain": 0
        }

    if player == "Split" and ai == "Steal":
        return {
            "result": "AI Wins",
            "player_gain": 0,
            "ai_gain": reward
        }

    return {
        "result": "Both Lose",
        "player_gain": 0,
        "ai_gain": 0
    }