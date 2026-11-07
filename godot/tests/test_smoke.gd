extends RefCounted


func test_project_boots_with_required_inputs() -> String:
	var packed: PackedScene = load("res://game/main.tscn")
	if packed == null:
		return "Main scene did not load"
	var scene: Node = packed.instantiate()
	var camera: Camera3D = scene.get_node_or_null("Camera3D")
	var title: Label = scene.get_node_or_null("HUD/Title")
	var valid: bool = scene is Node3D and camera != null and title != null
	if valid:
		valid = camera.current and title.text == "Overclocked"
	scene.free()
	if not valid:
		return "Main scene needs its camera and title"
	for action: StringName in [
		&"move_forward", &"move_back", &"move_left", &"move_right", &"fire",
		&"throw", &"interact", &"ping", &"pause",
	]:
		if not InputMap.has_action(action) or InputMap.action_get_events(action).is_empty():
			return "Missing binding: " + str(action)
	if ProjectSettings.get_setting("physics/common/physics_ticks_per_second") != 30:
		return "Simulation must run at 30 Hz"
	if ProjectSettings.get_setting("rendering/renderer/rendering_method") != "gl_compatibility":
		return "Web support requires Compatibility rendering"
	return ""
