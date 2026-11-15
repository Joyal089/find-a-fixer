import { availableActions, stepIndex } from './jobStatus';
import { leadUsage } from './leads';
import { formatAud, parseDollarsToCents } from './money';
import { maskPhone, normaliseAuMobile } from './phone';
import {
  darwinDayKey,
  darwinMonthStartIso,
  darwinSlotToIso,
  hourLabel,
  parseAuDate,
  upcomingDays,
} from './time';

describe('job status', () => {
  it('orders the four steps and treats cancelled as off the track', () => {
    expect(stepIndex('posted')).toBe(0);
    expect(stepIndex('completed')).toBe(3);
    expect(stepIndex('cancelled')).toBe(-1);
  });

  it('offers a company accept/decline on an open job, and nothing to chat about yet', () => {
    expect(
      availableActions({ status: 'posted', viewer: 'company', hasPendingQuote: false }),
    ).toEqual(['accept', 'decline']);
  });

  it('lets a company quote once, then wait for the customer', () => {
    const base = { status: 'accepted', viewer: 'company' } as const;
    expect(availableActions({ ...base, hasPendingQuote: false })).toEqual(['send_quote', 'chat']);
    expect(availableActions({ ...base, hasPendingQuote: true })).toEqual(['chat']);
  });

  it('lets a customer respond only when a quote is waiting, and cancel only before acceptance', () => {
    expect(
      availableActions({ status: 'accepted', viewer: 'customer', hasPendingQuote: true }),
    ).toEqual(['respond_to_quote', 'chat']);
    expect(
      availableActions({ status: 'posted', viewer: 'customer', hasPendingQuote: false }),
    ).toEqual(['cancel']);
    expect(
      availableActions({ status: 'scheduled', viewer: 'customer', hasPendingQuote: false }),
    ).toEqual(['chat']);
  });

  it('lets only the company complete a scheduled job, and offers nothing once cancelled', () => {
    expect(
      availableActions({ status: 'scheduled', viewer: 'company', hasPendingQuote: false }),
    ).toEqual(['complete', 'chat']);
    expect(
      availableActions({ status: 'cancelled', viewer: 'company', hasPendingQuote: false }),
    ).toEqual([]);
  });
});

describe('quote amounts', () => {
  it('parses dollars into cents', () => {
    expect(parseDollarsToCents('150')).toBe(15000);
    expect(parseDollarsToCents('$1,250.50')).toBe(125050);
    expect(parseDollarsToCents('19.99')).toBe(1999);
  });

  it('rejects junk and out-of-range amounts', () => {
    expect(parseDollarsToCents('')).toBeNull();
    expect(parseDollarsToCents('abc')).toBeNull();
    expect(parseDollarsToCents('12.345')).toBeNull();
    expect(parseDollarsToCents('-5')).toBeNull();
    expect(parseDollarsToCents('0.50')).toBeNull();
    expect(parseDollarsToCents('100001')).toBeNull();
  });

  it('formats as Australian dollars', () => {
    expect(formatAud(125050)).toBe('$1,250.50');
  });
});

describe('lead usage', () => {
  it('counts down to the monthly limit and never goes negative', () => {
    expect(leadUsage(3, 20)).toEqual({ used: 3, limit: 20, remaining: 17, atLimit: false });
    expect(leadUsage(20, 20).atLimit).toBe(true);
    expect(leadUsage(25, 20).remaining).toBe(0);
  });
});

describe('phone numbers', () => {
  it('normalises Australian mobiles to E.164', () => {
    expect(normaliseAuMobile('0412 345 678')).toBe('+61412345678');
    expect(normaliseAuMobile('+61 412 345 678')).toBe('+61412345678');
    expect(normaliseAuMobile('61412345678')).toBe('+61412345678');
  });

  it('rejects landlines and incomplete numbers', () => {
    expect(normaliseAuMobile('08 8999 1234')).toBeNull();
    expect(normaliseAuMobile('0412 345')).toBeNull();
  });

  it('masks all but the last three digits', () => {
    expect(maskPhone('+61412345678')).toBe('•••• ••• 678');
  });
});

describe('Darwin time', () => {
  it('uses the Darwin calendar day, not UTC', () => {
    // 15:00 UTC is 00:30 the next day in Darwin.
    expect(darwinDayKey(new Date('2026-11-15T15:00:00Z'))).toBe('2026-11-16');
    expect(darwinDayKey(new Date('2026-11-15T14:00:00Z'))).toBe('2026-11-15');
  });

  it('converts a Darwin wall-clock slot to the right instant', () => {
    expect(darwinSlotToIso('2026-11-16', 9)).toBe('2026-11-15T23:30:00.000Z');
  });

  it('starts the billing month at Darwin midnight', () => {
    expect(darwinMonthStartIso(new Date('2026-11-15T03:00:00Z'))).toBe('2026-10-31T14:30:00.000Z');
  });

  it('lists upcoming days and labels hours', () => {
    const days = upcomingDays(3, new Date('2026-11-15T01:00:00Z'));
    expect(days.map((day) => day.key)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
    expect(hourLabel(7)).toBe('7am');
    expect(hourLabel(12)).toBe('12pm');
    expect(hourLabel(17)).toBe('5pm');
  });

  it('parses Australian dates and rejects impossible ones', () => {
    expect(parseAuDate('5/3/2027')).toBe('2027-03-05');
    expect(parseAuDate('31/12/2027')).toBe('2027-12-31');
    expect(parseAuDate('31/02/2027')).toBeNull();
    expect(parseAuDate('2027-12-31')).toBeNull();
  });
});
