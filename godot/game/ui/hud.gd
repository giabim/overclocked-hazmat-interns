class_name ShiftHUD
extends CanvasLayer

signal restart_requested
signal menu_requested
signal settings_requested
signal orientation_requested

var caption_label: Label

var _heat: ProgressBar
var _heat_text: Label
var _count: Label
var _carry: Label
var _prompt: Label
var _flash: Label
var _flash_remaining: float = 0
var _map: LabMinimap
var _results: Panel
var _result_title: Label
var _result_details: Label
var _menu: Panel
var _menu_help: Label
var _shown_results: bool = false
var _root: Control
var _tools: Label
var _card: Panel
var _card_text: Label
var _card_remaining: float = 0
var _overlay: ColorRect
var _overlay_remaining: float = 0
var _arrow_layer: Control
## Each arrow: {"angle": float, "color": Color, "remaining": float}
var _arrows: Array[Dictionary] = []
var _state: GameState
## Lobby choice (M4.3): number of bots 0–7 and level 1–3, or 4 = mixed (1, 2, 3, 1, …).
var bot_count: int = 0
var bot_level: int = 2
var bot_overrides: Dictionary = {}
var _bots_label: Label
var _level_button: Button
var _per_bot_button: Button
var _bot_editor: Panel
var _bot_rows: Array[Control] = []
var _bot_level_buttons: Array[Button] = []


