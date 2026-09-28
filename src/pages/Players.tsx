import { useEffect, useState, type FormEvent } from "react";
import { createPlayer, deletePlayer, listPlayers, updatePlayer, type PlayerRecord } from "../storage/db";
import { Dialog } from "../components/Dialog";
import { GroupedSection, PageHeader } from "../components/PageHeader";
import { useAccount } from "../account/accountState";

const COLOR_NAMES = ["Coral", "Apricot", "Butter", "Mint", "Aqua", "Periwinkle", "Lavender", "Pink"];

interface PlayerForm {
  displayName: string;
  bggUsername: string;
  preferredColorIndex: number | null;
}

const emptyForm = (): PlayerForm => ({ displayName: "", bggUsername: "", preferredColorIndex: null });

export function Players() {
  const { workspace } = useAccount();
  const canWrite = workspace.kind === "guest" || (workspace.kind === "account" && workspace.capabilities.write);
  const [players, setPlayers] = useState<PlayerRecord[] | null>(null);
  const [newPlayer, setNewPlayer] = useState<PlayerForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PlayerForm>(emptyForm);
  const [deleting, setDeleting] = useState<PlayerRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload(cancelled?: { value: boolean }) {
    const all = await listPlayers();
    const sorted = [...all].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
    if (!cancelled?.value) setPlayers(sorted);
  }

  useEffect(() => {
    const cancelled = { value: false };
    void listPlayers().then((all) => {
      const sorted = [...all].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
      if (!cancelled.value) setPlayers(sorted);
    });
    return () => { cancelled.value = true; };
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    try {
      await createPlayer(newPlayer);
      setNewPlayer(emptyForm());
      setError(null);
      await reload();
    } catch {
      setError("Enter a display name before saving this player.");
    }
  }

  function startEditing(player: PlayerRecord) {
    setEditingId(player.id);
    setEditForm({ displayName: player.displayName, bggUsername: player.bggUsername ?? "", preferredColorIndex: player.preferredColorIndex });
    setError(null);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    try {
      await updatePlayer(editingId, editForm);
      setEditingId(null);
      setError(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The player could not be saved.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await deletePlayer(deleting.id);
    if (editingId === deleting.id) setEditingId(null);
    setDeleting(null);
    await reload();
  }

  function colorSelect(value: number | null, onChange: (value: number | null) => void) {
    return (
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}>
        <option value="">Automatic</option>
        {COLOR_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
      </select>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Players" subtitle="Local player details for faster setup. No network requests are made." />

      {canWrite ? <GroupedSection title="Add player">
        <form onSubmit={handleAdd}>
          <label className="field"><span className="field-label">Display name</span><input value={newPlayer.displayName} onChange={(event) => setNewPlayer((form) => ({ ...form, displayName: event.target.value }))} /></label>
          <label className="field"><span className="field-label">BGG username <span className="field-hint">(optional, stored locally)</span></span><input value={newPlayer.bggUsername} onChange={(event) => setNewPlayer((form) => ({ ...form, bggUsername: event.target.value }))} /></label>
          <label className="field"><span className="field-label">Preferred colour</span>{colorSelect(newPlayer.preferredColorIndex, (preferredColorIndex) => setNewPlayer((form) => ({ ...form, preferredColorIndex })))}</label>
          <button type="submit">Add player</button>
        </form>
      </GroupedSection> : <p className="type-caption">This account is read-only. Saved players are available to browse.</p>}

      {error && <p role="alert" className="form-error">{error}</p>}
      {players === null && <p className="type-caption">Loading…</p>}
      {players !== null && players.length === 0 && <p className="type-caption">No saved players yet.</p>}
      {players !== null && players.length > 0 && (
        <ul className="play-list" aria-label="Saved players" data-dialog-fallback tabIndex={-1}>
          {players.map((player) => (
            <li key={player.id} className="directory-row">
              {editingId === player.id ? (
                <form onSubmit={saveEdit} className="edit-player-form">
                  <label className="field"><span className="field-label">Display name</span><input value={editForm.displayName} onChange={(event) => setEditForm((form) => ({ ...form, displayName: event.target.value }))} /></label>
                  <label className="field"><span className="field-label">BGG username</span><input value={editForm.bggUsername} onChange={(event) => setEditForm((form) => ({ ...form, bggUsername: event.target.value }))} /></label>
                  <label className="field"><span className="field-label">Preferred colour</span>{colorSelect(editForm.preferredColorIndex, (preferredColorIndex) => setEditForm((form) => ({ ...form, preferredColorIndex })))}</label>
                  <div className="action-row"><button type="submit">Save changes</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button><button type="button" className="destructive-button" onClick={() => setDeleting(player)}>Delete player</button></div>
                </form>
              ) : (
                <div className="directory-summary">
                  <span className={`player-colour-swatch${player.preferredColorIndex == null ? " is-automatic" : ""}`} style={player.preferredColorIndex == null ? undefined : { background: `var(--color-player-${player.preferredColorIndex + 1}-fill)` }} aria-label={player.preferredColorIndex == null ? "Automatic colour" : `${COLOR_NAMES[player.preferredColorIndex]} preferred colour`} role="img" />
                  <div><strong>{player.displayName}</strong>{player.bggUsername && <div className="type-caption">BGG: {player.bggUsername}</div>}</div>
                  {canWrite && <button type="button" onClick={() => startEditing(player)}>Edit</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <Dialog title={`Delete ${deleting.displayName}?`} message="Recorded plays keep their historical names and scores." onCancel={() => setDeleting(null)}>
          <button type="button" className="destructive-button" onClick={confirmDelete}>Delete player</button>
          <button type="button" onClick={() => setDeleting(null)}>Cancel</button>
        </Dialog>
      )}
    </div>
  );
}
