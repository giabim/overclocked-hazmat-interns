class_name BotBrain
extends RefCounted
## A bot intern (design.md §3.10). It outputs the same PlayerInput a human sends, so bots follow
## exactly the same rules. Perception is fair: a bot knows a specimen only if it can see it
## (line of sight, ≤ BOT_SIGHT_RANGE) or hear it (slime 8 m, hound 12 m; frozen ones are silent).
## Decisions refresh every reaction time; steering toward the current target runs every tick.

enum Goal { CANISTER, DELIVER, GRENADE, ESCORT, EXTRACT, WANDER }

const LEVEL_NAMES: Array[String] = ["TRAINEE", "TECHNICIAN", "SUPERVISOR"]

var level: int = 1
var goal: Goal = Goal.CANISTER
var target_canister: int = -1
var target_cell: Vector2i = Vector2i.ZERO
var target_point: Vector2 = Vector2.ZERO
var aim: SpecimenState = null
var fire: bool = false
var throw_now: bool = false
var think_remaining: float = 0.0
var still_time: float = 0.0
var wander_remaining: float = 0.0
var rng: RandomNumberGenerator = RandomNumberGenerator.new()
var _avoid_field: FlowField = null
var _last_position: Vector2 = Vector2(INF, INF)


static func create(bot_level: int, seed_value: int) -> BotBrain:
	var brain: BotBrain = BotBrain.new()
	brain.level = clampi(bot_level, 1, 3)
	brain.rng.seed = seed_value
	return brain


func reaction() -> float:
	return Tuning.BOT_REACTION_SECONDS[level - 1]


func think(state: GameState, me: PlayerState, delta: float) -> PlayerInput:
	if me.position.distance_squared_to(_last_position) < 0.0001 and not me.is_stunned():
		still_time += delta
	else:
		still_time = 0.0
	_last_position = me.position
	wander_remaining = maxf(0.0, wander_remaining - delta)
	think_remaining -= delta
	if think_remaining <= 0.0:
		think_remaining = reaction()
		_decide(state, me)
	var input: PlayerInput = PlayerInput.new()
	var heading: Vector2 = _steer(state, me)
	var look: Vector2 = heading
	if aim != null and aim.can_be_frozen():
		look = (aim.position - me.position).normalized()
	if look == Vector2.ZERO:
		look = me.facing()
	input.yaw = yaw_for(look)
	input.move = heading.rotated(input.yaw)
	input.fire = fire and aim != null and aim.can_be_frozen()
	input.throw_grenade = throw_now
	throw_now = false
	input.interact = _wants_interact(state, me)
	return input


## Yaw that makes PlayerState.facing() point along `direction`.
static func yaw_for(direction: Vector2) -> float:
	return -Vector2.UP.angle_to(direction)


func _decide(state: GameState, me: PlayerState) -> void:
	var known: Array[SpecimenState] = perceive(state, me)
	_choose_aim(state, me, known)
	_choose_goal(state, me, known)
	_avoid_field = null
	if level >= 2 and goal != Goal.WANDER:
		_avoid_field = _avoidance_field(state, me, known)


## Specimens this bot can see or hear right now.
func perceive(state: GameState, me: PlayerState) -> Array[SpecimenState]:
	var known: Array[SpecimenState] = []
	for specimen: SpecimenState in state.specimens:
		if specimen.mode == SpecimenState.Mode.DEN:
			continue
		var distance: float = me.position.distance_to(specimen.position)
		var hearing: float = Tuning.SLIME_HEAR_RADIUS if specimen.kind == SpecimenState.Kind.SLIME else Tuning.HOUND_HEAR_RADIUS
		var audible: bool = distance <= hearing and specimen.mode != SpecimenState.Mode.FROZEN
		if audible or (distance <= Tuning.BOT_SIGHT_RANGE and GridLos.clear(state.grid, me.position, specimen.position)):
			known.append(specimen)
	return known


func _choose_aim(state: GameState, me: PlayerState, known: Array[SpecimenState]) -> void:
	aim = null
	fire = false
	var best: float = Tuning.BOT_ENGAGE_RANGE[level - 1]
	for specimen: SpecimenState in known:
		var frozen: bool = specimen.mode == SpecimenState.Mode.FROZEN
		# Only the Supervisor keeps foaming frozen specimens, to finish a 3-freeze containment.
		if frozen and (level < 3 or specimen.freeze_times.is_empty()):
			continue
		var distance: float = me.position.distance_to(specimen.position)
		if distance <= best and GridLos.clear(state.grid, me.position, specimen.position):
			aim = specimen
			best = distance
	if aim != null:
		fire = me.foam_charges > 0 and best <= Tuning.FOAM_RANGE + aim.radius()
	if not me.has_grenade or level < 2:
		return
	for specimen: SpecimenState in known:
		var distance: float = me.position.distance_to(specimen.position)
		if distance > Tuning.GRENADE_THROW_DISTANCE + 1.0 or not GridLos.clear(state.grid, me.position, specimen.position):
			continue
		var worth: bool = specimen.mode == SpecimenState.Mode.WINDUP if level == 3 else specimen.can_catch()
		if worth:
			aim = specimen
			throw_now = true
			return


