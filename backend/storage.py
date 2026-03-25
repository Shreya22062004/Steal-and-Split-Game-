import json
import os

FILE = "data.json"

def load_history():
    if not os.path.exists(FILE):
        return []
    with open(FILE, "r") as f:
        return json.load(f)

def save_round(player, ai, result):
    data = load_history()
    data.append({
        "player": player,
        "ai": ai,
        "result": result
    })
    with open(FILE, "w") as f:
        json.dump(data, f, indent=4)