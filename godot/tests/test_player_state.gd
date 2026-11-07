extends RefCounted


func test_speed_diagonal_limit_and_carrying() -> String:
	var grid: MapGrid = MapGrid.from_text("##########\n#........#\n#........#\n#........#\n##########")
	var state: PlayerState = PlayerState.new()
	var input: PlayerInput = PlayerInput.new()
	input.move = Vector2(1, 1)
	state.teleport(Vector2(5, 5))
	state.step(grid, input, 0.1)
	if not is_equal_approx(state.position.distance_to(Vector2(5, 5)), 0.55):
		return "Diagonal movement must stay at walk speed"
	state.teleport(Vector2(5, 5))
	state.carrying = 0
	state.step(grid, input, 0.1)
	if not is_equal_approx(state.position.distance_to(Vector2(5, 5)), 0.47):
		return "Carrying must use 4.7 m/s"
	return ""


func test_heading_and_previous_position_for_interpolation() -> String:
	var grid: MapGrid = MapGrid.from_text("######\n#....#\n#....#\n######")
	var state: PlayerState = PlayerState.new()
	state.teleport(Vector2(5, 3))
	var input: PlayerInput = PlayerInput.new()
	input.move = Vector2(0, -1)
	input.yaw = -PI / 2.0
	state.step(grid, input, 1.0 / Tuning.TICK_RATE)
	if not state.previous_position.is_equal_approx(Vector2(5, 3)) or state.position.x <= 5 or not is_equal_approx(state.position.y, 3):
		return "Forward input must follow camera heading and preserve previous tick"
	return ""
