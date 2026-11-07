class_name CanisterViews
extends Node3D

var _bodies: MultiMeshInstance3D
var _handles: MultiMeshInstance3D


func build(count: int) -> void:
	var body: CylinderMesh = CylinderMesh.new()
	body.top_radius = 0.19
	body.bottom_radius = 0.19
	body.height = 0.65
	body.radial_segments = 12
	_bodies = _batch(body, LevelBuilder.COOLANT, count)
	var handle: BoxMesh = BoxMesh.new()
	handle.size = Vector3(0.34, 0.12, 0.14)
	_handles = _batch(handle, LevelBuilder.AMBER, count)


func sync(state: GameState) -> void:
	for canister: CanisterState in state.canisters:
		var at: Vector3 = Vector3(canister.position.x, 0.45, canister.position.y)
		var basis: Basis = Basis.IDENTITY if canister.available else Basis.from_scale(Vector3.ZERO)
		_bodies.multimesh.set_instance_transform(canister.id, Transform3D(basis, at))
		_handles.multimesh.set_instance_transform(canister.id, Transform3D(basis, at + Vector3(0, 0.42, 0)))


func _batch(mesh: Mesh, color: Color, count: int) -> MultiMeshInstance3D:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = 0.35
	material.roughness = 0.45
	mesh.surface_set_material(0, material)
	var multi: MultiMesh = MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.mesh = mesh
	multi.instance_count = count
	var view: MultiMeshInstance3D = MultiMeshInstance3D.new()
	view.multimesh = multi
	add_child(view)
	return view
