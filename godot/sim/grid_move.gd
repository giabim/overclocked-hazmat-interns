class_name GridMove
extends RefCounted
## Shared server/client circle movement. Substeps prevent wall tunneling.


static func hits_wall(grid: MapGrid, position: Vector2, radius: float = Tuning.PLAYER_RADIUS) -> bool:
	var size: float = Tuning.CELL_SIZE
	var x0: int = floori((position.x - radius) / size)
	var x1: int = floori((position.x + radius) / size)
	var y0: int = floori((position.y - radius) / size)
	var y1: int = floori((position.y + radius) / size)
	for cy: int in range(y0, y1 + 1):
		for cx: int in range(x0, x1 + 1):
			if not grid.is_wall(cx, cy):
				continue
			var nearest: Vector2 = Vector2(
				clampf(position.x, cx * size, (cx + 1) * size),
				clampf(position.y, cy * size, (cy + 1) * size)
			)
			if position.distance_squared_to(nearest) < radius * radius:
				return true
	return false


static func move_circle(
	grid: MapGrid, position: Vector2, displacement: Vector2,
	radius: float = Tuning.PLAYER_RADIUS
) -> Vector2:
	var steps: int = maxi(1, ceili(displacement.length() / Tuning.MOVE_MAX_STEP))
	var step: Vector2 = displacement / steps
	for _index: int in steps:
		if not hits_wall(grid, Vector2(position.x + step.x, position.y), radius):
			position.x += step.x
		if not hits_wall(grid, Vector2(position.x, position.y + step.y), radius):
			position.y += step.y
	return position
