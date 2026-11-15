import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Card, LoadingView, Notice, SectionTitle } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { SUBURBS, TRADES, tradeLabel } from '@/constants/catalogue';
import { colours, fontSize } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';
import { registerCompany } from '@/services/company';
import { toFriendlyMessage } from '@/services/errors';
import { formatDay, parseAuDate } from '@/services/logic/time';
import type { Company, CompanyStatus } from '@/types';

const STATUS_MESSAGES: Record<CompanyStatus, string> = {
  pending:
    'Thanks — your details are with the Find a Fixer team. You will see jobs as soon as your licence and insurance are checked.',
  approved: 'Verified partner. You can see and accept jobs in your trades and service areas.',
  suspended: 'This company is suspended. Please contact the Find a Fixer team.',
};

function CompanyDetails({ company }: { company: Company }) {
  const { signOut } = useSession();
  return (
    <Screen>
      <Text style={styles.heading}>{company.name}</Text>
      <Notice message={STATUS_MESSAGES[company.status]} />
      <Card>
        <SectionTitle>Licence and insurance</SectionTitle>
        <Text style={styles.detail}>Licence: {company.licence_number}</Text>
        <Text style={styles.detail}>
          Insurance: {company.insurance_provider}, expires {formatDay(company.insurance_expiry)}
        </Text>
        {company.abn ? <Text style={styles.detail}>ABN: {company.abn}</Text> : null}
      </Card>
      <Card>
        <SectionTitle>Trades</SectionTitle>
        <Text style={styles.detail}>{company.trades.map(tradeLabel).join(', ')}</Text>
        <SectionTitle>Service areas</SectionTitle>
        <Text style={styles.detail}>{company.service_areas.join(', ')}</Text>
      </Card>
      <Button label="Go to job feed" onPress={() => router.replace('/company/feed')} />
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

function RegistrationForm() {
  const { refresh, signOut } = useSession();
  const [name, setName] = useState('');
  const [abn, setAbn] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [expiryInput, setExpiryInput] = useState('');
  const [trades, setTrades] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const insuranceExpiry = parseAuDate(expiryInput);
    if (!insuranceExpiry) {
      setError('Enter the insurance expiry as DD/MM/YYYY.');
      return;
    }
    if (trades.length === 0 || serviceAreas.length === 0) {
      setError('Choose at least one trade and one service area.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registerCompany({
        name,
        abn,
        licenceNumber,
        insuranceProvider,
        insuranceExpiry,
        trades,
        serviceAreas,
      });
      await refresh();
    } catch (caught) {
      setError(toFriendlyMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.heading}>Your company</Text>
      <Text style={styles.body}>
        We check licence and insurance before a company can take jobs.
      </Text>
      <TextField label="Company name" maxLength={120} value={name} onChangeText={setName} />
      <TextField
        label="ABN (optional)"
        placeholder="11 digits"
        keyboardType="number-pad"
        maxLength={14}
        value={abn}
        onChangeText={setAbn}
      />
      <TextField
        label="Licence number"
        maxLength={60}
        autoCapitalize="characters"
        value={licenceNumber}
        onChangeText={setLicenceNumber}
      />
      <TextField
        label="Public liability insurer"
        maxLength={120}
        value={insuranceProvider}
        onChangeText={setInsuranceProvider}
      />
      <TextField
        label="Insurance expiry"
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        value={expiryInput}
        onChangeText={setExpiryInput}
      />
      <ChipGroup label="Trades" options={TRADES} selected={trades} onChange={setTrades} multiple />
      <ChipGroup
        label="Service areas"
        options={SUBURBS}
        selected={serviceAreas}
        onChange={setServiceAreas}
        multiple
      />
      {error ? <Notice tone="error" message={error} /> : null}
      <Button label="Submit for approval" loading={busy} onPress={() => void submit()} />
      <Button label="Sign out" variant="secondary" disabled={busy} onPress={() => void signOut()} />
    </Screen>
  );
}

export function CompanyProfileScreen() {
  const { loading, userId, company } = useSession();
  if (loading) return <LoadingView />;
  if (!userId) return <Redirect href="/" />;
  return company ? <CompanyDetails company={company} /> : <RegistrationForm />;
}

const styles = StyleSheet.create({
  heading: { color: colours.text, fontSize: fontSize.title, fontWeight: '800' },
  body: { color: colours.textMuted, fontSize: fontSize.body, lineHeight: 24 },
  detail: { color: colours.text, fontSize: fontSize.body, lineHeight: 24 },
});
