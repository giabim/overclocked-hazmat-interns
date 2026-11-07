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
var pings: Array[TeamPing] = []
var contained: int = 0
## Custom shifts and tests can set a fixed quota (0 = normal formula).
var quota_override: int = 0
var sweep_elapsed: float = 0.0
## Flow fields toward a cell (key: Vector2i target cell), kept until the grid changes.
var field_cache: Dictionary = {}
var _field_version: int = -1
## One entry per player: null for a human, a BotBrain for a bot (M4).
var brains: Array[BotBrain] = []
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


static func create(
	map: MapGrid, count: int = 1, seed_value: int = 0, spawn_specimens: bool = true,
	bot_levels: Array[int] = []
) -> GameState:
	var state: GameState = GameState.new()
	state.grid = map
	var bots: int = mini(bot_levels.size(), Tuning.MAX_PARTICIPANTS - 1)
	state.participants = clampi(maxi(count, 1 + bots), 1, Tuning.MAX_PARTICIPANTS)
	state.rng.seed = seed_value
	var spawns: Array[Vector2i] = map.cells_of("P")
	state.player.teleport(map.cell_center(spawns[0]))
	state.players.append(state.player)
	state.brains.append(null)
	for index: int in bots:
		var bot: PlayerState = PlayerState.new()
		bot.id = index + 1
		bot.yaw = -PI / 2.0
		bot.teleport(map.cell_center(spawns[(index + 1) % spawns.size()]))
		state.players.append(bot)
		state.brains.append(BotBrain.create(bot_levels[index], state.rng.randi()))
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
	return quota_override if quota_override > 0 else Tuning.BASE_QUOTA + participants


func specimen_count() -> int:
	return clampi(ceili(float(participants) / Tuning.PARTICIPANTS_PER_SPECIMEN), 1, Tuning.MAX_SPECIMENS)


func field_to(cell: Vector2i) -> FlowField:
	if _field_version != grid.version:
		field_cache.clear()
		_field_version = grid.version
	if not field_cache.has(cell):
		field_cache[cell] = FlowField.build(grid, [cell])
	return field_cache[cell]


func finished() -> bool:
	return phase == Phase.SUCCESS or phase == Phase.FAILED
