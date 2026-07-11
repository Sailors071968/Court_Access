declare module 'pump' {
  import type { Stream } from 'node:stream';

  type Callback = (err?: Error) => void;

  function pump<T extends Stream>(...streams: [...Stream[], T]): T;
  function pump<T extends Stream>(...streamsAndCallback: [...Stream[], T, Callback]): T;
  function pump(...streams: Stream[]): Stream;

  export default pump;
}
