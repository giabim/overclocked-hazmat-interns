extends RefCounted


func test_lab_dimensions_and_spawn_counts() -> String:
	var grid: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	if grid == null or grid.width != 24 or grid.height != 15:
		return "Lab A must be a valid 24 x 15 map"
	var expected: Dictionary = {"C": 8, "G": 3, "M": 2, "P": 9, "E": 3, "+": 14}
	for symbol: String in expected:
		if grid.cells_of(symbol).size() != expected[symbol]:
			return "Unexpected count for " + symbol
	return ""


func test_all_213_walkable_cells_reachable() -> String:
	var grid: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	var queue: Array[Vector2i] = [grid.cells_of("P")[0]]
	var visited: Dictionary = {queue[0]: true}
	var cursor: int = 0
	while cursor < queue.size():
		var current: Vector2i = queue[cursor]
		cursor += 1
		for offset: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var neighbor: Vector2i = current + offset
			if not grid.is_wall(neighbor.x, neighbor.y) and not visited.has(neighbor):
				visited[neighbor] = true
				queue.append(neighbor)
	var walkable: int = 0
	for cy: int in grid.height:
		for cx: int in grid.width:
			if not grid.is_wall(cx, cy):
				walkable += 1
	if walkable != 213 or visited.size() != walkable:
		return "Expected 213 reachable cells; got %d / %d" % [visited.size(), walkable]
	return ""


func test_outside_is_wall_and_centers_are_in_meters() -> String:
	var grid: MapGrid = MapGrid.from_text("###\n#P#\n###\n")
	for outside: Vector2i in [Vector2i(-1, 1), Vector2i(3, 1), Vector2i(1, -1), Vector2i(1, 3)]:
		if grid.cell(outside.x, outside.y) != "#" or not grid.is_wall(outside.x, outside.y):
			return "Outside the map must be solid"
	if grid.cell_center(Vector2i(1, 1)) != Vector2(3.0, 3.0):
		return "Grid centers must use 2-meter cells"
	return ""


func test_invalid_maps_rejected_and_crlf_accepted() -> String:
	for invalid: String in ["", "###\n##", "###\n#X#\n###"]:
		if MapGrid.from_text(invalid) != null:
			return "Invalid map accepted"
	if MapGrid.from_text("###\r\n#P#\r\n###\r\n") == null:
		return "Windows line endings must be accepted"
	return ""
