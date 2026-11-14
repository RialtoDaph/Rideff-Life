// The browser's own listening and speaking: the second tier when the realtime voice is not
// there. It hears with the browser's speech recognition and answers aloud with its speech
// synthesis. Less natural, but it needs no key and no network to the voice service.

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const LANG_TAG: Record<string, string> = { en: "en-US", de: "de-DE", id: "id-ID" };
export const canListen = () => typeof window !== "undefined" && !!ctor();
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Listens for one sentence. Returns a function that stops it. */
export function listenOnce(lang: string, onText: (text: string) => void, onEnd: (reason?: string) => void): () => void {
  const R = ctor();
  if (!R) {
    onEnd("unsupported");
    return () => {};
  }
  const r = new R();
  let got = false;
  let reason: string | undefined;
  r.lang = LANG_TAG[lang] ?? "en-US";
  r.interimResults = false;
  r.continuous = false;
  r.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript?.trim();
    if (text) {
      got = true;
      onText(text);
    }
  };
  r.onerror = (e) => {
    reason = e.error;
  };
  r.onend = () => onEnd(got ? undefined : (reason ?? "nothing"));
  try {
    r.start();
  } catch {
    onEnd("failed");
  }
  return () => {
    r.onend = null;
    try {
      r.abort();
    } catch {}
  };
}

/** Says a text aloud. Returns a function that cuts it off. */
export function speak(text: string, lang: string, onEnd: () => void): () => void {
  if (!canSpeak()) {
    onEnd();
    return () => {};
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG_TAG[lang] ?? "en-US";
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onEnd();
  };
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return () => {
    done = true;
    window.speechSynthesis.cancel();
  };
}
