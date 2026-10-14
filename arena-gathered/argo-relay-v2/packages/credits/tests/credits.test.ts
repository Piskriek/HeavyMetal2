import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CreditsRollController,
  ENDING_AUDIO_FILES,
  FOUR_FLOATS_BPM,
  LAST_LYRIC_END_SEC,
  SONG_SWITCH_TO_LOOP_SEC,
} from '../src/index';

test('locks Four Floats v4b at 144 BPM, ends lyric at 160.2s, and switches to chorus loop at 160.73s', () => {
  assert.equal(FOUR_FLOATS_BPM, 144.0);
  assert.equal(LAST_LYRIC_END_SEC, 160.2);
  assert.equal(SONG_SWITCH_TO_LOOP_SEC, 160.73);

  const ctrl = new CreditsRollController();
  ctrl.start(10.0);
  assert.equal(ctrl.sampleFrame(25.0).activeAudioFile, ENDING_AUDIO_FILES.mainSong);
  assert.equal(ctrl.sampleFrame(10.0 + SONG_SWITCH_TO_LOOP_SEC + 1.0).activeAudioFile, ENDING_AUDIO_FILES.chorusLoop);
});
