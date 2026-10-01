import { ThumbnailItem } from './types';

/**
 * Seed library for the Posters section. Movie posters are portrait artwork,
 * so they render in 2:3 cards with no metadata footer. Every entry carries
 * kind: 'poster', which is what routes it to the posters wall instead of the
 * thumbnails gallery. Artwork is served from the TMDB image CDN.
 */

const P = 'https://image.tmdb.org/t/p/w500';

function poster(
  id: string,
  title: string,
  creator: string,
  path: string,
  genre: string,
  year: string,
  likesCount: number,
  createdAt: string
): ThumbnailItem {
  return {
    id: `poster-${id}`,
    kind: 'poster',
    title,
    creator,
    imageUrl: `${P}${path}`,
    sourceUrl: `${P}${path}`,
    niche: genre,
    styles: [],
    tags: [genre, year, 'Movie Poster', 'Cinema'],
    colors: [],
    ocrText: '',
    source: 'curated',
    createdAt,
    likesCount,
  };
}

export const INITIAL_POSTERS: ThumbnailItem[] = [
  poster('interstellar', 'Interstellar', 'Christopher Nolan', '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', 'Sci-Fi', '2014', 842, '2026-09-02T10:00:00.000Z'),
  poster('dune-part-two', 'Dune: Part Two', 'Denis Villeneuve', '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', 'Sci-Fi', '2024', 917, '2026-09-04T10:00:00.000Z'),
  poster('inception', 'Inception', 'Christopher Nolan', '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', 'Sci-Fi', '2010', 788, '2026-08-28T10:00:00.000Z'),
  poster('avengers-endgame', 'Avengers: Endgame', 'Russo Brothers', '/or06FN3Dka5tukK1e9sl16pB3iy.jpg', 'Action', '2019', 764, '2026-08-20T10:00:00.000Z'),
  poster('joker', 'Joker', 'Todd Phillips', '/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', 'Drama', '2019', 693, '2026-09-06T10:00:00.000Z'),
  poster('oppenheimer', 'Oppenheimer', 'Christopher Nolan', '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', 'Drama', '2023', 881, '2026-09-08T10:00:00.000Z'),
  poster('barbie', 'Barbie', 'Greta Gerwig', '/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg', 'Comedy', '2023', 542, '2026-08-15T10:00:00.000Z'),
  poster('john-wick-4', 'John Wick: Chapter 4', 'Chad Stahelski', '/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg', 'Action', '2023', 618, '2026-08-22T10:00:00.000Z'),
  poster('top-gun-maverick', 'Top Gun: Maverick', 'Joseph Kosinski', '/62HCnUTziyWcpDaBO2i1DX17ljH.jpg', 'Action', '2022', 705, '2026-08-18T10:00:00.000Z'),
  poster('the-batman', 'The Batman', 'Matt Reeves', '/74xTEgt7R36Fpooo50r9T25onhq.jpg', 'Action', '2022', 659, '2026-08-25T10:00:00.000Z'),
  poster('spider-man-nwh', 'Spider-Man: No Way Home', 'Jon Watts', '/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg', 'Action', '2021', 733, '2026-08-12T10:00:00.000Z'),
  poster('avatar-2', 'Avatar: The Way of Water', 'James Cameron', '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', 'Sci-Fi', '2022', 571, '2026-08-10T10:00:00.000Z'),
  poster('deadpool-wolverine', 'Deadpool & Wolverine', 'Shawn Levy', '/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg', 'Comedy', '2024', 826, '2026-09-10T10:00:00.000Z'),
  poster('inside-out-2', 'Inside Out 2', 'Pixar', '/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg', 'Animation', '2024', 498, '2026-08-08T10:00:00.000Z'),
];
