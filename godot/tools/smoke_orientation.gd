extends SceneTree


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var path: String = "user://orientation_scene_test.tmp"
	var scene: Node = load("res://game/orientation/orientation.tscn").instantiate()
	scene.set("settings_path", path)
	root.add_child(scene)
	current_scene = scene
	scene.set_physics_process(false)
	await process_frame
	var state: OrientationState = scene.get("state")
	var ui: Control = scene.get_node("TrainingHUD/Root")
	var skip: Button = ui.get_node("Skip")
	if state.room != 0 or not skip.visible or not Rect2(Vector2.ZERO, ui.size).encloses(skip.get_rect()):
		printerr("FAIL orientation start or visible Skip bounds")
		quit(1)
		return
	skip.pressed.emit()
	for _frame: int in 4:
		await process_frame
	if is_instance_valid(scene) or current_scene == null or not SettingsStore.orientation_finished(path):
		printerr("FAIL Skip must save progress and enter the playable shift")
		quit(1)
		return
	if not await SceneCleanup.dispose(self, current_scene):
		quit(1)
		return
	DirAccess.remove_absolute(path)
	print("Scene smoke passed: orientation starts, Skip stays visible, progress saves, shift loads")
	quit(0)
