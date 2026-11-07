extends SceneTree
## Full M4.4 verification without rerunning unrelated tests: BOT_LEAGUE=1 godot ...


func _initialize() -> void:
	if OS.get_environment("BOT_LEAGUE") != "1":
		printerr("FAIL set BOT_LEAGUE=1 to run the full 50-shift-per-level league")
		quit(1)
		return
	var suite: RefCounted = load("res://tests/test_bots.gd").new()
	var result: Variant = suite.call("test_bot_league_ranks_levels_and_bots_keep_moving")
	if result is String and result.is_empty():
		print("Full bot league passed: 50 shifts per level; strict median ranking; no goal stalls over 5 s")
		quit(0)
	else:
		printerr("FAIL full bot league: " + str(result))
		quit(1)
