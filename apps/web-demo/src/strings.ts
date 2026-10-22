// All user-facing text in one place.
// TODO(copy): the team replaces these English placeholders with Mongolian.
export const t = {
  appName: "[APP NAME]",
  badge: "Web proof of concept",
  tagline: "A 3-second light reflex check for your child's eyes",
  start: "Start scan",
  forParents: "For parents: why this matters",
  footerPrivacy: "Images stay on this phone",
  footerNoDiagnosis: "Not a diagnosis",

  back: "Back",
  loading: "Starting the camera…",
  cameraError: "The camera could not start. Allow camera access and open the page over HTTPS.",
  torchOn: "Torch on",
  torchOff: "No torch: hold a light next to the camera",
  instructions: "Hold the phone about 35 cm away. Ask your child to look at the light.",
  faceFound: "Face found",
  eyesFound: "Both eyes found",
  reflexFound: "Reflex visible",
  scan: "Scan",
  keepStill: "Keep still…",
  of3s: "of 3 s",

  resultTitle: "Scan complete",
  imageLeft: "Image-left eye",
  imageRight: "Image-right eye",
  iris: "Iris",
  reflex: "Light reflex",
  offsetHint: "Offset = reflex shift ÷ iris radius",
  difference: "Difference between eyes",
  differenceHint: "Unitless, after mirroring one eye",
  framesUsed: "Frames used",
  spread: "Spread",
  notice:
    "Proof of concept. Not a diagnosis and not a replacement for an eye exam. No image was saved.",
  scanAgain: "Scan again",
  noResult: "Not enough clear frames. Please scan again.",

  parentsTitle: "For parents",
  parentsHero: "Early checks protect a child's sight",
  fact1: "About 3 in 100 preschool children had strabismus in a large population study.",
  fact1Source: "Source: MEPEDS, Ophthalmology 2013 (3.24–3.55%, ages 6–72 months)",
  fact2: "Lazy eye treatment works best when it starts young.",
  fact2Source: "Source: US National Eye Institute, PEDIG trials (2005)",
  fact3:
    "Experts advise a vision check at least once between ages 3 and 5. The light reflex test is one of the listed methods.",
  fact3Source: "Source: USPSTF recommendation, 2017",
  parentsNotice:
    "This app only suggests whether seeing an eye doctor is a good idea. It never diagnoses, and it never replaces an eye exam.",

  reasons: {
    NO_FACE: "No face found",
    MULTIPLE_FACES: "More than one face",
    EYE_NOT_FOUND: "Eyes not found",
    REFLEX_NOT_FOUND: "Light reflex not visible",
  } as Record<string, string>,
};
