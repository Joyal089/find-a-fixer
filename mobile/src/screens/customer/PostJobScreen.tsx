import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Notice } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { MAX_JOB_MEDIA, MAX_JOB_VIDEOS, SUBURBS, TRADES, URGENCIES } from '@/constants/catalogue';
import { colours, fontSize, radius, spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';
import { toFriendlyMessage } from '@/services/errors';
import { postJob } from '@/services/jobs';
import { pickMedia } from '@/services/media';
import type { JobUrgency, PickedMedia } from '@/types';

const MIN_TITLE = 3;
const MIN_DESCRIPTION = 10;
const MIN_ADDRESS = 5;

interface FormState {
  category: string[];
  suburb: string[];
  urgency: JobUrgency[];
  title: string;
  description: string;
  address: string;
  media: PickedMedia[];
}

const EMPTY_FORM: FormState = {
  category: [],
  suburb: [],
  urgency: ['flexible'],
  title: '',
  description: '',
  address: '',
  media: [],
};

/** First thing still missing, in the order the form is laid out. Null when ready to send. */
function firstProblem(form: FormState): string | null {
  if (form.category.length === 0) return 'Choose what kind of job it is.';
  if (form.title.trim().length < MIN_TITLE) return 'Give the job a short title.';
  if (form.description.trim().length < MIN_DESCRIPTION)
    return 'Describe the job in a sentence or two.';
  if (form.suburb.length === 0) return 'Choose your suburb.';
  if (form.address.trim().length < MIN_ADDRESS) return 'Add the street address.';
  return null;
}

export function PostJobScreen() {
  const { userId } = useSession();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const addMedia = async () => {
    try {
      const picked = await pickMedia({
        allowVideo: true,
        limit: MAX_JOB_MEDIA - form.media.length,
      });
      const combined = [...form.media, ...picked].slice(0, MAX_JOB_MEDIA);
      const videos = combined.filter((item) => item.type === 'video').length;
      if (videos > MAX_JOB_VIDEOS) {
        setError(`You can attach up to ${MAX_JOB_VIDEOS} short videos.`);
        return;
      }
      setError(null);
      update('media', combined);
    } catch (caught) {
      setError(toFriendlyMessage(caught));
    }
  };

  const removeMedia = (uri: string) =>
    update(
      'media',
      form.media.filter((item) => item.uri !== uri),
    );

  const submit = async () => {
    const problem = firstProblem(form);
    const [category] = form.category;
    const [suburb] = form.suburb;
    const [urgency] = form.urgency;
    if (problem || !userId || !category || !suburb || !urgency) {
      setError(problem ?? 'Please sign in again.');
      return;
    }
    setError(null);
    setProgress(form.media.length > 0 ? 'Uploading…' : 'Posting…');
    try {
      const jobId = await postJob(userId, { ...form, category, suburb, urgency }, (done, total) =>
        setProgress(`Uploading ${done} of ${total}…`),
      );
      setForm(EMPTY_FORM);
      router.replace('/customer/jobs');
      router.push(`/job/${jobId}`);
    } catch (caught) {
      setError(toFriendlyMessage(caught));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen>
      <ChipGroup
        label="What do you need?"
        options={TRADES}
        selected={form.category}
        onChange={(next) => update('category', next)}
      />
      <TextField
        label="Job title"
        placeholder="Leaking kitchen tap"
        maxLength={100}
        value={form.title}
        onChangeText={(text) => update('title', text)}
      />
      <TextField
        label="What's the problem?"
        placeholder="Tell the tradie what's wrong and anything they should know."
        multiline
        maxLength={2000}
        value={form.description}
        onChangeText={(text) => update('description', text)}
      />

      <View style={styles.mediaSection}>
        <Text style={styles.label}>Photos or short videos (optional)</Text>
        <View style={styles.mediaRow}>
          {form.media.map((item, index) => (
            <Pressable
              key={item.uri}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.type} ${index + 1}`}
              onPress={() => removeMedia(item.uri)}
              style={styles.thumbnail}
            >
              {item.type === 'photo' ? (
                <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
              ) : (
                <Text style={styles.videoTile}>Video</Text>
              )}
              <View style={styles.removeBadge}>
                <Text style={styles.removeText}>✕</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {form.media.length < MAX_JOB_MEDIA ? (
          <Button label="Add photos or video" variant="secondary" onPress={() => void addMedia()} />
        ) : null}
      </View>

      <ChipGroup
        label="How urgent is it?"
        options={URGENCIES}
        selected={form.urgency}
        onChange={(next) => update('urgency', next)}
      />
      <ChipGroup
        label="Suburb"
        options={SUBURBS}
        selected={form.suburb}
        onChange={(next) => update('suburb', next)}
      />
      <TextField
        label="Street address"
        placeholder="12 Smith Street"
        hint="Only shared with the company after you accept their quote."
        autoComplete="street-address"
        maxLength={200}
        value={form.address}
        onChangeText={(text) => update('address', text)}
      />

      {error ? <Notice tone="error" message={error} /> : null}
      <Button
        label={progress ?? 'Post job — free'}
        disabled={progress !== null}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const THUMBNAIL_SIZE = 84;

const styles = StyleSheet.create({
  label: { color: colours.text, fontSize: fontSize.small, fontWeight: '600' },
  mediaSection: { gap: spacing.sm },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colours.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE },
  videoTile: { color: colours.text, fontSize: fontSize.small, fontWeight: '700' },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colours.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colours.text, fontSize: fontSize.small, fontWeight: '700' },
});
