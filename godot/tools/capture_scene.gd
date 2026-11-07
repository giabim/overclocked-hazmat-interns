extends SceneTree
## Render the actual scene on a desktop GPU; generated images are reviewed separately.


func _initialize() -> void:
	_capture.call_deferred()


func _capture() -> void:
	var training: bool = "--orientation" in OS.get_cmdline_user_args()
	var packed: PackedScene = load("res://game/orientation/orientation.tscn" if training else "res://game/main.tscn")
	var scene: Node = packed.instantiate()
	root.add_child(scene)
	if "--low-quality" in OS.get_cmdline_user_args() or "--high-quality" in OS.get_cmdline_user_args():
		var values: Dictionary = SettingsStore.defaults()
		values["quality"] = 0 if "--low-quality" in OS.get_cmdline_user_args() else 2
		SettingsStore.apply_values(scene, values)
	if "--results" in OS.get_cmdline_user_args():
		scene.set_physics_process(false)
		var state: GameState = scene.get("state")
		state.delivered = state.quota()
		state.score = state.delivered
		state.phase = GameState.Phase.SUCCESS
	if "--specimens" in OS.get_cmdline_user_args():
		_stage_specimens(scene)
	for _frame: int in 30:
		await process_frame
	if "--specimens" in OS.get_cmdline_user_args():
		_stage_specimen_hud(scene)
		for _frame: int in 2:
			await process_frame
	if "--fx" in OS.get_cmdline_user_args():
		var bus: Feedback = scene.get("feedback_bus")
		var player: PlayerView = scene.get_node("Player")
		var at: Vector3 = player.camera.global_position - player.camera.global_transform.basis.z * 2
		bus.publish([{"kind": &"delivery", "position": at}])
		for _frame: int in 3:
			await process_frame
	if "--settings" in OS.get_cmdline_user_args():
		var settings: SettingsPanel = scene.get("settings_panel")
		settings.open(scene)
		var ui: Control = settings.get("_root")
		var tabs: TabContainer = ui.find_children("*", "TabContainer", true, false)[0]
		if "--controls" in OS.get_cmdline_user_args():
			tabs.current_tab = 1
		elif "--audio" in OS.get_cmdline_user_args():
			tabs.current_tab = 2
		for _frame: int in 3:
			await process_frame
	await RenderingServer.frame_post_draw
	var calls: int = int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	DirAccess.make_dir_recursive_absolute("res://docs/shots")
	var file: String = "M2_orientation.png" if training else ("M1_results.png" if "--results" in OS.get_cmdline_user_args() else "M1_play.png")
	if "--fx" in OS.get_cmdline_user_args():
		file = "M2_feedback.png"
	if "--specimens" in OS.get_cmdline_user_args():
		file = "M3_specimens.png"
	if "--settings" in OS.get_cmdline_user_args():
		file = "M2_settings_controls.png" if "--controls" in OS.get_cmdline_user_args() else ("M2_settings_audio.png" if "--audio" in OS.get_cmdline_user_args() else "M2_settings.png")
	if "--low-quality" in OS.get_cmdline_user_args() or "--high-quality" in OS.get_cmdline_user_args():
		file = "M2_quality_low.png" if "--low-quality" in OS.get_cmdline_user_args() else "M2_quality_high.png"
	var error: Error = root.get_texture().get_image().save_png("res://docs/shots/" + file)
	print("Game render: %d draw calls; screenshot result %d" % [calls, error])
	if "--settings" in OS.get_cmdline_user_args():
		var settings: SettingsPanel = scene.get("settings_panel")
		settings.close()
	scene.queue_free()
	await process_frame
	await create_timer(0.1).timeout
	quit(0 if calls > 0 and calls <= 120 and error == OK else 1)


## M3 review shot: a slime, a winding-up hound and a frozen slime in view, plus the caught card.
func _stage_specimens(scene: Node) -> void:
	scene.set_physics_process(false)
	var state: GameState = scene.get("state")
	var player: PlayerView = scene.get_node("Player")
	var eye: Vector2 = state.player.position
	var placements: Array = [
		[SpecimenState.Kind.SLIME, SpecimenState.Mode.CHASE, Vector2(4.2, 0.9)],
		[SpecimenState.Kind.HOUND, SpecimenState.Mode.WINDUP, Vector2(5.2, -1.3)],
		[SpecimenState.Kind.SLIME, SpecimenState.Mode.FROZEN, Vector2(5.5, 2.4)],
	]
	state.specimens.clear()
	for entry: Array in placements:
		var specimen: SpecimenState = SpecimenState.new()
		specimen.id = state.specimens.size()
		specimen.kind = entry[0]
		specimen.set_mode(entry[1], 5.0)
		specimen.position = eye + entry[2]
		specimen.previous_position = specimen.position + Vector2(0.05, 0.0)
		specimen.dash_direction = Vector2.LEFT
		specimen.den = state.grid.cell_center(state.grid.cells_of("M")[0])
		state.specimens.append(specimen)
	var views: SpecimenViews = scene.get("specimen_views")
	views.build(state)
	player.yaw = -PI / 2.0


func _stage_specimen_hud(scene: Node) -> void:
	var state: GameState = scene.get("state")
	var hud: ShiftHUD = scene.get_node("HUD")
	hud.feedback(&"caught", {"specimen": &"hound", "how": &"dashed", "from_angle": -PI / 2.0})
	hud.feedback(&"sensor_sweep", {"blips": [state.specimens[0].position, state.specimens[1].position] as Array[Vector2]})
