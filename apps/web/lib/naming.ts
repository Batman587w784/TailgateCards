/**
 * M1 / T4 — Naming layer (Campus/Chapter/Member).
 *
 * Pure, client-safe label map for the three-tier hierarchy. The active preset is
 * resolved server-side (see `get_user_naming_preset` / `get_district_naming_preset`
 * RPCs and `_lib/server/naming.ts`); this module turns a preset into display
 * nouns so UI/emails never hardcode "Campus" vs "District".
 */
import type { Database } from '~/lib/database.types';

export type NamingPreset = Database['public']['Enums']['district_naming_preset'];

export interface NounLabel {
  singular: string;
  plural: string;
}

export interface HierarchyLabels {
  /** Top tier: District (generic) / Campus (campus). */
  district: NounLabel;
  /** Middle tier: Organization (generic) / Chapter (campus). */
  organization: NounLabel;
  /** Bottom tier: Member (both presets). */
  member: NounLabel;
}

export const DEFAULT_NAMING_PRESET: NamingPreset = 'district_org_member';

export const NAMING_LABELS: Record<NamingPreset, HierarchyLabels> = {
  campus_chapter_member: {
    district: { singular: 'Campus', plural: 'Campuses' },
    organization: { singular: 'Chapter', plural: 'Chapters' },
    member: { singular: 'Member', plural: 'Members' },
  },
  district_org_member: {
    district: { singular: 'District', plural: 'Districts' },
    organization: { singular: 'Organization', plural: 'Organizations' },
    member: { singular: 'Member', plural: 'Members' },
  },
};

/**
 * Resolve the label set for a preset, falling back to the default when the
 * preset is null/undefined/unknown.
 */
export function getHierarchyLabels(
  preset: NamingPreset | null | undefined,
): HierarchyLabels {
  return NAMING_LABELS[preset ?? DEFAULT_NAMING_PRESET] ?? NAMING_LABELS[DEFAULT_NAMING_PRESET];
}
