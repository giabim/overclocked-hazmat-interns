extends RefCounted


func test_settings_clamp_ranges_and_reject_garbage() -> String:
	var values: Dictionary = SettingsStore.sanitize({"fov": 999, "sensitivity": -8, "master_volume": NAN, "sfx_volume": "loud", "quality": 20, "head_bob": "true", "reduce_motion": true, "bindings": {"fire": {"type": "mouse", "code": 999}, "move_left": {"type": "key", "code": KEY_J, "physical": true}, "unknown": {"type": "key", "code": KEY_K}}})
	if values["fov"] != 110 or not is_equal_approx(values["sensitivity"], 0.2) or values["quality"] != 2 or values["head_bob"] or not values["reduce_motion"]:
		return "Settings must clamp ranges and accept only typed options"
	if values["master_volume"] != 1 or values["sfx_volume"] != 1 or values["bindings"].size() != 1:
		return "Invalid settings or bindings must fall back safely"
	return ""


func test_settings_roundtrip_preserves_orientation_progress() -> String:
	var path: String = "user://settings_roundtrip_test.tmp"
	SettingsStore.finish_orientation(path)
	var values: Dictionary = SettingsStore.defaults()
	values["fov"] = 105.0
	values["reduce_motion"] = true
	values["bindings"] = {"interact": {"type": "key", "code": KEY_F, "physical": true}}
	var saved: Error = SettingsStore.save_values(values, path)
	var loaded: Dictionary = SettingsStore.load_values(path)
	var valid: bool = saved == OK and loaded["fov"] == 105 and loaded["reduce_motion"] and SettingsStore.orientation_finished(path)
	valid = valid and loaded["bindings"]["interact"]["code"] == KEY_F
	DirAccess.remove_absolute(path)
	return "" if valid else "Settings roundtrip must preserve values, remaps and progress"


func test_binding_override_and_default_restore() -> String:
	var prior: Dictionary = SettingsStore.load_values()
	var values: Dictionary = SettingsStore.defaults()
	values["bindings"] = {"move_left": {"type": "key", "code": KEY_J, "physical": true}}
	SettingsStore.apply_bindings(values)
	var events: Array[InputEvent] = InputMap.action_get_events("move_left")
	var valid: bool = events.size() == 1 and events[0] is InputEventKey and events[0].physical_keycode == KEY_J and SettingsStore.binding_text("move_left") == "J"
	SettingsStore.apply_bindings(SettingsStore.defaults())
	events = InputMap.action_get_events("move_left")
	valid = valid and events.size() == 1 and events[0] is InputEventKey and events[0].physical_keycode == KEY_A
	SettingsStore.apply_bindings(prior)
	return "" if valid else "Remapping and restoring defaults must change the live input map"
