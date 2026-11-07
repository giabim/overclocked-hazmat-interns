extends Node3D

var grid: MapGrid
var state: GameState
var canister_views: CanisterViews

@onready var player: PlayerView = $Player
@onready var debug_label: Label = $HUD/Debug


func _ready() -> void:
	grid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	var level: LevelBuilder = LevelBuilder.new()
	add_child(level)
	level.build(grid)
	state = GameState.create(grid)
	player.state = state.player
	player.configure(grid, state.player.position)
	canister_views = CanisterViews.new()
	add_child(canister_views)
	canister_views.build(state.canisters.size())
	canister_views.sync(state)
	var light: DirectionalLight3D = DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-65, -30, 0)
	light.light_color = Color("ffdfb4")
	light.light_energy = 0.8
	add_child(light)
	var world: WorldEnvironment = WorldEnvironment.new()
	var environment: Environment = Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = LevelBuilder.NIGHT
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("ced8e0")
	environment.ambient_light_energy = 0.65
	world.environment = environment
	add_child(world)


func _physics_process(delta: float) -> void:
	Rules.advance(state, player.read_input(), delta)
	canister_views.sync(state)


func _process(_delta: float) -> void:
	debug_label.text = "HEAT %.0f%%   /   COOLANT %d / %d   /   DRAW CALLS %d" % [state.heat, state.delivered, state.quota(), int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))]
