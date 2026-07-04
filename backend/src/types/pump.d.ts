declare module 'pump' {
  import { Stream } from 'stream';
  function pump(...streams: Array<Stream | ((err: Error | null) => void)>): void;
  export default pump;
}
