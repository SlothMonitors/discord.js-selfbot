const EventEmitter = require('events').EventEmitter;
const prism = require('prism-media');
const StreamDispatcher = require('../dispatcher/StreamDispatcher');
const Collection = require('../../../util/Collection');
const OpusEncoders = require('../opus/OpusEngineList');

const FFMPEG_ARGUMENTS = [
  '-analyzeduration', '0',
  '-loglevel', '0',
  '-f', 's16le',
  '-ar', '48000',
  '-ac', '2',
];

/**
 * An Audio Player for a Voice Connection.
 * @private
 * @extends {EventEmitter}
 */
class AudioPlayer extends EventEmitter {
  constructor(voiceConnection) {
    super();
    /**
     * The voice connection that the player serves
     * @type {VoiceConnection}
     */
    this.voiceConnection = voiceConnection;

    this.streams = {};
    this.dispatcher = null;

    this.streamingData = {
      channels: 2,
      count: 0,
      sequence: 0,
      timestamp: 0,
      pausedTime: 0,
    };

    this.voiceConnection.once('closing', () => this.destroyCurrentStream());
  }

  destroy() {
    this.destroyDispatcher();
  }

  destroyDispatcher() {
    if (this.dispatcher) {
      this.dispatcher.destroy();
      this.dispatcher = null;
    }
  }

  /**
   * Set the bitrate of the current Opus encoder.
   * @param {number} value New bitrate, in kbps
   * If set to 'auto', the voice channel's bitrate will be used
   */
  setBitrate(value) {
    if (!value) return;
    if (!this.opusEncoder) return;
    const bitrate = value === 'auto' ? this.voiceConnection.channel.bitrate : value;
    this.opusEncoder.setBitrate(bitrate);
  }

  playUnknownStream(stream, options = {}) {
    this.destroyDispatcher();
    const ffmpeg = this.streams.ffmpeg = new prism.FFmpeg({ args: FFMPEG_ARGUMENTS });
    stream.pipe(ffmpeg);
    return this.playPCMStream(ffmpeg, options);
  }

  playPCMStream(stream, options = {}) {
    this.destroyDispatcher();
    const opus = this.streams.opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
    stream.pipe(opus);
    return this.playOpusStream(opus, options);
  }

  playOpusStream(stream, options = {}) {
    this.destroyDispatcher();
    const dispatcher = this.dispatcher = this.createDispatcher(options);
    stream.pipe(dispatcher);
    return dispatcher;
  }

  playBroadcast(broadcast, options) {
    
  }

  createDispatcher({ seek = 0, volume = 1, passes = 1 } = {}) {
    this.destroyDispatcher();
    const options = { seek, volume, passes };
    const dispatcher = new StreamDispatcher(this, options);
    this.streamingData.count = 0;
    dispatcher.on('speaking', value => this.voiceConnection.setSpeaking(value));
    return dispatcher;
  }
}

module.exports = AudioPlayer;