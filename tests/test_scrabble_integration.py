import requests
import json
import time
import sys

BASE_URL = "http://localhost:3037/api"

def print_result(name, passed, message=""):
    if passed:
        print(f"✅ [PASS] {name}")
    else:
        print(f"❌ [FAIL] {name}: {message}")

def wait_for_server():
    print("Waiting for server to be ready...")
    for i in range(10):
        try:
            response = requests.get(f"http://localhost:3037/api/health")
            if response.status_code == 200:
                print("Server is ready!")
                return True
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(1)
    return False

def test_game_lifecycle():
    print("\n--- Testing Game Lifecycle & Integrity ---")
    
    # 1. Create a Game
    payload = {"playerNames": ["PlayerOne", "PlayerTwo"]}
    try:
        response = requests.post(f"{BASE_URL}/games", json=payload)
        if response.status_code != 201:
            print_result("Create Game", False, f"Status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print_result("Create Game", False, str(e))
        return None
        
    game_data = response.json()
    game_id = game_data['id']
    players = game_data['players']
    p1_id = players[0]['id']
    p2_id = players[1]['id']
    print_result("Create Game", True, f"Game ID: {game_id}")

    # 2. Test Turn Order (Player Two tries to go first)
    # Note: The current server implementation MIGHT NOT actually enforce turn order strictly based on ID, 
    # but relies on the client to send the correct player. Let's see if we can jam a turn in for P2.
    
    # Create an empty board for the "before" state
    empty_board = [[None for _ in range(15)] for _ in range(15)]
    
    # Valid Move Data for Player 1 (Start the game)
    # Word "HELLO" starting at 7,7 (center)
    # Layout:
    # 7,7: H
    # 7,8: E
    # 7,9: L
    # 7,10: L
    # 7,11: O
    
    # Construct Board State AFTER the move (The Server expects this!)
    board_after_move = [row[:] for row in empty_board] # Deep copyish
    word = "HELLO"
    start_row = 7
    start_col = 7
    for i, char in enumerate(word):
         board_after_move[start_row][start_col + i] = {"letter": char, "isBlank": False}

    turn_payload = {
        "playerId": p1_id,
        "word": "HELLO",
        "score": 14, # minimal score calc
        "boardState": board_after_move,
        "startRow": 7,
        "startCol": 7,
        "direction": "across",
        "secondaryWords": [],
        "blankTiles": []
    }

    # 3. Submit Valid Turn Player 1
    response = requests.post(f"{BASE_URL}/games/{game_id}/turns", json=turn_payload)
    if response.status_code == 200:
        print_result("Submit Valid Turn (P1)", True)
    else:
        print_result("Submit Valid Turn (P1)", False, response.text)
        return

    # 4. State Integrity Test: The "Malicious" Turn
    # Player 2 submits a turn, but modifies the board state to DELETE Player 1's tiles
    # or add extra tiles that weren't part of the word.
    
    # Malicious Board: Contains P2's new word "WORLD" connecting to "HELLO" (hypothetically)
    # BUT we secretly wipe out the "H" from "HELLO" in the board state we send.
    
    # Let's try to add a random tile at 0,0 that is NOT part of the word "WORLD"
    # If the server blindly saves boardState, checking 0,0 later will reveal the bug.
    
    malicious_board = [row[:] for row in board_after_move]
    
    # P2 plays "WORLD" down from 7,11 (the 'O' in HELLO)
    # 7,11: O (Existing)
    # 8,11: W
    # 9,11: O
    # 10,11: R
    # 11,11: L
    # 12,11: D
    
    p2_word = "WORLD"
    # Update board for the move
    # Note: We are mocking the client logic here.
    # We skip index 0 because it overlaps 'O' which is supposedly there.
    # actually let's just create a valid looking board first
    malicious_board[8][11] = {"letter": "W", "isBlank": False}
    malicious_board[9][11] = {"letter": "O", "isBlank": False}
    malicious_board[10][11] = {"letter": "R", "isBlank": False}
    malicious_board[11][11] = {"letter": "L", "isBlank": False}
    malicious_board[12][11] = {"letter": "D", "isBlank": False}

    # Now perform the ATTACK: Add a random tile at 0,0
    malicious_board[0][0] = {"letter": "X", "isBlank": False}

    p2_payload = {
        "playerId": p2_id,
        "word": "WORLD", # This is the word we claim to play
        "score": 10,
        "boardState": malicious_board, # This contains the extra 'X'
        "startRow": 7,
        "startCol": 11,
        "direction": "down",
        "secondaryWords": [],
        "blankTiles": []
    }

    response = requests.post(f"{BASE_URL}/games/{game_id}/turns", json=p2_payload)
    
    if response.status_code == 200:
        print_result("Submit Malicious Turn (P2)", True, "Server accepted the turn (as expected for this bug)")
        
        # Verify if the 'X' persisted
        game_details = requests.get(f"{BASE_URL}/games/{game_id}").json()
        saved_board = game_details['board_state']
        
        tile_at_0_0 = saved_board[0][0]
        if tile_at_0_0 and tile_at_0_0.get('letter') == "X":
            print_result("VULNERABILITY CONFIRMED", False, "Server accepted and saved a board state with unauthorized tiles!")
        else:
            print_result("State Integrity", True, "Server apparently sanitized or rejected the extra tile (Unexpected success?)")
            
    else:
        print_result("Submit Malicious Turn (P2)", True, f"Server rejected turn: {response.text} (Good behavior!)")


if __name__ == "__main__":
    if not wait_for_server():
        print("Could not connect to server.")
        sys.exit(1)
        
    test_game_lifecycle()
