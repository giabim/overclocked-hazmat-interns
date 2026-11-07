extends RefCounted

const DT: float = 1.0 / Tuning.TICK_RATE
const CORRIDOR: String = "########################\n#P....................C#\n########################"
const FACE_EAST: float = -PI / 2.0


func _state(text: String, participants: int = 1) -> GameState:
	return GameState.create(MapGrid.from_text(text), participants, 7, false)


func _add(state: GameState, kind: SpecimenState.Kind, at: Vector2, mode: SpecimenState.Mode) -> SpecimenState:
	var specimen: SpecimenState = SpecimenState.new()
	specimen.id = state.specimens.size()
	specimen.kind = kind
	specimen.position = at
	specimen.previous_position = at
	specimen.den = state.grid.cell_center(Vector2i(1, 1))
	specimen.set_mode(mode)
	state.specimens.append(specimen)
	return specimen


func _input(forward: float = 0.0, yaw: float = FACE_EAST) -> PlayerInput:
	var input: PlayerInput = PlayerInput.new()
	input.move = Vector2(0.0, -forward)
	input.yaw = yaw
	return input


func _count(events: Array[Dictionary], kind: StringName) -> int:
	var total: int = 0
	for event: Dictionary in events:
		if event.get("kind") == kind:
			total += 1
	return total


func test_spawn_count_alternates_kinds_and_starts_in_den() -> String:
	var map: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	for case: Array in [[1, 1], [2, 1], [3, 2], [4, 2], [8, 4], [20, 4]]:
		var state: GameState = GameState.create(map, case[0], 1)
		if state.specimens.size() != case[1]:
			return "%d participants should spawn %d specimens, got %d" % [case[0], case[1], state.specimens.size()]
		for index: int in state.specimens.size():
			var specimen: SpecimenState = state.specimens[index]
			var expected: SpecimenState.Kind = SpecimenState.Kind.SLIME if index % 2 == 0 else SpecimenState.Kind.HOUND
			if specimen.kind != expected or specimen.mode != SpecimenState.Mode.DEN or specimen.timer != Tuning.DEN_SECONDS:
				return "Specimen %d should start as alternating kind in its den" % index
	return ""


func test_catch_drops_canister_stuns_and_grants_immunity() -> String:
	var state: GameState = _state(CORRIDOR)
	state.player.carrying = 0
	state.canisters[0].available = false
	var slime: SpecimenState = _add(state, SpecimenState.Kind.SLIME, state.player.position + Vector2(0.9, 0), SpecimenState.Mode.CHASE)
	Rules.advance(state, _input(), DT)
	if _count(state.events, &"caught") != 1:
		return "Touching an active slime should catch the player"
	if state.player.carrying != -1 or not state.canisters[0].available or state.canisters[0].position.distance_to(state.player.position) > 0.01:
		return "Caught player should drop the canister where they stand"
	var held: Vector2 = state.player.position
	var catches: int = 0
	for tick: int in int(Tuning.CAUGHT_STUN_SECONDS * Tuning.TICK_RATE) - 1:
		slime.position = state.player.position
		slime.set_mode(SpecimenState.Mode.CHASE)
		Rules.advance(state, _input(1.0), DT)
		catches += _count(state.events, &"caught")
	if state.player.position != held:
		return "Stunned player moved"
	var elapsed: float = Tuning.CAUGHT_STUN_SECONDS
	while elapsed < Tuning.CAUGHT_STUN_SECONDS + Tuning.CAUGHT_IMMUNE_SECONDS - DT:
		slime.position = state.player.position
		slime.set_mode(SpecimenState.Mode.CHASE)
		Rules.advance(state, _input(), DT)
		catches += _count(state.events, &"caught")
		elapsed += DT
	if catches != 0:
		return "Player was caught again during immunity"
	for tick: int in 3:
		slime.position = state.player.position
		slime.set_mode(SpecimenState.Mode.CHASE)
		Rules.advance(state, _input(), DT)
		catches += _count(state.events, &"caught")
	if catches != 1:
		return "Immunity should end after %.1f s" % (Tuning.CAUGHT_STUN_SECONDS + Tuning.CAUGHT_IMMUNE_SECONDS)
	return ""


