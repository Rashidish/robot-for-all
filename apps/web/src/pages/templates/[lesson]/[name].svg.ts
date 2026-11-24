// The printable template file itself (true-scale A4 SVG), built at build time. A sheet whose
// lesson translation may be shown also gets `<name>.<lang>.svg`, with the same shapes and its
// words in that language (translate-templates spec §2.3).
import type { APIRoute } from 'astro';
import type { SheetWords } from '../../../../../../packages/templates/src/index';
import { hidden } from '../../../withdrawn';
import { getLessons } from '../../../lessons/load';
import { localLesson } from '../../../lessons/translations';
import { siteLanguages } from '../../../site-languages';
import { findTemplate, templateSvg } from '../../../templates/load';

export async function getStaticPaths() {
  const lessons = await getLessons();
  const paths: {
    params: { lesson: string; name: string };
    props: { sheet: string; lang: string; words?: SheetWords };
  }[] = [];
  for (const lesson of lessons) {
    const sheets = lesson.data.templates.filter(
      (name) => !hidden('template', `${lesson.id}/${name}`)
    );
    for (const name of sheets) {
      paths.push({ params: { lesson: lesson.id, name }, props: { sheet: name, lang: 'en' } });
    }
    for (const { code } of siteLanguages.filter((l) => l.code !== 'en')) {
      const local = await localLesson(lesson, code, lessons);
      if (local.lang !== code) continue;
      for (const name of sheets) {
        const words = local.sheets[name];
        if (words)
          paths.push({
            params: { lesson: lesson.id, name: `${name}.${code}` },
            props: { sheet: name, lang: code, words }
          });
      }
    }
  }
  return paths;
}

interface Props {
  sheet: string;
  lang: string;
  words?: SheetWords;
}

export const GET: APIRoute<Props> = ({ params, props }) => {
  const entry = findTemplate(params['lesson'] ?? '', props.sheet);
  if (!entry) return new Response('Not found', { status: 404 });
  return new Response(templateSvg(entry, props.lang, props.words), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' }
  });
};
