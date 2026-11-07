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
	if "--bots" in OS.get_cmdline_user_args():
		_stage_bots(scene)
	if training and ("--slime-pen" in OS.get_cmdline_user_args() or "--glass-hall" in OS.get_cmdline_user_args()):
		_stage_training_room(scene, "--slime-pen" in OS.get_cmdline_user_args())
	for _frame: int in 30:
		await process_frame
	if "--bot-levels" in OS.get_cmdline_user_args():
		var hud: ShiftHUD = scene.get_node("HUD")
		hud.call("_open_menu")
		hud.call("_open_bot_editor")
		for _frame: int in 3:
			await process_frame
	if "--pings" in OS.get_cmdline_user_args():
		var state: GameState = scene.get("state")
		for caller: PlayerState in state.players:
			Hazards.try_ping(state, caller)
		var bus: Feedback = scene.get("feedback_bus")
		bus.publish(state.events)
		for _frame: int in 3:
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
	var file: String = ("M3_orientation_slime.png" if "--slime-pen" in OS.get_cmdline_user_args() else ("M3_orientation_hound.png" if "--glass-hall" in OS.get_cmdline_user_args() else "M2_orientation.png")) if training else ("M1_results.png" if "--results" in OS.get_cmdline_user_args() else "M1_play.png")
	if "--fx" in OS.get_cmdline_user_args():
		file = "M2_feedback.png"
	if "--specimens" in OS.get_cmdline_user_args():
		file = "M3_specimens.png"
	if "--bots" in OS.get_cmdline_user_args():
		file = "M4_bots.png"
	if "--settings" in OS.get_cmdline_user_args():
		file = "M2_settings_controls.png" if "--controls" in OS.get_cmdline_user_args() else ("M2_settings_audio.png" if "--audio" in OS.get_cmdline_user_args() else "M2_settings.png")
	if "--low-quality" in OS.get_cmdline_user_args() or "--high-quality" in OS.get_cmdline_user_args():
		file = "M2_quality_low.png" if "--low-quality" in OS.get_cmdline_user_args() else "M2_quality_high.png"
	if "--bot-levels" in OS.get_cmdline_user_args():
		file = "M4_bot_levels.png"
	if "--pings" in OS.get_cmdline_user_args():
		file = "M4_team_pings.png"
	var error: Error = root.get_texture().get_image().save_png("res://docs/shots/" + file)
	print("Game render: %d draw calls; screenshot result %d" % [calls, error])
	if "--settings" in OS.get_cmdline_user_args():
		var settings: SettingsPanel = scene.get("settings_panel")
		settings.close()
	if not await SceneCleanup.dispose(self, scene):
		quit(1)
		return
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


## M3 cohesion shots: the real training slime (R3) and the hound pens (R4).
func _stage_training_room(scene: Node, slime_pen: bool) -> void:
	var training: OrientationState = scene.get("state")
	var player: PlayerView = scene.get_node("Player")
	for index: int in 3:
		training._unlock(index)
	if slime_pen:
		training.room = 2
		training.game.player.teleport(Vector2(37, 18.5))
		player.yaw = PI
	else:
		training.room = 3
		training.game.player.teleport(Vector2(23, 23))
		player.yaw = PI / 2.0
	player.configure(training.game.grid, training.game.player.position)
	player.yaw = PI if slime_pen else PI / 2.0


## M4 review shot: a full team of 7 mixed-level bots facing the camera (draw-call budget check).
func _stage_bots(scene: Node) -> void:
	var hud: ShiftHUD = scene.get_node("HUD")
	hud.bot_count = Tuning.MAX_BOTS
	hud.bot_level = 4
	scene.call("_restart")
	scene.set_physics_process(false)
	var state: GameState = scene.get("state")
	var player: PlayerView = scene.get_node("Player")
	player.yaw = -PI / 2.0
	var eye: Vector2 = state.player.position
	for index: int in range(1, state.players.size()):
		var bot: PlayerState = state.players[index]
		var row: int = (index - 1) / 4
		var column: int = (index - 1) % 4
		bot.teleport(eye + Vector2(3.0 + row * 1.6, -2.1 + column * 1.4))
		bot.yaw = PI / 2.0
	state.players[2].carrying = 0
