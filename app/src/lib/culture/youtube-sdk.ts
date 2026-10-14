export type Player = {
  loadVideoById: (id: string) => void; playVideo: () => void; pauseVideo: () => void;
  destroy: () => void; getIframe: () => HTMLIFrameElement;
};
type PlayerEvent = {target: Player; data: number};
declare global {
  interface Window {
    YT?: {Player: new (element: HTMLElement, options: {width: string; height: string; videoId: string; playerVars: Record<string, string | number>; events: {onReady: (e: PlayerEvent) => void; onStateChange: (e: PlayerEvent) => void; onError: (e: PlayerEvent) => void; onAutoplayBlocked: () => void}}) => Player};
    onYouTubeIframeAPIReady?: () => void;
  }
}
let loading: Promise<void> | undefined;
export function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve();
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onYouTubeIframeAPIReady;
    const fail = () => { clearTimeout(timer); script.remove(); loading = undefined; window.onYouTubeIframeAPIReady = previous; reject(Error('YouTube could not load. Check your connection and retry, or open the video on YouTube.')); };
    const timer = window.setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(); };
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
