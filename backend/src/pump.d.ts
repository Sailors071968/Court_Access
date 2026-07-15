// Ambient declaration for the untyped 'pump' package.
declare module 'pump' {
  import type { Stream } from 'node:stream';
  function pump(
    ...streamsAndCallback: Array<Stream | ((err?: Error) => void)>
  ): Stream;
  export = pump;
}
