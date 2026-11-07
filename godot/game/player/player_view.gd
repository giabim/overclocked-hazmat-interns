class_name PlayerView
extends Node3D

var state: PlayerState = PlayerState.new()
var grid: MapGrid
var yaw: float = -PI / 2.0
var pitch: float = 0.0
var horizontal_fov: float = Tuning.DEFAULT_FOV
var input_enabled: bool = true
var _look_delta: Vector2 = Vector2.ZERO
var _interact_queued: bool = false

@onready var camera: Camera3D = $Camera3D


func _ready() -> void:
	camera.position.y = Tuning.EYE_HEIGHT
	camera.keep_aspect = Camera3D.KEEP_WIDTH
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
		input.move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
		input.interact = _interact_queued
		input.fire = Input.is_action_pressed("fire")
		input.throw_grenade = Input.is_action_just_pressed("throw")
		input.ping = Input.is_action_just_pressed("ping")
	_interact_queued = false
	return input


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled:
		return
	if event.is_action_pressed("pause"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_look_delta += event.screen_relative
	elif event.is_action_pressed("interact") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_interact_queued = true
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _process(_delta: float) -> void:
	yaw -= _look_delta.x * Tuning.MOUSE_SENSITIVITY
	pitch = clampf(pitch - _look_delta.y * Tuning.MOUSE_SENSITIVITY, -Tuning.MAX_LOOK_PITCH, Tuning.MAX_LOOK_PITCH)
	_look_delta = Vector2.ZERO
	rotation.y = yaw
	camera.rotation.x = pitch
	var at: Vector2 = state.previous_position.lerp(state.position, Engine.get_physics_interpolation_fraction())
	position = Vector3(at.x, 0, at.y)


func set_horizontal_fov(value: float) -> void:
	horizontal_fov = clampf(value, Tuning.MIN_FOV, Tuning.MAX_FOV)
	if is_instance_valid(camera):
		camera.fov = horizontal_fov
