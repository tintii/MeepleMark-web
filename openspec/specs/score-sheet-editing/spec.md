# score-sheet-editing Specification

## Purpose
TBD - created by archiving change ios-parity-responsive-web. Update Purpose after archive.
## Requirements
### Requirement: Score-sheet categories are editable and reorderable
The editor SHALL support adding, renaming, removing, and reordering one to ten non-empty categories, choosing high/low win direction and ranked/flagged outcome, and saving or deleting a game's sheet. Reordering SHALL have explicit touch and keyboard controls, independent of drag gestures. Validation failures SHALL be visible without discarding entered values.

#### Scenario: Reorder categories
- **WHEN** the user moves the third category above the second and saves
- **THEN** the saved sheet and subsequent templated plays display that order

#### Scenario: Reject an invalid sheet
- **WHEN** a submitted sheet contains an empty label or exceeds ten categories
- **THEN** saving is refused with a visible explanation and the current entries remain editable

### Requirement: Versioning reflects real sheet changes
Saving an unchanged sheet SHALL preserve its version. Changes to category order, labels, or rules SHALL advance its version through the existing template storage semantics. Category keys SHALL remain unique under the existing slug/key rules.

#### Scenario: Reorder and save again
- **WHEN** a reordered sheet is saved and then saved again without further changes
- **THEN** the first save advances the version and the second does not

### Requirement: Applying a sheet creates an independent snapshot
Plain scoring SHALL remain the default. A matching game's saved sheet SHALL be offered but applied only after explicit selection. Applying it SHALL embed the category order/version and copy its win direction and outcome before the new play is persisted. Later sheet edits or deletion SHALL NOT change existing plays.

#### Scenario: Edit a sheet after a play starts
- **WHEN** a game's sheet is reordered or deleted after a templated play has been created
- **THEN** that play still opens with its original categories, rules, version, and recorded values

#### Scenario: Failed initial save
- **WHEN** saving a newly selected templated play fails
- **THEN** the form retains the user's selections, displays the failure, and does not navigate or leave a newly created plain play in history
