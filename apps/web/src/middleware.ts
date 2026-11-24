// Each page is built once per language (more content spec §2.5): this tells the translation
// functions which language the page being built is in. Pages are built one at a time.
import { defineMiddleware } from 'astro:middleware';
import { baseLocale, isLocale, overwriteGetLocale } from './paraglide/runtime.js';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const wanted = ctx.currentLocale ?? baseLocale;
  const locale = isLocale(wanted) ? wanted : baseLocale;
  overwriteGetLocale(() => locale);
  return next();
});
