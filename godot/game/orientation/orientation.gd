extends Node3D

var state: OrientationState
var settings_path: String = SettingsStore.PATH
var _doors: Array[MeshInstance3D] = []
var _canisters: CanisterViews
var _specimens: SpecimenViews
var _hint: Label
var _heading: Label
var _skip: Button
var feedback_bus: Feedback
var settings_panel: SettingsPanel
var _caption: Label
var _leaving: bool = false

@onready var player: PlayerView = $Player


func _ready() -> void:
	var grid: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/orientation.txt"))
	var level: LevelBuilder = LevelBuilder.new()
	add_child(level)
	level.build(grid, false)
	state = OrientationState.create(grid)
	player.state = state.game.player
	player.configure(grid, state.game.player.position)
	_canisters = CanisterViews.new()
	add_child(_canisters)
	_canisters.build(1)
	for index: int in OrientationState.DOORS.size():
		var at: Vector2 = grid.cell_center(OrientationState.DOORS[index])
		var dimensions: Vector3 = Vector3(1.9, 2.7, 0.15) if index == 1 else Vector3(0.15, 2.7, 1.9)
		_doors.append(_box(self, dimensions, Vector3(at.x, 1.35, at.y), LevelBuilder.AMBER))
	var light_at: Vector2 = grid.cell_center(OrientationState.LIGHT_CELL)
	_box(self, Vector3(1.7, 0.035, 1.7), Vector3(light_at.x, 0.02, light_at.y), LevelBuilder.COOLANT)
	_specimens = SpecimenViews.new()
	add_child(_specimens)
	_specimens.build(state.game)
	var glass: MeshInstance3D = _box(self, Vector3(10, 2.4, 0.06), Vector3(9, 1.2, 21), Color(0.18, 0.77, 0.79, 0.18))
	var material: StandardMaterial3D = glass.material_override
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	var light: DirectionalLight3D = DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-65, -30, 0)
	light.light_color = Color("ffdfb4")
	add_child(light)
	var world: WorldEnvironment = WorldEnvironment.new()
	world.environment = Environment.new()
	world.environment.background_mode = Environment.BG_COLOR
	world.environment.background_color = LevelBuilder.NIGHT
	world.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	world.environment.ambient_light_color = Color.WHITE
	world.environment.ambient_light_energy = 0.6
	add_child(world)
	feedback_bus = Feedback.new()
	feedback_bus.player = player
	add_child(feedback_bus)
	_build_ui()
	feedback_bus.caption_target = _caption
	settings_panel = SettingsPanel.new()
	add_child(settings_panel)
	SettingsStore.apply_values(self, SettingsStore.load_values())


func _physics_process(delta: float) -> void:
	advance_input(player.read_input(), delta)


func advance_input(input: PlayerInput, delta: float) -> void:
	state.advance(input, delta)
	feedback_bus.publish(state.game.events, Vector3(state.game.player.position.x, 1, state.game.player.position.y))
	if state.finished:
		_finish()


func _process(_delta: float) -> void:
	_canisters.sync(state.game)
	for index: int in _doors.size():
		_doors[index].visible = not state.open_doors[index]
	_heading.text = "%02d / %s" % [state.room + 1, ["LOCKER", "SUPPLY", "SLIME PEN", "GLASS HALL"][state.room]]
	_hint.text = state.hint()
	_hint.text = _hint.text.replace("WASD", SettingsStore.movement_binding_text()).replace("E to", SettingsStore.binding_text("interact") + " to").replace("Click to", SettingsStore.binding_text("fire") + " to")
	_skip.text = "SKIP / %s FOR CURSOR" % SettingsStore.binding_text("pause")


func _build_ui() -> void:
	var canvas: CanvasLayer = CanvasLayer.new()
	canvas.name = "TrainingHUD"
	add_child(canvas)
	var ui: Control = Control.new()
	ui.name = "Root"
	canvas.add_child(ui)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_heading = Label.new()
	ui.add_child(_heading)
	_heading.position = Vector2(28, 28)
	_heading.add_theme_font_size_override("font_size", 24)
	_heading.add_theme_color_override("font_color", LevelBuilder.AMBER)
	_caption = Label.new()
	ui.add_child(_caption)
	_caption.position = Vector2(28, 70)
	_caption.add_theme_font_size_override("font_size", 14)
	_hint = Label.new()
	ui.add_child(_hint)
	_hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_hint.offset_top = -84
	_hint.offset_bottom = -40
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.add_theme_font_size_override("font_size", 22)
	_hint.add_theme_color_override("font_color", LevelBuilder.COOLANT)
	var skip: Button = Button.new()
	_skip = skip
	skip.name = "Skip"
	ui.add_child(skip)
	skip.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	skip.offset_left = -350
	skip.offset_right = -28
	skip.offset_top = 24
	skip.offset_bottom = 68
	skip.text = "SKIP / ESC FOR CURSOR"
	skip.pressed.connect(_finish)
	var settings: Button = Button.new()
	ui.add_child(settings)
	settings.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	settings.offset_left = -278
	settings.offset_right = -28
	settings.offset_top = 78
	settings.offset_bottom = 116
	settings.text = "SETTINGS [F10]"
	settings.pressed.connect(func() -> void: settings_panel.open(self))
	var crosshair: Label = Label.new()
	ui.add_child(crosshair)
	crosshair.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	crosshair.offset_left = -10
	crosshair.offset_right = 10
	crosshair.offset_top = -15
	crosshair.offset_bottom = 15
	crosshair.text = "+"
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	crosshair.add_theme_color_override("font_color", LevelBuilder.AMBER)
	crosshair.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# CanvasLayer roots need an explicit viewport size for anchored child controls.
	get_viewport().size_changed.connect(func() -> void: ui.size = get_viewport().get_visible_rect().size)
	ui.size = get_viewport().get_visible_rect().size


func _finish() -> void:
	if _leaving:
		return
	_leaving = true
	if SettingsStore.finish_orientation(settings_path) != OK:
		push_warning("Orientation progress could not be saved")
	get_tree().change_scene_to_file.call_deferred("res://game/main.tscn")


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_F10:
		settings_panel.open(self)
		get_viewport().set_input_as_handled()


func _box(parent: Node, size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	return _part(parent, mesh, at, color)


func _part(parent: Node, mesh: Mesh, at: Vector3, color: Color) -> MeshInstance3D:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.8
	var view: MeshInstance3D = MeshInstance3D.new()
	view.mesh = mesh
	view.material_override = material
	view.position = at
	parent.add_child(view)
	return view
