/**
 * All portfolio media. Files live in /public/media and are referenced from the site root.
 *
 * Fields:
 *   src     required  MP4 (H.264) path
 *   webm    optional  WebM path, offered to the browser before the MP4
 *   width   required  intrinsic pixel width
 *   height  required  intrinsic pixel height
 *   label   optional  short text shown on hover
 *   poster  optional  still image shown before the clip loads
 *   alt     optional  accessible description of the clip
 */
export const media = [
  {
    src: '/media/cat-01.mp4',
    webm: '/media/cat-01.webm',
    width: 1280,
    height: 720,
    label: 'Ambush',
    poster: '/media/cat-01.jpg',
  },
  {
    src: '/media/cat-02.mp4',
    width: 720,
    height: 1280,
    label: 'Play',
    poster: '/media/cat-02.jpg',
  },
  {
    src: '/media/cat-03.mp4',
    width: 1280,
    height: 720,
    label: 'Lizard',
    poster: '/media/cat-03.jpg',
  },
  {
    src: '/media/cat-04.mp4',
    width: 576,
    height: 720,
    label: 'Water',
    poster: '/media/cat-04.jpg',
  },
  {
    src: '/media/cat-05.mp4',
    width: 1280,
    height: 720,
    label: 'Grooming',
    poster: '/media/cat-05.jpg',
  },
  {
    src: '/media/cat-06.mp4',
    width: 720,
    height: 1280,
    label: 'Yawn',
    poster: '/media/cat-06.jpg',
  },
  {
    src: '/media/cat-09.mp4',
    width: 720,
    height: 1280,
    label: 'Spotted',
    poster: '/media/cat-09.jpg',
  },
  {
    src: '/media/cat-07.mp4',
    webm: '/media/cat-07.webm',
    width: 720,
    height: 720,
    label: 'Kneading',
    poster: '/media/cat-07.jpg',
  },
  {
    src: '/media/cat-08.mp4',
    width: 1280,
    height: 720,
    poster: '/media/cat-08.jpg',
  },
];
