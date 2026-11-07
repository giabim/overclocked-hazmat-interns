extends SceneTree
## Render code-authored geometry, not an AI bitmap: front / side / three-quarter.


func _initialize() -> void:
	_capture.call_deferred()


func _capture() -> void:
	var viewports: Array[SubViewport] = []
	for mode: int in 2:
		for angle: int in 3:
			var viewport: SubViewport = SubViewport.new()
			viewport.size = Vector2i(128, 128) if mode == 0 else Vector2i(256, 384)
			viewport.own_world_3d = true
			viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
			root.add_child(viewport)
			viewports.append(viewport)
			var intern: InternView = InternView.new()
			viewport.add_child(intern)
			intern.build(1, mode == 0)
			var world: WorldEnvironment = WorldEnvironment.new()
			world.environment = Environment.new()
			world.environment.background_mode = Environment.BG_COLOR
			world.environment.background_color = Color.WHITE if mode == 0 else LevelBuilder.NIGHT
			world.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
			world.environment.ambient_light_color = Color.WHITE
			world.environment.ambient_light_energy = 0.6
			viewport.add_child(world)
			var light: DirectionalLight3D = DirectionalLight3D.new()
			light.rotation_degrees = Vector3(-35, -30, 0)
			viewport.add_child(light)
			var camera: Camera3D = Camera3D.new()
			camera.projection = Camera3D.PROJECTION_ORTHOGONAL
			camera.keep_aspect = Camera3D.KEEP_HEIGHT
			camera.size = 2.05
			viewport.add_child(camera)
			var positions: Array[Vector3] = [Vector3(0, 0.875, -3), Vector3(3, 0.875, 0), Vector3(2.2, 0.875, -2.2)]
			camera.position = positions[angle]
			camera.look_at(Vector3(0, 0.875, 0))
	for _frame: int in 15:
		await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://docs/shots")
	for mode: int in 2:
		var size: Vector2i = Vector2i(128, 128) if mode == 0 else Vector2i(256, 384)
		var sheet: Image = Image.create(size.x * 3, size.y, false, Image.FORMAT_RGBA8)
		for angle: int in 3:
			sheet.blit_rect(viewports[mode * 3 + angle].get_texture().get_image(), Rect2i(Vector2i.ZERO, size), Vector2i(angle * size.x, 0))
		var file: String = "M1_silhouette.png" if mode == 0 else "M1_intern.png"
		if sheet.save_png("res://docs/shots/" + file) != OK:
			printerr("FAIL saving " + file)
			quit(1)
			return
	print("Intern views rendered: front, side, three-quarter; silhouette cells 128 x 128")
	for viewport: SubViewport in viewports:
		viewport.queue_free()
	await process_frame
	quit(0)
