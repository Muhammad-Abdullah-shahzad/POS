import { useNavStore } from '../store/useNavStore';
import { getDestinations } from '../nav/navGraph';

/**
 * Overlay dropdown for choosing a destination. Writing the selection into the
 * store triggers A* and, in turn, the arrow re-render.
 */
export function DestinationPicker() {
  const destinationId = useNavStore((s) => s.destinationId);
  const setDestination = useNavStore((s) => s.setDestination);
  const destinations = getDestinations();

  return (
    <div className="pointer-events-auto rounded-2xl bg-slate-900/80 p-3 shadow-lg backdrop-blur">
      <label htmlFor="destination" className="mb-1 block text-xs font-medium text-slate-400">
        Destination
      </label>
      <select
        id="destination"
        value={destinationId ?? ''}
        onChange={(event) => setDestination(event.target.value || null)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-guide focus:outline-none"
      >
        <option value="">Choose a destination…</option>
        {destinations.map((node) => (
          <option key={node.id} value={node.id}>
            {node.label}
          </option>
        ))}
      </select>
    </div>
  );
}
