import { useState } from 'react';
import {
  Clock,
  Flag,
  Heart,
  MapPin,
  Navigation,
  Share2,
  Wallet,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/components/ui/Toast';
import { Modal, ModalCloseButton } from '@/components/ui/Modal';
import { Button, AnchorButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  AccessibilityIcons,
  ImageCarousel,
  SafetyScore,
} from '@/components/ui/Shared';
import { FeedbackForm } from './FeedbackForm';
import { directionsUrl, formatDistance, formatWalkTime } from '@/lib/geo';
import { itemTypeLabel, thirdSpaceLabel } from '@/lib/format';
import { hasEnoughReports } from '@/services/feedbackService';
import type { Installation, MapItem, ThirdSpace } from '@/types';
import { ExampleBadge } from '@/components/ui/ExampleBadge';
import { appUrl } from '@/lib/url';

interface Props {
  item: MapItem;
  distance: number | null;
  onClose: () => void;
}

/** Prompts 9 & 32 — the detail sheet for public art and third spaces. */
export function LocationDetailModal({ item, distance, onClose }: Props) {
  const user = useAppStore((s) => s.user);
  const isSaved = useAppStore((s) => s.isSaved);
  const toggleSaved = useAppStore((s) => s.toggleSaved);
  const userLocation = useAppStore((s) => s.userLocation);
  const setMapCenter = useAppStore((s) => s.setMapCenter);
  const safety = useAppStore((s) => s.data?.safety);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [savingSave, setSavingSave] = useState(false);

  const isInstallation = item.type === 'installation';
  const installation = isInstallation ? (item.raw as Installation) : null;
  const space = item.type === 'third_space' ? (item.raw as ThirdSpace) : null;

  const images = installation?.images ?? (space?.image_url ? [space.image_url] : []);
  const description = installation?.description ?? space?.description ?? null;
  const address = installation?.address ?? space?.address ?? null;
  const summary = safety?.get(item.id);
  const saved = isSaved(item.type, item.id);

  async function handleSave() {
    if (!user) {
      toast.show('Sign in to save places you want to come back to.', 'info', {
        label: 'Log in',
        onClick: () => window.location.assign(appUrl('/login')),
      });
      return;
    }
    setSavingSave(true);
    try {
      const nowSaved = await toggleSaved(item.type, item.id);
      toast.success(nowSaved ? 'Saved to your profile.' : 'Removed from your saved places.');
      if (nowSaved) void markJourney('explored');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that.');
    } finally {
      setSavingSave(false);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/discover?item=${item.type}:${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied.');
      }
    } catch {
      /* the user dismissed the share sheet */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      flushBody
      label={item.title}
      header={
        <div style={{ position: 'relative' }}>
          <ModalCloseButton onClose={onClose} />
          <ImageCarousel images={images} alt={item.title} />
        </div>
      }
      footer={
        <>
          <Button
            variant={saved ? 'secondary' : 'text'}
            onClick={handleSave}
            loading={savingSave}
            icon={<Heart size={15} fill={saved ? 'currentColor' : 'none'} />}
          >
            {saved ? 'Saved' : 'Save'}
          </Button>
          <AnchorButton
            href={directionsUrl(item.location, userLocation)}
            variant="primary"
            icon={<Navigation size={15} />}
          >
            Get directions
          </AnchorButton>
          <Button variant="ghost" onClick={handleShare} icon={<Share2 size={15} />}>
            Share
          </Button>
        </>
      }
    >
      <div className="stack" style={{ padding: '1rem' }}>
        <div>
          <div className="row" style={{ marginBottom: '0.35rem' }}>
            <Badge tone={isInstallation ? 'pink' : 'success'}>{itemTypeLabel(item.type)}</Badge>
            {installation?.category ? (
              <Badge tone="neutral">{installation.category}</Badge>
            ) : null}
            {space ? <Badge tone="neutral">{thirdSpaceLabel(space.type)}</Badge> : null}
            {installation?.is_temporary ? <Badge tone="warning">Temporary</Badge> : null}
            <ExampleBadge show={item.raw.is_example} />
          </div>

          <h2 style={{ marginBottom: '0.2rem' }}>{item.title}</h2>
          {item.subtitle ? <p className="muted small">{item.subtitle}</p> : null}
        </div>

        {distance != null ? (
          <div className="row small muted">
            <MapPin size={14} aria-hidden="true" />
            {formatDistance(distance)} away · {formatWalkTime(distance)}
          </div>
        ) : null}

        {description ? <p>{description}</p> : null}

        {space ? (
          <div className="row" style={{ gap: '1rem' }}>
            {space.hours_open ? (
              <span className="row small muted" style={{ gap: '0.3rem' }}>
                <Clock size={14} aria-hidden="true" />
                {space.hours_open}
              </span>
            ) : null}
            {space.cost ? (
              <span className="row small muted" style={{ gap: '0.3rem' }}>
                <Wallet size={14} aria-hidden="true" />
                {space.cost}
              </span>
            ) : null}
          </div>
        ) : null}

        {address ? (
          <div>
            <p className="small" style={{ marginBottom: '0.2rem' }}>
              {address}
            </p>
            <button
              className="link-btn"
              onClick={() => {
                setMapCenter(item.location, 17);
                onClose();
              }}
            >
              View on map
            </button>
          </div>
        ) : null}

        {item.accessibility.length > 0 ? (
          <div>
            <h4 style={{ marginBottom: '0.35rem' }}>Getting in</h4>
            <AccessibilityIcons tags={item.accessibility} />
          </div>
        ) : null}

        <hr className="divider" />

        <div>
          <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0 }}>How this place feels</h4>
            {!feedbackOpen ? (
              <button className="link-btn" onClick={() => setFeedbackOpen(true)}>
                Add your report
              </button>
            ) : null}
          </div>

          {hasEnoughReports(summary) && summary ? (
            <SafetyScore summary={summary} />
          ) : (
            <p className="small muted">
              Not enough reports yet — we show a score once at least three people have shared how a
              place felt.
            </p>
          )}

          {feedbackOpen ? (
            <div style={{ marginTop: '0.75rem' }}>
              <FeedbackForm locationId={item.id} onSubmitted={() => setFeedbackOpen(false)} />
            </div>
          ) : null}
        </div>

        <button
          className="link-btn muted tiny row"
          style={{ gap: '0.3rem' }}
          onClick={() =>
            toast.show('Thanks — the Inclusivity Department will look at this within 48 hours.')
          }
        >
          <Flag size={12} aria-hidden="true" />
          Report a problem with this listing
        </button>
      </div>
    </Modal>
  );
}
