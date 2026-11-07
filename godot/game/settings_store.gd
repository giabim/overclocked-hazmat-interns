class_name SettingsStore
extends RefCounted

const PATH: String = "user://settings.cfg"
const ACTIONS: Array[String] = ["move_forward", "move_back", "move_left", "move_right", "fire", "throw", "interact", "ping", "pause"]
static var session_orientation_done: bool = false


static func orientation_finished(path: String = PATH) -> bool:
	if path == PATH and session_orientation_done:
		return true
	var config: ConfigFile = ConfigFile.new()
	if config.load(path) != OK:
		return false
	return bool(config.get_value("progress", "orientation_finished", false))


static func finish_orientation(path: String = PATH) -> Error:
	if path == PATH:
		session_orientation_done = true
	var config: ConfigFile = ConfigFile.new()
	var error: Error = config.load(path)
	if error != OK and error != ERR_FILE_NOT_FOUND:
		return error
	config.set_value("progress", "orientation_finished", true)
	return config.save(path)


static func defaults() -> Dictionary:
	return {"sensitivity": 1.0, "invert_y": false, "fov": Tuning.DEFAULT_FOV,
		"reduce_motion": false, "head_bob": false, "subtitles": true,
		"toggle_fire": false, "master_volume": 1.0, "sfx_volume": 1.0,
		"quality": 1, "bindings": {}}


static func sanitize(source: Dictionary) -> Dictionary:
	var result: Dictionary = defaults()
	var ranges: Dictionary = {"sensitivity": Vector2(0.2, 3), "fov": Vector2(Tuning.MIN_FOV, Tuning.MAX_FOV), "master_volume": Vector2(0, 1), "sfx_volume": Vector2(0, 1)}
	for key: String in ranges:
		var value: Variant = source.get(key, result[key])
		if (value is int or value is float) and is_finite(float(value)):
			var limits: Vector2 = ranges[key]
			result[key] = clampf(float(value), limits.x, limits.y)
	for key: String in ["invert_y", "reduce_motion", "head_bob", "subtitles", "toggle_fire"]:
		if source.get(key) is bool:
			result[key] = source[key]
	if source.get("quality") is int:
		result["quality"] = clampi(source["quality"], 0, 2)
	var bindings: Variant = source.get("bindings")
	if bindings is Dictionary:
		for action: String in ACTIONS:
			var entry: Variant = bindings.get(action)
			if not entry is Dictionary or not entry.get("code") is int:
				continue
			var code: int = entry["code"]
			if entry.get("type") == "key" and code > 0 and code < (1 << 24) and code != KEY_F10:
				result["bindings"][action] = {"type": "key", "code": code, "physical": entry.get("physical", true) == true}
			elif entry.get("type") == "mouse" and code >= 1 and code <= 9:
				result["bindings"][action] = {"type": "mouse", "code": code}
	return result


static func load_values(path: String = PATH) -> Dictionary:
	var config: ConfigFile = ConfigFile.new()
	var values: Dictionary = defaults()
	if config.load(path) == OK:
		for key: String in values:
			values[key] = config.get_value("settings", key, values[key])
	return sanitize(values)


static func save_values(values: Dictionary, path: String = PATH) -> Error:
	var config: ConfigFile = ConfigFile.new()
	var error: Error = config.load(path)
	if error != OK and error != ERR_FILE_NOT_FOUND:
		return error
	var clean: Dictionary = sanitize(values)
	for key: String in clean:
		config.set_value("settings", key, clean[key])
	return config.save(path)


static func binding_from_event(event: InputEvent) -> Dictionary:
	if event is InputEventKey:
		return {"type": "key", "code": event.physical_keycode if event.physical_keycode != 0 else event.keycode, "physical": event.physical_keycode != 0}
	if event is InputEventMouseButton:
		return {"type": "mouse", "code": event.button_index}
	return {}


static func apply_bindings(values: Dictionary) -> void:
	var bindings: Dictionary = sanitize(values)["bindings"]
	for action: String in ACTIONS:
		InputMap.action_erase_events(action)
		if not bindings.has(action):
			var preset: Dictionary = ProjectSettings.get_setting("input/" + action, {"events": []})
			for event: InputEvent in preset["events"]:
				InputMap.action_add_event(action, event)
			continue
		var entry: Dictionary = bindings[action]
		if entry["type"] == "key":
			var key: InputEventKey = InputEventKey.new()
			if entry["physical"]:
				key.physical_keycode = entry["code"]
			else:
				key.keycode = entry["code"]
			InputMap.action_add_event(action, key)
		else:
			var mouse: InputEventMouseButton = InputEventMouseButton.new()
			mouse.button_index = entry["code"]
			InputMap.action_add_event(action, mouse)


static func binding_text(action: String) -> String:
	var names: PackedStringArray = PackedStringArray()
	for event: InputEvent in InputMap.action_get_events(action):
		if event is InputEventKey:
			names.append(OS.get_keycode_string(event.physical_keycode if event.physical_keycode != 0 else event.keycode))
		else:
			names.append(event.as_text())
	return " / ".join(names)


static func movement_binding_text() -> String:
	return "/".join([binding_text("move_forward"), binding_text("move_left"), binding_text("move_back"), binding_text("move_right")])


static func apply_values(scene: Node, values: Dictionary) -> void:
	var clean: Dictionary = sanitize(values)
	apply_bindings(clean)
	AudioServer.set_bus_mute(0, clean["master_volume"] <= 0)
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.0001, clean["master_volume"])))
	var viewport: Viewport = scene.get_viewport()
	viewport.scaling_3d_scale = 0.75 if clean["quality"] == 0 else 1.0
	viewport.msaa_3d = Viewport.MSAA_2X if clean["quality"] == 2 else Viewport.MSAA_DISABLED
	var stack: Array[Node] = [scene]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if node is PlayerView:
			node.mouse_sensitivity = Tuning.MOUSE_SENSITIVITY * clean["sensitivity"]
			node.invert_y = clean["invert_y"]
			node.reduce_motion = clean["reduce_motion"]
			node.head_bob = clean["head_bob"]
			node.toggle_fire = clean["toggle_fire"]
			node.set_horizontal_fov(clean["fov"])
		elif node is Feedback:
			node.apply_settings(clean)
		elif node is WorldEnvironment and node.environment != null:
			node.environment.glow_enabled = clean["quality"] >= 1
			node.environment.ssao_enabled = clean["quality"] == 2
		for child: Node in node.get_children():
			stack.append(child)
