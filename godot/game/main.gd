extends Node3D

var grid: MapGrid

@onready var player: PlayerView = $Player
@onready var debug_label: Label = $HUD/Debug


func _ready() -> void:
	grid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	var level: LevelBuilder = LevelBuilder.new()
	add_child(level)
	level.build(grid)
	player.configure(grid, grid.cell_center(grid.cells_of("P")[0]))
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
	player.state.step(grid, player.read_input(), delta)


func _process(_delta: float) -> void:
	debug_label.text = "LAB A   /   DRAW CALLS %d / 40" % int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
