class_name GameState
extends RefCounted

enum Phase { SHIFT, EXTRACTION, SUCCESS, FAILED }

var grid: MapGrid
var player: PlayerState = PlayerState.new()
## Everyone the specimens can chase. players[0] is the local player; bots join in M4.
var players: Array[PlayerState] = []
var specimens: Array[SpecimenState] = []
var grenade_pickups: Array[GrenadePickup] = []
var thrown_grenades: Array[ThrownGrenade] = []
var contained: int = 0
var sweep_elapsed: float = 0.0
## Flow fields toward a cell, rebuilt each tick on demand (key: Vector2i target cell).
var field_cache: Dictionary = {}
var canisters: Array[CanisterState] = []
var events: Array[Dictionary] = []
var rng: RandomNumberGenerator = RandomNumberGenerator.new()
var participants: int = 1
var phase: Phase = Phase.SHIFT
var heat: float = 0.0
var delivered: int = 0
var score: int = 0
var elapsed: float = 0.0
var extraction_remaining: float = Tuning.EXTRACTION_SECONDS
var failure_reason: String = ""


static func create(map: MapGrid, count: int = 1, seed_value: int = 0, spawn_specimens: bool = true) -> GameState:
	var state: GameState = GameState.new()
	state.grid = map
	state.participants = clampi(count, 1, Tuning.MAX_PARTICIPANTS)
	state.rng.seed = seed_value
	state.player.teleport(map.cell_center(map.cells_of("P")[0]))
	state.players.append(state.player)
	for cell: Vector2i in map.cells_of("C"):
		var canister: CanisterState = CanisterState.new()
		canister.id = state.canisters.size()
		canister.position = map.cell_center(cell)
		state.canisters.append(canister)
	for cell: Vector2i in map.cells_of("G"):
		var pickup: GrenadePickup = GrenadePickup.new()
		pickup.id = state.grenade_pickups.size()
		pickup.position = map.cell_center(cell)
		state.grenade_pickups.append(pickup)
	if spawn_specimens:
		SpecimenAI.spawn_all(state)
	return state


func quota() -> int:
	return Tuning.BASE_QUOTA + participants


func specimen_count() -> int:
	return clampi(ceili(float(participants) / Tuning.PARTICIPANTS_PER_SPECIMEN), 1, Tuning.MAX_SPECIMENS)


func field_to(cell: Vector2i) -> FlowField:
	if not field_cache.has(cell):
		field_cache[cell] = FlowField.build(grid, [cell])
	return field_cache[cell]


func finished() -> bool:
	return phase == Phase.SUCCESS or phase == Phase.FAILED
