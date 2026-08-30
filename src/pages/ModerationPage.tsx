import { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, MapPin, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Card, Section } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { Field, SafeImage } from '@/components/ui/Shared';
import { useToast } from '@/components/ui/Toast';
import {
  approveSubmission,
  getPendingSubmissions,
  rejectSubmission,
  SUBMISSION_TYPE_LABELS,
} from '@/services/submissionService';
import { awardBadge, BADGES } from '@/services/pointsService';
import { relativeTime } from '@/lib/format';
import type { CommunitySubmission } from '@/types';

/** Prompt 28 — what moderators see. */
export function ModerationPage() {
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);
  const toast = useToast();

  const [queue, setQueue] = useState<CommunitySubmission[] | null>(null);
  const [rejecting, setRejecting] = useState<CommunitySubmission | null>(null);
  const [notes, setNotes] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    getPendingSubmissions()
      .then(setQueue)
      .catch(() => setQueue([]));
  }, []);

  useEffect(load, [load]);

  async function handleApprove(submission: CommunitySubmission) {
    if (!user) return;
    setBusyId(submission.id);
    try {
      await approveSubmission(submission.id, user.id);
      // The contributor earns their badge the moment something they added goes live.
      await awardBadge(submission.submitted_by, BADGES.contributor).catch(() => null);
      toast.success('Approved and published.');
      await refreshData();
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not approve that.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!user || !rejecting) return;
    setBusyId(rejecting.id);
    try {
      await rejectSubmission(rejecting.id, user.id, notes.trim() || 'No reason given.');
      toast.success('Rejected — the contributor can see your note.');
      setRejecting(null);
      setNotes('');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reject that.');
    } finally {
      setBusyId(null);
    }
  }

  if (queue === null) return <LoadingBlock label="Loading the queue…" />;

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.8rem' }}>Moderation queue</h1>
      <p className="page__lede">
        {queue.length === 0
          ? 'Nothing waiting.'
          : `${queue.length} submission${queue.length === 1 ? '' : 's'} waiting for review.`}
      </p>

      {queue.length === 0 ? (
        <EmptyState
          icon={<Inbox size={24} />}
          title="Queue is clear"
          message="New community submissions land here as soon as they are sent."
        />
      ) : (
        <Section title="Pending">
          <div className="stack">
            {queue.map((submission) => {
              const content = submission.content as Record<string, unknown>;
              const name = (content.title ?? content.name ?? 'Untitled') as string;
              const description = content.description as string | null;
              const address = content.address as string | null;
              const images = (content.images as string[] | undefined) ?? [];
              const image = images[0] ?? (content.image_url as string | null) ?? null;
              const tags = (content.accessibility as string[] | undefined) ?? [];

              return (
                <Card key={submission.id}>
                  <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
                    <div className="row" style={{ gap: '0.35rem' }}>
                      <Badge tone="pink">
                        {SUBMISSION_TYPE_LABELS[submission.submission_type]}
                      </Badge>
                      <Badge tone="warning">Pending</Badge>
                    </div>
                    <span className="tiny muted">{relativeTime(submission.created_at)}</span>
                  </div>

                  <div className="row row--top" style={{ gap: '0.75rem', flexWrap: 'nowrap' }}>
                    {image ? (
                      <SafeImage
                        src={image}
                        alt=""
                        style={{
                          width: 90,
                          height: 90,
                          objectFit: 'cover',
                          borderRadius: 'var(--r-sm)',
                          flexShrink: 0,
                        }}
                      />
                    ) : null}

                    <div className="grow" style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>{name}</h3>
                      {submission.submitter_name ? (
                        <p className="tiny muted" style={{ margin: '0 0 0.35rem' }}>
                          Sent by {submission.submitter_name}
                        </p>
                      ) : null}
                      {description ? (
                        <p className="small muted" style={{ marginBottom: '0.35rem' }}>
                          {description}
                        </p>
                      ) : null}
                      {address ? (
                        <p className="tiny muted row" style={{ gap: '0.25rem', margin: 0 }}>
                          <MapPin size={11} aria-hidden="true" />
                          {address}
                        </p>
                      ) : null}
                      {tags.length > 0 ? (
                        <p className="tiny muted" style={{ margin: '0.35rem 0 0' }}>
                          Claims: {tags.join(', ')}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="row" style={{ marginTop: '0.75rem' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Check size={14} />}
                      loading={busyId === submission.id}
                      onClick={() => handleApprove(submission)}
                    >
                      Approve &amp; publish
                    </Button>
                    <Button
                      variant="text"
                      size="sm"
                      icon={<X size={14} />}
                      onClick={() => {
                        setRejecting(submission);
                        setNotes('');
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject submission"
        footer={
          <>
            <Button variant="danger" onClick={handleReject} loading={busyId === rejecting?.id}>
              Reject
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <Field
          label="Why?"
          htmlFor="reject-notes"
          hint="The contributor sees this. Say what would make it publishable."
        >
          <textarea
            id="reject-notes"
            className="textarea"
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="The accessibility claims don't match what's there — the entrance has two steps."
          />
        </Field>
      </Modal>
    </div>
  );
}
