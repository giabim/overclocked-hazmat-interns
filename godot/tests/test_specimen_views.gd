extends RefCounted


func test_caught_card_names_attacker_and_side() -> String:
	var cases: Array = [
		[{"specimen": &"hound", "how": &"dashed", "from_angle": -PI / 2.0}, "CAUGHT BY SPARK HOUND — IT DASHED FROM THE LEFT"],
		[{"specimen": &"slime", "how": &"touched", "from_angle": PI}, "CAUGHT BY GOO SLIME — IT TOUCHED YOU FROM BEHIND"],
		[{"specimen": &"slime", "how": &"touched", "from_angle": 1.2}, "CAUGHT BY GOO SLIME — IT TOUCHED YOU FROM THE RIGHT"],
		[{"specimen": &"hound", "how": &"touched", "from_angle": 0.1}, "CAUGHT BY SPARK HOUND — IT TOUCHED YOU FROM THE FRONT"],
	]
	for case: Array in cases:
		var text: String = ShiftHUD.caught_text(case[0])
		if text != case[1]:
			return "Expected '%s', got '%s'" % [case[1], text]
	return ""


func test_views_build_one_body_per_specimen_and_one_cage_per_den() -> String:
	var map: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	var state: GameState = GameState.create(map, 8, 3)
	var views: SpecimenViews = SpecimenViews.new()
	views.build(state)
	var bodies: int = 0
	var cages: int = 0
	for child: Node in views.get_children():
		if child.name == "DenCages":
			cages = child.get_child_count()
		elif child is Node3D:
			bodies += 1
	views.free()
	if bodies != state.specimens.size():
		return "Expected %d specimen bodies, got %d" % [state.specimens.size(), bodies]
	# Each den has one post multimesh and one closing-bars multimesh.
	if cages != map.cells_of("M").size() * 2:
		return "Expected 2 cage parts per den, got %d" % cages
	var grenades: GrenadeViews = GrenadeViews.new()
	grenades.build(state)
	var crates: int = grenades.get_child_count()
	grenades.free()
	if crates != state.grenade_pickups.size():
		return "Expected one crate per G cell, got %d" % crates
	return ""


func test_bot_intern_is_one_mesh_plus_numbers() -> String:
	var body: Node3D = BotViews.merged_intern(5)
	var meshes: int = 0
	var labels: int = 0
	for child: Node in body.get_children():
		if child is MeshInstance3D:
			meshes += 1
		elif child is Label3D:
			labels += 1
			if (child as Label3D).text != "05":
				body.free()
				return "Bot number label should read 05"
	var vertices: int = (body.get_child(0) as MeshInstance3D).mesh.get_faces().size()
	body.free()
	if meshes != 1 or labels != 2:
		return "Expected 1 merged mesh and 2 number labels, got %d and %d" % [meshes, labels]
	if vertices < 300:
		return "Merged intern looks empty (%d face vertices)" % vertices
	return ""
