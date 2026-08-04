import { describe, expect, it } from 'vitest';
import {
  describeRequest,
  inviteCommand,
  kickCommand,
  parseLogLine,
  parseTradeWhisper,
  sanitizeMessage,
  thanksCommand,
  tradeCommand,
  whisperCommand,
} from '../src';

const PREFIX = '2026/08/03 17:52:40 123456 cffb0716 [INFO Client 1234]';

describe('log line parsing', () => {
  it('extracts direction, character and message', () => {
    expect(parseLogLine(`${PREFIX} @From Alice: Hi there`)).toMatchObject({
      direction: 'incoming',
      character: 'Alice',
      message: 'Hi there',
    });
    expect(parseLogLine(`${PREFIX} @To Bob: On my way`)).toMatchObject({
      direction: 'outgoing',
      character: 'Bob',
    });
  });

  it('parses the log timestamp', () => {
    const parsed = parseLogLine(`${PREFIX} @From Alice: Hi`);
    expect(parsed?.timestamp.startsWith('2026-08-03')).toBe(true);
  });

  it('ignores non-whisper log lines', () => {
    expect(parseLogLine(`${PREFIX} : You have entered The Coast.`)).toBeNull();
    expect(parseLogLine('random text')).toBeNull();
    expect(parseLogLine('')).toBeNull();
  });
});

describe('trade whisper parsing', () => {
  it('parses a single item purchase with stash location', () => {
    const line = `${PREFIX} @From Alice: Hi, I would like to buy your Headhunter listed for 72 divine in Allflame (stash tab "Sale"; position: left 5, top 3)`;
    expect(parseTradeWhisper(line)).toMatchObject({
      kind: 'item',
      direction: 'incoming',
      character: 'Alice',
      itemName: 'Headhunter',
      price: { amount: 72, currency: 'divine' },
      league: 'Allflame',
      stash: { tab: 'Sale', left: 5, top: 3 },
    });
  });

  it('parses a purchase without a stash suffix', () => {
    const line = `${PREFIX} @From Bob: Hi, I would like to buy your Divine Orb listed for 1 chaos in Hardcore Allflame`;
    expect(parseTradeWhisper(line)).toMatchObject({
      kind: 'item',
      itemName: 'Divine Orb',
      price: { amount: 1, currency: 'chaos' },
      league: 'Hardcore Allflame',
      stash: null,
    });
  });

  it('parses a listing with no price', () => {
    const line = `${PREFIX} @From Cara: Hi, I would like to buy your Wrath Pelt in Allflame (stash tab "A"; position: left 1, top 1)`;
    expect(parseTradeWhisper(line)).toMatchObject({
      kind: 'item',
      itemName: 'Wrath Pelt',
      price: null,
      stash: { tab: 'A', left: 1, top: 1 },
    });
  });

  it('parses a bulk currency exchange', () => {
    const line = `${PREFIX} @From Dan: Hi, I'd like to buy your 100 Chaos Orb for my 10 Divine Orb in Allflame.`;
    expect(parseTradeWhisper(line)).toMatchObject({
      kind: 'bulk',
      want: { amount: 100, currency: 'Chaos Orb' },
      offer: { amount: 10, currency: 'Divine Orb' },
      league: 'Allflame',
    });
  });

  it('parses decimal prices', () => {
    const line = `${PREFIX} @From Eve: Hi, I would like to buy your Chaos Orb listed for 0.5 divine in Allflame`;
    expect(parseTradeWhisper(line)).toMatchObject({
      price: { amount: 0.5, currency: 'divine' },
    });
  });

  it('tracks outgoing trade whispers separately', () => {
    const line = `${PREFIX} @To Frank: Hi, I would like to buy your Goldrim listed for 1 chaos in Allflame`;
    expect(parseTradeWhisper(line)).toMatchObject({ direction: 'outgoing' });
  });
});

describe('privacy — ordinary chat is never treated as a trade', () => {
  it('ignores personal whispers', () => {
    const lines = [
      `${PREFIX} @From Friend: hey are you online later?`,
      `${PREFIX} @From Friend: can you help me with the lab`,
      `${PREFIX} @To Friend: sure, give me 5 minutes`,
    ];
    for (const line of lines) {
      expect(parseTradeWhisper(line)).toBeNull();
    }
  });

  it('ignores guild, party and global chat', () => {
    expect(parseTradeWhisper(`${PREFIX} &Guildmate: anyone want to run maps`)).toBeNull();
    expect(parseTradeWhisper(`${PREFIX} #Someone: WTS mirror`)).toBeNull();
  });

  it('ignores a message that merely mentions buying', () => {
    expect(
      parseTradeWhisper(`${PREFIX} @From Friend: I would like to buy a house one day`),
    ).toBeNull();
  });
});

