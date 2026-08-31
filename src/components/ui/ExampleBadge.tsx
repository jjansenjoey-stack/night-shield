import { Flag } from 'lucide-react';
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
export function ExampleBadge({
  show = true,
  iconOnly,
}: {
  show?: boolean;
  /**
   * For rows with no space for a worded badge — a map list, a carousel pill.
   * The flag still carries the meaning; the word moves into the label so it
   * is read out and shown on hover rather than lost.
   */
  iconOnly?: boolean;
}) {
  if (!show) return null;
  if (iconOnly) {
    return (
      <span className="example-flag" title="Example — invented for this demo">
        <Flag size={12} aria-hidden="true" />
        <span className="sr-only">Example — invented for this demo</span>
      </span>
    );
  }
  return (
    <Badge tone="warning" icon={<Flag size={12} />} title="Invented for this demo">
      Example
    </Badge>
  );
}
