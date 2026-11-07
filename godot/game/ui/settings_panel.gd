class_name SettingsPanel
extends CanvasLayer

var settings_path: String = SettingsStore.PATH
var _values: Dictionary = {}
var _target: Node
var _root: Control
var _status: Label
var _waiting_action: String = ""
var _was_paused: bool = false
var _previous_mouse_mode: Input.MouseMode = Input.MOUSE_MODE_VISIBLE


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	hide()


func open(scene: Node) -> void:
	if visible:
		return
	_target = scene
	_values = SettingsStore.load_values(settings_path)
	_was_paused = get_tree().paused
	_previous_mouse_mode = Input.mouse_mode
	_build()
	show()
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func close() -> void:
	if not visible:
		return
	_waiting_action = ""
	hide()
	get_tree().paused = _was_paused
	Input.mouse_mode = _previous_mouse_mode


func update_value(key: String, value: Variant) -> void:
	_values[key] = value
	_values = SettingsStore.sanitize(_values)
	SettingsStore.apply_values(_target, _values)
	_status.text = "Saved" if SettingsStore.save_values(_values, settings_path) == OK else "Changes active; settings could not be saved"
	if key == "reduce_motion":
		var bob: CheckButton = _root.find_child("head_bob", true, false)
		bob.disabled = _values["reduce_motion"]


func _input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		if _waiting_action.is_empty():
			close()
		else:
			_waiting_action = ""
			_status.text = "Remap cancelled"
		get_viewport().set_input_as_handled()
		return
	if _waiting_action.is_empty():
		return
	if event is InputEventKey and (event.keycode == KEY_F10 or event.physical_keycode == KEY_F10):
		_status.text = "F10 opens Settings; choose another key"
		get_viewport().set_input_as_handled()
		return
	if (event is InputEventKey and event.pressed and not event.echo) or (event is InputEventMouseButton and event.pressed):
		var bindings: Dictionary = _values["bindings"].duplicate(true)
		bindings[_waiting_action] = SettingsStore.binding_from_event(event)
		var action: String = _waiting_action
		_waiting_action = ""
		update_value("bindings", bindings)
		var button: Button = _root.find_child("Bind_" + action, true, false)
		button.text = SettingsStore.binding_text(action)
		get_viewport().set_input_as_handled()


func _build() -> void:
	if is_instance_valid(_root):
		_root.queue_free()
	_root = Control.new()
	add_child(_root)
	_root.size = get_viewport().get_visible_rect().size
	_root.resized.connect(_layout)
	var shade: ColorRect = ColorRect.new()
	shade.color = Color(0.02, 0.03, 0.04, 0.86)
	_root.add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var frame: PanelContainer = PanelContainer.new()
	frame.name = "Frame"
	_root.add_child(frame)
	frame.anchor_left = 0.5
	frame.anchor_right = 0.5
	frame.anchor_top = 0.5
	frame.anchor_bottom = 0.5
	frame.offset_left = -380
	frame.offset_right = 380
	frame.offset_top = -310
	frame.offset_bottom = 310
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = LevelBuilder.NIGHT
	style.border_color = LevelBuilder.AMBER
	style.set_border_width_all(1)
	style.content_margin_left = 22
	style.content_margin_right = 22
	style.content_margin_top = 18
	style.content_margin_bottom = 18
	frame.add_theme_stylebox_override("panel", style)
	var column: VBoxContainer = VBoxContainer.new()
	frame.add_child(column)
	column.add_theme_constant_override("separation", 10)
	_text(column, "SETTINGS", 28)
	var tabs: TabContainer = TabContainer.new()
	tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(tabs)
	var display: VBoxContainer = _page(tabs, "DISPLAY")
	_slider(display, "Horizontal field of view", "fov", 75, 110, 1, "degrees")
	var quality: OptionButton = OptionButton.new()
	quality.name = "quality"
	_row(display, "Visual quality").add_child(quality)
	quality.add_item("Low / faster")
	quality.add_item("Medium")
	quality.add_item("High / richer lighting")
	quality.select(_values["quality"])
	quality.item_selected.connect(func(index: int) -> void: update_value("quality", index))
	_check(display, "Reduce motion", "reduce_motion")
	_check(display, "Head bob (off with Reduce Motion)", "head_bob")
	_text(display, "Player numbers and band patterns stay visible at every quality.", 14)
	var controls: VBoxContainer = _page(tabs, "CONTROLS")
	_slider(controls, "Mouse sensitivity", "sensitivity", 0.2, 3, 0.05, "multiplier")
	_check(controls, "Invert mouse Y", "invert_y")
	_check(controls, "Toggle foam fire (default: hold)", "toggle_fire")
	var names: Array[String] = ["Move forward", "Move back", "Move left", "Move right", "Foam spray", "Freeze grenade", "Interact", "Ping", "Pause / cursor"]
	for index: int in SettingsStore.ACTIONS.size():
		var action: String = SettingsStore.ACTIONS[index]
		var button: Button = Button.new()
		button.name = "Bind_" + action
		button.text = SettingsStore.binding_text(action)
		button.custom_minimum_size.x = 260
		_row(controls, names[index]).add_child(button)
		button.pressed.connect(func() -> void:
			_waiting_action = action
			_status.text = "Press a key or mouse button / Esc cancels"
		)
	var sound: VBoxContainer = _page(tabs, "AUDIO")
	_slider(sound, "Master volume", "master_volume", 0, 1, 0.01, "percent")
	_slider(sound, "Effects volume", "sfx_volume", 0, 1, 0.01, "percent")
	_check(sound, "Important sound subtitles", "subtitles")
	_status = _text(column, "Changes save automatically", 14)
	var footer: HBoxContainer = HBoxContainer.new()
	column.add_child(footer)
	var reset: Button = Button.new()
	reset.text = "RESET DEFAULTS"
	reset.custom_minimum_size = Vector2(250, 42)
	footer.add_child(reset)
	reset.pressed.connect(func() -> void:
		_values = SettingsStore.defaults()
		SettingsStore.apply_values(_target, _values)
		SettingsStore.save_values(_values, settings_path)
		_build()
	)
	var done: Button = Button.new()
	done.name = "Close"
	done.text = "CLOSE"
	done.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(done)
	done.pressed.connect(close)
	var bob: CheckButton = _root.find_child("head_bob", true, false)
	bob.disabled = _values["reduce_motion"]
	_layout()


