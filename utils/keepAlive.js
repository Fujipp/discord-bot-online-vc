const { Readable } = require("stream");
const { createAudioPlayer, NoSubscriberBehavior, createAudioResource, StreamType } = require("@discordjs/voice");

class Silence extends Readable { _read() { this.push(Buffer.from([0xF8, 0xFF, 0xFE])); } }
function attachKeepAlive(connection) {
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  const resource = createAudioResource(new Silence(), { inputType: StreamType.Opus });
  connection.subscribe(player);
  player.play(resource);
  return player;
}
module.exports = { attachKeepAlive };
