// Lessons are Markdown files in /content/lessons/<id>/index.md (ADR-0004).
// Front matter is validated here; a bad lesson fails the build with a clear message.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { lessonSchema } from './lessons/schema';

const lessons = defineCollection({
  loader: glob({
    base: '../../content/lessons',
    // English source only for now; translations (index.<lang>.md) join when a second language arrives.
    pattern: '*/index.md',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry
  }),
  schema: lessonSchema
});

export const collections = { lessons };
