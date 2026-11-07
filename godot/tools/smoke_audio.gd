extends SceneTree
## Regression: delete scenes with active, paused, overlapping and positional loop audio.


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	for iteration: int in 6:
		var scene: Node3D = Node3D.new()
		root.add_child(scene)
		var camera: Camera3D = Camera3D.new()
		scene.add_child(camera)
		camera.current = true
		for index: int in 4:
			var cue: AudioStreamPlayer = AudioStreamPlayer.new()
			cue.stream = ShiftAudio._make_clip(0.4, 300 + index * 110, 900, true)
			cue.max_polyphony = 4
			scene.add_child(cue)
			for _voice: int in 3:
				cue.play()
			cue.stream_paused = (iteration + index) % 2 == 0
		for index: int in 3:
			var loop: AudioStreamPlayer3D = AudioStreamPlayer3D.new()
			loop.stream = ShiftAudio.make_loop(0.5, 110 + index * 110, true)
			scene.add_child(loop)
			loop.play()
		await physics_frame
		await physics_frame
		if not await SceneCleanup.dispose(self, scene):
			quit(1)
			return
		if is_instance_valid(scene):
			printerr("FAIL audio fixture scene was not freed")
			quit(1)
			return
	print("Scene smoke passed: active, paused, overlapping and positional audio cleanup")
	quit(0)
