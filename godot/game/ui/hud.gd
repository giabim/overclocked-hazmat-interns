class_name ShiftHUD
extends CanvasLayer

signal restart_requested
signal menu_requested

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
var _shown_results: bool = false
var _root: Control


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
	_prompt = _label(_root, "", Vector2(-250, -94), Vector2(500, 28), 17, Vector2(0.5, 1))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_flash = _label(_root, "", Vector2(-300, 110), Vector2(600, 40), 22, Vector2(0.5, 0))
	_flash.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_flash.add_theme_color_override("font_color", Color.WHITE)
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
	_menu = _panel(_root, Vector2(-240, -135), Vector2(480, 270), Vector2(0.5, 0.5))
	_menu.mouse_filter = Control.MOUSE_FILTER_STOP
	_label(_menu, "OVERCLOCKED", Vector2(28, 28), Vector2(424, 48), 32)
	_label(_menu, "THE HAZMAT INTERNS / SOLO PROTOTYPE", Vector2(28, 83), Vector2(424, 24), 14)
	_button(_menu, "START SOLO SHIFT", Vector2(28, 139), Vector2(424, 48), _restart)
	_label(_menu, "WASD move · mouse look · E interact · Esc cursor", Vector2(28, 210), Vector2(424, 32), 14)
	_menu.hide()


func sync(state: GameState, delta: float) -> void:
	_root.size = get_viewport().get_visible_rect().size
	_heat.value = state.heat
	_heat_text.text = "%d%%" % ceili(state.heat)
	_count.text = "COOLANT  %d / %d" % [state.delivered, state.quota()]
	_carry.text = "[+] CARRYING COOLANT" if state.player.carrying >= 0 else "[ ] EMPTY HANDS"
	_carry.modulate = LevelBuilder.COOLANT if state.player.carrying >= 0 else Color("a5afb4")
	_prompt.text = "FIND COOLANT / CYAN CANISTERS"
	if state.phase == GameState.Phase.EXTRACTION:
		_prompt.text = "EXTRACT AT AIRLOCK / %ds" % ceili(state.extraction_remaining)
	elif state.player.carrying >= 0:
		_prompt.text = "[E] DELIVER COOLANT / HEAT -6%" if Rules.at_airlock(state) else "CARRY TO AIRLOCK / EAST WING"
	else:
		for canister: CanisterState in state.canisters:
			if canister.available and state.player.position.distance_to(canister.position) <= Tuning.INTERACT_RANGE:
				_prompt.text = "[E] PICK UP COOLANT"
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


func feedback(kind: StringName) -> void:
	var messages: Dictionary = {&"pickup": "COOLANT SECURED", &"delivery": "DELIVERED / HEAT -6%", &"heat_warning": "WARNING / LAB OVERHEATING", &"extraction": "QUOTA MET / EXTRACT NOW"}
	if messages.has(kind):
		_flash.text = messages[kind]
		_flash.modulate = LevelBuilder.AMBER if kind == &"heat_warning" else LevelBuilder.COOLANT
		_flash_remaining = 1.5


func _restart() -> void:
	_results.hide()
	_menu.hide()
	_shown_results = false
	_flash_remaining = 0
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


func _button(parent: Node, text: String, at: Vector2, dimensions: Vector2, callback: Callable) -> void:
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


func _style(color: Color) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = color
	return style