func test_caught_event_explains_attacker_and_direction() -> String:
	var state: GameState = _state(CORRIDOR)
	# Player faces east; a slime touching from the west is behind them.
	_add(state, SpecimenState.Kind.SLIME, state.player.position + Vector2(-0.5, 0), SpecimenState.Mode.CHASE)
	state.player.teleport(state.grid.cell_center(Vector2i(5, 1)))
	state.specimens[0].position = state.player.position + Vector2(-0.9, 0)
	Rules.advance(state, _input(), DT)
	for event: Dictionary in state.events:
		if event.get("kind") == &"caught":
			if event["specimen"] != &"slime" or event["how"] != &"touched" or absf(absf(event["from_angle"]) - PI) > 0.2:
				return "Caught event should say slime, touched, from behind: %s" % event
			return ""
	return "No caught event"


func test_carrying_player_outruns_slime_on_straight_path() -> String:
	var state: GameState = _state(CORRIDOR)
	state.player.teleport(state.grid.cell_center(Vector2i(5, 1)))
	state.player.carrying = 0
	state.canisters[0].available = false
	var slime: SpecimenState = _add(state, SpecimenState.Kind.SLIME, state.player.position - Vector2(3.0, 0), SpecimenState.Mode.CHASE)
	var start_gap: float = state.player.position.x - slime.position.x
	for tick: int in 4 * Tuning.TICK_RATE:
		Rules.advance(state, _input(1.0), DT)
		if _count(state.events, &"caught") > 0:
			return "Slime caught a carrying player on a straight path"
	var end_gap: float = state.player.position.x - slime.position.x
	if end_gap < start_gap + 4.0 * (Tuning.CARRY_SPEED - Tuning.SLIME_SPEED) * 0.9:
		return "Gap should grow by about %.1f m, grew %.1f m" % [4.0 * (Tuning.CARRY_SPEED - Tuning.SLIME_SPEED), end_gap - start_gap]
	return ""


func test_hound_winds_up_full_time_then_dashes() -> String:
	var state: GameState = _state(CORRIDOR)
	state.player.teleport(state.grid.cell_center(Vector2i(12, 1)))
	var hound: SpecimenState = _add(state, SpecimenState.Kind.HOUND, state.player.position - Vector2(7.0, 0), SpecimenState.Mode.CHASE)
	var windup: float = -1.0
	var dashed: bool = false
	for tick: int in 6 * Tuning.TICK_RATE:
		var before: SpecimenState.Mode = hound.mode
		Rules.advance(state, _input(), DT)
		if hound.mode == SpecimenState.Mode.WINDUP:
			windup = maxf(windup, 0.0) + DT
		if hound.mode == SpecimenState.Mode.DASH and before == SpecimenState.Mode.WINDUP:
			dashed = true
			if windup < Tuning.HOUND_WINDUP_SECONDS - 0.001:
				return "Dash started after only %.2f s of wind-up" % windup
		for event: Dictionary in state.events:
			if event.get("kind") == &"caught":
				if not dashed or event["how"] != &"dashed":
					return "Expected the catch to come from the dash: %s" % event
				return ""
	return "Hound never dashed and caught a standing player (wind-up %.2f s)" % windup


func test_hound_needs_clear_space_to_dash() -> String:
	var state: GameState = _state(CORRIDOR)
	# Player 3 m from the hound with the east wall right behind: less than 4 m clear, no dash.
	state.player.teleport(state.grid.cell_center(Vector2i(22, 1)))
	var hound: SpecimenState = _add(state, SpecimenState.Kind.HOUND, state.player.position - Vector2(3.0, 0), SpecimenState.Mode.CHASE)
	for tick: int in Tuning.TICK_RATE:
		Rules.advance(state, _input(), DT)
		if hound.mode == SpecimenState.Mode.WINDUP:
			return "Hound wound up without 4 m of clear space"
		if _count(state.events, &"caught") > 0:
			return ""
	return ""