func _process(_delta: float) -> void:
	if visible:
		_root.size = get_viewport().get_visible_rect().size


func _layout() -> void:
	if not is_instance_valid(_root):
		return
	var frame: Control = _root.get_node_or_null("Frame")
	if frame != null:
		frame.scale = Vector2.ONE * minf(1, minf(_root.size.x / 800, _root.size.y / 660))
		frame.pivot_offset = Vector2(380, 310)


func _page(tabs: TabContainer, label: String) -> VBoxContainer:
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.name = label
	tabs.add_child(scroll)
	var page: VBoxContainer = VBoxContainer.new()
	page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	page.add_theme_constant_override("separation", 6)
	scroll.add_child(page)
	return page


func _row(parent: VBoxContainer, label: String) -> HBoxContainer:
	var row: HBoxContainer = HBoxContainer.new()
	row.custom_minimum_size.y = 38
	parent.add_child(row)
	var text: Label = _text(row, label, 15)
	text.custom_minimum_size.x = 270
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return row


func _slider(page: VBoxContainer, label: String, key: String, minimum: float, maximum: float, step: float, mode: String) -> void:
	var row: HBoxContainer = _row(page, label)
	var slider: HSlider = HSlider.new()
	slider.name = key
	slider.custom_minimum_size.x = 250
	slider.min_value = minimum
	slider.max_value = maximum
	slider.step = step
	slider.value = _values[key]
	row.add_child(slider)
	var value: Label = _text(row, _value_text(slider.value, mode), 15)
	value.custom_minimum_size.x = 70
	slider.value_changed.connect(func(number: float) -> void:
		value.text = _value_text(number, mode)
		update_value(key, number)
	)


func _check(page: VBoxContainer, label: String, key: String) -> void:
	var button: CheckButton = CheckButton.new()
	button.name = key
	button.button_pressed = _values[key]
	button.text = "ON" if button.button_pressed else "OFF"
	button.custom_minimum_size.x = 100
	_row(page, label).add_child(button)
	button.toggled.connect(func(enabled: bool) -> void:
		button.text = "ON" if enabled else "OFF"
		update_value(key, enabled)
	)


func _text(parent: Node, value: String, size: int) -> Label:
	var label: Label = Label.new()
	label.text = value
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", LevelBuilder.AMBER)
	parent.add_child(label)
	return label


func _value_text(value: float, mode: String) -> String:
	if mode == "degrees":
		return "%d°" % roundi(value)
	if mode == "percent":
		return "%d%%" % roundi(value * 100)
	return "%.2fx" % value
