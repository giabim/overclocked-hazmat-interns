class_name Hazards
extends RefCounted
## Foam, freeze grenades, specimens, catches and sensor sweeps (design.md §3.4–§3.5).
## Called by Rules.advance once per tick. Pure sim; appends events for the views.


static func tick_player_timers(player: PlayerState, delta: float) -> void:
	player.stun_remaining = maxf(0.0, player.stun_remaining - delta)
	player.immune_remaining = maxf(0.0, player.immune_remaining - delta)
	player.foam_cooldown = maxf(0.0, player.foam_cooldown - delta)
	if player.foam_charges >= Tuning.FOAM_MAX_CHARGES:
		player.foam_recharge = 0.0
		return
	player.foam_recharge += delta
	while player.foam_recharge >= Tuning.FOAM_RECHARGE_SECONDS and player.foam_charges < Tuning.FOAM_MAX_CHARGES:
		player.foam_recharge -= Tuning.FOAM_RECHARGE_SECONDS
		player.foam_charges += 1


## One player's tool use this tick (pickup, foam, grenade).
static func player_actions(state: GameState, player: PlayerState, input: PlayerInput) -> void:
	_grenade_pickup(state, player)
	if not player.is_stunned():
		if input.fire:
			try_foam(state, player)
		if input.throw_grenade:
			try_throw(state, player)


## Everything that happens once per tick: crates, fuses, specimens, catches, sweeps.
static func world_step(state: GameState, delta: float) -> void:
	_grenade_respawns(state, delta)
	_fuses(state, delta)
	for specimen: SpecimenState in state.specimens:
		SpecimenAI.step(state, specimen, delta)
	_catches(state)
	_sweep(state, delta)


## Fires one foam burst if ready. Returns the frozen specimen or null.
static func try_foam(state: GameState, player: PlayerState) -> SpecimenState:
	if player.foam_cooldown > 0.0 or player.foam_charges <= 0:
		return null
	player.foam_charges -= 1
	player.foam_cooldown = Tuning.FOAM_COOLDOWN
	var facing: Vector2 = player.facing()
	state.events.append({"kind": &"foam_fired", "position": player.position, "direction": facing})
	var best: SpecimenState = null
	var best_distance: float = INF
	var min_dot: float = cos(deg_to_rad(Tuning.FOAM_CONE_DEGREES))
	for specimen: SpecimenState in state.specimens:
		if not specimen.can_be_frozen():
			continue
		var offset: Vector2 = specimen.position - player.position
		var distance: float = offset.length()
		if distance > Tuning.FOAM_RANGE + specimen.radius() or distance >= best_distance:
			continue
		if distance > specimen.radius() and facing.dot(offset / distance) < min_dot:
			continue
		if not GridLos.clear(state.grid, player.position, specimen.position):
			continue
		best = specimen
		best_distance = distance
	if best == null:
		var reach: float = GridLos.free_distance(state.grid, player.position, facing, Tuning.FOAM_RANGE)
		state.events.append({"kind": &"foam_miss", "position": player.position + facing * reach})
		return null
	state.events.append({"kind": &"foam_hit", "id": best.id, "position": best.position})
	freeze(state, best, Tuning.FOAM_FREEZE_SECONDS)
	return best


static func try_throw(state: GameState, player: PlayerState) -> ThrownGrenade:
	if not player.has_grenade:
		return null
	player.has_grenade = false
	var facing: Vector2 = player.facing()
	var reach: float = GridLos.free_distance(state.grid, player.position, facing, Tuning.GRENADE_THROW_DISTANCE, 0.15)
	var grenade: ThrownGrenade = ThrownGrenade.new()
	grenade.from = player.position
	grenade.position = player.position + facing * reach
	grenade.thrower = player.id
	state.thrown_grenades.append(grenade)
	state.events.append({"kind": &"grenade_thrown", "from": grenade.from, "position": grenade.position})
	return grenade


