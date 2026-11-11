// Formal bereavement notice for contract-bound services. Drafted client-side from the
// verified case facts; no PayPal call, and nothing is sent: the executor reviews and sends it.

import type { Analysis, EstateItem } from './types';
import { fictional, longDate, merchantName } from './types';

export function draftNotice(item: EstateItem, analysis: Analysis): string {
  const { deceased_name, date_of_death, executor_name } = analysis.case;
  const name = (deceased_name ?? 'the deceased').replace(fictional, '');
  const executor = executor_name ?? 'The executor';
  return [
    `To: ${merchantName(item.merchant)}, member services`,
    `Re: Membership of ${name}${item.subscriptionId ? ` (PayPal subscription ${item.subscriptionId})` : ''}`,
    '',
    'Dear member services team,',
    '',
    `I am writing as the appointed executor of the estate of ${name}, who died on ${date_of_death ? longDate(date_of_death) : '[date of death]'}. A copy of the death certificate and the notary act of heredity can be provided on request.`,
    '',
    'The membership is bound by a contract. Rather than stopping payment, which would leave the estate in debt, I ask you to:',
    '1. End the membership as of the date of death under your bereavement or death clause.',
    '2. Confirm in writing any amount still owed, or refund any fee collected after that date.',
    '3. Send all further correspondence to me as executor.',
    '',
    'Thank you for your understanding.',
    '',
    'Kind regards,',
    executor,
    `Executor of the estate of ${name}`,
  ].join('\n');
}
