import { loadLesson, lessonIds } from '../../../lib/lesson.js';

export const entries = () => lessonIds.map((id) => ({ id }));

export const load = ({ params }) => loadLesson(params.id);