func test_hound_dash_into_wall_stuns() -> String:
	var state: GameState = _state(CORRIDOR)
	var hound: SpecimenState = _add(state, SpecimenState.Kind.HOUND, state.grid.cell_center(Vector2i(20, 1)), SpecimenState.Mode.DASH)
	hound.timer = Tuning.HOUND_DASH_SECONDS
	hound.dash_direction = Vector2.RIGHT
	for tick: int in Tuning.TICK_RATE:
		Rules.advance(state, _input(), DT)
		if _count(state.events, &"hound_wall_stun") == 1:
			if hound.mode != SpecimenState.Mode.STUNNED or not is_equal_approx(hound.timer, Tuning.HOUND_WALL_STUN_SECONDS):
				return "Wall hit should stun for %.1f s" % Tuning.HOUND_WALL_STUN_SECONDS
			if GridMove.hits_wall(state.grid, hound.position, hound.radius()):
				return "Hound ended inside the wall"
			return ""
	return "Dash into a wall did not stun the hound"


func test_full_shifts_keep_invariants() -> String:
	var map: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	for seed_value: int in [3, 11, 29]:
		var state: GameState = GameState.create(map, 4, seed_value)
		var rng: RandomNumberGenerator = RandomNumberGenerator.new()
		rng.seed = seed_value
		var input: PlayerInput = _input()
		var windup: Dictionary = {}
		for tick: int in int(Tuning.SHIFT_SECONDS) * Tuning.TICK_RATE:
			if tick % 15 == 0:
				input = _input(rng.randf_range(0.2, 1.0), rng.randf_range(-PI, PI))
				input.fire = rng.randf() < 0.3
				input.interact = true
				input.throw_grenade = rng.randf() < 0.1
			var before: Array[SpecimenState.Mode] = []
			for specimen: SpecimenState in state.specimens:
				before.append(specimen.mode)
			# Immunity that runs out during this tick may legitimately end in a catch.
			var immune: bool = state.player.immune_remaining > DT + 0.0001
			Rules.advance(state, input, DT)
			if immune and _count(state.events, &"caught") > 0:
				return "Caught while immune (seed %d)" % seed_value
			for specimen: SpecimenState in state.specimens:
				if GridMove.hits_wall(map, specimen.position, specimen.radius()):
					return "Specimen %d inside a wall (seed %d)" % [specimen.id, seed_value]
				if specimen.mode == SpecimenState.Mode.WINDUP:
					windup[specimen.id] = float(windup.get(specimen.id, 0.0)) + DT
				elif specimen.mode == SpecimenState.Mode.DASH and before[specimen.id] == SpecimenState.Mode.WINDUP:
					if float(windup.get(specimen.id, 0.0)) < Tuning.HOUND_WINDUP_SECONDS - 0.001:
						return "Short wind-up %.2f s (seed %d)" % [windup.get(specimen.id, 0.0), seed_value]
					windup[specimen.id] = 0.0
				elif specimen.mode != SpecimenState.Mode.DASH:
					windup[specimen.id] = 0.0
			if state.finished():
				break
	return ""


func test_sensor_sweep_every_twelve_seconds() -> String:
	var map: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	var state: GameState = GameState.create(map, 2, 5)
	var sweeps: int = 0
	var blips: int = 0
	for tick: int in 25 * Tuning.TICK_RATE:
		Rules.advance(state, _input(), DT)
		for event: Dictionary in state.events:
			if event.get("kind") == &"sensor_sweep":
				sweeps += 1
				blips = event["blips"].size()
	if sweeps != 2:
		return "Expected 2 sweeps in 25 s, got %d" % sweeps
	if blips != 1:
		return "The patrolling specimen should show on the sweep (got %d blips)" % blips
	return ""
