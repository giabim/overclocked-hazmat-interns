class_name ThrownGrenade
extends RefCounted
## A thrown freeze grenade waiting for its fuse.

var from: Vector2 = Vector2.ZERO
var position: Vector2 = Vector2.ZERO
var fuse: float = Tuning.GRENADE_FUSE_SECONDS
var thrower: int = 0
