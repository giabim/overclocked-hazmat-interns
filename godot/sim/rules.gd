class_name Rules
extends RefCounted
## Authoritative shift rules. No Nodes, rendering, clocks or input APIs.


## `input` drives players[0] (the local human). Bots (state.brains) make their own inputs.
static func advance(state: GameState, input: PlayerInput, delta: float) -> void:
	state.events.clear()
	if state.finished():
		return
	var old_phase: GameState.Phase = state.phase
	state.elapsed += delta
	var inputs: Array[PlayerInput] = []
	for index: int in state.players.size():
		var brain: BotBrain = state.brains[index] if index < state.brains.size() else null
		inputs.append(input if brain == null else brain.think(state, state.players[index], delta))
	for index: int in state.players.size():
		var player: PlayerState = state.players[index]
		player.yaw = inputs[index].yaw
		Hazards.tick_player_timers(player, delta)
		if player.is_stunned():
			player.hold()
		else:
			player.step(state.grid, inputs[index], delta)
	for canister: CanisterState in state.canisters:
		if canister.respawn_remaining > 0:
			canister.respawn_remaining = maxf(0, canister.respawn_remaining - delta)
			if canister.respawn_remaining <= 0:
				_respawn(state, canister)
	for index: int in state.players.size():
		if inputs[index].interact and not state.players[index].is_stunned():
			_interact(state, state.players[index])
		Hazards.player_actions(state, state.players[index], inputs[index])
	Hazards.world_step(state, delta)
	if state.phase == GameState.Phase.SHIFT:
		var old_heat: float = state.heat
		state.heat = minf(Tuning.MAX_HEAT, state.heat + delta * Tuning.MAX_HEAT / Tuning.SHIFT_SECONDS)
		for threshold: float in [Tuning.HEAT_WARNING, Tuning.HEAT_CRITICAL]:
			if old_heat < threshold and state.heat >= threshold:
				state.events.append({"kind": &"heat_warning", "heat": state.heat})
		if state.heat >= Tuning.MAX_HEAT:
			_fail(state, "MELTDOWN — Heat reached 100%")
	elif old_phase == GameState.Phase.EXTRACTION:
		state.extraction_remaining = maxf(0, state.extraction_remaining - delta)
		if state.extraction_remaining <= 0:
			_fail(state, "EXTRACTION MISSED — the airlock sealed")
		elif at_airlock(state):
			state.phase = GameState.Phase.SUCCESS
			state.events.append({"kind": &"success"})


## Defaults to the local player (players[0]).
static func at_airlock(state: GameState, who: PlayerState = null) -> bool:
	var player: PlayerState = state.player if who == null else who
	return player.position.distance_to(nearest_airlock(state, player)) <= Tuning.INTERACT_RANGE


static func nearest_airlock(state: GameState, who: PlayerState = null) -> Vector2:
	var player: PlayerState = state.player if who == null else who
	var nearest: Vector2 = Vector2(INF, INF)
	var distance: float = INF
	for cell: Vector2i in state.grid.cells_of("E"):
		var candidate: Vector2 = state.grid.cell_center(cell)
		var current: float = player.position.distance_squared_to(candidate)
		if current < distance:
			nearest = candidate
			distance = current
	return nearest


static func _interact(state: GameState, player: PlayerState) -> void:
	if state.phase != GameState.Phase.SHIFT:
		return
	if player.carrying >= 0:
		if at_airlock(state, player):
			var canister: CanisterState = state.canisters[player.carrying]
			canister.respawn_remaining = Tuning.CANISTER_RESPAWN_SECONDS
			player.carrying = -1
			state.delivered += 1
			state.score += Tuning.DELIVERY_SCORE
			state.heat = maxf(0, state.heat - Tuning.DELIVERY_COOLING)
			state.events.append({"kind": &"delivery", "id": canister.id, "player": player.id, "position": nearest_airlock(state, player)})
			if state.delivered >= state.quota():
				state.phase = GameState.Phase.EXTRACTION
				state.events.append({"kind": &"extraction"})
		return
	var nearest: CanisterState = null
	var distance: float = Tuning.INTERACT_RANGE
	for canister: CanisterState in state.canisters:
		var candidate: float = player.position.distance_to(canister.position)
		if canister.available and candidate <= distance:
			nearest = canister
			distance = candidate
	if nearest != null:
		nearest.available = false
		player.carrying = nearest.id
		state.events.append({"kind": &"pickup", "id": nearest.id, "player": player.id, "position": nearest.position})


static func _respawn(state: GameState, canister: CanisterState) -> void:
	var free: Array[Vector2i] = state.grid.cells_of("C")
	for other: CanisterState in state.canisters:
		if other.available:
			var occupied: Vector2i = Vector2i((other.position / Tuning.CELL_SIZE).floor())
			free.erase(occupied)
	if free.is_empty():
		canister.respawn_remaining = 1.0 / Tuning.TICK_RATE
		return
	canister.position = state.grid.cell_center(free[state.rng.randi_range(0, free.size() - 1)])
	canister.available = true
	state.events.append({"kind": &"respawn", "id": canister.id})


static func _fail(state: GameState, reason: String) -> void:
	state.phase = GameState.Phase.FAILED
	state.failure_reason = reason
	state.events.append({"kind": &"failure"})
