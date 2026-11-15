import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CHAT_PAGE_SIZE,
  listMessages,
  sendPhotoMessage,
  sendTextMessage,
  subscribeToMessages,
} from '@/services/chat';
import { toFriendlyMessage } from '@/services/errors';
import { CHAT_MEDIA_BUCKET, pickMedia, signUrls } from '@/services/media';
import type { Message } from '@/types';

/** Adds messages to a newest-first list, ignoring any already present. O(n + m). */
function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const seen = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !seen.has(message.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function useChat(jobId: string, userId: string) {
  // Newest first, which is what an inverted list wants.
  const [messages, setMessages] = useState<Message[]>([]);
  const [photoUrls, setPhotoUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasOlder = useRef(true);
  const loadingOlder = useRef(false);
  const requestedUrls = useRef(new Set<string>());

  const addMessages = useCallback((incoming: Message[]) => {
    setMessages((current) => mergeMessages(current, incoming));
    const paths = incoming.flatMap((message) =>
      message.media_path && !requestedUrls.current.has(message.media_path)
        ? [message.media_path]
        : [],
    );
    if (paths.length === 0) return;
    paths.forEach((path) => requestedUrls.current.add(path));
    signUrls(CHAT_MEDIA_BUCKET, paths)
      .then((urls) => setPhotoUrls((current) => new Map([...current, ...urls])))
      .catch((caught: unknown) => setError(toFriendlyMessage(caught)));
  }, []);

  useEffect(() => {
    let active = true;
    listMessages(jobId)
      .then((page) => {
        if (!active) return;
        hasOlder.current = page.length === CHAT_PAGE_SIZE;
        addMessages(page);
      })
      .catch((caught: unknown) => active && setError(toFriendlyMessage(caught)))
      .finally(() => active && setLoading(false));
    const unsubscribe = subscribeToMessages(jobId, (message) => addMessages([message]));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [jobId, addMessages]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[messages.length - 1];
    if (!oldest || !hasOlder.current || loadingOlder.current) return;
    loadingOlder.current = true;
    try {
      const page = await listMessages(jobId, oldest.created_at);
      hasOlder.current = page.length === CHAT_PAGE_SIZE;
      addMessages(page);
    } catch (caught) {
      setError(toFriendlyMessage(caught));
    } finally {
      loadingOlder.current = false;
    }
  }, [jobId, messages, addMessages]);

  const send = useCallback(
    async (create: () => Promise<Message | null>): Promise<boolean> => {
      setSending(true);
      try {
        const message = await create();
        if (message) addMessages([message]);
        setError(null);
        return true;
      } catch (caught) {
        setError(toFriendlyMessage(caught));
        return false;
      } finally {
        setSending(false);
      }
    },
    [addMessages],
  );

  const sendText = useCallback(
    (body: string) => send(() => sendTextMessage(jobId, userId, body)),
    [send, jobId, userId],
  );

  const sendPhoto = useCallback(
    () =>
      send(async () => {
        const [photo] = await pickMedia({ allowVideo: false, limit: 1 });
        return photo ? sendPhotoMessage(jobId, userId, photo) : null;
      }),
    [send, jobId, userId],
  );

  return { messages, photoUrls, loading, sending, error, loadOlder, sendText, sendPhoto };
}
