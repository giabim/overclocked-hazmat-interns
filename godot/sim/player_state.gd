class_name PlayerState
extends RefCounted

var position: Vector2 = Vector2.ZERO
var previous_position: Vector2 = Vector2.ZERO
var carrying: int = -1
var id: int = 0
var yaw: float = 0.0
var foam_charges: int = Tuning.FOAM_MAX_CHARGES
var foam_recharge: float = 0.0
var foam_cooldown: float = 0.0
var has_grenade: bool = false
## Caught: no movement or actions while stunned; no new catch while immune (includes the stun).
var stun_remaining: float = 0.0
var immune_remaining: float = 0.0


func step(grid: MapGrid, input: PlayerInput, delta: float) -> void:
	previous_position = position
	var direction: Vector2 = input.move.limit_length().rotated(-input.yaw)
	var speed: float = Tuning.CARRY_SPEED if carrying >= 0 else Tuning.WALK_SPEED
	position = GridMove.move_circle(grid, position, direction * speed * delta)


func facing() -> Vector2:
	return Vector2.UP.rotated(-yaw)


func is_stunned() -> bool:
	return stun_remaining > 0.0


func hold() -> void:
	previous_position = position


func teleport(destination: Vector2) -> void:
	position = destination
	previous_position = destination
