extends RefCounted

const DT: float = 1.0 / Tuning.TICK_RATE
const ROOM: String = "##########\n#........#\n#........#\n#P.G.....#\n#........#\n#........#\n##########"
const PILLAR: String = "##########\n#........#\n#........#\n#P#......#\n#........#\n#........#\n##########"
const FACE_EAST: float = -PI / 2.0


func _state(text: String) -> GameState:
	var state: GameState = GameState.create(MapGrid.from_text(text), 1, 9, false)
	state.player.yaw = FACE_EAST
	return state


func _slime(state: GameState, at: Vector2, mode: SpecimenState.Mode = SpecimenState.Mode.PATROL) -> SpecimenState:
	var specimen: SpecimenState = SpecimenState.new()
	specimen.id = state.specimens.size()
	specimen.position = at
	specimen.den = state.grid.cell_center(Vector2i(8, 1))
	specimen.set_mode(mode)
	state.specimens.append(specimen)
	return specimen


func test_foam_hits_in_cone_with_charges_and_cooldown() -> String:
	var state: GameState = _state(ROOM)
	var slime: SpecimenState = _slime(state, state.player.position + Vector2(2.0, 0))
	if Hazards.try_foam(state, state.player) != slime or slime.mode != SpecimenState.Mode.FROZEN:
		return "Foam should freeze a slime 2 m straight ahead"
	if not is_equal_approx(slime.timer, Tuning.FOAM_FREEZE_SECONDS):
		return "Foam freeze should last %.1f s" % Tuning.FOAM_FREEZE_SECONDS
	if Hazards.try_foam(state, state.player) != null or state.player.foam_charges != Tuning.FOAM_MAX_CHARGES - 1:
		return "Cooldown should block a second spray without using a charge"
	state.player.foam_cooldown = 0.0
	slime.position = state.player.position + Vector2(2.0, 2.0)
	slime.set_mode(SpecimenState.Mode.PATROL)
	if Hazards.try_foam(state, state.player) != null:
		return "A slime 45 degrees off the crosshair should be missed"
	return ""


func test_foam_blocked_by_walls_and_runs_out() -> String:
	var state: GameState = _state(PILLAR)
	_slime(state, state.player.position + Vector2(3.5, 0))
	if Hazards.try_foam(state, state.player) != null:
		return "Foam went through a pillar"
	for index: int in Tuning.FOAM_MAX_CHARGES:
		state.player.foam_cooldown = 0.0
		Hazards.try_foam(state, state.player)
	if state.player.foam_charges != 0:
		return "Charges should run out"
	for tick: int in int(Tuning.FOAM_RECHARGE_SECONDS * Tuning.TICK_RATE) + 1:
		Hazards.tick_player_timers(state.player, DT)
	if state.player.foam_charges != 1:
		return "One charge should return every %.1f s" % Tuning.FOAM_RECHARGE_SECONDS
	return ""


func test_contain_needs_three_freezes_inside_twelve_seconds() -> String:
	var state: GameState = _state(ROOM)
	var slime: SpecimenState = _slime(state, state.grid.cell_center(Vector2i(5, 3)))
	for at: float in [0.0, 5.0, 13.0]:
		state.elapsed = at
		Hazards.freeze(state, slime, Tuning.FOAM_FREEZE_SECONDS)
	if slime.mode == SpecimenState.Mode.DEN or state.contained != 0:
		return "Freezes 13 s apart should not contain"
	state.elapsed = 14.0
	state.events.clear()
	Hazards.freeze(state, slime, Tuning.FOAM_FREEZE_SECONDS)
	if slime.mode != SpecimenState.Mode.DEN or state.contained != 1 or state.score != Tuning.CONTAIN_SCORE:
		return "Third freeze inside 12 s should contain for +%d" % Tuning.CONTAIN_SCORE
	if slime.position != slime.den or not is_equal_approx(slime.timer, Tuning.DEN_SECONDS) or not slime.freeze_times.is_empty():
		return "Contained specimen should rest in its den for %.0f s" % Tuning.DEN_SECONDS
	if state.events.is_empty() or state.events[-1].get("kind") != &"contained":
		return "Contain should emit an event"
	if Hazards.try_foam(state, state.player) != null:
		return "A specimen in its den can't be foamed"
	return ""


func test_grenade_pickup_throw_fuse_radius_and_respawn() -> String:
	var state: GameState = _state(ROOM)
	var pickup: GrenadePickup = state.grenade_pickups[0]
	state.player.teleport(pickup.position)
	var input: PlayerInput = PlayerInput.new()
	input.yaw = FACE_EAST
	Rules.advance(state, input, DT)
	if not state.player.has_grenade or pickup.available:
		return "Walking onto a G cell should pick up a grenade"
	var near: SpecimenState = _slime(state, pickup.position + Vector2(Tuning.GRENADE_THROW_DISTANCE + 1.0, 0), SpecimenState.Mode.FROZEN)
	near.timer = 10.0
	var far: SpecimenState = _slime(state, pickup.position + Vector2(Tuning.GRENADE_THROW_DISTANCE, 3.5), SpecimenState.Mode.FROZEN)
	far.timer = 10.0
	input.throw_grenade = true
	Rules.advance(state, input, DT)
	input.throw_grenade = false
	if state.player.has_grenade or state.thrown_grenades.size() != 1:
		return "Throw should use the grenade"
	var landing: Vector2 = state.thrown_grenades[0].position
	if absf(landing.distance_to(pickup.position) - Tuning.GRENADE_THROW_DISTANCE) > 0.01:
		return "Grenade should land %.0f m ahead in open space" % Tuning.GRENADE_THROW_DISTANCE
	var ticks: int = 0
	while not state.thrown_grenades.is_empty() and ticks < 60:
		Rules.advance(state, input, DT)
		ticks += 1
	if absf(ticks * DT - Tuning.GRENADE_FUSE_SECONDS) > DT * 1.5:
		return "Fuse should be %.1f s, was %.2f s" % [Tuning.GRENADE_FUSE_SECONDS, ticks * DT]
	if near.freeze_times.size() != 1 or not far.freeze_times.is_empty():
		return "Burst should freeze only specimens within %.2f m" % Tuning.GRENADE_RADIUS
	for tick: int in int(Tuning.GRENADE_RESPAWN_SECONDS * Tuning.TICK_RATE):
		state.player.teleport(state.grid.cell_center(Vector2i(1, 1)))
		Rules.advance(state, input, DT)
	if not pickup.available:
		return "Grenade crate should come back after %.0f s" % Tuning.GRENADE_RESPAWN_SECONDS
	return ""


func test_grenade_stops_at_walls() -> String:
	var state: GameState = _state(ROOM)
	state.player.has_grenade = true
	state.player.teleport(state.grid.cell_center(Vector2i(7, 3)))
	var grenade: ThrownGrenade = Hazards.try_throw(state, state.player)
	# East wall face is at x = 18 m.
	if grenade == null or grenade.position.x > 18.0 - 0.1 or grenade.position.x < 17.0:
		return "Grenade should stop just before the wall, landed at %s" % (grenade.position if grenade else Vector2.ZERO)
	return ""
