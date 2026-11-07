extends RefCounted


func _new_state(count: int = 1) -> GameState:
	return GameState.create(MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt")), count, 472)


func _interact(state: GameState) -> void:
	var input: PlayerInput = PlayerInput.new()
	input.interact = true
	Rules.advance(state, input, 0)


func _deliver(state: GameState, id: int = 0) -> void:
	state.player.teleport(state.canisters[id].position)
	_interact(state)
	state.player.teleport(state.grid.cell_center(state.grid.cells_of("E")[0]))
	_interact(state)


func test_quota_counts_participants_and_clamps_invalid_counts() -> String:
	for count: int in range(1, 9):
		if _new_state(count).quota() != 2 + count:
			return "Quota must count humans plus bots"
	if _new_state(0).quota() != 3 or _new_state(100).quota() != 10:
		return "Participant limits must be 1 to 8"
	return ""


func test_delivery_cools_six_percent_and_scores_once() -> String:
	var state: GameState = _new_state()
	state.heat = 50
	_deliver(state)
	_interact(state)
	if state.heat != 44 or state.score != 1 or state.delivered != 1 or state.player.carrying != -1:
		return "Delivery must cool 6%, score once and clear carrying"
	return ""


func test_cooling_never_goes_negative() -> String:
	var state: GameState = _new_state()
	state.heat = 2
	_deliver(state)
	return "" if state.heat == 0 else "Cooling must clamp to zero"


func test_meltdown_at_240_seconds_and_terminal_state_stays_fixed() -> String:
	var state: GameState = _new_state()
	Rules.advance(state, PlayerInput.new(), 239)
	if state.finished():
		return "Shift ended before 240 seconds"
	Rules.advance(state, PlayerInput.new(), 1)
	if state.phase != GameState.Phase.FAILED or state.heat != 100:
		return "Heat must cause meltdown at 100%"
	Rules.advance(state, PlayerInput.new(), 20)
	return "" if state.elapsed == 240 else "Finished shifts must stop advancing"


func test_canister_respawns_after_ten_seconds_at_free_spawn() -> String:
	var state: GameState = _new_state()
	_deliver(state)
	Rules.advance(state, PlayerInput.new(), 9.9)
	if state.canisters[0].available:
		return "Canister respawned early"
	Rules.advance(state, PlayerInput.new(), 0.11)
	if not state.canisters[0].available:
		return "Canister failed to respawn"
	var positions: Dictionary = {}
	for canister: CanisterState in state.canisters:
		if positions.has(canister.position):
			return "Respawn overlapped another canister"
		positions[canister.position] = true
	return ""


func test_quota_starts_extraction_and_airlock_wins() -> String:
	var state: GameState = _new_state()
	for id: int in 3:
		_deliver(state, id)
	if state.phase != GameState.Phase.EXTRACTION or state.extraction_remaining != 20:
		return "Quota must start a 20-second extraction"
	Rules.advance(state, PlayerInput.new(), 1.0 / 30.0)
	return "" if state.phase == GameState.Phase.SUCCESS else "Reaching the airlock must win"


func test_missed_extraction_fails() -> String:
	var state: GameState = _new_state()
	state.phase = GameState.Phase.EXTRACTION
	Rules.advance(state, PlayerInput.new(), 20)
	return "" if state.phase == GameState.Phase.FAILED else "Missing extraction must fail"


func test_distant_interaction_and_double_pickup_do_not_change_inventory() -> String:
	var state: GameState = _new_state()
	_interact(state)
	if state.player.carrying != -1:
		return "Distant pickup succeeded"
	state.player.teleport(state.canisters[0].position)
	_interact(state)
	_interact(state)
	return "" if state.player.carrying == 0 and not state.canisters[0].available else "Pickup must reserve exactly one canister"
