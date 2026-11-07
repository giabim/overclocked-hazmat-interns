extends RefCounted


func _state(levels: Array[int] = []) -> GameState:
	return GameState.create(MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt")), 1, 7, false, levels)


func test_ping_uses_only_caller_location_and_respects_stun() -> String:
	var state: GameState = _state([2])
	var caller: PlayerState = state.players[1]
	caller.stun_remaining = 1
	if Hazards.try_ping(state, caller):
		return "Stunned players must not perform actions"
	caller.stun_remaining = 0
	if not Hazards.try_ping(state, caller) or state.pings.size() != 1:
		return "Ordinary bot/player ping did not create one marker"
	var ping: TeamPing = state.pings[0]
	var event: Dictionary = state.events[-1]
	return "" if ping.player_id == caller.id and ping.position == caller.position and event["player"] == caller.id and not event.has("specimen") else "Pings must identify the caller without revealing hidden targets"


func test_ping_cooldown_and_marker_expiry_do_not_change_score() -> String:
	var state: GameState = _state()
	var input: PlayerInput = PlayerInput.new()
	input.ping = true
	Rules.advance(state, input, 0)
	Rules.advance(state, input, 1)
	if state.pings.size() != 1 or state.events.any(func(event: Dictionary) -> bool: return event.get("kind") == &"ping"):
		return "Held/spammed ping bypassed cooldown"
	Rules.advance(state, PlayerInput.new(), Tuning.PING_COOLDOWN_SECONDS)
	if not state.pings.is_empty():
		return "Ping marker must expire"
	Rules.advance(state, input, 0)
	return "" if state.pings.size() == 1 and state.score == 0 else "Ping must recharge without scoring points"


func test_technician_pings_new_perceived_danger_not_unknown_threats() -> String:
	var state: GameState = _state([2])
	var me: PlayerState = state.players[1]
	var threat: SpecimenState = SpecimenState.new()
	threat.position = me.position + Vector2(0, 2)
	threat.set_mode(SpecimenState.Mode.PATROL)
	state.specimens.append(threat)
	var brain: BotBrain = state.brains[1]
	if not brain.think(state, me, 0).ping or brain.think(state, me, 0).ping:
		return "Bots must ping a new encounter once, not every tick"
	threat.position = Vector2(41, 27)
	brain.think_remaining = 0
	if brain.think(state, me, 0).ping:
		return "An unseen/unheard threat triggered a ping"
	return ""


func test_foam_events_keep_the_firing_player_identity() -> String:
	var state: GameState = _state([2])
	Hazards.try_foam(state, state.players[1])
	for event: Dictionary in state.events:
		if event.get("kind") in [&"foam_fired", &"foam_hit", &"foam_miss"] and event.get("player") != 1:
			return "Remote weapon cues must preserve the firing intern"
	return ""
