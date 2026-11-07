extends Node3D

var grid: MapGrid
var state: GameState
var canister_views: CanisterViews
var specimen_views: SpecimenViews
var grenade_views: GrenadeViews
var feedback_bus: Feedback
var settings_panel: SettingsPanel
var _menu_open: bool = false
var _light: DirectionalLight3D

@onready var player: PlayerView = $Player
@onready var debug_label: Label = $HUD/Debug
@onready var hud: ShiftHUD = $HUD


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
	specimen_views = SpecimenViews.new()
	add_child(specimen_views)
	specimen_views.build(state)
	grenade_views = GrenadeViews.new()
	add_child(grenade_views)
	grenade_views.build(state)
	feedback_bus = Feedback.new()
	feedback_bus.hud = hud
	feedback_bus.player = player
	feedback_bus.caption_target = hud.caption_label
	add_child(feedback_bus)
	hud.restart_requested.connect(_restart)
	hud.menu_requested.connect(_open_menu)
	var light: DirectionalLight3D = DirectionalLight3D.new()
	_light = light
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
	settings_panel = SettingsPanel.new()
	add_child(settings_panel)
	hud.settings_requested.connect(_open_settings)
	hud.orientation_requested.connect(_replay_orientation)
	SettingsStore.apply_values(self, SettingsStore.load_values())
	if DisplayServer.get_name() != "headless" and not "--capture" in OS.get_cmdline_user_args() and not SettingsStore.orientation_finished():
		get_tree().change_scene_to_file.call_deferred("res://game/orientation/orientation.tscn")


func _physics_process(delta: float) -> void:
	if _menu_open:
		return
	advance_input(player.read_input(), delta)


func advance_input(input: PlayerInput, delta: float) -> void:
	Rules.advance(state, input, delta)
	canister_views.sync(state)
	specimen_views.sync(state)
	grenade_views.sync(state)
	feedback_bus.publish(state.events, Vector3(state.player.position.x, 1.0, state.player.position.y))
	player.input_enabled = not state.finished()


func _process(_delta: float) -> void:
	debug_label.text = "LAB A / DRAW CALLS %d" % int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	hud.sync(state, _delta)
	_light.light_color = Color("ffdfb4").lerp(Color("ff5a1f"), clampf((state.heat - Tuning.HEAT_WARNING) / (Tuning.MAX_HEAT - Tuning.HEAT_WARNING), 0, 1))


func _restart() -> void:
	state = GameState.create(grid)
	player.state = state.player
	player.configure(grid, state.player.position)
	player.yaw = -PI / 2.0
	player.pitch = 0
	player.input_enabled = true
	_menu_open = false
	if DisplayServer.get_name() != "headless" and not "--capture" in OS.get_cmdline_user_args():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	canister_views.sync(state)
	specimen_views.build(state)
	grenade_views.build(state)


func _open_menu() -> void:
	_menu_open = true
	player.input_enabled = false


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_F10:
		_open_settings()
		get_viewport().set_input_as_handled()


func _open_settings() -> void:
	settings_panel.open(self)


func _replay_orientation() -> void:
	get_tree().change_scene_to_file("res://game/orientation/orientation.tscn")
