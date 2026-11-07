class_name InternView
extends Node3D
## Original primitive placeholder: human limbs, separate respirator lenses, front tank.

var player_number: int = 1
var _silhouette: bool = false
var _layer: int = 1


func build(number: int = 1, silhouette: bool = false, local_body: bool = false) -> void:
	for child: Node in get_children():
		child.free()
	player_number = clampi(number, 1, 8)
	_silhouette = silhouette
	_layer = 2 if local_body else 1
	var suit: Color = Color("e9e4d8")
	var rubber: Color = Color("30383c")
	var orange: Color = Color("d55e00")
	var colors: Array[Color] = [Color("e69f00"), Color("56b4e9"), Color("009e73"), Color("f0e442"), Color("0072b2"), Color("d55e00"), Color("cc79a7"), Color.WHITE]
	_box("Torso", Vector3(0.43, 0.48, 0.27), Vector3(0, 1.19, 0), suit)
	_box("Waist", Vector3(0.35, 0.18, 0.25), Vector3(0, 0.91, 0), orange)
	_box("Belt", Vector3(0.38, 0.055, 0.28), Vector3(0, 0.99, 0), rubber)
	_cylinder("Neck", 0.06, 0.10, Vector3(0, 1.47, 0), rubber)
	var helmet: SphereMesh = SphereMesh.new()
	helmet.radius = 0.15
	helmet.height = 0.30
	helmet.radial_segments = 16
	helmet.rings = 8
	_part("Helmet", helmet, Vector3(0, 1.60, 0), suit)
	_box("HelmetIDPlate", Vector3(0.17, 0.07, 0.025), Vector3(0, 1.71, -0.13), suit)
	_box("Respirator", Vector3(0.19, 0.11, 0.10), Vector3(0, 1.535, -0.135), rubber)
	for side: int in [-1, 1]:
		var suffix: String = "L" if side < 0 else "R"
		_capsule("Leg" + suffix, 0.075, 0.67, Vector3(side * 0.115, 0.52, 0), suit)
		_box("Boot" + suffix, Vector3(0.17, 0.21, 0.30), Vector3(side * 0.115, 0.105, -0.04), rubber)
		_capsule("UpperArm" + suffix, 0.075, 0.36, Vector3(side * 0.29, 1.265, 0), suit)
		_capsule("Forearm" + suffix, 0.065, 0.29, Vector3(side * 0.335, 0.98, -0.015), orange)
		_capsule("Glove" + suffix, 0.068, 0.16, Vector3(side * 0.335, 0.785, -0.025), rubber)
		var lens: MeshInstance3D = _cylinder("Lens" + suffix, 0.041, 0.022, Vector3(side * 0.065, 1.635, -0.141), LevelBuilder.COOLANT)
		lens.rotation.x = PI / 2.0
		var filter: MeshInstance3D = _cylinder("Filter" + suffix, 0.042, 0.07, Vector3(side * 0.119, 1.535, -0.135), rubber)
		filter.rotation.z = PI / 2.0
	_cylinder("ChestTank", 0.105, 0.28, Vector3(0, 1.16, -0.24), LevelBuilder.COOLANT)
	_box("TankStrap", Vector3(0.25, 0.045, 0.22), Vector3(0, 1.16, -0.23), rubber)
	_segment("HoseA", Vector3(0.08, 1.02, -0.24), Vector3(0.19, 0.82, -0.16), 0.017, rubber)
	_segment("HoseB", Vector3(0.19, 0.82, -0.16), Vector3(0.335, 0.79, -0.09), 0.017, rubber)
	_box("HandNozzle", Vector3(0.06, 0.09, 0.18), Vector3(0.335, 0.80, -0.15), rubber)
	_box("ShoulderBand", Vector3(0.16, 0.09, 0.17), Vector3(-0.29, 1.34, 0), colors[player_number - 1])
	for stripe: int in 3:
		_box("BandPattern%d" % stripe, Vector3(0.015, 0.065, 0.012), Vector3(-0.33 + stripe * 0.035, 1.34, -0.09), rubber)
	_number("BackNumber", Vector3(0, 1.20, 0.141), false)
	_number("HelmetNumber", Vector3(0, 1.705, -0.145), true)
	for label: String in ["Head", "Chest", "HandR", "HandL"]:
		var marker: Marker3D = Marker3D.new()
		marker.name = label
		marker.position = {"Head": Vector3(0, 1.6, 0), "Chest": Vector3(0, 1.16, -0.24), "HandR": Vector3(0.335, 0.79, -0.09), "HandL": Vector3(-0.335, 0.79, -0.09)}[label]
		add_child(marker)


func _box(label: String, size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	return _part(label, mesh, at, color)


func _cylinder(label: String, radius: float, height: float, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh: CylinderMesh = CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	return _part(label, mesh, at, color)


func _capsule(label: String, radius: float, height: float, at: Vector3, color: Color) -> void:
	var mesh: CapsuleMesh = CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	mesh.rings = 4
	_part(label, mesh, at, color)


func _segment(label: String, from: Vector3, to: Vector3, radius: float, color: Color) -> void:
	var view: MeshInstance3D = _cylinder(label, radius, from.distance_to(to), (from + to) / 2.0, color)
	view.basis = Basis(Quaternion(Vector3.UP, (to - from).normalized()))


func _part(label: String, mesh: PrimitiveMesh, at: Vector3, color: Color) -> MeshInstance3D:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = Color.BLACK if _silhouette else color
	material.roughness = 0.8
	if _silhouette:
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.material = material
	var view: MeshInstance3D = MeshInstance3D.new()
	view.name = label
	view.mesh = mesh
	view.position = at
	view.layers = _layer
	add_child(view)
	return view


func _number(label: String, at: Vector3, front: bool) -> void:
	if _silhouette:
		return
	var text: Label3D = Label3D.new()
	text.name = label
	text.text = "%02d" % player_number
	text.font_size = 48 if front else 64
	text.pixel_size = 0.0015 if front else 0.003
	text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	text.modulate = Color("14171a")
	text.outline_size = 0
	text.position = at
	text.rotation.y = PI if front else 0.0
	text.layers = _layer
	add_child(text)
