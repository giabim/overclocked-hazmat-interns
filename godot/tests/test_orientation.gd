extends RefCounted


func _new_state() -> OrientationState:
	return OrientationState.create(MapGrid.from_text(FileAccess.get_file_as_string("res://maps/orientation.txt")))


func test_hints_wait_eight_idle_seconds_and_reset_on_input() -> String:
	var state: OrientationState = _new_state()
	var input: PlayerInput = PlayerInput.new()
	input.yaw = -PI / 2.0
	state.advance(input, 7.9)
	if state.hint() != "":
		return "Hint appeared before 8 seconds"
	state.advance(input, 0.11)
	if state.hint().is_empty():
		return "Idle hint missing"
	input.move = Vector2.RIGHT
	state.advance(input, 0.01)
	return "" if state.hint().is_empty() else "Input must hide the hint"


func test_light_delivery_and_three_foams_unlock_rooms_in_order() -> String:
	var state: OrientationState = _new_state()
	var input: PlayerInput = PlayerInput.new()
	state.game.player.teleport(state.game.grid.cell_center(OrientationState.LIGHT_CELL))
	state.advance(input, 0)
	if not state.open_doors[0] or state.game.grid.is_wall(12, 3):
		return "Stepping into light must open the locker"
	state.game.player.teleport(Vector2(29, 7))
	state.advance(input, 0)
	input.interact = true
	state.game.player.teleport(state.game.canisters[0].position)
	state.advance(input, 0)
	if state.game.player.carrying != 0:
		return "Training pickup failed"
	state.game.player.teleport(state.game.grid.cell_center(OrientationState.SLOT_CELL))
	state.advance(input, 0)
	if not state.open_doors[1]:
		return "Training delivery failed"
	input.interact = false
	state.game.player.teleport(Vector2(37, 19))
	state.advance(input, 0)
	state.game.player.teleport(Vector2(37, 21))
	input.fire = true
	input.yaw = PI
	for _freeze: int in 3:
		state.advance(input, Tuning.FOAM_COOLDOWN)
	return "" if state.foam_hits == 3 and state.open_doors[2] else "Three aimed freezes must open the slime pen"


func test_hound_demo_precedes_safe_live_wall_stun() -> String:
	var state: OrientationState = _new_state()
	state.room = 3
	state.game.player.teleport(Vector2(17, 22))
	for _tick: int in 60:
		state.advance(PlayerInput.new(), 1.0 / Tuning.TICK_RATE)
	if state.demo_finished:
		return "Demo must include wind-up, dash and wall stun"
	for _tick: int in 180:
		state.advance(PlayerInput.new(), 1.0 / Tuning.TICK_RATE)
	if not state.demo_finished or not state.open_doors[3] or state.game.finished():
		return "Safe training hound must demonstrate a wall stun without catching the player"
	return ""


func test_progress_save_preserves_existing_settings() -> String:
	var path: String = "user://orientation_test.tmp"
	var config: ConfigFile = ConfigFile.new()
	config.set_value("audio", "volume", 0.5)
	if config.save(path) != OK or SettingsStore.finish_orientation(path) != OK:
		return "Could not write test progress"
	var completed: bool = SettingsStore.orientation_finished(path)
	config.load(path)
	var preserved: bool = config.get_value("audio", "volume") == 0.5
	DirAccess.remove_absolute(path)
	return "" if completed and preserved else "Progress save must preserve settings"