func _ready() -> void:
	$Title.add_theme_font_size_override("font_size", 28)
	$Title.position = Vector2(28, 22)
	$Debug.position = Vector2(28, 62)
	$Debug.add_theme_font_size_override("font_size", 12)
	_root = Control.new()
	add_child(_root)
	_root.size = get_viewport().get_visible_rect().size
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var temperature: Panel = _panel(_root, Vector2(-175, 22), Vector2(350, 78), Vector2(0.5, 0))
	_label(temperature, "LAB TEMPERATURE", Vector2(16, 9), Vector2(230, 22), 13)
	_heat_text = _label(temperature, "0%", Vector2(278, 9), Vector2(56, 22), 16)
	_heat = ProgressBar.new()
	temperature.add_child(_heat)
	_heat.position = Vector2(16, 42)
	_heat.size = Vector2(318, 12)
	_heat.show_percentage = false
	_heat.add_theme_stylebox_override("background", _style(Color("30383c")))
	_heat.add_theme_stylebox_override("fill", _style(Color("ff5a1f")))
	var navigation: Panel = _panel(_root, Vector2(-258, 22), Vector2(230, 198), Vector2(1, 0))
	_label(navigation, "LAB A / FACILITY MAP", Vector2(14, 12), Vector2(212, 22), 13)
	_map = LabMinimap.new()
	navigation.add_child(_map)
	_map.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_map.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var inventory: Panel = _panel(_root, Vector2(28, -108), Vector2(340, 80), Vector2(0, 1))
	_count = _label(inventory, "COOLANT  0 / 3", Vector2(16, 10), Vector2(320, 26), 22)
	_carry = _label(inventory, "[ ] EMPTY HANDS", Vector2(16, 44), Vector2(320, 24), 14)
	_carry.add_theme_color_override("font_color", Color.WHITE)
	var tools: Panel = _panel(_root, Vector2(28, -168), Vector2(340, 52), Vector2(0, 1))
	_tools = _label(tools, "FOAM", Vector2(16, 12), Vector2(320, 26), 16)
	_overlay = ColorRect.new()
	_root.add_child(_overlay)
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.color = Color(0.45, 0.47, 0.5, 0)
	_arrow_layer = Control.new()
	_root.add_child(_arrow_layer)
	_arrow_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_arrow_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_arrow_layer.draw.connect(_draw_arrows)
	_card = _panel(_root, Vector2(-290, 160), Vector2(580, 56), Vector2(0.5, 0))
	_card_text = _label(_card, "", Vector2(14, 14), Vector2(552, 28), 17)
	_card_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card_text.add_theme_color_override("font_color", Color("ff5a1f"))
	_card.hide()
	_prompt = _label(_root, "", Vector2(-250, -94), Vector2(500, 28), 17, Vector2(0.5, 1))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_flash = _label(_root, "", Vector2(-300, 110), Vector2(600, 40), 22, Vector2(0.5, 0))
	_flash.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_flash.add_theme_color_override("font_color", Color.WHITE)
	caption_label = _label(_root, "", Vector2(-280, -150), Vector2(560, 28), 14, Vector2(0.5, 1))
	caption_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption_label.add_theme_color_override("font_color", Color.WHITE)
	_button(_root, "SETTINGS [F10]", Vector2(28, 88), Vector2(150, 30), func() -> void: settings_requested.emit())
	var crosshair: Label = _label(_root, "+", Vector2(-10, -15), Vector2(20, 30), 20, Vector2(0.5, 0.5))
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_results = _panel(_root, Vector2(-240, -176), Vector2(480, 352), Vector2(0.5, 0.5))
	_results.mouse_filter = Control.MOUSE_FILTER_STOP
	_result_title = _label(_results, "SHIFT COMPLETE", Vector2(28, 26), Vector2(424, 48), 32)
	_result_details = _label(_results, "", Vector2(28, 92), Vector2(424, 138), 18)
	_result_details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_button(_results, "PLAY AGAIN", Vector2(28, 270), Vector2(202, 48), _restart)
	_button(_results, "MAIN MENU", Vector2(248, 270), Vector2(202, 48), _open_menu)
	_results.hide()
	_menu = _panel(_root, Vector2(-240, -240), Vector2(480, 480), Vector2(0.5, 0.5))
	_menu.mouse_filter = Control.MOUSE_FILTER_STOP
	_label(_menu, "OVERCLOCKED", Vector2(28, 28), Vector2(424, 48), 32)
	_label(_menu, "THE HAZMAT INTERNS / SHIFT SETUP", Vector2(28, 83), Vector2(424, 24), 14)
	_bots_label = _label(_menu, "", Vector2(28, 126), Vector2(220, 30), 18)
	_button(_menu, "-", Vector2(300, 122), Vector2(70, 38), func() -> void: _change_bots(-1))
	_button(_menu, "+", Vector2(382, 122), Vector2(70, 38), func() -> void: _change_bots(1))
	_level_button = _button(_menu, "", Vector2(28, 170), Vector2(296, 38), _cycle_level)
	_per_bot_button = _button(_menu, "PER BOT", Vector2(336, 170), Vector2(116, 38), _open_bot_editor)
	var start: Button = _button(_menu, "START SHIFT", Vector2(28, 230), Vector2(424, 48), _restart)
	start.name = "StartShift"
	_button(_menu, "SETTINGS", Vector2(28, 288), Vector2(424, 42), func() -> void: settings_requested.emit())
	_button(_menu, "REPLAY ORIENTATION", Vector2(28, 338), Vector2(424, 42), func() -> void: orientation_requested.emit())
	_menu_help = _label(_menu, "", Vector2(28, 398), Vector2(424, 56), 14)
	_build_bot_editor()
	_refresh_lobby()
	_menu_help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_menu.hide()


