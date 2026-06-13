import {
  DEFAULT_SONG_ARRANGEMENT,
  createSongArrangement,
  type SongArrangement,
  type SongFormSection,
} from "./song-form";
import {
  BALANCED_SECTION_DYNAMICS_PROFILE,
  BREATHING_SECTION_DYNAMICS_PROFILE,
  LIFTED_SECTION_DYNAMICS_PROFILE,
  type SectionDynamicsProfile,
} from "./section-dynamics";

export type FormVariantId = "classic-arc" | "early-hook" | "wide-return";

export interface FormVariant {
  id: FormVariantId;
  label: string;
  summary: string;
  arrangement: SongArrangement;
  sectionDynamicsProfile: SectionDynamicsProfile;
}

const EARLY_HOOK_FORM: readonly SongFormSection[] = [
  { sectionType: "verse", bars: 4 },
  { sectionType: "chorus", bars: 8 },
  { sectionType: "verse", bars: 4 },
  { sectionType: "chorus", bars: 8 },
  { sectionType: "bridge", bars: 4 },
  { sectionType: "chorus", bars: 8 },
];

const WIDE_RETURN_FORM: readonly SongFormSection[] = [
  { sectionType: "verse", bars: 8 },
  { sectionType: "chorus", bars: 8 },
  { sectionType: "verse", bars: 4 },
  { sectionType: "chorus", bars: 8 },
  { sectionType: "bridge", bars: 4 },
  { sectionType: "chorus", bars: 12 },
];

export const FORM_VARIANTS: readonly FormVariant[] = [
  {
    id: "classic-arc",
    label: "Classic Arc",
    summary: "The current 8-bar verse/chorus/bridge song form.",
    arrangement: DEFAULT_SONG_ARRANGEMENT,
    sectionDynamicsProfile: BALANCED_SECTION_DYNAMICS_PROFILE,
  },
  {
    id: "early-hook",
    label: "Early Hook",
    summary: "Shorter verses bring the chorus in sooner with a stronger lift.",
    arrangement: createSongArrangement(EARLY_HOOK_FORM),
    sectionDynamicsProfile: LIFTED_SECTION_DYNAMICS_PROFILE,
  },
  {
    id: "wide-return",
    label: "Wide Return",
    summary: "A shorter bridge and longer final chorus leave more room for the return.",
    arrangement: createSongArrangement(WIDE_RETURN_FORM),
    sectionDynamicsProfile: BREATHING_SECTION_DYNAMICS_PROFILE,
  },
];

export const DEFAULT_FORM_VARIANT_ID: FormVariantId = "classic-arc";

export function getFormVariant(id: FormVariantId): FormVariant {
  return FORM_VARIANTS.find((variant) => variant.id === id) ?? FORM_VARIANTS[0];
}

export function isFormVariantId(value: string): value is FormVariantId {
  return FORM_VARIANTS.some((variant) => variant.id === value);
}
