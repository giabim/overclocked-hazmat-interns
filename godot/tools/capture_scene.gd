extends SceneTree
## Render the actual scene on a desktop GPU; generated images are reviewed separately.


func _initialize() -> void:
	_capture.call_deferred()


func _capture() -> void:
	var packed: PackedScene = load("res://game/main.tscn")
	root.add_child(packed.instantiate())
	for _frame: int in 30:
		await process_frame
	await RenderingServer.frame_post_draw
	var calls: int = int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	DirAccess.make_dir_recursive_absolute("res://docs/shots")
	var error: Error = root.get_texture().get_image().save_png("res://docs/shots/M1_lab.png")
	print("Lab render: %d draw calls; screenshot result %d" % [calls, error])
	quit(0 if calls > 0 and calls <= 40 and error == OK else 1)
