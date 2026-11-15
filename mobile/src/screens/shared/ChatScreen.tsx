import { useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView, Notice } from '@/components/Feedback';
import { colours, fontSize, MAX_CONTENT_WIDTH, radius, spacing } from '@/constants/theme';
import { useChat } from '@/hooks/useChat';
import { formatDateTime } from '@/services/logic/time';
import type { Message } from '@/types';

interface BubbleProps {
  message: Message;
  mine: boolean;
  photoUrl: string | undefined;
}

function Bubble({ message, mine, photoUrl }: BubbleProps) {
  return (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {message.media_path ? (
        photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            accessibilityLabel="Photo sent in chat"
          />
        ) : (
          <View style={[styles.photo, styles.photoLoading]} />
        )
      ) : null}
      {message.body ? (
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
      ) : null}
      <Text style={[styles.time, mine && styles.timeMine]}>
        {formatDateTime(message.created_at)}
      </Text>
    </View>
  );
}

/** Private chat between the customer and the company on one job, with photo sharing. */
export function ChatScreen({ jobId, userId }: { jobId: string; userId: string }) {
  const chat = useChat(jobId, userId);
  const [draft, setDraft] = useState('');

  if (chat.loading) return <LoadingView />;

  const sendDraft = async () => {
    const body = draft.trim();
    if (!body) return;
    if (await chat.sendText(body)) setDraft('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          inverted
          data={chat.messages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={styles.messages}
          onEndReached={() => void chat.loadOlder()}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <Bubble
              message={item}
              mine={item.sender_id === userId}
              photoUrl={item.media_path ? chat.photoUrls.get(item.media_path) : undefined}
            />
          )}
          ListEmptyComponent={
            // The list is inverted, so flip the empty message back the right way up.
            <Text style={[styles.empty, styles.flipped]}>
              No messages yet. Say hello and sort out the details here.
            </Text>
          }
        />
        {chat.error ? <Notice tone="error" message={chat.error} /> : null}
        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send a photo"
            disabled={chat.sending}
            onPress={() => void chat.sendPhoto()}
            style={styles.iconButton}
          >
            <Text style={styles.iconText}>＋</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Message"
            style={styles.input}
            placeholder="Message"
            placeholderTextColor={colours.textMuted}
            value={draft}
            onChangeText={setDraft}
            maxLength={2000}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={chat.sending || draft.trim().length === 0}
            onPress={() => void sendDraft()}
            style={[styles.sendButton, draft.trim().length === 0 && styles.sendDisabled]}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PHOTO_SIZE = 220;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  messages: { gap: spacing.sm, padding: spacing.sm, flexGrow: 1 },
  empty: {
    color: colours.textMuted,
    fontSize: fontSize.body,
    textAlign: 'center',
    padding: spacing.xl,
  },
  flipped: { transform: [{ scaleY: -1 }] },
  bubble: { maxWidth: '82%', padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colours.accent },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colours.surfaceRaised },
  bubbleText: { color: colours.text, fontSize: fontSize.body, lineHeight: 22 },
  bubbleTextMine: { color: colours.onAccent },
  time: { color: colours.textMuted, fontSize: 11 },
  timeMine: { color: 'rgba(0,0,0,0.6)' },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: radius.sm },
  photoLoading: { backgroundColor: colours.border },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colours.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colours.text, fontSize: fontSize.large },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: colours.surface,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colours.text,
    fontSize: fontSize.body,
  },
  sendButton: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colours.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: colours.onAccent, fontSize: fontSize.body, fontWeight: '700' },
});
