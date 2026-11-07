class_name Feedback
extends Node
## One scene-local bus for confirmed and predicted cosmetic feedback.

signal fx(kind: StringName, data: Dictionary)

var hud: ShiftHUD
var player: PlayerView
var caption_target: Label
var _caption_remaining: float = 0
var _subtitles: bool = true
var _audio: ShiftAudio


func _ready() -> void:
	_audio = ShiftAudio.new()
	add_child(_audio)
	fx.connect(_on_fx)


func publish(events: Array[Dictionary], fallback: Vector3 = Vector3.ZERO) -> void:
	for event: Dictionary in events:
		if not event.has("kind"):
			continue
		var data: Dictionary = event.duplicate()
		var at: Variant = data.get("position", fallback)
		data["position"] = Vector3(at.x, 0.7, at.y) if at is Vector2 else at
		fx.emit(StringName(event["kind"]), data)


func _on_fx(kind: StringName, data: Dictionary) -> void:
	_audio.play_event(kind)
	var captions: Dictionary = {&"pickup": "CLANK / COOLANT SECURED", &"delivery": "WHOOSH / COOLANT DELIVERED", &"heat_warning": "ALARM / LAB OVERHEATING", &"hound_windup": "CRACKLE / HOUND WINDING UP", &"hound_wall_stun": "CLANG / HOUND HIT A WALL", &"contained": "CLUNK / SPECIMEN CONTAINED"}
	if _subtitles and caption_target != null and captions.has(kind):
		caption_target.text = captions[kind]
		_caption_remaining = 2.0
	if hud != null:
		hud.feedback(kind)
	if player != null and kind in [&"foam_fired", &"delivery", &"contained"]:
		player.add_camera_kick(0.35)
	if DisplayServer.get_name() == "headless":
		return
	var at: Vector3 = data.get("position", Vector3.ZERO)
	match kind:
		&"pickup":
			_burst(at, LevelBuilder.AMBER, 12, 0.25)
		&"delivery":
			_burst(at, LevelBuilder.COOLANT, 32, 0.55)
			_burst(at, Color(0.8, 0.9, 0.9, 0.25), 18, 1.2, Vector3.UP, 20, 0.22)
		&"contained":
			_burst(at, LevelBuilder.COOLANT, 40, 0.6)
		&"hound_windup":
			_burst(at, LevelBuilder.AMBER, 24, Tuning.HOUND_WINDUP_SECONDS, Vector3.UP, 130)
		&"hound_wall_stun":
			_burst(at, Color.WHITE, 18, 0.3)
		&"foam_hit":
			_burst(at, LevelBuilder.COOLANT.lightened(0.5), 20, 0.35)
		&"foam_miss":
			_burst(at, Color("a5afb4"), 8, 0.2)
		&"foam_fired":
			if player != null:
				var direction: Vector3 = -player.camera.global_transform.basis.z
				_burst(player.camera.global_position + direction * 0.6, LevelBuilder.COOLANT.lightened(0.6), 16, 0.22, direction, 15)


func _process(delta: float) -> void:
	_caption_remaining = maxf(0, _caption_remaining - delta)
	if caption_target != null:
		caption_target.visible = _subtitles and _caption_remaining > 0


func apply_settings(values: Dictionary) -> void:
	_subtitles = values["subtitles"]
	_audio.set_volume(values["sfx_volume"])


func _burst(at: Vector3, color: Color, amount: int, lifetime: float, direction: Vector3 = Vector3.UP, spread: float = 65, size: float = 0.06) -> void:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.vertex_color_use_as_albedo = true
	var mesh: QuadMesh = QuadMesh.new()
	mesh.size = Vector2(size, size)
	mesh.material = material
	var particles: CPUParticles3D = CPUParticles3D.new()
	particles.mesh = mesh
	particles.one_shot = true
	particles.explosiveness = 1.0
	particles.amount = amount
	particles.lifetime = lifetime
	particles.direction = direction
	particles.spread = spread
	particles.gravity = Vector3(0, -1.5, 0)
	particles.initial_velocity_min = 0.7
	particles.initial_velocity_max = 2.2
	particles.color = color
	var fade: Gradient = Gradient.new()
	fade.set_color(0, Color.WHITE)
	fade.set_color(1, Color(1, 1, 1, 0))
	particles.color_ramp = fade
	particles.position = at
	add_child(particles)
	particles.finished.connect(particles.queue_free)
