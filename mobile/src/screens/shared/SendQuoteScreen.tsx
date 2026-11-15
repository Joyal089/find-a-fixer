import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Notice } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colours, fontSize } from '@/constants/theme';
import { toFriendlyMessage } from '@/services/errors';
import { formatAud, parseDollarsToCents } from '@/services/logic/money';
import { darwinSlotToIso, hourLabel, QUOTE_HOURS, upcomingDays } from '@/services/logic/time';
import { sendQuote } from '@/services/quotes';

const DAYS_OFFERED = 7;
const HOUR_OPTIONS = QUOTE_HOURS.map((hour) => ({ value: String(hour), label: hourLabel(hour) }));

/** Price, a proposed visit time (Darwin time) and optional notes. */
export function SendQuoteScreen({ jobId }: { jobId: string }) {
  const dayOptions = useMemo(
    () =>
      upcomingDays(DAYS_OFFERED, new Date()).map((day) => ({ value: day.key, label: day.label })),
    [],
  );
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState<string[]>([]);
  const [hour, setHour] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = parseDollarsToCents(amount);

  const submit = async () => {
    const [dayKey] = day;
    const [hourValue] = hour;
    if (amountCents === null) {
      setError('Enter the price in dollars, for example 250 or 250.50.');
      return;
    }
    if (!dayKey || !hourValue) {
      setError('Choose a day and a start time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendQuote({
        jobId,
        amountCents,
        notes,
        proposedTimeIso: darwinSlotToIso(dayKey, Number(hourValue)),
      });
      router.back();
    } catch (caught) {
      setError(toFriendlyMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TextField
        label="Price (AUD, including GST)"
        placeholder="250"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        hint={amountCents === null ? undefined : `The customer will see ${formatAud(amountCents)}.`}
      />
      <ChipGroup label="Proposed day" options={dayOptions} selected={day} onChange={setDay} />
      <ChipGroup label="Start time" options={HOUR_OPTIONS} selected={hour} onChange={setHour} />
      <Text style={styles.muted}>Times are Darwin time.</Text>
      <TextField
        label="Notes for the customer (optional)"
        placeholder="What's included, parts, how long it should take."
        multiline
        maxLength={1000}
        value={notes}
        onChangeText={setNotes}
      />
      {error ? <Notice tone="error" message={error} /> : null}
      <Button label="Send quote" loading={busy} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.textMuted, fontSize: fontSize.small },
});
