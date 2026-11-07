extends RefCounted


func test_feedback_preserves_sim_events_and_normalizes_world_positions() -> String:
	var bus: Feedback = Feedback.new()
	var received: Array[Dictionary] = []
	bus.fx.connect(func(kind: StringName, data: Dictionary) -> void:
		received.append({"kind": kind, "position": data["position"]})
	)
	var events: Array[Dictionary] = [{"kind": &"pickup"}, {"kind": &"foam_hit", "position": Vector2(3, 5)}]
	bus.publish(events, Vector3(9, 1, 8))
	var valid: bool = received.size() == 2 and not events[0].has("position") and events[1]["position"] is Vector2
	valid = valid and received[0]["position"] == Vector3(9, 1, 8) and received[1]["position"] == Vector3(3, 0.7, 5)
	bus.free()
	return "" if valid else "Feedback must preserve sim events and convert positions consistently"
