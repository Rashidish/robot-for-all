// Email to parents (ADR-0016 and its amendment: email only, for now). Messages carry a link,
// never a child's name. The provider is the owner's choice (M5 spec owner action 5); its adapter
// goes in mailerFrom. Until one is set up there is no mailer, and the service refuses to store a
// school's enrolment it could not tell the parent about.
import en from '../../../content/i18n/en.json';
import zu from '../../../content/i18n/zu.json';

export interface Mailer {
  /** True once the provider has accepted the message. */
  send(to: string, subject: string, text: string): Promise<boolean>;
}

export interface MailEnv {
  EMAIL_PROVIDER?: string;
}

export function mailerFrom(env: MailEnv): Mailer | null {
  switch (env.EMAIL_PROVIDER) {
    // case '<provider>': return providerMailer(env);  (added when the owner chooses one)
    default:
      return null;
  }
}

const WORDS: Record<string, Record<string, string>> = { en, zu };

/** An interface message in the class's language (English if it has no translation yet). */
export function words(language: string, key: string, values: Record<string, string>): string {
  const template = WORDS[language]?.[key] ?? WORDS['en']?.[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '');
}