## Freezes a specimen and contains it on the third freeze inside the window.
static func freeze(state: GameState, specimen: SpecimenState, seconds: float) -> void:
	specimen.freeze_times.append(state.elapsed)
	while not specimen.freeze_times.is_empty() and state.elapsed - specimen.freeze_times[0] > Tuning.CONTAIN_WINDOW_SECONDS:
		specimen.freeze_times.pop_front()
	if specimen.freeze_times.size() >= Tuning.CONTAIN_FREEZES:
		var at: Vector2 = specimen.position
		SpecimenAI.contain(specimen)
		state.score += Tuning.CONTAIN_SCORE
		state.contained += 1
		state.events.append({"kind": &"contained", "id": specimen.id, "specimen": specimen.kind_name(), "position": at})
		return
	var remaining: float = specimen.timer if specimen.mode == SpecimenState.Mode.FROZEN else 0.0
	specimen.set_mode(SpecimenState.Mode.FROZEN, maxf(remaining, seconds))


static func _grenade_respawns(state: GameState, delta: float) -> void:
	for pickup: GrenadePickup in state.grenade_pickups:
		if not pickup.available:
			pickup.respawn_remaining = maxf(0.0, pickup.respawn_remaining - delta)
			if pickup.respawn_remaining <= 0.0:
				pickup.available = true
				state.events.append({"kind": &"grenade_respawn", "id": pickup.id, "position": pickup.position})


static func _grenade_pickup(state: GameState, player: PlayerState) -> void:
	if player.has_grenade or player.is_stunned():
		return
	for pickup: GrenadePickup in state.grenade_pickups:
		if pickup.available and player.position.distance_to(pickup.position) <= Tuning.GRENADE_PICKUP_RANGE:
			pickup.available = false
			pickup.respawn_remaining = Tuning.GRENADE_RESPAWN_SECONDS
			player.has_grenade = true
			state.events.append({"kind": &"grenade_pickup", "id": pickup.id, "player": player.id, "position": pickup.position})
			return


static func _fuses(state: GameState, delta: float) -> void:
	for grenade: ThrownGrenade in state.thrown_grenades.duplicate():
		grenade.fuse -= delta
		if grenade.fuse > 0.0:
			continue
		state.thrown_grenades.erase(grenade)
		state.events.append({"kind": &"grenade_burst", "position": grenade.position})
		for specimen: SpecimenState in state.specimens:
			if specimen.can_be_frozen() and specimen.position.distance_to(grenade.position) <= Tuning.GRENADE_RADIUS + specimen.radius():
				freeze(state, specimen, Tuning.GRENADE_FREEZE_SECONDS)


static func _catches(state: GameState) -> void:
	for specimen: SpecimenState in state.specimens:
		if not specimen.can_catch():
			continue
		for player: PlayerState in state.players:
			if player.immune_remaining > 0.0:
				continue
			if player.position.distance_to(specimen.position) <= Tuning.PLAYER_RADIUS + specimen.radius():
				catch_player(state, player, specimen)
				break


static func catch_player(state: GameState, player: PlayerState, specimen: SpecimenState) -> void:
	if player.carrying >= 0:
		var canister: CanisterState = state.canisters[player.carrying]
		canister.position = player.position
		canister.available = true
		player.carrying = -1
		state.events.append({"kind": &"canister_dropped", "id": canister.id, "position": canister.position})
	player.stun_remaining = Tuning.CAUGHT_STUN_SECONDS
	player.immune_remaining = Tuning.CAUGHT_STUN_SECONDS + Tuning.CAUGHT_IMMUNE_SECONDS
	var how: StringName = &"dashed" if specimen.mode == SpecimenState.Mode.DASH else &"touched"
	# Signed angle from where the player looks to the attacker: 0 = in front, +PI/2 = right, -PI/2 = left.
	var from_angle: float = player.facing().angle_to(specimen.position - player.position)
	state.events.append({
		"kind": &"caught", "player": player.id, "specimen": specimen.kind_name(), "how": how,
		"from_angle": from_angle, "position": specimen.position,
	})
	SpecimenAI.after_catch(state, specimen)


static func _sweep(state: GameState, delta: float) -> void:
	state.sweep_elapsed += delta
	if state.sweep_elapsed < Tuning.SENSOR_SWEEP_SECONDS:
		return
	state.sweep_elapsed -= Tuning.SENSOR_SWEEP_SECONDS
	var blips: Array[Vector2] = []
	for specimen: SpecimenState in state.specimens:
		if specimen.mode != SpecimenState.Mode.DEN:
			blips.append(specimen.position)
	state.events.append({"kind": &"sensor_sweep", "blips": blips})
