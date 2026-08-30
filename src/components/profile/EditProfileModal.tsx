import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { updateUserProfile } from '@/services/authService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CheckboxGroup, Field } from '@/components/ui/Shared';
import { useToast } from '@/components/ui/Toast';
import { A11Y_TAGS, a11yLabel } from '@/lib/format';
import type { MentalityPreference } from '@/types';

const PRONOUN_SUGGESTIONS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they'];

/** Prompt 16 — edit name, pronouns, avatar, accessibility needs. */
export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [pronouns, setPronouns] = useState(user?.pronouns ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [needs, setNeeds] = useState<string[]>(user?.accessibility_needs ?? []);
  const [preference, setPreference] = useState<MentalityPreference>(
    user?.onboarding_preference ?? 'both',
  );
  const [saving, setSaving] = useState(false);

  // useState initialisers run once, so without this a Cancel would leave the
  // edited drafts sitting in the form the next time it is opened.
  useEffect(() => {
    if (!open || !user) return;
    setFullName(user.full_name ?? '');
    setPronouns(user.pronouns ?? '');
    setAvatarUrl(user.avatar_url ?? '');
    setNeeds(user.accessibility_needs ?? []);
    setPreference(user.onboarding_preference ?? 'both');
  }, [open, user]);

  if (!user) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const updated = await updateUserProfile(user.id, {
        full_name: fullName.trim() || null,
        pronouns: pronouns.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        accessibility_needs: needs,
        onboarding_preference: preference,
      });
      setUser(updated);
      toast.success('Profile saved.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <form onSubmit={handleSubmit}>
        <Field label="Name" htmlFor="profile-name" hint="Shown on events you organise.">
          <input
            id="profile-name"
            className="input"
            value={fullName}
            maxLength={80}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>

        <Field
          label="Pronouns"
          htmlFor="profile-pronouns"
          hint="Optional. Shown next to your name where your name appears."
        >
          <input
            id="profile-pronouns"
            className="input"
            value={pronouns}
            maxLength={30}
            list="pronoun-suggestions"
            onChange={(e) => setPronouns(e.target.value)}
          />
          <datalist id="pronoun-suggestions">
            {PRONOUN_SUGGESTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>

        <Field
          label="Avatar image URL"
          htmlFor="profile-avatar"
          hint="Leave empty to use your initials."
        >
          <input
            id="profile-avatar"
            className="input"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>

        <div className="field">
          <span className="field__label">How you like to move through the city</span>
          <div className="row">
            {(
              [
                ['vigilant', 'Clarity and safe routes'],
                ['explorer', 'Exploration and discovery'],
                ['both', 'Depends on the night'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip${preference === value ? ' is-active' : ''}`}
                aria-pressed={preference === value}
                onClick={() => setPreference(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Accessibility needs"
          hint="Used to sort accessible places first. Never shown to anyone else."
        >
          <CheckboxGroup
            options={A11Y_TAGS}
            selected={needs}
            labelFor={a11yLabel}
            onToggle={(tag) =>
              setNeeds((current) =>
                current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
              )
            }
          />
        </Field>

        <div className="row">
          <Button type="submit" variant="primary" loading={saving}>
            Save changes
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
