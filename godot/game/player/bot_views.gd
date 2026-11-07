class_name BotViews
extends Node3D
## Draws bot interns (players[1..]) from sim state. Each intern is merged into one mesh
## (vertex colours) plus its two number labels, so 7 bots stay inside the draw-call budget.

var _state: GameState
var _bodies: Array[Node3D] = []
var _carried: Array[MeshInstance3D] = []
var _time: float = 0.0


func build(state: GameState) -> void:
	_state = state
	for body: Node3D in _bodies:
		body.queue_free()
	_bodies.clear()
	_carried.clear()
	var canister: CylinderMesh = CylinderMesh.new()
	canister.top_radius = 0.11
	canister.bottom_radius = 0.11
	canister.height = 0.42
	var glow: StandardMaterial3D = StandardMaterial3D.new()
	glow.albedo_color = LevelBuilder.COOLANT
	glow.emission_enabled = true
	glow.emission = LevelBuilder.COOLANT
	glow.emission_energy_multiplier = 0.6
	for index: int in range(1, state.players.size()):
		var body: Node3D = merged_intern(state.players[index].id + 1)
		body.name = "Bot%d" % state.players[index].id
		var held: MeshInstance3D = MeshInstance3D.new()
		held.mesh = canister
		held.material_override = glow
		held.position = Vector3(0, 0.95, -0.32)
		held.rotation.z = PI / 2.0
		body.add_child(held)
		add_child(body)
		_bodies.append(body)
		_carried.append(held)
	_update(1.0)


func sync(state: GameState) -> void:
	if state != _state or state.players.size() - 1 != _bodies.size():
		build(state)


func _process(delta: float) -> void:
	_time += delta
	_update(Engine.get_physics_interpolation_fraction())


func _update(fraction: float) -> void:
	if _state == null:
		return
	for index: int in _bodies.size():
		var player: PlayerState = _state.players[index + 1]
		var body: Node3D = _bodies[index]
		var at: Vector2 = player.previous_position.lerp(player.position, fraction)
		body.position = Vector3(at.x, 0, at.y)
		body.rotation = Vector3(0, player.yaw, 0.3 if player.is_stunned() else 0.0)
		# Blink while immune after a catch, like the local player's own cue.
		body.visible = player.immune_remaining <= 0.0 or player.is_stunned() or int(_time * 8.0) % 2 == 0
		_carried[index].visible = player.carrying >= 0


## Builds an InternView and bakes its primitive parts into one vertex-coloured mesh.
static func merged_intern(number: int) -> Node3D:
	var model: InternView = InternView.new()
	model.build(number)
	var root: Node3D = Node3D.new()
	var surface: SurfaceTool = SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for child: Node in model.get_children():
		if child is MeshInstance3D:
			var part: MeshInstance3D = child
			var shape: PrimitiveMesh = part.mesh
			var colour: Color = (shape.material as StandardMaterial3D).albedo_color
			var arrays: Array = shape.get_mesh_arrays()
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			var normal_basis: Basis = part.transform.basis.inverse().transposed()
			var count: int = indices.size() if not indices.is_empty() else vertices.size()
			for corner: int in count:
				var vertex: int = indices[corner] if not indices.is_empty() else corner
				surface.set_color(colour)
				surface.set_normal((normal_basis * normals[vertex]).normalized())
				surface.add_vertex(part.transform * vertices[vertex])
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.vertex_color_is_srgb = true
	material.roughness = 0.8
	surface.set_material(material)
	var merged: MeshInstance3D = MeshInstance3D.new()
	merged.name = "Body"
	merged.mesh = surface.commit()
	root.add_child(merged)
	for child: Node in model.get_children():
		if child is Label3D:
			model.remove_child(child)
			root.add_child(child)
	model.free()
	return root
