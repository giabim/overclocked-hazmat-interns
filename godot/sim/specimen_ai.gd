class_name SpecimenAI
extends RefCounted
## Specimen behaviour (design.md §3.4, §3.7). Pure sim: reads GameState, appends events.
## Slime: notices by path distance, chases along the flow field, gives up when far or bored.
## Hound: notices by line of sight, winds up (telegraph), dashes straight, hits walls (stun), tires.


static func spawn_all(state: GameState) -> void:
	var dens: Array[Vector2i] = state.grid.cells_of("M")
	if dens.is_empty():
		return
	for index: int in state.specimen_count():
		var specimen: SpecimenState = SpecimenState.new()
		specimen.id = index
		specimen.kind = SpecimenState.Kind.SLIME if index % 2 == 0 else SpecimenState.Kind.HOUND
		specimen.den = state.grid.cell_center(dens[index % dens.size()])
		_return_to_den(specimen, Tuning.DEN_SECONDS)
		state.specimens.append(specimen)


static func step(state: GameState, specimen: SpecimenState, delta: float) -> void:
	specimen.previous_position = specimen.position
	specimen.ignore_remaining = maxf(0.0, specimen.ignore_remaining - delta)
	match specimen.mode:
		SpecimenState.Mode.DEN:
			specimen.timer -= delta
			if specimen.timer <= 0.0:
				_start_patrol(state, specimen)
		SpecimenState.Mode.FROZEN:
			specimen.timer -= delta
			if specimen.timer <= 0.0:
				_start_patrol(state, specimen)
		SpecimenState.Mode.STUNNED:
			specimen.timer -= delta
			if specimen.timer <= 0.0:
				specimen.set_mode(SpecimenState.Mode.TIRED, Tuning.HOUND_TIRED_SECONDS)
		SpecimenState.Mode.PATROL:
			_patrol(state, specimen, delta)
		_:
			if specimen.kind == SpecimenState.Kind.SLIME:
				_slime_chase(state, specimen, delta)
			else:
				_hound_active(state, specimen, delta)


## Contain or catch reaction: back to the den, freezes forgotten.
static func contain(specimen: SpecimenState) -> void:
	_return_to_den(specimen, Tuning.DEN_SECONDS)


## After catching someone the specimen backs off so it can't chain-catch.
static func after_catch(state: GameState, specimen: SpecimenState) -> void:
	if specimen.kind == SpecimenState.Kind.HOUND:
		specimen.set_mode(SpecimenState.Mode.TIRED, Tuning.HOUND_TIRED_SECONDS)
	else:
		_start_patrol(state, specimen)
	specimen.ignore_remaining = Tuning.SPECIMEN_IGNORE_AFTER_CATCH_SECONDS


static func _return_to_den(specimen: SpecimenState, seconds: float) -> void:
	specimen.position = specimen.den
	specimen.previous_position = specimen.den
	specimen.freeze_times.clear()
	specimen.chase_time = 0.0
	specimen.unseen_time = 0.0
	specimen.set_mode(SpecimenState.Mode.DEN, seconds)


static func _start_patrol(state: GameState, specimen: SpecimenState) -> void:
	specimen.set_mode(SpecimenState.Mode.PATROL)
	_pick_patrol_target(state, specimen)


static func _pick_patrol_target(state: GameState, specimen: SpecimenState) -> void:
	var cells: Array[Vector2i] = state.grid.cells_of(".")
	if cells.is_empty():
		specimen.patrol_target = GridLos.cell_of(specimen.position)
		return
	specimen.patrol_target = cells[state.rng.randi_range(0, cells.size() - 1)]


static func _patrol(state: GameState, specimen: SpecimenState, delta: float) -> void:
	if specimen.ignore_remaining <= 0.0 and _notice(state, specimen):
		return
	var field: FlowField = state.field_to(specimen.patrol_target)
	var direction: Vector2 = field.steer(specimen.position)
	if direction == Vector2.ZERO:
		var centre: Vector2 = state.grid.cell_center(specimen.patrol_target)
		if specimen.position.distance_to(centre) < 0.3:
			_pick_patrol_target(state, specimen)
			return
		direction = (centre - specimen.position).normalized()
	_move(state, specimen, direction * specimen.speed() * Tuning.PATROL_SPEED_SCALE * delta)


## Returns true when the specimen switched to chasing.
static func _notice(state: GameState, specimen: SpecimenState) -> bool:
	if specimen.kind == SpecimenState.Kind.SLIME:
		var target: PlayerState = _nearest_by_path(state, specimen, Tuning.SLIME_NOTICE_CELLS)
		if target == null:
			return false
		specimen.set_mode(SpecimenState.Mode.CHASE)
		specimen.chase_time = 0.0
		state.events.append({"kind": &"slime_notice", "id": specimen.id, "position": specimen.position})
		return true
	var seen: PlayerState = _nearest_visible(state, specimen, Tuning.HOUND_NOTICE_CELLS * Tuning.CELL_SIZE)
	if seen == null:
		return false
	specimen.set_mode(SpecimenState.Mode.CHASE)
	specimen.unseen_time = 0.0
	specimen.last_seen = seen.position
	state.events.append({"kind": &"hound_notice", "id": specimen.id, "position": specimen.position})
	return true


