class_name GrenadeViews
extends Node3D
## Freeze-grenade crates on G cells and grenades in flight. Cosmetic only.

const ARC_HEIGHT: float = 1.2

var _state: GameState
var _crates: Array[Node3D] = []
var _flying: Array[MeshInstance3D] = []
var _orb: SphereMesh
var _orb_material: StandardMaterial3D
var _time: float = 0.0


func build(state: GameState) -> void:
	_state = state
	for crate: Node3D in _crates:
		crate.queue_free()
	_crates.clear()
	var box: BoxMesh = BoxMesh.new()
	box.size = Vector3(0.55, 0.4, 0.55)
	var band: BoxMesh = BoxMesh.new()
	band.size = Vector3(0.57, 0.08, 0.57)
	var shell: StandardMaterial3D = StandardMaterial3D.new()
	shell.albedo_color = Color("e9e4d8")
	var stripe: StandardMaterial3D = StandardMaterial3D.new()
	stripe.albedo_color = LevelBuilder.COOLANT
	stripe.emission_enabled = true
	stripe.emission = LevelBuilder.COOLANT
	stripe.emission_energy_multiplier = 0.8
	for pickup: GrenadePickup in state.grenade_pickups:
		var crate: Node3D = Node3D.new()
		crate.name = "GrenadeCrate%d" % pickup.id
		crate.position = Vector3(pickup.position.x, 0, pickup.position.y)
		var body: MeshInstance3D = MeshInstance3D.new()
		body.mesh = box
		body.material_override = shell
		body.position.y = 0.2
		crate.add_child(body)
		var light_band: MeshInstance3D = MeshInstance3D.new()
		light_band.mesh = band
		light_band.material_override = stripe
		light_band.position.y = 0.3
		crate.add_child(light_band)
		add_child(crate)
		_crates.append(crate)
	_orb = SphereMesh.new()
	_orb.radius = 0.12
	_orb.height = 0.24
	_orb_material = stripe
	sync(state)


func sync(state: GameState) -> void:
	if state != _state or state.grenade_pickups.size() != _crates.size():
		build(state)
		return
	for index: int in _crates.size():
		_crates[index].visible = state.grenade_pickups[index].available
	while _flying.size() < state.thrown_grenades.size():
		var orb: MeshInstance3D = MeshInstance3D.new()
		orb.mesh = _orb
		orb.material_override = _orb_material
		add_child(orb)
		_flying.append(orb)
	while _flying.size() > state.thrown_grenades.size():
		_flying.pop_back().queue_free()


func _process(delta: float) -> void:
	_time += delta
	if _state == null:
		return
	for index: int in mini(_flying.size(), _state.thrown_grenades.size()):
		var grenade: ThrownGrenade = _state.thrown_grenades[index]
		var progress: float = clampf(1.0 - grenade.fuse / Tuning.GRENADE_FUSE_SECONDS, 0.0, 1.0)
		var at: Vector2 = grenade.from.lerp(grenade.position, minf(1.0, progress * 1.6))
		var height: float = 0.25 + ARC_HEIGHT * 4.0 * minf(1.0, progress * 1.6) * (1.0 - minf(1.0, progress * 1.6))
		_flying[index].position = Vector3(at.x, height, at.y)
		_flying[index].visible = progress < 0.62 or int(_time * 16.0) % 2 == 0
	for index: int in _crates.size():
		_crates[index].rotation.y = _time * 0.6
