from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from game_logic import evaluate_result
from ai_engine import get_ai_move
from storage import save_round, load_history

app = FastAPI()

# Allow React to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "AI Negotiation Arena Backend Running"}

@app.post("/play")
def play_round(data: dict):
    player_choice = data["player_choice"]
    reward = data["reward"]

    history = load_history()

    # AI decision
    ai_choice, explanation = get_ai_move(player_choice, history, reward)

    # Result
    result = evaluate_result(player_choice, ai_choice, reward)

    # Save
    save_round(player_choice, ai_choice, result)

    return {
        "ai_choice": ai_choice,
        "result": result,
        "explanation": explanation
    }

@app.get("/stats")
def stats():
    history = load_history()

    total = len(history)
    splits = sum(1 for h in history if h["player"] == "Split")
    steals = total - splits

    return {
        "total": total,
        "split_rate": splits,
        "steal_rate": steals
    }