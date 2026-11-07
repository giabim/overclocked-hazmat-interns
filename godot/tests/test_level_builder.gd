extends RefCounted


func test_level_geometry_is_batched_and_rebuildable() -> String:
	var grid: MapGrid = MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))
	var level: LevelBuilder = LevelBuilder.new()
	level.build(grid)
	var walls: MultiMeshInstance3D = level.get_node("Walls")
	var frames: MultiMeshInstance3D = level.get_node("DoorFrames")
	var exit: MultiMeshInstance3D = level.get_node("Airlock")
	var valid: bool = walls.multimesh.instance_count == 147 and frames.multimesh.instance_count == 42 and exit.multimesh.instance_count == 3
	var count: int = level.get_child_count()
	level.build(grid)
	valid = valid and level.get_child_count() == count and count <= 12
	level.free()
	return "" if valid else "Geometry counts or batched rebuild failed"
