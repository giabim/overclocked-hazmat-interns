class_name LabMinimap
extends Control

var state: GameState
## Sensor-sweep blips (specimens are otherwise hidden on the map) and their fade.
var blips: Array[Vector2] = []
var blip_strength: float = 0.0


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
	var names: Array[String] = ["W-01", "E-01", "N-01", "S-01"]
	for index: int in 4:
		draw_string(ThemeDB.fallback_font, Vector2(14 + index * 52, 182), names[index], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, LevelBuilder.WING_COLORS[index])
