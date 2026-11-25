import { describe, expect, it } from 'vitest';
import { mailerFrom, words } from './mail';

describe('email to parents', () => {
  it('has no mailer until the owner chooses a provider', () => {
    expect(mailerFrom({})).toBeNull();
  });

  it('fills the message in the class language, falling back to English', () => {
    const values = {
      organisation: 'Sizwe Primary',
      class: 'Grade 4B',
      link: 'https://x/enrol/confirm/#t'
    };
    expect(words('en', 'email_enrol_body', values)).toContain('Sizwe Primary');
    expect(words('en', 'email_enrol_body', values)).toContain('https://x/enrol/confirm/#t');
    expect(words('zu', 'email_enrol_subject', values)).not.toBe(
      words('en', 'email_enrol_subject', values)
    );
    expect(words('xh', 'email_enrol_subject', values)).toBe(
      words('en', 'email_enrol_subject', values)
    );
  });
});
