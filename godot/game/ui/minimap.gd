class_name LabMinimap
extends Control

var state: GameState
## Sensor-sweep blips (specimens are otherwise hidden on the map) and their fade.
var blips: Array[Vector2] = []
var blip_strength: float = 0.0
var _ping_mesh: ArrayMesh = ArrayMesh.new()
const DIGIT_MASKS: Array[int] = [63, 6, 91, 79, 102, 109, 125, 7, 127, 111]
const DIGIT_LINES: Array[Vector4] = [Vector4(0, 0, 3, 0), Vector4(3, 0, 3, 3), Vector4(3, 3, 3, 6), Vector4(0, 6, 3, 6), Vector4(0, 3, 0, 6), Vector4(0, 0, 0, 3), Vector4(0, 3, 3, 3)]


func _draw() -> void:
	if state == null:
		return
	var origin: Vector2 = Vector2(14, 40)
	var scale: float = 8.0
	for cy: int in state.grid.height:
		for cx: int in state.grid.width:
			var cell: Vector2i = Vector2i(cx, cy)
			var color: Color = Color("343b40") if state.grid.is_wall(cx, cy) else LevelBuilder.WING_COLORS[LevelBuilder.wing_at(cell, state.grid)].darkened(0.7)
			draw_rect(Rect2(origin + Vector2(cell) * scale, Vector2.ONE * (scale - 0.5)), color)
	for canister: CanisterState in state.canisters:
		if canister.available:
			draw_circle(origin + canister.position / Tuning.CELL_SIZE * scale, 2.1, LevelBuilder.COOLANT)
	for cell: Vector2i in state.grid.cells_of("E"):
		draw_rect(Rect2(origin + Vector2(cell) * scale, Vector2.ONE * scale), LevelBuilder.COOLANT)
	for pickup: GrenadePickup in state.grenade_pickups:
		if pickup.available:
			draw_rect(Rect2(origin + pickup.position / Tuning.CELL_SIZE * scale - Vector2(2, 2), Vector2(4, 4)), Color("e9e4d8"))
	if blip_strength > 0:
		for blip: Vector2 in blips:
			draw_circle(origin + blip / Tuning.CELL_SIZE * scale, 3.4, Color(1.0, 0.35, 0.12, blip_strength))
	var bands: Array[Color] = [Color("e69f00"), Color("56b4e9"), Color("009e73"), Color("f0e442"), Color("0072b2"), Color("d55e00"), Color("cc79a7"), Color.WHITE]
	for index: int in range(1, state.players.size()):
		var bot: PlayerState = state.players[index]
		draw_circle(origin + bot.position / Tuning.CELL_SIZE * scale, 2.6, bands[bot.id % bands.size()])
	var at: Vector2 = origin + state.player.position / Tuning.CELL_SIZE * scale
	draw_circle(at, 3.2, Color.WHITE)
	_draw_pings(origin, scale)
	var names: Array[String] = ["W-01", "E-01", "N-01", "S-01"]
	for index: int in 4:
		draw_string(ThemeDB.fallback_font, Vector2(14 + index * 52, 182), names[index], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, LevelBuilder.WING_COLORS[index])


func _draw_pings(origin: Vector2, scale: float) -> void:
	if state.pings.is_empty():
		return
	# One draw call for all rings and stencil IDs; individual font/arc calls exceed budget.
	var vertices: Array[Vector3] = []
	var colors: Array[Color] = []
	for ping: TeamPing in state.pings:
		var center: Vector2 = origin + ping.position / Tuning.CELL_SIZE * scale
		var strength: float = clampf(ping.remaining / Tuning.PING_LIFETIME_SECONDS, 0, 1)
		var color: Color = Color(1.0, 0.77, 0.2, strength)
		var radius: float = 5 + (1 - strength) * 4
		for segment: int in 20:
			_stroke(vertices, colors, center + Vector2.from_angle(TAU * segment / 20) * radius, center + Vector2.from_angle(TAU * (segment + 1) / 20) * radius, color)
		var digits: Array[int] = [0, ping.player_id + 1]
		for index: int in 2:
			var at: Vector2 = center + Vector2(6 + index * 5, -5)
			for segment: int in 7:
				if DIGIT_MASKS[digits[index]] & (1 << segment):
					var line: Vector4 = DIGIT_LINES[segment]
					_stroke(vertices, colors, at + Vector2(line.x, line.y), at + Vector2(line.z, line.w), color)
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = PackedVector3Array(vertices)
	arrays[Mesh.ARRAY_COLOR] = PackedColorArray(colors)
	_ping_mesh.clear_surfaces()
	_ping_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	draw_mesh(_ping_mesh, null)


func _exit_tree() -> void:
	RenderingServer.canvas_item_clear(get_canvas_item())


static func _stroke(vertices: Array[Vector3], colors: Array[Color], from: Vector2, to: Vector2, color: Color) -> void:
	var side: Vector2 = (to - from).normalized().orthogonal() * 0.6
	for point: Vector2 in [from + side, to + side, to - side, from + side, to - side, from - side]:
		vertices.append(Vector3(point.x, point.y, 0))
		colors.append(color)