func sync(state: GameState, delta: float) -> void:
	_state = state
	_root.size = get_viewport().get_visible_rect().size
	var grenade: String = "[%s] FREEZE GRENADE" % SettingsStore.binding_text("throw") if state.player.has_grenade else "NO GRENADE"
	_tools.text = "FOAM %d / %d   ·   %s" % [state.player.foam_charges, Tuning.FOAM_MAX_CHARGES, grenade]
	_card_remaining = maxf(0, _card_remaining - delta)
	_card.visible = _card_remaining > 0
	_overlay_remaining = maxf(0, _overlay_remaining - delta)
	_overlay.color.a = 0.45 * _overlay_remaining
	for arrow: Dictionary in _arrows:
		arrow["remaining"] = float(arrow["remaining"]) - delta
	_arrows = _arrows.filter(func(arrow: Dictionary) -> bool: return float(arrow["remaining"]) > 0)
	_arrow_layer.queue_redraw()
	_map.blip_strength = maxf(0, _map.blip_strength - delta)
	_heat.value = state.heat
	_heat_text.text = "%d%%" % ceili(state.heat)
	_count.text = "COOLANT  %d / %d" % [state.delivered, state.quota()]
	_carry.text = "[+] CARRYING COOLANT" if state.player.carrying >= 0 else "[ ] EMPTY HANDS"
	_carry.modulate = LevelBuilder.COOLANT if state.player.carrying >= 0 else Color("a5afb4")
	_prompt.text = "FIND COOLANT / CYAN CANISTERS"
	_menu_help.text = "%s move · mouse look · %s interact · %s cursor" % [SettingsStore.movement_binding_text(), SettingsStore.binding_text("interact"), SettingsStore.binding_text("pause")]
	var interact_key: String = SettingsStore.binding_text("interact")
	if state.player.is_stunned():
		_prompt.text = "CAUGHT / RECOVERING"
	elif state.phase == GameState.Phase.EXTRACTION:
		_prompt.text = "EXTRACT AT AIRLOCK / %ds" % ceili(state.extraction_remaining)
	elif state.player.carrying >= 0:
		_prompt.text = "[%s] DELIVER COOLANT / HEAT -6%%" % interact_key if Rules.at_airlock(state) else "CARRY TO AIRLOCK / EAST WING"
	else:
		for canister: CanisterState in state.canisters:
			if canister.available and state.player.position.distance_to(canister.position) <= Tuning.INTERACT_RANGE:
				_prompt.text = "[%s] PICK UP COOLANT" % interact_key
				break
	_map.state = state
	_map.queue_redraw()
	_flash_remaining = maxf(0, _flash_remaining - delta)
	_flash.visible = _flash_remaining > 0
	if state.finished() and not _shown_results:
		_shown_results = true
		_results.show()
		_result_title.text = "SHIFT COMPLETE" if state.phase == GameState.Phase.SUCCESS else "SHIFT FAILED"
		_result_details.text = "TEAM SCORE  %d\nCOOLANT  %d / %d\nSHIFT TIME  %ds\n%s" % [state.score, state.delivered, state.quota(), roundi(state.elapsed), "LAB STABLE / ALL CLEAR" if state.phase == GameState.Phase.SUCCESS else state.failure_reason]
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func feedback(kind: StringName, data: Dictionary = {}) -> void:
	var messages: Dictionary = {
		&"ping": "INTERN %02d / HERE" % (int(data.get("player", 0)) + 1),
		&"pickup": "COOLANT SECURED", &"delivery": "DELIVERED / HEAT -6%", &"heat_warning": "WARNING / LAB OVERHEATING",
		&"extraction": "QUOTA MET / EXTRACT NOW", &"contained": "+%d CONTAINED" % Tuning.CONTAIN_SCORE,
		&"grenade_pickup": "FREEZE GRENADE / [%s] TO THROW" % SettingsStore.binding_text("throw"),
		&"canister_dropped": "COOLANT DROPPED / PICK IT UP AGAIN",
	}
	if messages.has(kind):
		_flash.text = messages[kind]
		_flash.modulate = LevelBuilder.AMBER if kind in [&"heat_warning", &"canister_dropped"] else LevelBuilder.COOLANT
		_flash_remaining = 1.5
	match kind:
		&"caught":
			_card_text.text = caught_text(data)
			_card_remaining = 2.5
			_overlay_remaining = 1.0
			_arrows.append({"angle": float(data.get("from_angle", 0.0)), "color": Color("ff5a1f"), "remaining": 1.5})
		&"hound_notice", &"hound_windup":
			var at: Variant = data.get("position")
			if _state != null and at is Vector3:
				var offset: Vector2 = Vector2(at.x, at.z) - _state.player.position
				_arrows.append({"angle": _state.player.facing().angle_to(offset), "color": LevelBuilder.AMBER, "remaining": 1.2})
		&"sensor_sweep":
			_map.blips = data.get("blips", [] as Array[Vector2])
			_map.blip_strength = 1.0


