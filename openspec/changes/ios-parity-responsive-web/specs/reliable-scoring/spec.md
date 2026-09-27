## ADDED Requirements

### Requirement: Scoring preserves the shared engine contract
All totals, ranks, warning messages, and winner summaries SHALL come from the existing engine and summary functions. Scores SHALL use exact decimals and persist as decimal strings. High/low direction, standard competition ranks, draft status, and explicit completion SHALL retain their established semantics. A play SHALL remain usable without live game/player/template records.

#### Scenario: Exact arithmetic and ranking
- **WHEN** scores include `0.1 + 0.2` category totals or ranked totals `75, 62, 62, 51`
- **THEN** the displayed results are respectively `0.3` and ranks `1, 2, 2, 4`, matching the unchanged golden contract

### Requirement: Manual overrides remain visible and sticky
Plain and category scoring SHALL mark manually overridden ranks with text. Category scoring SHALL mark overridden totals and expose Recompute. Subsequent score/category edits SHALL preserve overrides until explicitly cleared or recomputed. Clearing a rank SHALL restore automatic ranking.

#### Scenario: Preserve an override
- **WHEN** the user enters a manual total and rank, then edits a category
- **THEN** both overrides remain active and visibly labelled, including after reload

### Requirement: Flagged outcomes have explicit controls
Both scoring layouts SHALL expose per-player win/loss controls for flagged outcomes and omit rank inputs in that mode. Unset flags SHALL remain unset until chosen. Results SHALL persist and drive the engine's completion summary.

#### Scenario: Record a cooperative result
- **WHEN** a flagged play's participants are marked as having won and the play is completed
- **THEN** those flags survive reopening and the recorded summary reflects the engine's winners

### Requirement: Saves preserve edit ordering and expose failures
Draft mutations SHALL operate on the latest in-memory state and persist in order per play. The UI SHALL distinguish loading failure from saving/pending/error states, retain editable input after failure, and provide retry. Stale operations from a previous play SHALL NOT replace the current play or its save state.

#### Scenario: Rapid edits during a delayed save
- **WHEN** the user edits several fields while storage writes are delayed
- **THEN** all accepted edits are present after the saves finish and the play reloads

#### Scenario: Recover from a failed write
- **WHEN** a write fails and then retry succeeds
- **THEN** the input remains available throughout, the latest values persist, and the save error clears only after successful acknowledgement

### Requirement: Completion confirms durable persistence
Completion SHALL await pending edits and the completed play write before offering collection membership or displaying Play recorded. Repeated completion submissions SHALL be prevented while pending. Success SHALL offer View Plays leading to the root history. An unowned game's collection offer SHALL occur once for that completion action and SHALL NOT repeat on revisiting a completed play.

#### Scenario: Failed completion
- **WHEN** the completed play write fails
- **THEN** no success or collection dialog is shown, and the user can retry without re-entering scores

#### Scenario: Collection write fails after completion
- **WHEN** the play saves but adding the game to Collection fails
- **THEN** the saved play stays complete and the offer shows an error with retry and Not now choices

### Requirement: Navigation and deletion coordinate with pending edits
In-app navigation SHALL wait for pending valid writes or let the user explicitly leave after a failure. Unfinished numeric text SHALL be preserved while editing and SHALL NOT be silently treated as successfully saved; completion SHALL ask the user to resolve it. The app SHALL request the browser's unsaved-change protection for pending/failed changes on unload where supported. Deletion SHALL coordinate with queued writes for the same play.

#### Scenario: Leave after a failed save
- **WHEN** an in-app navigation is requested while the latest save has failed
- **THEN** the user can retry or explicitly leave without saving, and neither path falsely acknowledges persistence

#### Scenario: Delete with a pending write
- **WHEN** deletion is confirmed while an earlier write for that play remains pending
- **THEN** the final persisted state is deleted and no late write restores the play
