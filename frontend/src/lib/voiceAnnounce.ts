// English-only for now — Myanmar (my-MM) voices aren't reliably installed on
// Windows across machines, so text in Burmese script often gets mispronounced
// or silently skipped. See CLAUDE.md discussion; revisit if a target machine
// confirms a working my-MM voice via speechSynthesis.getVoices().
export function announceCall(patientName: string, place: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`${patientName}, please come to ${place}.`)
    utterance.lang = 'en-US'
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  } catch {
    // speechSynthesis can throw in some embedded/locked-down browser contexts —
    // this is a convenience feature, never worth breaking the actual action over.
  }
}