## "Caught by Spark Hound — it dashed from the left" (design.md §3.5).
static func caught_text(data: Dictionary) -> String:
	var specimen: String = "SPARK HOUND" if data.get("specimen") == &"hound" else "GOO SLIME"
	var how: String = "IT DASHED" if data.get("how") == &"dashed" else "IT TOUCHED YOU"
	return "CAUGHT BY %s — %s %s" % [specimen, how, direction_words(float(data.get("from_angle", 0.0)))]


## from_angle: 0 = in front, +PI/2 = right, -PI/2 = left, ±PI = behind.
static func direction_words(angle: float) -> String:
	var size: float = absf(wrapf(angle, -PI, PI))
	if size <= PI / 4.0:
		return "FROM THE FRONT"
	if size >= PI * 0.75:
		return "FROM BEHIND"
	return "FROM THE RIGHT" if wrapf(angle, -PI, PI) > 0 else "FROM THE LEFT"


func _draw_arrows() -> void:
	var area: Vector2 = _arrow_layer.size
	var centre: Vector2 = area / 2.0
	for arrow: Dictionary in _arrows:
		var angle: float = float(arrow["angle"])
		var direction: Vector2 = Vector2(sin(angle), -cos(angle))
		var tip: Vector2 = centre + Vector2(direction.x * area.x * 0.44, direction.y * area.y * 0.4)
		var side: Vector2 = Vector2(-direction.y, direction.x) * 16.0
		var base: Vector2 = tip - direction * 30.0
		var color: Color = arrow["color"]
		color.a = clampf(float(arrow["remaining"]) * 1.5, 0, 1)
		_arrow_layer.draw_colored_polygon(PackedVector2Array([tip, base + side, base - side]), color)


func _restart() -> void:
	_results.hide()
	_menu.hide()
	_shown_results = false
	_flash_remaining = 0
	_card_remaining = 0
	_overlay_remaining = 0
	_arrows.clear()
	restart_requested.emit()


func _open_menu() -> void:
	_results.hide()
	_menu.show()
	menu_requested.emit()


func _panel(parent: Node, at: Vector2, dimensions: Vector2, anchor: Vector2) -> Panel:
	var panel: Panel = Panel.new()
	parent.add_child(panel)
	panel.anchor_left = anchor.x
	panel.anchor_right = anchor.x
	panel.anchor_top = anchor.y
	panel.anchor_bottom = anchor.y
	panel.offset_left = at.x
	panel.offset_top = at.y
	panel.offset_right = at.x + dimensions.x
	panel.offset_bottom = at.y + dimensions.y
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = _style(Color(0.078, 0.09, 0.102, 0.94))
	style.border_color = Color(0.95, 0.66, 0, 0.45)
	style.set_border_width_all(1)
	panel.add_theme_stylebox_override("panel", style)
	return panel


func _label(parent: Node, text: String, at: Vector2, dimensions: Vector2, font_size: int, anchor: Vector2 = Vector2.ZERO) -> Label:
	var label: Label = Label.new()
	parent.add_child(label)
	label.anchor_left = anchor.x
	label.anchor_right = anchor.x
	label.anchor_top = anchor.y
	label.anchor_bottom = anchor.y
	label.offset_left = at.x
	label.offset_top = at.y
	label.offset_right = at.x + dimensions.x
	label.offset_bottom = at.y + dimensions.y
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", LevelBuilder.AMBER)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


## Levels for GameState.create: one entry per bot.
func bot_levels() -> Array[int]:
	var levels: Array[int] = []
	for index: int in clampi(bot_count, 0, Tuning.MAX_BOTS):
		var base: int = index % 3 + 1 if bot_level == 4 else clampi(bot_level, 1, 3)
		levels.append(clampi(bot_overrides.get(index, base), 1, 3))
	return levels


