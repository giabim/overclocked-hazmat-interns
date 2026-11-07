class_name OrientationState
extends RefCounted
## Safe training rooms. R3/R4 use real SpecimenState data (drawn by SpecimenViews like in a shift),
## but their behaviour is scripted so Orientation can never catch the player.

enum HoundPhase { WINDUP, DASH, TIRED, STUNNED }

const DOORS: Array[Vector2i] = [Vector2i(12, 3), Vector2i(18, 7), Vector2i(12, 11), Vector2i(0, 11)]
const LIGHT_CELL: Vector2i = Vector2i(9, 3)
const SLOT_CELL: Vector2i = Vector2i(22, 5)
const SLIME_CELL: Vector2i = Vector2i(18, 11)
const DEMO_PEN: Vector2i = Vector2i(4, 9)
const LIVE_PEN: Vector2i = Vector2i(9, 12)
const SLEEP_SECONDS: float = 1.0e9

var game: GameState
var room: int = 0
var open_doors: Array[bool] = [false, false, false, false]
var idle_seconds: float = 0
var finished: bool = false
var foam_hits: int = 0
var foam_cooldown: float = 0
var demo_seconds: float = 0
var demo_finished: bool = false
var hound_position: Vector2 = Vector2.ZERO
var hound_direction: Vector2 = Vector2.LEFT
var hound_phase: HoundPhase = HoundPhase.WINDUP
var hound_timer: float = Tuning.HOUND_WINDUP_SECONDS
var _last_yaw: float = -PI / 2.0
## Real specimen records: a sleeping slime (R3), the demo hound and the live hound (R4).
var slime: SpecimenState
var demo_hound: SpecimenState
var live_hound: SpecimenState


static func create(grid: MapGrid) -> OrientationState:
	var state: OrientationState = OrientationState.new()
	state.game = GameState.create(grid, 1, 0, false)
	state.hound_position = grid.cell_center(LIVE_PEN)
	state.slime = _specimen(state.game, SpecimenState.Kind.SLIME, grid.cell_center(SLIME_CELL))
	state.slime.set_mode(SpecimenState.Mode.STUNNED, SLEEP_SECONDS)
	state.demo_hound = _specimen(state.game, SpecimenState.Kind.HOUND, grid.cell_center(DEMO_PEN))
	state.live_hound = _specimen(state.game, SpecimenState.Kind.HOUND, grid.cell_center(LIVE_PEN))
	state._sync_hounds()
	for cell: Vector2i in DOORS:
		grid.set_blocked(cell, true)
	# Glass pen has collision without opaque wall geometry.
	for cx: int in range(2, 7):
		grid.set_blocked(Vector2i(cx, 10), true)
	return state


func advance(input: PlayerInput, delta: float) -> void:
	game.events.clear()
	if finished:
		return
	var active: bool = input.move.length_squared() > 0 or input.look_changed or not is_equal_approx(input.yaw, _last_yaw) or input.interact or input.fire
	idle_seconds = 0.0 if active else idle_seconds + delta
	_last_yaw = input.yaw
	game.elapsed += delta
	game.player.yaw = input.yaw
	Hazards.tick_player_timers(game.player, delta)
	game.player.step(game.grid, input, delta)
	foam_cooldown = game.player.foam_cooldown
	_rest_slime(delta)
	var position: Vector2 = game.player.position
	if room == 0:
		if position.distance_to(game.grid.cell_center(LIGHT_CELL)) <= Tuning.ORIENTATION_TRIGGER_RANGE:
			_unlock(0)
		if open_doors[0] and position.x > 13 * Tuning.CELL_SIZE:
			_enter_room(1)
	elif room == 1:
		if input.interact:
			var canister: CanisterState = game.canisters[0]
			if game.player.carrying < 0 and canister.available and position.distance_to(canister.position) <= Tuning.INTERACT_RANGE:
				canister.available = false
				game.player.carrying = 0
				game.events.append({"kind": &"pickup", "position": canister.position})
			elif game.player.carrying == 0 and position.distance_to(game.grid.cell_center(SLOT_CELL)) <= Tuning.INTERACT_RANGE:
				game.player.carrying = -1
				game.delivered = 1
				game.events.append({"kind": &"delivery", "position": game.grid.cell_center(SLOT_CELL)})
				_unlock(1)
		if open_doors[1] and position.y > 8 * Tuning.CELL_SIZE:
			_enter_room(2)
	elif room == 2:
		if input.fire and Hazards.try_foam(game, game.player) == slime:
			foam_hits = mini(Tuning.CONTAIN_FREEZES, foam_hits + 1)
		if slime.mode == SpecimenState.Mode.DEN and not open_doors[2]:
			_unlock(2)
		if open_doors[2] and position.x < 12 * Tuning.CELL_SIZE:
			_enter_room(3)
	elif room == 3:
		_advance_hound(delta)
		_sync_hounds()
		if open_doors[3] and position.distance_to(game.grid.cell_center(DOORS[3])) <= Tuning.INTERACT_RANGE:
			finished = true
			game.events.append({"kind": &"orientation_finished"})


func hint() -> String:
	if idle_seconds < Tuning.HINT_IDLE_SECONDS:
		return ""
	return ["WASD to move · mouse to look", "E to pick up · carry to the lit slot", "Click to spray foam", "Watch for sparks, then dodge"][room]


