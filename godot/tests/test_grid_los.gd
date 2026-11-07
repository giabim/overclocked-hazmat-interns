extends RefCounted


func _lab() -> MapGrid:
	return MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))


func test_los_clear_in_open_room_and_blocked_by_walls() -> String:
	var grid: MapGrid = MapGrid.from_text("#######\n#.....#\n#.###.#\n#.....#\n#######")
	if not GridLos.clear(grid, grid.cell_center(Vector2i(1, 1)), grid.cell_center(Vector2i(5, 1))):
		return "Open corridor should be visible"
	if GridLos.clear(grid, grid.cell_center(Vector2i(3, 1)), grid.cell_center(Vector2i(3, 3))):
		return "Wall between rows should block sight"
	if GridLos.clear(grid, grid.cell_center(Vector2i(1, 1)), grid.cell_center(Vector2i(5, 3))):
		return "Diagonal through the middle wall should be blocked"
	return ""


func test_los_blocks_diagonal_corner_gaps() -> String:
	var grid: MapGrid = MapGrid.from_text("####\n#.##\n##.#\n####")
	if GridLos.clear(grid, grid.cell_center(Vector2i(1, 1)), grid.cell_center(Vector2i(2, 2))):
		return "Sight leaked through a diagonal corner gap"
	return ""


func test_los_is_symmetric_on_lab_a() -> String:
	var grid: MapGrid = _lab()
	var cells: Array[Vector2i] = grid.cells_of(".")
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 31
	for index: int in 400:
		var a: Vector2 = grid.cell_center(cells[rng.randi_range(0, cells.size() - 1)])
		var b: Vector2 = grid.cell_center(cells[rng.randi_range(0, cells.size() - 1)])
		if GridLos.clear(grid, a, b) != GridLos.clear(grid, b, a):
			return "Asymmetric sight between %s and %s" % [a, b]
	return ""


func test_free_distance_stops_before_walls() -> String:
	var grid: MapGrid = MapGrid.from_text("######\n#....#\n######")
	var start: Vector2 = grid.cell_center(Vector2i(1, 1))
	var free: float = GridLos.free_distance(grid, start, Vector2.RIGHT, 20.0, 0.5)
	# Wall face at x = 10 m; circle centre can reach 9.5 m, start is at 3 m.
	if absf(free - 6.5) > 0.11:
		return "Expected about 6.5 m free, got %.2f" % free
	if GridLos.free_distance(grid, start, Vector2.RIGHT, 2.0, 0.5) != 2.0:
		return "Free distance should cap at the maximum"
	return ""


func test_flow_field_reaches_target_from_every_cell() -> String:
	var grid: MapGrid = _lab()
	var targets: Array[Vector2i] = grid.cells_of("E")
	var field: FlowField = FlowField.build(grid, targets)
	for cy: int in grid.height:
		for cx: int in grid.width:
			var cell: Vector2i = Vector2i(cx, cy)
			if grid.is_wall(cx, cy):
				if field.distance(cell) != FlowField.UNREACHABLE:
					return "Wall cell %s has a distance" % cell
				continue
			var steps: int = 0
			while field.distance(cell) > 0:
				var next: Vector2i = field.next_cell(cell)
				if next == cell or field.distance(next) != field.distance(cell) - 1:
					return "Flow field does not descend at %s" % cell
				cell = next
				steps += 1
				if steps > 400:
					return "Flow field loops"
			if not targets.has(cell):
				return "Flow field ended away from the airlock at %s" % cell
	var spawn: Vector2i = grid.cells_of("P")[0]
	if field.distance(spawn) < 18 or field.distance(spawn) > 30:
		return "Spawn to airlock distance looks wrong: %d" % field.distance(spawn)
	return ""


func test_circle_following_flow_field_arrives() -> String:
	var grid: MapGrid = _lab()
	var den: Vector2i = grid.cells_of("M")[0]
	var target: Vector2i = grid.cells_of("P")[0]
	var field: FlowField = FlowField.build(grid, [target])
	var position: Vector2 = grid.cell_center(den)
	for tick: int in 30 * 60:
		var direction: Vector2 = field.steer(position)
		if direction == Vector2.ZERO:
			return ""
		position = GridMove.move_circle(grid, position, direction * 3.0 / 30.0, Tuning.SLIME_RADIUS)
	return "A slime-sized circle got stuck at %s" % position
