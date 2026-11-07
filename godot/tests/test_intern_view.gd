extends RefCounted


func test_intern_attachments_identity_and_local_camera_layer() -> String:
	var intern: InternView = InternView.new()
	intern.build(1, false, true)
	var valid: bool = true
	for label: String in ["Head", "Chest", "HandR", "HandL"]:
		valid = valid and intern.get_node_or_null(label) is Marker3D
	for label: String in ["LensL", "LensR", "FilterL", "FilterR", "ChestTank", "HoseA", "HandNozzle"]:
		var part: MeshInstance3D = intern.get_node_or_null(label)
		valid = valid and part != null and part.layers == 2
	var number: Label3D = intern.get_node("BackNumber")
	valid = valid and number.text == "01"
	intern.build(8)
	number = intern.get_node("BackNumber")
	valid = valid and number.text == "08"
	intern.free()
	return "" if valid else "Intern attachment, identity or local-view visibility failed"
