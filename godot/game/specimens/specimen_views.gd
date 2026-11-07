class_name SpecimenViews
extends Node3D
## Draws specimens and den cages from sim state (docs/art.md §4.4). Cosmetic only.
## Each specimen has a looping positional sound: slime 8 m, hound 12 m (louder in wind-up).

const SLIME_GREEN: Color = Color("7bd35a")
const FROST: Color = Color("bfe9f5")
const HOUND_METAL: Color = Color("3a4046")

var _state: GameState
var _bodies: Array[Node3D] = []
var _materials: Array[StandardMaterial3D] = []
var _sounds: Array[AudioStreamPlayer3D] = []
var _cages: Node3D
var _cage_bars: Array[MultiMeshInstance3D] = []
var _cage_dens: Array[Vector2] = []
var _volume: float = 1.0
var _time: float = 0.0


func build(state: GameState) -> void:
	_state = state
	for body: Node3D in _bodies:
		body.queue_free()
	_bodies.clear()
	_materials.clear()
	_sounds.clear()
	if _cages != null:
		_cages.queue_free()
	_cages = _build_cages(state.grid)
	add_child(_cages)
	for specimen: SpecimenState in state.specimens:
		var material: StandardMaterial3D = StandardMaterial3D.new()
		var body: Node3D = _build_slime(material) if specimen.kind == SpecimenState.Kind.SLIME else _build_hound(material)
		var sound: AudioStreamPlayer3D = AudioStreamPlayer3D.new()
		sound.stream = ShiftAudio.make_loop(0.8, 110.0, true) if specimen.kind == SpecimenState.Kind.SLIME \
			else ShiftAudio.make_loop(0.5, 1180.0, true)
		sound.max_distance = Tuning.SLIME_HEAR_RADIUS if specimen.kind == SpecimenState.Kind.SLIME else Tuning.HOUND_HEAR_RADIUS
		sound.unit_size = 2.0
		sound.position = Vector3(0, 0.6, 0)
		body.add_child(sound)
		add_child(body)
		_bodies.append(body)
		_materials.append(material)
		_sounds.append(sound)
	_apply_volume()
	_update(0.0)


func sync(state: GameState) -> void:
	if state != _state or state.specimens.size() != _bodies.size():
		build(state)


func apply_settings(values: Dictionary) -> void:
	_volume = values["sfx_volume"]
	_apply_volume()


func _process(delta: float) -> void:
	_time += delta
	_update(Engine.get_physics_interpolation_fraction())


func _update(fraction: float) -> void:
	if _state == null:
		return
	for index: int in mini(_bodies.size(), _state.specimens.size()):
		var specimen: SpecimenState = _state.specimens[index]
		var body: Node3D = _bodies[index]
		var at: Vector2 = specimen.previous_position.lerp(specimen.position, fraction)
		body.position = Vector3(at.x, 0, at.y)
		var heading: Vector2 = specimen.position - specimen.previous_position
		if specimen.mode in [SpecimenState.Mode.WINDUP, SpecimenState.Mode.DASH]:
			heading = specimen.dash_direction
		if heading.length() > 0.001:
			body.rotation.y = atan2(-heading.x, -heading.y)
		_style(specimen, body, _materials[index], _sounds[index])
	for cage: int in _cage_bars.size():
		var occupied: bool = false
		for specimen: SpecimenState in _state.specimens:
			if specimen.mode == SpecimenState.Mode.DEN and specimen.den.distance_to(_cage_dens[cage]) < 0.1:
				occupied = true
		_cage_bars[cage].visible = occupied


func _style(specimen: SpecimenState, body: Node3D, material: StandardMaterial3D, sound: AudioStreamPlayer3D) -> void:
	var frozen: bool = specimen.mode == SpecimenState.Mode.FROZEN
	var base: Color = SLIME_GREEN if specimen.kind == SpecimenState.Kind.SLIME else HOUND_METAL
	material.albedo_color = Color(FROST, 0.9) if frozen else Color(base, 0.78 if specimen.kind == SpecimenState.Kind.SLIME else 1.0)
	material.emission_enabled = frozen or specimen.mode == SpecimenState.Mode.WINDUP
	material.emission = LevelBuilder.COOLANT if frozen else LevelBuilder.AMBER
	material.emission_energy_multiplier = 0.35 if frozen else 0.25
	body.scale = Vector3.ONE
	body.rotation.z = 0.0
	match specimen.mode:
		SpecimenState.Mode.PATROL, SpecimenState.Mode.CHASE:
			if specimen.kind == SpecimenState.Kind.SLIME:
				var wobble: float = sin(_time * 7.0 + specimen.id) * 0.06
				body.scale = Vector3(1.0 + wobble, 1.0 - wobble, 1.0 + wobble)
		SpecimenState.Mode.WINDUP:
			body.position += Vector3(sin(_time * 61.0), 0, cos(_time * 53.0)) * 0.03
		SpecimenState.Mode.STUNNED:
			body.rotation.z = 0.35
		SpecimenState.Mode.TIRED:
			body.scale = Vector3(1.0, 0.85, 1.0)
	var audible: bool = specimen.mode != SpecimenState.Mode.DEN and specimen.mode != SpecimenState.Mode.FROZEN and _volume > 0.0
	if audible and not sound.playing and sound.is_inside_tree():
		sound.play()
	elif not audible and sound.playing:
		sound.stop()
	var loud: bool = specimen.mode == SpecimenState.Mode.WINDUP or specimen.mode == SpecimenState.Mode.DASH
	sound.volume_db = linear_to_db(maxf(0.0001, _volume)) + (4.0 if loud else -6.0)
	sound.pitch_scale = 1.35 if loud else 1.0


