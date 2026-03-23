# utils.py

def evaluate(my_move, opponent_move):
    """
    Payoff matrix for Split or Steal
    """

    if my_move == "SPLIT" and opponent_move == "SPLIT":
        return 3   # both share
    elif my_move == "SPLIT" and opponent_move == "STEAL":
        return 0   # I lose
    elif my_move == "STEAL" and opponent_move == "SPLIT":
        return 5   # I win
    else:
        return 1   # both steal → small penalty
