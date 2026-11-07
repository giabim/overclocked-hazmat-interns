extends RefCounted
## Bots (M4). The league is small by default; run the full 50-shift league with BOT_LEAGUE=1.

const DT: float = 1.0 / Tuning.TICK_RATE


func _lab() -> MapGrid:
	return MapGrid.from_text(FileAccess.get_file_as_string("res://maps/lab_a.txt"))


func test_bots_join_as_players_on_their_own_spawns() -> String:
	var levels: Array[int] = [1, 2, 3]
	var state: GameState = GameState.create(_lab(), 1, 4, true, levels)
	if state.players.size() != 4 or state.brains.size() != 4 or state.brains[0] != null:
		return "Expected 1 human + 3 bots"
	if state.participants != 4 or state.quota() != Tuning.BASE_QUOTA + 4 or state.specimens.size() != 2:
		return "Bots must count as participants for quota and specimens"
	var spots: Dictionary = {}
	for player: PlayerState in state.players:
		spots[player.position] = true
	if spots.size() != 4:
		return "Players must start on different spawn cells"
	for index: int in range(1, 4):
		if state.brains[index].level != levels[index - 1] or state.players[index].id != index:
			return "Bot %d has the wrong level or id" % index
	var many: Array[int] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
	if GameState.create(_lab(), 1, 4, true, many).players.size() != Tuning.MAX_PARTICIPANTS:
		return "At most 7 bots can join"
	return ""


func test_bot_delivers_with_ordinary_inputs() -> String:
	var levels: Array[int] = [1]
	var state: GameState = GameState.create(_lab(), 1, 8, false, levels)
	var bot: PlayerState = state.players[1]
	var brain: BotBrain = state.brains[1]
	for tick: int in 60 * Tuning.TICK_RATE:
		var input: PlayerInput = brain.think(state, bot, 0.0)
		if input.move.length() > 1.001:
			return "Bot input is stronger than a human's"
		Rules.advance(state, PlayerInput.new(), DT)
		for event: Dictionary in state.events:
			if event.get("kind") == &"delivery" and event.get("player") == 1:
				return ""
	return "A Trainee bot should deliver a canister within 60 s"


func test_perception_is_line_of_sight_or_hearing() -> String:
	var grid: MapGrid = MapGrid.from_text("#############\n#P..........#\n#.#########.#\n#...........#\n#############")
	var state: GameState = GameState.create(grid, 1, 1, false)
	var brain: BotBrain = BotBrain.create(2, 1)
	var me: PlayerState = state.player
	var hound: SpecimenState = SpecimenState.new()
	hound.kind = SpecimenState.Kind.HOUND
	hound.set_mode(SpecimenState.Mode.PATROL)
	state.specimens.append(hound)
	# Behind the long wall, 14 m away along the corridor but 4 m in a straight line: heard.
	hound.position = grid.cell_center(Vector2i(1, 3))
	if not brain.perceive(state, me).has(hound):
		return "A hound within 12 m should be heard through walls"
	hound.position = grid.cell_center(Vector2i(11, 3))
	if brain.perceive(state, me).has(hound):
		return "A hound out of sight and out of earshot must stay unknown"
	hound.position = grid.cell_center(Vector2i(8, 1))
	if not brain.perceive(state, me).has(hound):
		return "A hound in plain sight must be seen"
	hound.set_mode(SpecimenState.Mode.FROZEN, 5.0)
	hound.position = grid.cell_center(Vector2i(3, 3))
	if brain.perceive(state, me).has(hound):
		return "A frozen specimen behind a wall makes no sound"
	return ""


func test_supervisors_split_up_canisters() -> String:
	var levels: Array[int] = [3, 3, 3]
	var state: GameState = GameState.create(_lab(), 1, 2, false, levels)
	Rules.advance(state, PlayerInput.new(), DT)
	var targets: Dictionary = {}
	for index: int in range(1, 4):
		var brain: BotBrain = state.brains[index]
		if brain.goal != BotBrain.Goal.CANISTER or targets.has(brain.target_canister):
			return "Supervisors should claim different canisters"
		targets[brain.target_canister] = true
	return ""


func test_bot_league_ranks_levels_and_bots_keep_moving() -> String:
	var full: bool = OS.get_environment("BOT_LEAGUE") == "1"
	var shifts: int = 50 if full else 3
	var seconds: float = Tuning.SHIFT_SECONDS if full else 150.0
	var medians: Array[int] = []
	for level: int in [1, 2, 3]:
		var scores: Array[int] = []
		for seed_value: int in shifts:
			var levels: Array[int] = [level, level, level]
			var state: GameState = GameState.create(_lab(), 4, seed_value, true, levels)
			state.brains[0] = BotBrain.create(level, seed_value * 7 + 1)
			state.quota_override = 999
			for tick: int in int(seconds * Tuning.TICK_RATE):
				Rules.advance(state, PlayerInput.new(), DT)
				for index: int in state.players.size():
					var brain: BotBrain = state.brains[index]
					var away: bool = state.players[index].position.distance_to(brain.target_point) > 1.5
					if away and brain.still_time > 5.0:
						return "Lv%d bot %d stood still for 5 s on its way to %s" % [level, index, BotBrain.Goal.keys()[brain.goal]]
				if state.finished():
					break
			scores.append(state.score)
			if full and (seed_value + 1) % 10 == 0:
				print("Bot league Lv%d: %d/%d shifts" % [level, seed_value + 1, shifts])
		scores.sort()
		medians.append(scores[scores.size() / 2])
		if full:
			print("Bot league Lv%d median: %d" % [level, medians[-1]])
	if not (medians[2] > medians[1] and medians[1] > medians[0]):
		return "Median scores should rank Lv3 > Lv2 > Lv1, got %s" % [medians]
	return ""
