class_name SceneCleanup
extends RefCounted
## Keep sound resources alive until the mix thread has released stopped playbacks.

const DRAIN_TIMEOUT_MS: int = 1000


static func dispose(tree: SceneTree, scene: Node) -> bool:
	var playbacks: Array[WeakRef] = []
	var streams: Array[AudioStream] = []
	var stack: Array[Node] = [scene]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		node.set_process(false)
		node.set_physics_process(false)
		if node is AudioStreamPlayer or node is AudioStreamPlayer2D or node is AudioStreamPlayer3D:
			var stream: AudioStream = node.get("stream")
			if stream != null:
				streams.append(stream)
			if node.call("has_stream_playback"):
				playbacks.append(weakref(node.call("get_stream_playback")))
			node.call("stop")
		for child: Node in node.get_children():
			stack.append(child)
	var deadline: int = Time.get_ticks_msec() + DRAIN_TIMEOUT_MS
	while _pending(playbacks) > 0 and Time.get_ticks_msec() < deadline:
		await tree.create_timer(0.01).timeout
	var pending: int = _pending(playbacks)
	scene.queue_free()
	await tree.process_frame
	# streams intentionally remain strongly held until native playback teardown is done.
	streams.clear()
	if pending > 0:
		printerr("FAIL audio shutdown timed out with %d pending playbacks" % pending)
	return pending == 0


static func _pending(playbacks: Array[WeakRef]) -> int:
	var count: int = 0
	for playback: WeakRef in playbacks:
		if playback.get_ref() != null:
			count += 1
	return count