func demo_position() -> Vector2:
	var start: Vector2 = game.grid.cell_center(Vector2i(4, 9))
	var dash_time: float = clampf(demo_seconds - Tuning.HOUND_WINDUP_SECONDS, 0, Tuning.HOUND_DASH_SECONDS)
	return start + Vector2.RIGHT * minf(2.4, dash_time * Tuning.HOUND_DASH_SPEED)


func _advance_hound(delta: float) -> void:
	if not demo_finished:
		var old_seconds: float = demo_seconds
		demo_seconds += delta
		if old_seconds < Tuning.HOUND_WINDUP_SECONDS + Tuning.HOUND_DASH_SECONDS and demo_seconds >= Tuning.HOUND_WINDUP_SECONDS + Tuning.HOUND_DASH_SECONDS:
			game.events.append({"kind": &"hound_wall_stun", "position": demo_position()})
		if demo_seconds >= Tuning.HOUND_WINDUP_SECONDS + Tuning.HOUND_DASH_SECONDS + Tuning.HOUND_WALL_STUN_SECONDS:
			demo_finished = true
			game.events.append({"kind": &"hound_windup", "position": hound_position})
		return
	hound_timer -= delta
	if hound_phase == HoundPhase.WINDUP and hound_timer <= 0:
		hound_phase = HoundPhase.DASH
		hound_timer = Tuning.HOUND_DASH_SECONDS
		hound_direction = (game.player.position - hound_position).normalized()
	elif hound_phase == HoundPhase.DASH:
		var proposed: Vector2 = hound_position + hound_direction * Tuning.HOUND_DASH_SPEED * delta
		if GridMove.hits_wall(game.grid, proposed, Tuning.HOUND_RADIUS):
			hound_phase = HoundPhase.STUNNED
			hound_timer = Tuning.HOUND_WALL_STUN_SECONDS
			_unlock(3)
			game.events.append({"kind": &"hound_wall_stun", "position": hound_position})
		else:
			hound_position = proposed
			if hound_timer <= 0:
				hound_phase = HoundPhase.TIRED
				hound_timer = Tuning.HOUND_TIRED_SECONDS
	elif hound_phase == HoundPhase.TIRED and hound_timer <= 0:
		hound_phase = HoundPhase.WINDUP
		hound_timer = Tuning.HOUND_WINDUP_SECONDS
		game.events.append({"kind": &"hound_windup", "position": hound_position})


static func _specimen(target: GameState, kind: SpecimenState.Kind, at: Vector2) -> SpecimenState:
	var specimen: SpecimenState = SpecimenState.new()
	specimen.id = target.specimens.size()
	specimen.kind = kind
	specimen.den = at
	specimen.position = at
	specimen.previous_position = at
	target.specimens.append(specimen)
	return specimen


## The training slime only sleeps, thaws back to sleep, or rests in its closed pen once contained.
func _rest_slime(delta: float) -> void:
	slime.previous_position = slime.position
	if slime.mode == SpecimenState.Mode.FROZEN:
		slime.timer -= delta
		if slime.timer <= 0.0:
			slime.set_mode(SpecimenState.Mode.STUNNED, SLEEP_SECONDS)


## Mirrors the scripted hounds into SpecimenState so they look and sound like real hounds.
func _sync_hounds() -> void:
	demo_hound.previous_position = demo_hound.position
	demo_hound.position = demo_position()
	demo_hound.dash_direction = Vector2.RIGHT
	if demo_finished:
		demo_hound.set_mode(SpecimenState.Mode.TIRED, 1.0)
	elif demo_seconds < Tuning.HOUND_WINDUP_SECONDS:
		demo_hound.set_mode(SpecimenState.Mode.WINDUP, Tuning.HOUND_WINDUP_SECONDS - demo_seconds)
	elif demo_seconds < Tuning.HOUND_WINDUP_SECONDS + Tuning.HOUND_DASH_SECONDS:
		demo_hound.set_mode(SpecimenState.Mode.DASH, 0.1)
	else:
		demo_hound.set_mode(SpecimenState.Mode.STUNNED, 0.1)
	live_hound.previous_position = live_hound.position
	live_hound.position = hound_position
	live_hound.dash_direction = hound_direction
	if not demo_finished:
		live_hound.set_mode(SpecimenState.Mode.DEN, 1.0)
		return
	var modes: Dictionary = {
		HoundPhase.WINDUP: SpecimenState.Mode.WINDUP, HoundPhase.DASH: SpecimenState.Mode.DASH,
		HoundPhase.TIRED: SpecimenState.Mode.TIRED, HoundPhase.STUNNED: SpecimenState.Mode.STUNNED,
	}
	live_hound.set_mode(modes[hound_phase], hound_timer)


func _unlock(index: int) -> void:
	if open_doors[index]:
		return
	open_doors[index] = true
	game.grid.set_blocked(DOORS[index], false)
	game.events.append({"kind": &"door_open", "position": game.grid.cell_center(DOORS[index])})


func _enter_room(index: int) -> void:
	room = index
	idle_seconds = 0
	if room == 3:
		game.events.append({"kind": &"hound_windup", "position": game.grid.cell_center(Vector2i(4, 9))})
