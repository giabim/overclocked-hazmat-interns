class_name LabMinimap
extends Control

var state: GameState


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
	var at: Vector2 = origin + state.player.position / Tuning.CELL_SIZE * scale
	draw_circle(at, 3.2, Color.WHITE)
	var names: Array[String] = ["W-01", "E-01", "N-01", "S-01"]
	for index: int in 4:
		draw_string(ThemeDB.fallback_font, Vector2(14 + index * 52, 182), names[index], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, LevelBuilder.WING_COLORS[index])
