# Music

`bg_music.mp3` is the background loop. It is wired up in `MUSIC` in
`src/services/SoundService.ts` -- one track, so there is no map to add to;
replacing the file is enough.

The loop is driven from `musicOn` in `src/ui/GameScreen.tsx`: it plays while
the world is moving, and holds -- without rewinding -- for the splash, the
pause card, the shop, a death, a finish, and the app being backgrounded.
`Sound.stopMusic()` on "start over" is what rewinds it.

It is mixed at `MUSIC_VOLUME` (0.35) so the effects stay readable over it.

As with the effects, the filename must be lowercase letters, digits and
underscores or the Android build rejects it.

## Licensing

The current file is a royalty-free Sigma Music Art track (source filename
`sigmamusicart-no-copyright-music-537751.mp3`), so it is clear to ship. It
replaced an earlier placeholder pulled off a Pinterest video, which was very
likely someone else's copyrighted audio.

Keep the licence in mind when swapping it again: dropping a new file in as
`bg_music.mp3` is the whole change, so it is as easy to do with something
uncleared as with something cleared.
