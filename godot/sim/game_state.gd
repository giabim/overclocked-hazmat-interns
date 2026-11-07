class_name GameState
extends RefCounted

enum Phase { SHIFT, EXTRACTION, SUCCESS, FAILED }

var grid: MapGrid
var player: PlayerState = PlayerState.new()
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


static func create(map: MapGrid, count: int = 1, seed_value: int = 0) -> GameState:
	var state: GameState = GameState.new()
	state.grid = map
	state.participants = clampi(count, 1, Tuning.MAX_PARTICIPANTS)
	state.rng.seed = seed_value
	state.player.teleport(map.cell_center(map.cells_of("P")[0]))
	for cell: Vector2i in map.cells_of("C"):
		var canister: CanisterState = CanisterState.new()
		canister.id = state.canisters.size()
		canister.position = map.cell_center(cell)
		state.canisters.append(canister)
	return state


func quota() -> int:
	return Tuning.BASE_QUOTA + participants


func finished() -> bool:
	return phase == Phase.SUCCESS or phase == Phase.FAILED
