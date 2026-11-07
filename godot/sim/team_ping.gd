class_name TeamPing
extends RefCounted
## A teammate's own location, not hidden specimen information.

var player_id: int = 0
var position: Vector2 = Vector2.ZERO
var remaining: float = Tuning.PING_LIFETIME_SECONDS
