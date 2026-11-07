class_name GridLos
extends RefCounted
## Line of sight and free distance on the map grid. Units: meters.
## Sight is blocked by any wall cell on the segment, including diagonal corner gaps.


static func cell_of(position: Vector2) -> Vector2i:
	return Vector2i((position / Tuning.CELL_SIZE).floor())


static func clear(grid: MapGrid, from: Vector2, to: Vector2) -> bool:
	var cell: Vector2i = cell_of(from)
	var end: Vector2i = cell_of(to)
	if grid.is_wall(cell.x, cell.y) or grid.is_wall(end.x, end.y):
		return false
	var delta: Vector2 = to - from
	var size: float = Tuning.CELL_SIZE
	var step_x: int = 1 if delta.x > 0 else -1
	var step_y: int = 1 if delta.y > 0 else -1
	var t_delta_x: float = INF if is_zero_approx(delta.x) else absf(size / delta.x)
	var t_delta_y: float = INF if is_zero_approx(delta.y) else absf(size / delta.y)
	var t_max_x: float = INF
	var t_max_y: float = INF
	if not is_zero_approx(delta.x):
		t_max_x = ((cell.x + (1 if step_x > 0 else 0)) * size - from.x) / delta.x
	if not is_zero_approx(delta.y):
		t_max_y = ((cell.y + (1 if step_y > 0 else 0)) * size - from.y) / delta.y
	while cell != end:
		if is_equal_approx(t_max_x, t_max_y):
			if t_max_x > 1.0:
				break
			# Passing exactly through a corner: both side cells must be open.
			if grid.is_wall(cell.x + step_x, cell.y) or grid.is_wall(cell.x, cell.y + step_y):
				return false
			cell += Vector2i(step_x, step_y)
			t_max_x += t_delta_x
			t_max_y += t_delta_y
		elif t_max_x < t_max_y:
			if t_max_x > 1.0:
				break
			cell.x += step_x
			t_max_x += t_delta_x
		else:
			if t_max_y > 1.0:
				break
			cell.y += step_y
			t_max_y += t_delta_y
		if grid.is_wall(cell.x, cell.y):
			return false
	return true


## How far a circle of `radius` can travel along `direction` before touching a wall.
static func free_distance(
	grid: MapGrid, from: Vector2, direction: Vector2, max_distance: float,
	radius: float = 0.0
) -> float:
	var unit: Vector2 = direction.normalized()
	if unit == Vector2.ZERO:
		return 0.0
	var travelled: float = 0.0
	while travelled < max_distance:
		var next: float = minf(max_distance, travelled + 0.1)
		var probe: Vector2 = from + unit * next
		var blocked: bool = GridMove.hits_wall(grid, probe, radius) if radius > 0.0 \
			else grid.is_wall(cell_of(probe).x, cell_of(probe).y)
		if blocked:
			return travelled
		travelled = next
	return max_distance
