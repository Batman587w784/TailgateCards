'use server';

import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { z } from 'zod';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AssignChaptersSchema,
  CreateCampusSchema,
  ToggleCampusStatusSchema,
  ToggleStandardizeLogosSchema,
  UpdateCampusSchema,
  UpdateDistrictLogoSchema,
} from '../schemas/entity.schema';
import { createAdminDistrictsService } from './services/admin-districts.service';

async function requireSuperAdminAndGetUserId(): Promise<string> {
  const client = getSupabaseServerClient();

  if (!(await isSuperAdmin(client))) {
    notFound();
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    notFound();
  }

  return user.id;
}

function getService() {
  return createAdminDistrictsService(getSupabaseServerAdminClient());
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const createCampusAction = enhanceAction(
  async (data) => {
    const adminUserId = await requireSuperAdminAndGetUserId();

    try {
      const district = await getService().createDistrict(data, adminUserId);
      revalidatePath('/dashboard/entities');

      return { success: true as const, data: district };
    } catch (error) {
      return {
        success: false as const,
        error: errorMessage(error, 'Failed to create campus'),
      };
    }
  },
  { schema: CreateCampusSchema },
);

export const updateCampusAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    try {
      await getService().updateDistrict(data);
      revalidatePath('/dashboard/entities');

      return { success: true as const };
    } catch (error) {
      return {
        success: false as const,
        error: errorMessage(error, 'Failed to update campus'),
      };
    }
  },
  { schema: UpdateCampusSchema },
);

export const toggleCampusStatusAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    try {
      await getService().updateDistrictStatus(data.districtId, data.isActive);
      revalidatePath('/dashboard/entities');

      return { success: true as const };
    } catch (error) {
      return {
        success: false as const,
        error: errorMessage(error, 'Failed to update status'),
      };
    }
  },
  { schema: ToggleCampusStatusSchema },
);

export const assignChaptersAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    try {
      await getService().assignChapters(data);
      revalidatePath('/dashboard/entities');

      return { success: true as const };
    } catch (error) {
      return {
        success: false as const,
        error: errorMessage(error, 'Failed to assign chapters'),
      };
    }
  },
  { schema: AssignChaptersSchema },
);

export const updateDistrictLogoAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    try {
      await getService().updateDistrictLogo(data.districtId, data.logoUrl);
      revalidatePath('/dashboard/entities');

      return { success: true as const };
    } catch (error) {
      return {
        success: false as const,
        error: errorMessage(error, 'Failed to update district logo'),
      };
    }
  },
  { schema: UpdateDistrictLogoSchema },
);

export const toggleStandardizeLogosAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    try {
      await getService().setStandardizeLogos(data.districtId, data.standardize);
      revalidatePath('/dashboard/entities');

      return { success: true as const };
    } catch (error) {
      return {
        success: false as const,
        error: errorMessage(error, 'Failed to update logo standardization'),
      };
    }
  },
  { schema: ToggleStandardizeLogosSchema },
);

export const getDistrictChaptersAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    try {
      const ids = await getService().getDistrictChapterIds(data.districtId);

      return { success: true as const, data: ids };
    } catch {
      return { success: false as const, data: [] as string[] };
    }
  },
  { schema: z.object({ districtId: z.string().uuid() }) },
);

// ── M2.5-a: prize tiers (super-admin managed, district-scoped) ────────────────

const ToggleDistrictFundraiserSchema = z.object({
  districtId: z.string().uuid(),
  enabled: z.boolean(),
});

const PrizeTierFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  thresholdCards: z.coerce.number().int().min(0),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

const CreatePrizeTierSchema = PrizeTierFieldsSchema.extend({
  districtId: z.string().uuid(),
  // All three scopes are creatable (decision #12): district-collective,
  // top-chapter, top-individual — all anchored to the district.
  scope: z.enum(['district', 'chapter', 'individual']).default('district'),
});

const SetCompetitionWindowSchema = z.object({
  districtId: z.string().uuid(),
  startDate: z.string().min(1), // ISO date (YYYY-MM-DD)
  days: z.coerce
    .number()
    .int()
    .refine((v) => [30, 40, 60].includes(v), 'Window must be 30, 40, or 60 days'),
});

const UpdatePrizeTierSchema = PrizeTierFieldsSchema.extend({
  tierId: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export const toggleDistrictFundraiserAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const admin = getSupabaseServerAdminClient();
    const { error } = await admin
      .from('districts')
      .update({ fundraiser_enabled: data.enabled })
      .eq('id', data.districtId);

    if (error) return { success: false as const, error: error.message };

    revalidatePath('/dashboard/entities');
    return { success: true as const };
  },
  { schema: ToggleDistrictFundraiserSchema },
);

export const createPrizeTierAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const admin = getSupabaseServerAdminClient();
    const { error } = await admin.from('prize_tiers').insert({
      scope: data.scope,
      district_id: data.districtId,
      name: data.name,
      description: data.description || null,
      image_url: data.imageUrl || null,
      threshold_cards: data.thresholdCards,
      display_order: data.displayOrder ?? 0,
    });

    if (error) return { success: false as const, error: error.message };

    revalidatePath('/dashboard/entities');
    return { success: true as const };
  },
  { schema: CreatePrizeTierSchema },
);

export const updatePrizeTierAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const admin = getSupabaseServerAdminClient();
    const { error } = await admin
      .from('prize_tiers')
      .update({
        name: data.name,
        description: data.description || null,
        image_url: data.imageUrl || null,
        threshold_cards: data.thresholdCards,
        ...(data.displayOrder !== undefined
          ? { display_order: data.displayOrder }
          : {}),
        ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
      })
      .eq('id', data.tierId);

    if (error) return { success: false as const, error: error.message };

    revalidatePath('/dashboard/entities');
    return { success: true as const };
  },
  { schema: UpdatePrizeTierSchema },
);

export const deletePrizeTierAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const admin = getSupabaseServerAdminClient();
    const { error } = await admin
      .from('prize_tiers')
      .delete()
      .eq('id', data.tierId);

    if (error) return { success: false as const, error: error.message };

    revalidatePath('/dashboard/entities');
    return { success: true as const };
  },
  { schema: z.object({ tierId: z.string().uuid() }) },
);

// ── M2.5 #14: competition window (start + 30/40/60 days) in districts.config ──
export const setCompetitionWindowAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const admin = getSupabaseServerAdminClient();

    // Merge into the existing config jsonb (don't clobber other keys).
    const { data: row } = await admin
      .from('districts')
      .select('config')
      .eq('id', data.districtId)
      .single();

    const existing =
      row?.config && typeof row.config === 'object' && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {};

    const config = {
      ...existing,
      competition_start: data.startDate,
      competition_days: data.days,
    };

    const { error } = await admin
      .from('districts')
      .update({ config })
      .eq('id', data.districtId);

    if (error) return { success: false as const, error: error.message };

    revalidatePath('/dashboard/entities');
    return { success: true as const };
  },
  { schema: SetCompetitionWindowSchema },
);
