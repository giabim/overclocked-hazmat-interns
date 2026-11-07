extends SceneTree
## Exercise the running scene, feedback, results and restart through the real input path.


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var scene: Node = load("res://game/main.tscn").instantiate()
	root.add_child(scene)
	scene.set_physics_process(false)
	await process_frame
	var state: GameState = scene.get("state")
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
	print("Scene smoke passed: pickup, delivery, extraction, results, restart")
	scene.queue_free()
	await process_frame
	# Allow the audio thread to release queued playback before the fast headless exit.
	await create_timer(0.1).timeout
	quit(0)


func _fail(message: String) -> void:
	printerr("FAIL " + message)
	quit(1)
