class_name LevelBuilder
extends Node3D
## Static geometry is batched by material, independent of map size.

const NIGHT: Color = Color("14171a")
const CONCRETE: Color = Color("8a8d8f")
const AMBER: Color = Color("f2a900")
const COOLANT: Color = Color("2ec4c9")
const WING_COLORS: Array[Color] = [COOLANT, AMBER, Color("ff5a1f"), Color("7bd35a")]


func build(grid: MapGrid, include_signage: bool = true) -> void:
	for child: Node in get_children():
		child.free()
	var walls: Array[Transform3D] = []
	var frames: Array[Transform3D] = []
	var exits: Array[Transform3D] = []
	var strips: Array[Array] = [[], [], [], []]
	for cy: int in grid.height:
		for cx: int in grid.width:
			var center: Vector2 = grid.cell_center(Vector2i(cx, cy))
			var at: Vector3 = Vector3(center.x, 0.0, center.y)
			if grid.is_wall(cx, cy):
				walls.append(_box(at + Vector3(0, 1.6, 0), Vector3(2, 3.2, 2)))
				continue
			var wing: int = wing_at(Vector2i(cx, cy), grid)
			strips[wing].append(_box(at + Vector3(0, 0.012, 0), Vector3(0.12, 0.02, 1.8)))
			if grid.cell(cx, cy) == "+":
				var axis: Vector3 = Vector3.RIGHT if grid.is_wall(cx - 1, cy) else Vector3.BACK
				for side: float in [-1.0, 1.0]:
					frames.append(_box(at + axis * side * 0.9 + Vector3(0, 1.3, 0), Vector3(0.14, 2.6, 0.14)))
				frames.append(_box(at + Vector3(0, 2.6, 0), Vector3(1.94, 0.16, 0.16) if axis == Vector3.RIGHT else Vector3(0.16, 0.16, 1.94)))
			elif grid.cell(cx, cy) == "E":
				exits.append(_box(at + Vector3(0.85, 1.35, 0), Vector3(0.12, 2.7, 1.94)))
	var floor_boxes: Array[Transform3D] = [_box(
		Vector3(grid.width, -0.11, grid.height),
		Vector3(grid.width * Tuning.CELL_SIZE, 0.2, grid.height * Tuning.CELL_SIZE)
	)]
	_batch("Floor", floor_boxes, CONCRETE.darkened(0.45))
	_batch("Walls", walls, CONCRETE)
	_batch("DoorFrames", frames, AMBER)
	_batch("Airlock", exits, COOLANT)
	for wing: int in 4:
		var transforms: Array[Transform3D] = []
		transforms.assign(strips[wing])
		_batch("Wing%d" % wing, transforms, WING_COLORS[wing])
	if not include_signage:
		return
	var labels: Array[String] = ["WEST / W-01", "EAST / E-01", "NORTH / N-01", "SOUTH / S-01"]
	var cells: Array[Vector2i] = [Vector2i(3, 3), Vector2i(20, 3), Vector2i(12, 1), Vector2i(12, 13)]
	for index: int in labels.size():
		var label: Label3D = Label3D.new()
		label.text = labels[index]
		label.font_size = 36
		label.pixel_size = 0.012
		label.modulate = WING_COLORS[index]
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		var center: Vector2 = grid.cell_center(cells[index])
		label.position = Vector3(center.x, 2.4, center.y)
		add_child(label)


static func wing_at(cell: Vector2i, grid: MapGrid) -> int:
	if cell.x < grid.width / 3:
		return 0
	if cell.x >= grid.width * 2 / 3:
		return 1
	return 2 if cell.y < grid.height / 2 else 3


static func _box(at: Vector3, size: Vector3) -> Transform3D:
	return Transform3D(Basis.from_scale(size), at)


func _batch(label: String, transforms: Array[Transform3D], color: Color) -> void:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.85
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = Vector3.ONE
	mesh.material = material
	var multi: MultiMesh = MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.mesh = mesh
	multi.instance_count = transforms.size()
	for index: int in transforms.size():
		multi.set_instance_transform(index, transforms[index])
	var view: MultiMeshInstance3D = MultiMeshInstance3D.new()
	view.name = label
	view.multimesh = multi
	add_child(view)
