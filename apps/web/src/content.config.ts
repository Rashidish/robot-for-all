// Lessons are Markdown files in /content/lessons/<id>/index.md (ADR-0004).
// Front matter is validated here; a bad lesson fails the build with a clear message.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { lessonSchema, translationSchema } from './lessons/schema';
import { machineSchema } from './machines/schema';

const lessons = defineCollection({
  loader: glob({
    base: '../../content/lessons',
    // English source; translations (index.<lang>.md) are their own collection below.
    pattern: '*/index.md',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry
  }),
  schema: lessonSchema
});

// Lesson translations, e.g. content/lessons/p1-crank-01/index.zu.md (more content spec §2.7).
// Id "<lesson>.<lang>", e.g. "p1-crank-01.zu".
const translations = defineCollection({
  loader: glob({
    base: '../../content/lessons',
    pattern: '*/index.*.md',
    generateId: ({ entry }) => {
      const [lesson = entry, file = ''] = entry.split('/');
      return `${lesson}.${file.replace(/^index\./, '').replace(/\.md$/, '')}`;
    }
  }),
  schema: translationSchema
});

// Machines topics (machines spec §6): content/machines/<id>/index.md, English source.
const machines = defineCollection({
  loader: glob({
    base: '../../content/machines',
    pattern: '*/index.md',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry
  }),
  schema: machineSchema
});

export const collections = { lessons, translations, machines };
