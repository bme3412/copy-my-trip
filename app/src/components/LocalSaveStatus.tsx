import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCity } from '../state/CityContext';
import { useLocalTrips } from '../state/TripContext';
export function downloadFile(name: string, body: string, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function LocalSaveStatus() {
    const store = useLocalTrips();
    const [confirm, setConfirm] = useState(false);
    return <details className="companion-panel workspace-recovery"><summary>Backup & recovery</summary>
      {store.blocked && <p role="alert">{store.status}</p>}
      <p>Plans are stored in this browser. Export a backup before clearing browser data or using another device.</p>
      <div className="companion-actions">
        <button onClick={() => downloadFile('copy-my-trip-backup.json', JSON.stringify(store.data, null, 2))}>Export current workspace</button>
        {store.recovery && <><button onClick={() => downloadFile('copy-my-trip-original.txt', store.recovery!, 'text/plain')}>Export original data</button><button onClick={store.recover}>Import older data as drafts</button></>}
        <button onClick={store.retry}>Retry saving</button><button onClick={() => setConfirm(true)}>Reset local workspace…</button>
      </div>
      {confirm && <div role="alert"><p>This removes this workspace's saved versions and drafts. Export a backup first.</p><button onClick={() => { store.reset(); setConfirm(false); }}>Confirm reset</button> <button onClick={() => setConfirm(false)}>Cancel</button></div>}
    </details>;
}

/** Interrupt only when saving actually needs attention. */
export function StorageWarning() {
  const store = useLocalTrips();
  const city = useCity();
  if (!store.blocked) return null;
  return <div className="storage-warning" role="alert">{store.status} <Link to={`/${city.id}/saved`}>Open backup & recovery</Link></div>;
}
