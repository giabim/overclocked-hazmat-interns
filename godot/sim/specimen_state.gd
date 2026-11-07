class_name SpecimenState
extends RefCounted
## One escaped specimen. Pure data; behaviour lives in SpecimenAI.

enum Kind { SLIME, HOUND }
enum Mode { DEN, PATROL, CHASE, WINDUP, DASH, TIRED, STUNNED, FROZEN }

const CATCHING_MODES: Array[Mode] = [Mode.PATROL, Mode.CHASE, Mode.WINDUP, Mode.DASH, Mode.TIRED]

var id: int = 0
var kind: Kind = Kind.SLIME
var mode: Mode = Mode.DEN
var position: Vector2 = Vector2.ZERO
var previous_position: Vector2 = Vector2.ZERO
var den: Vector2 = Vector2.ZERO
## Seconds left in the current timed mode (DEN, WINDUP, DASH, TIRED, STUNNED, FROZEN).
var timer: float = 0.0
var chase_time: float = 0.0
var unseen_time: float = 0.0
var ignore_remaining: float = 0.0
var last_seen: Vector2 = Vector2.ZERO
var patrol_target: Vector2i = Vector2i.ZERO
var dash_direction: Vector2 = Vector2.ZERO
## Shift times (GameState.elapsed) of recent freezes, used for the 3-in-12 s contain rule.
var freeze_times: Array[float] = []


func radius() -> float:
	return Tuning.SLIME_RADIUS if kind == Kind.SLIME else Tuning.HOUND_RADIUS


func speed() -> float:
	return Tuning.SLIME_SPEED if kind == Kind.SLIME else Tuning.HOUND_SPEED


func kind_name() -> StringName:
	return &"slime" if kind == Kind.SLIME else &"hound"


func can_catch() -> bool:
	return mode in CATCHING_MODES


func can_be_frozen() -> bool:
	return mode != Mode.DEN


func set_mode(next: Mode, seconds: float = 0.0) -> void:
	mode = next
	timer = seconds
