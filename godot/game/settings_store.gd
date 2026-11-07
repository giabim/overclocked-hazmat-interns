class_name SettingsStore
extends RefCounted

const PATH: String = "user://settings.cfg"
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
