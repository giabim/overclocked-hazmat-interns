class_name GrenadePickup
extends RefCounted
## A freeze-grenade crate on a `G` cell.

var id: int = 0
var position: Vector2 = Vector2.ZERO
var available: bool = true
var respawn_remaining: float = 0.0