func _choose_goal(state: GameState, me: PlayerState, known: Array[SpecimenState]) -> void:
	if state.phase == GameState.Phase.EXTRACTION:
		_set_goal(state, Goal.EXTRACT, Rules.nearest_airlock(state, me))
		return
	if me.carrying >= 0:
		_set_goal(state, Goal.DELIVER, Rules.nearest_airlock(state, me))
		return
	if still_time > Tuning.BOT_STUCK_SECONDS or (wander_remaining <= 0.0 and rng.randf() < Tuning.BOT_WANDER_CHANCE[level - 1]):
		_start_wander(state, me)
	if wander_remaining > 0.0:
		return
	if level >= 2 and not me.has_grenade:
		var crate: GrenadePickup = _nearest_crate(state, me)
		if crate != null:
			_set_goal(state, Goal.GRENADE, crate.position)
			return
	if level >= 3:
		var carrier: PlayerState = _carrier_in_danger(state, me, known)
		if carrier != null:
			_set_goal(state, Goal.ESCORT, carrier.position)
			return
	var canister: CanisterState = _pick_canister(state, me)
	if canister == null:
		_start_wander(state, me)
		return
	target_canister = canister.id
	_set_goal(state, Goal.CANISTER, canister.position)


func _set_goal(state: GameState, next: Goal, point: Vector2) -> void:
	goal = next
	target_point = point
	target_cell = GridLos.cell_of(point)
	if next != Goal.CANISTER:
		target_canister = -1
	if state.grid.is_wall(target_cell.x, target_cell.y):
		target_cell = GridLos.cell_of(point - (point - state.grid.cell_center(target_cell)).normalized() * 0.5)


func _start_wander(state: GameState, me: PlayerState) -> void:
	still_time = 0.0
	wander_remaining = Tuning.BOT_STUCK_SECONDS
	var options: Array[Vector2i] = []
	var here: Vector2i = GridLos.cell_of(me.position)
	for cell: Vector2i in state.grid.cells_of("."):
		if absi(cell.x - here.x) + absi(cell.y - here.y) <= 5 and cell != here:
			options.append(cell)
	if options.is_empty():
		options = state.grid.cells_of(".")
	var cell: Vector2i = options[rng.randi_range(0, options.size() - 1)]
	_set_goal(state, Goal.WANDER, state.grid.cell_center(cell))


func _pick_canister(state: GameState, me: PlayerState) -> CanisterState:
	var claimed: Dictionary = {}
	if level >= 3:
		for index: int in state.brains.size():
			var other: BotBrain = state.brains[index]
			if other != null and other != self and other.target_canister >= 0:
				claimed[other.target_canister] = true
	var best: CanisterState = null
	var best_cost: float = INF
	var here: Vector2i = GridLos.cell_of(me.position)
	for canister: CanisterState in state.canisters:
		if not canister.available or claimed.has(canister.id):
			continue
		# Trainees judge by straight distance; others by walking distance.
		var cost: float = me.position.distance_to(canister.position) if level == 1 \
			else float(state.field_to(GridLos.cell_of(canister.position)).distance(here))
		if cost >= 0.0 and cost < best_cost:
			best = canister
			best_cost = cost
	return best


func _nearest_crate(state: GameState, me: PlayerState) -> GrenadePickup:
	var here: Vector2i = GridLos.cell_of(me.position)
	var best: GrenadePickup = null
	var best_cells: int = Tuning.BOT_GRENADE_SEEK_CELLS + 1
	for crate: GrenadePickup in state.grenade_pickups:
		if not crate.available:
			continue
		var cells: int = state.field_to(GridLos.cell_of(crate.position)).distance(here)
		if cells != FlowField.UNREACHABLE and cells < best_cells:
			best = crate
			best_cells = cells
	return best


func _carrier_in_danger(state: GameState, me: PlayerState, known: Array[SpecimenState]) -> PlayerState:
	for other: PlayerState in state.players:
		if other == me or other.carrying < 0:
			continue
		for specimen: SpecimenState in known:
			if specimen.can_catch() and specimen.position.distance_to(other.position) <= Tuning.BOT_ESCORT_RANGE:
				return other
	return null


## Lv2+: route around cells next to active specimens that are close (cells count as walls).
func _avoidance_field(state: GameState, me: PlayerState, known: Array[SpecimenState]) -> FlowField:
	var avoid: Dictionary = {}
	var here: Vector2i = GridLos.cell_of(me.position)
	for specimen: SpecimenState in known:
		if not specimen.can_catch() or specimen.position.distance_to(me.position) > Tuning.BOT_AVOID_RANGE:
			continue
		var centre: Vector2i = GridLos.cell_of(specimen.position)
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var cell: Vector2i = centre + Vector2i(dx, dy)
				if cell != here and cell != target_cell:
					avoid[cell] = true
	if avoid.is_empty():
		return null
	var field: FlowField = FlowField.build(state.grid, [target_cell], avoid)
	return field if field.distance(here) != FlowField.UNREACHABLE else null


func _steer(state: GameState, me: PlayerState) -> Vector2:
	var here: Vector2i = GridLos.cell_of(me.position)
	var to_point: Vector2 = target_point - me.position
	if here == target_cell or (to_point.length() < Tuning.CELL_SIZE and GridLos.clear(state.grid, me.position, target_point)):
		return to_point.normalized() if to_point.length() > 0.2 else Vector2.ZERO
	var field: FlowField = _avoid_field if _avoid_field != null else state.field_to(target_cell)
	var direction: Vector2 = field.steer(me.position)
	return direction if direction != Vector2.ZERO else to_point.normalized()


func _wants_interact(state: GameState, me: PlayerState) -> bool:
	if goal == Goal.DELIVER:
		return Rules.at_airlock(state, me)
	if goal == Goal.CANISTER and target_canister >= 0:
		var canister: CanisterState = state.canisters[target_canister]
		return canister.available and me.position.distance_to(canister.position) <= Tuning.INTERACT_RANGE * 0.9
	return false
