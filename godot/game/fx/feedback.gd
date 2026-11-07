class_name Feedback
extends Node
## One scene-local bus for confirmed and predicted cosmetic feedback.

signal fx(kind: StringName, data: Dictionary)

var hud: ShiftHUD
var player: PlayerView
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
	if hud != null:
		hud.feedback(kind)
	if DisplayServer.get_name() == "headless":
		return
	var at: Vector3 = data.get("position", Vector3.ZERO)
	match kind:
		&"pickup":
			_burst(at, LevelBuilder.AMBER, 12, 0.25)
		&"delivery", &"contained":
			_burst(at, LevelBuilder.COOLANT, 32, 0.55)
		&"foam_hit":
			_burst(at, LevelBuilder.COOLANT.lightened(0.5), 20, 0.35)
		&"foam_miss":
			_burst(at, Color("a5afb4"), 8, 0.2)
		&"foam_fired":
			if player != null:
				var direction: Vector3 = -player.camera.global_transform.basis.z
				_burst(player.camera.global_position + direction * 0.6, LevelBuilder.COOLANT.lightened(0.6), 16, 0.22, direction, 15)


func _burst(at: Vector3, color: Color, amount: int, lifetime: float, direction: Vector3 = Vector3.UP, spread: float = 65) -> void:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.vertex_color_use_as_albedo = true
	var mesh: QuadMesh = QuadMesh.new()
	mesh.size = Vector2(0.06, 0.06)
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
