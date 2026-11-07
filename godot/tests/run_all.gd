extends SceneTree
## Tests return an empty String on success or an explanation on failure.


func _initialize() -> void:
	var total: int = 0
	var failed: int = 0
	for file: String in DirAccess.get_files_at("res://tests"):
		if not (file.begins_with("test_") and file.ends_with(".gd")):
			continue
		var script: GDScript = load("res://tests/" + file)
		if script == null or not script.can_instantiate():
			failed += 1
			printerr("FAIL could not load " + file)
			continue
		var instance: RefCounted = script.new()
		for method: Dictionary in script.get_script_method_list():
			var method_name: String = method["name"]
			if not method_name.begins_with("test_"):
				continue
			total += 1
			var result: Variant = instance.call(method_name)
			if not (result is String and result == ""):
				failed += 1
				printerr("FAIL %s.%s: %s" % [file, method_name, str(result)])
	if total == 0:
		failed += 1
		printerr("FAIL no tests discovered")
	print("%d/%d tests passed" % [maxi(0, total - failed), total])
	quit(1 if failed > 0 else 0)
