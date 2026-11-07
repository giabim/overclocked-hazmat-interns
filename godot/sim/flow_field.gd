class_name FlowField
extends RefCounted
## Breadth-first distance field (4 neighbours) toward one or more target cells.

const UNREACHABLE: int = -1
const NEIGHBOURS: Array[Vector2i] = [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]

var grid: MapGrid
var _distance: PackedInt32Array = PackedInt32Array()


static func build(map: MapGrid, targets: Array[Vector2i]) -> FlowField:
	var field: FlowField = FlowField.new()
	field.grid = map
	field._distance.resize(map.width * map.height)
	field._distance.fill(UNREACHABLE)
	var queue: Array[Vector2i] = []
	for target: Vector2i in targets:
		if field._inside(target) and not map.is_wall(target.x, target.y) and field.distance(target) == UNREACHABLE:
			field._distance[field._index(target)] = 0
			queue.append(target)
	var head: int = 0
	while head < queue.size():
		var current: Vector2i = queue[head]
		head += 1
		var next_distance: int = field.distance(current) + 1
		for offset: Vector2i in NEIGHBOURS:
			var next: Vector2i = current + offset
			if field._inside(next) and not map.is_wall(next.x, next.y) and field.distance(next) == UNREACHABLE:
				field._distance[field._index(next)] = next_distance
				queue.append(next)
	return field


func distance(cell: Vector2i) -> int:
	if not _inside(cell):
		return UNREACHABLE
	return _distance[_index(cell)]


## The neighbouring cell one step closer to a target (the same cell at a target or when unreachable).
func next_cell(cell: Vector2i) -> Vector2i:
	var best: Vector2i = cell
	var best_distance: int = distance(cell)
	if best_distance <= 0:
		return cell
	for offset: Vector2i in NEIGHBOURS:
		var candidate: int = distance(cell + offset)
		if candidate != UNREACHABLE and candidate < best_distance:
			best = cell + offset
			best_distance = candidate
	return best


## Unit direction from `position` toward the next cell centre, or ZERO at a target / unreachable.
func steer(position: Vector2) -> Vector2:
	var cell: Vector2i = GridLos.cell_of(position)
	var next: Vector2i = next_cell(cell)
	if next == cell:
		return Vector2.ZERO
	return (grid.cell_center(next) - position).normalized()


func _inside(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < grid.width and cell.y < grid.height


func _index(cell: Vector2i) -> int:
	return cell.y * grid.width + cell.x
