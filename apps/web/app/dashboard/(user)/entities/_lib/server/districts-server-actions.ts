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
