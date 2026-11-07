extends SceneTree
## Exercise the running scene, feedback, results and restart through the real input path.


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var scene: Node = load("res://game/main.tscn").instantiate()
	root.add_child(scene)
	scene.set_physics_process(false)
	await process_frame
	var lobby_error: String = _exercise_lobby(scene)
	if not lobby_error.is_empty():
		_fail(lobby_error)
		return
	var state: GameState = scene.get("state")
	var settings_error: String = _exercise_settings(scene)
	if not settings_error.is_empty():
		_fail(settings_error)
		return
	var player: PlayerView = scene.get_node("Player")
	var bus: Feedback = scene.get("feedback_bus")
	var before: Vector2 = state.player.position
	var yaw: float = player.yaw
	player.reduce_motion = false
	bus.publish([{"kind": &"foam_fired"}])
	player.call("_process", 0.0)
	var kick: float = absf(player.camera.rotation.x - player.pitch)
	if kick <= 0 or kick > deg_to_rad(Tuning.MAX_CAMERA_KICK_DEGREES) or player.yaw != yaw or state.player.position != before:
		_fail("Camera feedback must be bounded and cosmetic")
		return
	player.reduce_motion = true
	bus.publish([{"kind": &"foam_fired"}])
	player.call("_process", 0.0)
	if not is_equal_approx(player.camera.rotation.x, player.pitch):
		_fail("Reduce Motion must suppress camera kick")
		return
	player.reduce_motion = false
	bus.publish([{"kind": &"caught", "player": 1}, {"kind": &"foam_fired", "player": 1}])
	player.call("_process", 0.0)
	var own_hud: ShiftHUD = scene.get_node("HUD")
	if float(own_hud.get("_card_remaining")) > 0 or not is_equal_approx(player.camera.rotation.x, player.pitch):
		_fail("Another intern's catch/weapon cue changed the local player's card or camera")
		return
	var input: PlayerInput = PlayerInput.new()
	input.interact = true
	for id: int in state.quota():
		state.player.teleport(state.canisters[id].position)
		scene.call("advance_input", input, 0)
		if state.player.carrying != id:
			_fail("Scene pickup failed")
			return
		state.player.teleport(state.grid.cell_center(state.grid.cells_of("E")[0]))
		scene.call("advance_input", input, 0)
	scene.call("advance_input", PlayerInput.new(), 1.0 / Tuning.TICK_RATE)
	await process_frame
	if state.phase != GameState.Phase.SUCCESS or state.score != state.quota():
		_fail("Scene extraction failed")
		return
	var hud: ShiftHUD = scene.get_node("HUD")
	var ui_root: Control = hud.get("_root")
	var bounds: Rect2 = Rect2(Vector2.ZERO, ui_root.size)
	for child: Node in ui_root.get_children():
		if child is Control and not bounds.encloses(child.get_rect()):
			_fail("HUD control is outside viewport: " + str(child.get_rect()))
			return
	var results: Panel = hud.get("_results")
	if not results.visible:
		_fail("Results panel did not appear")
		return
	for child: Node in results.get_children():
		if child is Button and child.text == "PLAY AGAIN":
			child.pressed.emit()
	var restarted: GameState = scene.get("state")
	if restarted == state or restarted.finished() or restarted.heat != 0 or restarted.delivered != 0 or results.visible:
		_fail("Play Again did not reset the shift")
		return
	print("Scene smoke passed: bot lobby, settings, motion safety, pickup, delivery, extraction, results, restart")
	if not await SceneCleanup.dispose(self, scene):
		quit(1)
		return
	quit(0)


func _fail(message: String) -> void:
	printerr("FAIL " + message)
	quit(1)


func _exercise_settings(scene: Node) -> String:
	var path: String = "user://settings_scene_test.tmp"
	SettingsStore.finish_orientation(path)
	var prior: Dictionary = SettingsStore.load_values()
	var panel: SettingsPanel = scene.get("settings_panel")
	panel.settings_path = path
	panel.open(scene)
	var was_paused: bool = self.paused
	var ui: Control = panel.get("_root")
	var fov: HSlider = ui.find_child("fov", true, false)
	var reduce: CheckButton = ui.find_child("reduce_motion", true, false)
	var quality: OptionButton = ui.find_child("quality", true, false)
	var volume: HSlider = ui.find_child("master_volume", true, false)
	fov.value = 107
	reduce.button_pressed = true
	quality.item_selected.emit(0)
	volume.value = 0
	var player: PlayerView = scene.get_node("Player")
	var world: WorldEnvironment = scene.find_children("*", "WorldEnvironment", true, false)[0]
	var valid: bool = was_paused and player.horizontal_fov == 107 and player.reduce_motion and AudioServer.is_bus_mute(0)
	valid = valid and is_equal_approx(root.scaling_3d_scale, 0.75) and not world.environment.glow_enabled
	quality.item_selected.emit(2)
	valid = valid and world.environment.glow_enabled and world.environment.ssao_enabled and root.msaa_3d == Viewport.MSAA_2X
	var rebind: Button = ui.find_child("Bind_interact", true, false)
	rebind.pressed.emit()
	var key: InputEventKey = InputEventKey.new()
	key.physical_keycode = KEY_F
	key.keycode = KEY_F
	key.pressed = true
	panel.call("_input", key)
	var saved: Dictionary = SettingsStore.load_values(path)
	valid = valid and saved["fov"] == 107 and saved["bindings"]["interact"]["code"] == KEY_F
	for button: Node in ui.find_children("*", "Button", true, false):
		if button is Button and button.text == "RESET DEFAULTS":
			button.pressed.emit()
			break
	valid = valid and SettingsStore.load_values(path)["fov"] == 90 and SettingsStore.orientation_finished(path)
	panel.close()
	valid = valid and not self.paused
	SettingsStore.apply_values(scene, prior)
	DirAccess.remove_absolute(path)
	return "" if valid else "Settings UI must pause/resume, apply quality/FOV/audio/remaps, save and reset safely"


func _exercise_lobby(scene: Node) -> String:
	var hud: ShiftHUD = scene.get_node("HUD")
	hud.set_bot_count(3)
	hud.set_level_preset(1)
	hud.call("_open_menu")
	var edit: Button = hud.get("_per_bot_button")
	edit.pressed.emit()
	var levels: Array = hud.get("_bot_level_buttons")
	levels[1].pressed.emit()
	levels[2].pressed.emit()
	levels[2].pressed.emit()
	var valid: bool = hud.bot_levels() == [1, 2, 3]
	var editor: Panel = hud.get("_bot_editor")
	var ui: Control = hud.get("_root")
	valid = valid and editor.visible and Rect2(Vector2.ZERO, ui.size).encloses(editor.get_rect())
	editor.get_node("Done").pressed.emit()
	var menu: Panel = hud.get("_menu")
	menu.get_node("StartShift").pressed.emit()
	var state: GameState = scene.get("state")
	valid = valid and state.players.size() == 4
	for index: int in range(1, state.brains.size()):
		valid = valid and state.brains[index].level == index
	hud.set_bot_count(0)
	hud.call("_restart")
	return "" if valid else "Per-bot lobby controls must start the chosen team through the real scene"
