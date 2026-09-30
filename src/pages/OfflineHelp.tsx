import { PageHeader, GroupedSection } from "../components/PageHeader";

export function OfflineHelp() {
  return (
    <div className="page">
      <PageHeader
        title="Offline use"
        subtitle="What the green status indicator means and what remains available without a connection."
      />

      <GroupedSection title="Ready for offline use">
        <p>The green indicator means MeepleMark's app files have been cached on this device. Supported screens can reopen without a network connection, and records already stored in this browser remain available.</p>
        <p>You can create and edit games, players, and plays, enter scores, and view locally available history while offline. Signed-in changes are saved locally first and wait to sync until the server is reachable.</p>
      </GroupedSection>

      <GroupedSection title="What it does not mean">
        <p>The indicator describes the cached app, not your current connection or sync status. A connection is still required for a first visit, signing in or unlocking an account, downloading records that are not already on this device, and synchronizing changes.</p>
        <p>Offline data belongs to this browser profile. Clearing site data, using private browsing, or browser storage eviction can remove it, so the indicator is not a permanent-storage or backup guarantee.</p>
      </GroupedSection>
    </div>
  );
}
