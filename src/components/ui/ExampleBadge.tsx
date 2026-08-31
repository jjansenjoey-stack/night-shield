import { FlaskConical } from 'lucide-react';
import { Badge } from './Badge';

/**
 * Marks content that was invented for the demo.
 *
 * Everything seeded in this app is made up — plausible for Tilburg, but nobody
 * has booked a room, hidden a cache or scheduled a course. Presenting that as
 * real would be the one genuinely dishonest thing the app could do, so the mark
 * goes on the card where people look, not only on the detail sheet where they
 * might not.
 *
 * It doubles as a worked example: an organiser reading it is looking at the
 * shape their own listing would take.
 */
export function ExampleBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <Badge tone="warning" icon={<FlaskConical size={12} />} title="Invented for this demo">
      Example
    </Badge>
  );
}