static func _slime_chase(state: GameState, specimen: SpecimenState, delta: float) -> void:
	specimen.chase_time += delta
	var target: PlayerState = _nearest_by_path(state, specimen, Tuning.SLIME_GIVE_UP_CELLS)
	if target == null or specimen.chase_time > Tuning.SLIME_GIVE_UP_SECONDS:
		_start_patrol(state, specimen)
		specimen.ignore_remaining = Tuning.SPECIMEN_IGNORE_AFTER_CATCH_SECONDS
		return
	_move(state, specimen, _toward(state, specimen, target.position) * specimen.speed() * delta)


static func _hound_active(state: GameState, specimen: SpecimenState, delta: float) -> void:
	var seen: PlayerState = _nearest_visible(state, specimen, INF)
	if seen != null:
		specimen.last_seen = seen.position
		specimen.unseen_time = 0.0
	else:
		specimen.unseen_time += delta
	match specimen.mode:
		SpecimenState.Mode.CHASE:
			if specimen.unseen_time > Tuning.HOUND_GIVE_UP_SECONDS:
				_start_patrol(state, specimen)
				return
			if seen != null and _dash_ready(state, specimen, seen.position):
				specimen.set_mode(SpecimenState.Mode.WINDUP, Tuning.HOUND_WINDUP_SECONDS)
				specimen.dash_direction = (seen.position - specimen.position).normalized()
				state.events.append({"kind": &"hound_windup", "id": specimen.id, "position": specimen.position})
				return
			_move(state, specimen, _toward(state, specimen, specimen.last_seen) * specimen.speed() * delta)
		SpecimenState.Mode.WINDUP:
			specimen.timer -= delta
			# The hound keeps aiming until shortly before the dash, then the direction locks.
			if seen != null and specimen.timer > Tuning.HOUND_AIM_LOCK_SECONDS:
				specimen.dash_direction = (seen.position - specimen.position).normalized()
			if specimen.timer <= 0.0:
				specimen.set_mode(SpecimenState.Mode.DASH, Tuning.HOUND_DASH_SECONDS)
		SpecimenState.Mode.DASH:
			var intended: Vector2 = specimen.dash_direction * Tuning.HOUND_DASH_SPEED * delta
			var start: Vector2 = specimen.position
			_move(state, specimen, intended)
			if (specimen.position - start).dot(specimen.dash_direction) < intended.length() * 0.5:
				specimen.set_mode(SpecimenState.Mode.STUNNED, Tuning.HOUND_WALL_STUN_SECONDS)
				state.events.append({"kind": &"hound_wall_stun", "id": specimen.id, "position": specimen.position})
				return
			specimen.timer -= delta
			if specimen.timer <= 0.0:
				specimen.set_mode(SpecimenState.Mode.TIRED, Tuning.HOUND_TIRED_SECONDS)
		SpecimenState.Mode.TIRED:
			specimen.timer -= delta
			_move(state, specimen, _toward(state, specimen, specimen.last_seen) * specimen.speed() * Tuning.HOUND_TIRED_SPEED_SCALE * delta)
			if specimen.timer <= 0.0:
				if seen != null:
					specimen.set_mode(SpecimenState.Mode.CHASE)
				else:
					_start_patrol(state, specimen)


static func _dash_ready(state: GameState, specimen: SpecimenState, target: Vector2) -> bool:
	var offset: Vector2 = target - specimen.position
	if offset.length() > Tuning.HOUND_DASH_TRIGGER_RANGE:
		return false
	var clear: float = GridLos.free_distance(state.grid, specimen.position, offset, Tuning.HOUND_DASH_CLEARANCE, specimen.radius())
	return clear >= Tuning.HOUND_DASH_CLEARANCE - 0.01


## Direction toward a point: straight when visible and close, otherwise along the flow field.
static func _toward(state: GameState, specimen: SpecimenState, target: Vector2) -> Vector2:
	var target_cell: Vector2i = GridLos.cell_of(target)
	var field: FlowField = state.field_to(target_cell)
	var cells_away: int = field.distance(GridLos.cell_of(specimen.position))
	if cells_away <= 1 and GridLos.clear(state.grid, specimen.position, target):
		return (target - specimen.position).normalized()
	var direction: Vector2 = field.steer(specimen.position)
	if direction == Vector2.ZERO:
		return (target - specimen.position).normalized()
	return direction


static func _move(state: GameState, specimen: SpecimenState, displacement: Vector2) -> void:
	specimen.position = GridMove.move_circle(state.grid, specimen.position, displacement, specimen.radius())


static func _targetable(player: PlayerState) -> bool:
	return player.immune_remaining <= 0.0


static func _nearest_by_path(state: GameState, specimen: SpecimenState, max_cells: int) -> PlayerState:
	var best: PlayerState = null
	var best_cells: int = max_cells + 1
	var from: Vector2i = GridLos.cell_of(specimen.position)
	for player: PlayerState in state.players:
		if not _targetable(player):
			continue
		var cells: int = state.field_to(GridLos.cell_of(player.position)).distance(from)
		if cells != FlowField.UNREACHABLE and cells < best_cells:
			best = player
			best_cells = cells
	return best


static func _nearest_visible(state: GameState, specimen: SpecimenState, max_distance: float) -> PlayerState:
	var best: PlayerState = null
	var best_distance: float = max_distance
	for player: PlayerState in state.players:
		if not _targetable(player):
			continue
		var distance: float = specimen.position.distance_to(player.position)
		if distance <= best_distance and GridLos.clear(state.grid, specimen.position, player.position):
			best = player
			best_distance = distance
	return best