func _apply_volume() -> void:
	for sound: AudioStreamPlayer3D in _sounds:
		sound.volume_db = linear_to_db(maxf(0.0001, _volume)) - 6.0


static func _part(parent: Node3D, mesh: Mesh, material: Material, at: Vector3) -> MeshInstance3D:
	var instance: MeshInstance3D = MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	instance.position = at
	parent.add_child(instance)
	return instance


static func _flat(color: Color, glow: bool = false) -> StandardMaterial3D:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color
	if glow:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 1.2
	return material


func _build_slime(material: StandardMaterial3D) -> Node3D:
	var root: Node3D = Node3D.new()
	root.name = "GooSlime"
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.roughness = 0.15
	var blob: SphereMesh = SphereMesh.new()
	blob.radius = Tuning.SLIME_RADIUS
	blob.height = Tuning.SLIME_RADIUS * 1.5
	_part(root, blob, material, Vector3(0, Tuning.SLIME_RADIUS * 0.75, 0))
	var eye: SphereMesh = SphereMesh.new()
	eye.radius = 0.09
	eye.height = 0.18
	var pupil: SphereMesh = SphereMesh.new()
	pupil.radius = 0.045
	pupil.height = 0.09
	for side: float in [-1.0, 1.0]:
		_part(root, eye, _flat(Color.WHITE), Vector3(0.17 * side, 0.68, -0.44))
		_part(root, pupil, _flat(LevelBuilder.NIGHT), Vector3(0.17 * side, 0.68, -0.52))
	return root


func _build_hound(material: StandardMaterial3D) -> Node3D:
	var root: Node3D = Node3D.new()
	root.name = "SparkHound"
	material.metallic = 0.6
	material.roughness = 0.45
	var body: BoxMesh = BoxMesh.new()
	body.size = Vector3(0.48, 0.4, 1.0)
	_part(root, body, material, Vector3(0, 0.6, 0))
	var head: BoxMesh = BoxMesh.new()
	head.size = Vector3(0.36, 0.3, 0.36)
	_part(root, head, material, Vector3(0, 0.78, -0.62))
	var eye: BoxMesh = BoxMesh.new()
	eye.size = Vector3(0.07, 0.05, 0.02)
	for side: float in [-1.0, 1.0]:
		_part(root, eye, _flat(LevelBuilder.AMBER, true), Vector3(0.09 * side, 0.82, -0.81))
	var leg: BoxMesh = BoxMesh.new()
	leg.size = Vector3(0.1, 0.42, 0.1)
	var stripe: BoxMesh = BoxMesh.new()
	stripe.size = Vector3(0.5, 0.06, 0.12)
	_part(root, stripe, _flat(LevelBuilder.AMBER), Vector3(0, 0.81, -0.1))
	for x: float in [-0.17, 0.17]:
		for z: float in [-0.36, 0.36]:
			_part(root, leg, material, Vector3(x, 0.21, z))
	var cable: CylinderMesh = CylinderMesh.new()
	cable.top_radius = 0.025
	cable.bottom_radius = 0.035
	cable.height = 0.7
	var tail: MeshInstance3D = _part(root, cable, _flat(Color("1d2226")), Vector3(0, 0.68, 0.78))
	tail.rotation_degrees = Vector3(60, 0, 0)
	return root


## Open pens with corner posts; the bars drop (cage "snaps shut") while a specimen rests inside.
func _build_cages(grid: MapGrid) -> Node3D:
	var root: Node3D = Node3D.new()
	root.name = "DenCages"
	_cage_bars.clear()
	_cage_dens.clear()
	var steel: StandardMaterial3D = _flat(Color("6f777c"))
	steel.metallic = 0.7
	var half: float = Tuning.CELL_SIZE * 0.45
	for cell: Vector2i in grid.cells_of("M"):
		var centre: Vector2 = grid.cell_center(cell)
		var posts: Array[Transform3D] = []
		var bars: Array[Transform3D] = []
		for corner: Vector2 in [Vector2(-half, -half), Vector2(half, -half), Vector2(-half, half), Vector2(half, half)]:
			posts.append(Transform3D(Basis.from_scale(Vector3(2.0, 1.0, 2.0)), Vector3(centre.x + corner.x, 0.85, centre.y + corner.y)))
		for step: int in range(1, 6):
			var offset: float = lerpf(-half, half, step / 6.0)
			for point: Vector2 in [Vector2(offset, -half), Vector2(offset, half), Vector2(-half, offset), Vector2(half, offset)]:
				bars.append(Transform3D(Basis.IDENTITY, Vector3(centre.x + point.x, 0.85, centre.y + point.y)))
		root.add_child(_multimesh(posts, steel))
		var closed: MultiMeshInstance3D = _multimesh(bars, _flat(LevelBuilder.COOLANT.darkened(0.2), true))
		closed.visible = false
		root.add_child(closed)
		_cage_bars.append(closed)
		_cage_dens.append(centre)
	return root


static func _multimesh(transforms: Array[Transform3D], material: Material) -> MultiMeshInstance3D:
	var bar: BoxMesh = BoxMesh.new()
	bar.size = Vector3(0.06, 1.7, 0.06)
	var multimesh: MultiMesh = MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = bar
	multimesh.instance_count = transforms.size()
	for index: int in transforms.size():
		multimesh.set_instance_transform(index, transforms[index])
	var instance: MultiMeshInstance3D = MultiMeshInstance3D.new()
	instance.multimesh = multimesh
	instance.material_override = material
	return instance
