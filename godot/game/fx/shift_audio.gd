class_name ShiftAudio
extends Node
## Original synthesized placeholder cues; no external audio assets.

var _player: AudioStreamPlayer
var _clips: Dictionary = {}


func _ready() -> void:
	_player = AudioStreamPlayer.new()
	_player.max_polyphony = 4
	_player.volume_db = -12
	add_child(_player)
	_clips[&"pickup"] = _make_clip(0.18, 740, 390, false)
	_clips[&"delivery"] = _make_clip(0.42, 380, 960, true)
	_clips[&"heat_warning"] = _make_clip(0.65, 660, 440, false)
	_clips[&"success"] = _make_clip(0.7, 440, 880, false)
	_clips[&"failure"] = _make_clip(0.7, 240, 90, false)
	_clips[&"extraction"] = _make_clip(0.3, 520, 1040, false)
	_clips[&"foam_fired"] = _make_clip(0.18, 220, 110, true)
	_clips[&"foam_hit"] = _make_clip(0.16, 940, 580, true)
	_clips[&"foam_miss"] = _make_clip(0.1, 180, 90, true)
	_clips[&"contained"] = _make_clip(0.4, 440, 1040, false)
	_clips[&"door_open"] = _make_clip(0.16, 480, 720, false)
	_clips[&"hound_windup"] = _make_clip(Tuning.HOUND_WINDUP_SECONDS, 700, 1500, true)
	_clips[&"hound_wall_stun"] = _make_clip(0.25, 300, 100, true)
	_clips[&"caught"] = _make_clip(0.3, 160, 60, true)
	_clips[&"canister_dropped"] = _make_clip(0.2, 520, 210, false)
	_clips[&"grenade_pickup"] = _make_clip(0.15, 600, 900, false)
	_clips[&"grenade_thrown"] = _make_clip(0.2, 300, 520, true)
	_clips[&"grenade_burst"] = _make_clip(0.45, 1200, 200, true)
	_clips[&"slime_notice"] = _make_clip(0.35, 140, 90, true)
	_clips[&"hound_notice"] = _make_clip(0.3, 900, 1400, true)
	_clips[&"sensor_sweep"] = _make_clip(0.25, 1200, 1200, false)


func play_event(kind: StringName) -> void:
	if _clips.has(kind):
		_player.stream = _clips[kind]
		_player.play()


func set_volume(value: float) -> void:
	_player.volume_db = -12 + linear_to_db(maxf(value, 0.0001))
	_player.stream_paused = value <= 0


func _exit_tree() -> void:
	_player.stop()
	_player.stream = null
	_clips.clear()


static func _make_clip(seconds: float, start_hz: float, end_hz: float, noisy: bool) -> AudioStreamWAV:
	var rate: int = 22050
	var count: int = int(seconds * rate)
	var data: PackedByteArray = PackedByteArray()
	data.resize(count * 2)
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 472
	var phase: float = 0
	for index: int in count:
		var progress: float = float(index) / count
		phase += TAU * lerpf(start_hz, end_hz, progress) / rate
		var envelope: float = sin(PI * minf(1, progress * 12)) if progress < 0.08 else pow(1 - progress, 2)
		var sample: float = sin(phase) * 0.65 + sin(phase * 2.1) * 0.15
		if noisy:
			sample += rng.randf_range(-0.2, 0.2)
		data.encode_s16(index * 2, int(clampf(sample * envelope, -1, 1) * 20000))
	var clip: AudioStreamWAV = AudioStreamWAV.new()
	clip.format = AudioStreamWAV.FORMAT_16_BITS
	clip.mix_rate = rate
	clip.data = data
	return clip


## Seamless loop for positional specimen sounds (whole cycles, no envelope).
static func make_loop(seconds: float, hz: float, noisy: bool) -> AudioStreamWAV:
	var rate: int = 22050
	var cycles: int = maxi(1, roundi(seconds * hz))
	var count: int = int(round(cycles * rate / hz))
	var data: PackedByteArray = PackedByteArray()
	data.resize(count * 2)
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 91
	for index: int in count:
		var phase: float = TAU * cycles * float(index) / count
		var sample: float = sin(phase) * 0.45 + sin(phase * 3.0) * 0.12
		if noisy:
			sample += rng.randf_range(-0.25, 0.25) * (0.5 + 0.5 * sin(phase / cycles * 4.0))
		data.encode_s16(index * 2, int(clampf(sample, -1, 1) * 14000))
	var clip: AudioStreamWAV = AudioStreamWAV.new()
	clip.format = AudioStreamWAV.FORMAT_16_BITS
	clip.mix_rate = rate
	clip.data = data
	clip.loop_mode = AudioStreamWAV.LOOP_FORWARD
	clip.loop_begin = 0
	clip.loop_end = count
	return clip
