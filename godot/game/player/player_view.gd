class_name PlayerView
extends Node3D

var state: PlayerState = PlayerState.new()
var grid: MapGrid
var yaw: float = -PI / 2.0
var pitch: float = 0.0
var horizontal_fov: float = Tuning.DEFAULT_FOV
var input_enabled: bool = true
var reduce_motion: bool = false
var mouse_sensitivity: float = Tuning.MOUSE_SENSITIVITY
var invert_y: bool = false
var head_bob: bool = false
var toggle_fire: bool = false
var _fire_latched: bool = false
var _bob_phase: float = 0
var _camera_kick: float = 0
var _look_delta: Vector2 = Vector2.ZERO
var _look_activity: bool = false
var _interact_queued: bool = false

@onready var camera: Camera3D = $Camera3D


func _ready() -> void:
	camera.position.y = Tuning.EYE_HEIGHT
	camera.keep_aspect = Camera3D.KEEP_WIDTH
	camera.cull_mask = 1
	var body: InternView = InternView.new()
	add_child(body)
	body.build(1, false, true)
	set_horizontal_fov(horizontal_fov)
	if DisplayServer.get_name() != "headless" and not "--capture" in OS.get_cmdline_user_args():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func configure(map: MapGrid, spawn: Vector2) -> void:
	grid = map
	state.teleport(spawn)
	position = Vector3(spawn.x, 0, spawn.y)


func read_input() -> PlayerInput:
	var input: PlayerInput = PlayerInput.new()
	input.yaw = yaw
	if input_enabled and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		input.look_changed = _look_activity
		input.move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
		input.interact = _interact_queued
		input.fire = _fire_latched if toggle_fire else Input.is_action_pressed("fire")
		input.throw_grenade = Input.is_action_just_pressed("throw")
		input.ping = Input.is_action_just_pressed("ping")
	else:
		_fire_latched = false
	_interact_queued = false
	_look_activity = false
	return input


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled:
		return
	if toggle_fire and event.is_action_pressed("fire") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_fire_latched = not _fire_latched
	if event.is_action_pressed("pause"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_look_delta += event.screen_relative
		_look_activity = true
	elif event.is_action_pressed("interact") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_interact_queued = true
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _process(delta: float) -> void:
	yaw -= _look_delta.x * mouse_sensitivity
	pitch = clampf(pitch - _look_delta.y * mouse_sensitivity * (-1.0 if invert_y else 1.0), -Tuning.MAX_LOOK_PITCH, Tuning.MAX_LOOK_PITCH)
	_look_delta = Vector2.ZERO
	rotation.y = yaw
	if reduce_motion:
		_camera_kick = 0
	camera.rotation.x = clampf(pitch + _camera_kick, -Tuning.MAX_LOOK_PITCH, Tuning.MAX_LOOK_PITCH)
	_camera_kick = move_toward(_camera_kick, 0, deg_to_rad(Tuning.CAMERA_KICK_DECAY) * delta)
	if head_bob and not reduce_motion and state.position.distance_squared_to(state.previous_position) > 0.0001:
		_bob_phase += delta * Tuning.HEAD_BOB_RATE
		camera.position.y = Tuning.EYE_HEIGHT + sin(_bob_phase) * Tuning.HEAD_BOB_AMPLITUDE
	else:
		camera.position.y = Tuning.EYE_HEIGHT
	var at: Vector2 = state.previous_position.lerp(state.position, Engine.get_physics_interpolation_fraction())
	position = Vector3(at.x, 0, at.y)


func set_horizontal_fov(value: float) -> void:
	horizontal_fov = clampf(value, Tuning.MIN_FOV, Tuning.MAX_FOV)
	if is_instance_valid(camera):
		camera.fov = horizontal_fov


func add_camera_kick(degrees: float) -> void:
	if not reduce_motion:
		_camera_kick = clampf(_camera_kick + deg_to_rad(degrees), 0, deg_to_rad(Tuning.MAX_CAMERA_KICK_DEGREES))
