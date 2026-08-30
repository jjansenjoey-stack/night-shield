import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { eventToMapItem } from '@/services/api';

/** Prompt 50 — organizers create events here. */
export function CreateEventPage() {
  const navigate = useNavigate();
  const refreshData = useAppStore((s) => s.refreshData);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  return (
    <div className="page">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        icon={<ArrowLeft size={15} />}
        className="small"
      >
        Back
      </Button>

      <h1 style={{ fontSize: '1.7rem', marginTop: '0.5rem' }}>Create an event</h1>
      <p className="page__lede">
        Anyone in Tilburg can see this once it&rsquo;s published. Be honest about accessibility —
        people plan their evening around it.
      </p>

      <div className="card">
        <EventForm
          onSaved={async (event) => {
            await refreshData();
            void markJourney('contributed');
            toast.success('Event published.');
            navigate('/events');
            const item = eventToMapItem(event);
            if (item) setSelectedItem(item);
          }}
          onCancel={() => navigate('/events')}
        />
      </div>
    </div>
  );
}
