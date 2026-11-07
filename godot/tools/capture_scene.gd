extends SceneTree
## Render the actual scene on a desktop GPU; generated images are reviewed separately.


func _initialize() -> void:
	_capture.call_deferred()


func _capture() -> void:
	var training: bool = "--orientation" in OS.get_cmdline_user_args()
	var packed: PackedScene = load("res://game/orientation/orientation.tscn" if training else "res://game/main.tscn")
	var scene: Node = packed.instantiate()
	root.add_child(scene)
	if "--results" in OS.get_cmdline_user_args():
		scene.set_physics_process(false)
		var state: GameState = scene.get("state")
		state.delivered = state.quota()
		state.score = state.delivered
		state.phase = GameState.Phase.SUCCESS
	for _frame: int in 30:
		await process_frame
	if "--fx" in OS.get_cmdline_user_args():
		var bus: Feedback = scene.get("feedback_bus")
		var player: PlayerView = scene.get_node("Player")
		var at: Vector3 = player.camera.global_position - player.camera.global_transform.basis.z * 2
		bus.publish([{"kind": &"delivery", "position": at}])
		for _frame: int in 3:
			await process_frame
	await RenderingServer.frame_post_draw
	var calls: int = int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	DirAccess.make_dir_recursive_absolute("res://docs/shots")
	var file: String = "M2_orientation.png" if training else ("M1_results.png" if "--results" in OS.get_cmdline_user_args() else "M1_play.png")
	if "--fx" in OS.get_cmdline_user_args():
		file = "M2_feedback.png"
	var error: Error = root.get_texture().get_image().save_png("res://docs/shots/" + file)
	print("Game render: %d draw calls; screenshot result %d" % [calls, error])
	scene.queue_free()
	await process_frame
	await create_timer(0.1).timeout
	quit(0 if calls > 0 and calls <= 120 and error == OK else 1)
