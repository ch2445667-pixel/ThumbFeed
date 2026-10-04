import { ThumbnailItem } from './types';

/**
 * Seed library for the Posters section.
 *
 * Intentionally empty. The seed posters that used to live here were TMDB
 * artwork pulled from image.tmdb.org, which is not this project's content,
 * rendered inconsistently (several images failed to load), and could not be
 * deleted through the app because no database row pointed at them. They also
 * masked an empty database, which made it look as though posters still existed
 * after the bucket had been cleared.
 *
 * The Posters wall is now driven entirely by the `thumbnails` table. With no
 * rows the wall renders its empty state until posters are uploaded.
 */
export const INITIAL_POSTERS: ThumbnailItem[] = [];