describe('chat commands — one action each', () => {
  const request = parseTradeWhisper(
    `${PREFIX} @From Alice: Hi, I would like to buy your Headhunter listed for 72 divine in Allflame`,
  );
  if (request === null) throw new Error('fixture failed to parse');

  it('builds one command per action', () => {
    expect(inviteCommand(request).text).toBe('/invite Alice');
    expect(tradeCommand(request).text).toBe('/tradewith Alice');
    expect(kickCommand(request).text).toBe('/kick Alice');
  });

  it('builds a whisper command', () => {
    expect(whisperCommand(request, 'one moment').text).toBe('@Alice one moment');
  });

  it('never lets a message become more than one command', () => {
    // Newlines would submit the chat box early and send a second command.
    expect(sanitizeMessage('hello\n/kick Someone')).toBe('hello /kick Someone');
    expect(sanitizeMessage('a\r\nb')).toBe('a b');
    expect(sanitizeMessage('x'.repeat(500)).length).toBe(200);
  });

  it('strips characters the game would not accept in a name', () => {
    const hostile = parseTradeWhisper(
      `${PREFIX} @From Bad Name: Hi, I would like to buy your Item listed for 1 chaos in Allflame`,
    );
    expect(hostile).not.toBeNull();
    if (hostile === null) return;
    expect(inviteCommand(hostile).text).toBe('/invite BadName');
  });

  it('sends a thank-you as one whisper and nothing else', () => {
    const command = thanksCommand(request, 'Thanks, have a nice day!');
    expect(command.kind).toBe('whisper');
    expect(command.text).toBe('@Alice Thanks, have a nice day!');
    // A thanks must never carry a second command along with it.
    expect(command.text.includes('/kick')).toBe(false);
    expect(command.text.split('\n')).toHaveLength(1);
  });

  it('keeps a custom thanks message to a single command', () => {
    const command = thanksCommand(request, 'thanks\n/kick Alice');
    expect(command.text).toBe('@Alice thanks /kick Alice');
    expect(command.text.split('\n')).toHaveLength(1);
  });

  it('summarizes requests for display', () => {
    expect(describeRequest(request)).toBe('Headhunter — 72 divine');
    const bulk = parseTradeWhisper(
      `${PREFIX} @From Dan: Hi, I'd like to buy your 100 Chaos Orb for my 10 Divine Orb in Allflame.`,
    );
    if (bulk === null) throw new Error('bulk fixture failed');
    expect(describeRequest(bulk)).toBe('100 Chaos Orb for 10 Divine Orb');
  });
});

describe('real whisper captured from the game', () => {
  // Copied verbatim from Client.txt during live play. The buyer's character
  // name is the only thing altered.
  const REAL =
    '2026/08/04 13:45:59 3428931861 e63da844 [INFO Client 47430] @From ExampleBuyer: ' +
    'Hi, I would like to buy your Limbsplit, Woodsplitter listed for 1 regal in Allflame ' +
    '(stash tab "~price 1 regal"; position: left 11, top 1)';

  it('parses an item name containing a comma', () => {
    const request = parseTradeWhisper(REAL);
    expect(request).toMatchObject({
      kind: 'item',
      direction: 'incoming',
      character: 'ExampleBuyer',
      itemName: 'Limbsplit, Woodsplitter',
      price: { amount: 1, currency: 'regal' },
      league: 'Allflame',
    });
  });

  it('reads a stash tab name containing punctuation', () => {
    const request = parseTradeWhisper(REAL);
    if (request === null || request.kind !== 'item') throw new Error('failed to parse');
    expect(request.stash).toEqual({ tab: '~price 1 regal', left: 11, top: 1 });
  });

  it('builds the invite for the real buyer', () => {
    const request = parseTradeWhisper(REAL);
    if (request === null) throw new Error('failed to parse');
    expect(inviteCommand(request).text).toBe('/invite ExampleBuyer');
    expect(describeRequest(request)).toBe('Limbsplit, Woodsplitter — 1 regal');
  });
});
