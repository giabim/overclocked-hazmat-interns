class_name MapGrid
extends RefCounted
## ASCII map data. Every non-wall cell is traversable; outside is solid.

var width: int = 0
var height: int = 0
var _rows: PackedStringArray = PackedStringArray()
var _blocked: Dictionary = {}
## Bumped whenever a cell is blocked or unblocked, so cached flow fields can be rebuilt.
var version: int = 0


static func from_text(text: String) -> MapGrid:
	var rows: PackedStringArray = text.replace("\r", "").strip_edges().split("\n")
	if rows.is_empty() or rows[0].is_empty():
		return null
	var grid: MapGrid = MapGrid.new()
	grid.width = rows[0].length()
	grid.height = rows.size()
	for row: String in rows:
		if row.length() != grid.width:
			return null
		for symbol: String in row:
			if not "#.+CGMPE".contains(symbol):
				return null
	grid._rows = rows
	return grid


func cell(cx: int, cy: int) -> String:
	if cx < 0 or cy < 0 or cx >= width or cy >= height:
		return "#"
	return _rows[cy].substr(cx, 1)


func is_wall(cx: int, cy: int) -> bool:
	return cell(cx, cy) == "#" or _blocked.has(Vector2i(cx, cy))


func set_blocked(at: Vector2i, blocked: bool) -> void:
	version += 1
	if blocked:
		_blocked[at] = true
	else:
		_blocked.erase(at)


func cells_of(symbol: String) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for cy: int in height:
		for cx: int in width:
			if cell(cx, cy) == symbol:
				result.append(Vector2i(cx, cy))
	return result


func cell_center(position: Vector2i) -> Vector2:
	return (Vector2(position) + Vector2(0.5, 0.5)) * Tuning.CELL_SIZE
