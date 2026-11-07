extends RefCounted


func test_ten_thousand_random_moves_never_enter_walls() -> String:
	var grid: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 472
	var starts: Array[Vector2i] = grid.cells_of(".")
	var position: Vector2 = grid.cell_center(starts[0])
	for index: int in 10000:
		if index % 100 == 0:
			position = grid.cell_center(starts[rng.randi_range(0, starts.size() - 1)])
		var displacement: Vector2 = Vector2(rng.randf_range(-10.0, 10.0), rng.randf_range(-10.0, 10.0))
		position = GridMove.move_circle(grid, position, displacement)
		if GridMove.hits_wall(grid, position):
			return "Move %d ended inside a wall at %s" % [index, position]
	return ""


func test_wall_sliding_preserves_parallel_motion() -> String:
	var grid: MapGrid = MapGrid.from_text("#####\n#.#.#\n#.#.#\n#.#.#\n#####")
	var start: Vector2 = Vector2(4.0 - Tuning.PLAYER_RADIUS - 0.01, 3.0)
	var end: Vector2 = GridMove.move_circle(grid, start, Vector2(1.0, 2.0))
	if not is_equal_approx(end.y, start.y + 2.0):
		return "Sliding lost motion parallel to the wall"
	if end.x > 4.0 - Tuning.PLAYER_RADIUS or GridMove.hits_wall(grid, end):
		return "Sliding penetrated the wall"
	return ""


func test_ten_meter_move_cannot_cross_two_meter_wall() -> String:
	var grid: MapGrid = MapGrid.from_text("########\n#P#....#\n########")
	var start: Vector2 = grid.cell_center(grid.cells_of("P")[0])
	var end: Vector2 = GridMove.move_circle(grid, start, Vector2(10.0, 0.0))
	if end.x > 4.0 - Tuning.PLAYER_RADIUS or GridMove.hits_wall(grid, end):
		return "Long displacement tunneled through a wall"
	return ""


func test_outer_edges_corners_and_zero_motion() -> String:
	var grid: MapGrid = MapGrid.from_text("####\n#..#\n#..#\n####")
	var start: Vector2 = Vector2(3.0, 3.0)
	if GridMove.move_circle(grid, start, Vector2.ZERO) != start:
		return "Zero displacement moved the player"
	for direction: Vector2 in [Vector2(-10, -10), Vector2(10, 10), Vector2(-10, 10), Vector2(10, -10)]:
		var end: Vector2 = GridMove.move_circle(grid, start, direction)
		if GridMove.hits_wall(grid, end) or end.x < 2.0 or end.y < 2.0 or end.x > 6.0 or end.y > 6.0:
			return "Movement escaped the map boundary"
	return ""
