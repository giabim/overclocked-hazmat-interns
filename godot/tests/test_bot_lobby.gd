extends RefCounted


func test_individual_levels_preserve_other_bots() -> String:
	var hud: ShiftHUD = ShiftHUD.new()
	hud.set_bot_count(3)
	hud.set_level_preset(2)
	hud.set_bot_level(1, 3)
	hud.set_bot_level(0, 1)
	var valid: bool = hud.bot_levels() == [1, 3, 2]
	hud.free()
	return "" if valid else "Editing one bot must preserve the rest of the team"


func test_removing_bots_drops_hidden_overrides_and_counts_are_bounded() -> String:
	var hud: ShiftHUD = ShiftHUD.new()
	hud.set_bot_count(99)
	hud.set_level_preset(2)
	hud.set_bot_level(6, 1)
	hud.set_bot_level(-1, 3)
	hud.set_bot_count(2)
	hud.set_bot_count(99)
	var levels: Array[int] = hud.bot_levels()
	var valid: bool = levels.size() == 7 and levels[6] == 2
	hud.set_bot_count(-1)
	valid = valid and hud.bot_levels().is_empty()
	hud.free()
	return "" if valid else "Removed bot settings must not leak into new slots"


func test_presets_clear_individual_overrides_and_keep_mixed_mode() -> String:
	var hud: ShiftHUD = ShiftHUD.new()
	hud.set_bot_count(4)
	hud.set_level_preset(4)
	var valid: bool = hud.bot_levels() == [1, 2, 3, 1]
	hud.set_bot_level(3, 3)
	valid = valid and hud.bot_levels() == [1, 2, 3, 3]
	hud.set_level_preset(1)
	valid = valid and hud.bot_levels() == [1, 1, 1, 1]
	hud.free()
	return "" if valid else "Team presets must replace custom choices predictably"