func set_bot_count(count: int) -> void:
	bot_count = clampi(count, 0, Tuning.MAX_BOTS)
	for index: int in bot_overrides.keys():
		if index >= bot_count:
			bot_overrides.erase(index)
	if is_node_ready():
		_refresh_lobby()


func set_level_preset(level: int) -> void:
	bot_level = clampi(level, 1, 4)
	bot_overrides.clear()
	if is_node_ready():
		_refresh_lobby()


func set_bot_level(index: int, level: int) -> void:
	if index < 0 or index >= bot_count or index >= Tuning.MAX_BOTS:
		return
	bot_overrides[index] = clampi(level, 1, 3)
	if is_node_ready():
		_refresh_lobby()


func _change_bots(step: int) -> void:
	set_bot_count(bot_count + step)


func _cycle_level() -> void:
	set_level_preset(bot_level % 4 + 1)


func _refresh_lobby() -> void:
	_bots_label.text = "BOTS  %d / %d" % [bot_count, Tuning.MAX_BOTS]
	var names: Array[String] = ["LV1 TRAINEE", "LV2 TECHNICIAN", "LV3 SUPERVISOR", "MIXED LV1-3"]
	_level_button.text = "TEAM: CUSTOM" if not bot_overrides.is_empty() else "TEAM: %s" % names[clampi(bot_level, 1, 4) - 1]
	_level_button.disabled = bot_count == 0
	_per_bot_button.disabled = bot_count == 0
	var levels: Array[int] = bot_levels()
	for index: int in _bot_rows.size():
		_bot_rows[index].visible = index < levels.size()
		if index < levels.size():
			_bot_level_buttons[index].text = names[levels[index] - 1]


func _build_bot_editor() -> void:
	_bot_editor = _panel(_root, Vector2(-240, -224), Vector2(480, 448), Vector2(0.5, 0.5))
	_bot_editor.mouse_filter = Control.MOUSE_FILTER_STOP
	_label(_bot_editor, "BOT LEVELS", Vector2(28, 20), Vector2(424, 38), 28)
	_label(_bot_editor, "Choose a level for each intern", Vector2(28, 62), Vector2(424, 24), 14)
	for index: int in Tuning.MAX_BOTS:
		var row: Control = Control.new()
		_bot_editor.add_child(row)
		row.position = Vector2(28, 92 + index * 40)
		row.size = Vector2(424, 34)
		_label(row, "INTERN %02d" % (index + 2), Vector2(0, 4), Vector2(140, 28), 18)
		var level: Button = _button(row, "", Vector2(148, 0), Vector2(276, 34), func() -> void:
			set_bot_level(index, bot_levels()[index] % 3 + 1)
		)
		_bot_rows.append(row)
		_bot_level_buttons.append(level)
	var done: Button = _button(_bot_editor, "DONE", Vector2(28, 392), Vector2(424, 38), _close_bot_editor)
	done.name = "Done"
	_bot_editor.hide()


func _open_bot_editor() -> void:
	_refresh_lobby()
	_menu.hide()
	_bot_editor.show()


func _close_bot_editor() -> void:
	_bot_editor.hide()
	_menu.show()


func modal_open() -> bool:
	return _menu.visible or _bot_editor.visible or _results.visible


func _button(parent: Node, text: String, at: Vector2, dimensions: Vector2, callback: Callable) -> Button:
	var button: Button = Button.new()
	parent.add_child(button)
	button.position = at
	button.size = dimensions
	button.text = text
	button.add_theme_font_size_override("font_size", 18)
	button.add_theme_color_override("font_color", LevelBuilder.AMBER)
	button.add_theme_stylebox_override("normal", _style(Color("30383c")))
	button.add_theme_stylebox_override("hover", _style(Color("47545b")))
	button.pressed.connect(callback)
	return button


func _style(color: Color) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = color
	return style
