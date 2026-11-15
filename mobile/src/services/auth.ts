import { AppError, throwIfError } from './errors';
import { normaliseAuMobile } from './logic/phone';
import { supabase } from './supabase';

/** Sends a one-time code by SMS. Supabase rate-limits these per number and per project. */
export async function requestPhoneCode(rawPhone: string): Promise<string> {
  const phone = normaliseAuMobile(rawPhone);
  if (!phone) throw new AppError('INVALID_INPUT');
  const { error } = await supabase.auth.signInWithOtp({ phone });
  throwIfError(error);
  return phone;
}

export async function verifyPhoneCode(phone: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
  throwIfError(error);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  throwIfError(error);
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  throwIfError(error);
  // No session means the project requires the email to be confirmed first.
  if (!data.session) throw new AppError('EMAIL_CONFIRMATION_REQUIRED');
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  throwIfError(error);
}
