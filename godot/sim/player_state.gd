class_name PlayerState
extends RefCounted

var position: Vector2 = Vector2.ZERO
var previous_position: Vector2 = Vector2.ZERO
var carrying: int = -1


func step(grid: MapGrid, input: PlayerInput, delta: float) -> void:
	previous_position = position
	var direction: Vector2 = input.move.limit_length().rotated(-input.yaw)
	var speed: float = Tuning.CARRY_SPEED if carrying >= 0 else Tuning.WALK_SPEED
	position = GridMove.move_circle(grid, position, direction * speed * delta)


func teleport(destination: Vector2) -> void:
	position = destination
	previous_position = destination
