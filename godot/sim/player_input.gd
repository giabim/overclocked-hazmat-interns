class_name PlayerInput
extends RefCounted
## Humans, bots and later RPCs use this same input record.

var move: Vector2 = Vector2.ZERO
var yaw: float = 0.0
var look_changed: bool = false
var interact: bool = false
var fire: bool = false
var throw_grenade: bool = false
var ping: bool = false
