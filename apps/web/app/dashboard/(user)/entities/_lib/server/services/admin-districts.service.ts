import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

import {
  AssignChaptersSchemaType,
  CreateCampusSchemaType,
  UpdateCampusSchemaType,
} from '../../schemas/entity.schema';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .concat('-', Math.random().toString(36).substring(2, 8));
}

function namingPresetFor(
  type: 'campus' | 'generic',
): Database['public']['Enums']['district_naming_preset'] {
  return type === 'campus' ? 'campus_chapter_member' : 'district_org_member';
}

export function createAdminDistrictsService(client: SupabaseClient<Database>) {
  return new AdminDistrictsService(client);
}

class AdminDistrictsService {
  constructor(private adminClient: SupabaseClient<Database>) {}

  async createDistrict(data: CreateCampusSchemaType, adminUserId: string) {
    const { data: district, error } = await this.adminClient
      .from('districts')
      .insert({
        name: data.name,
        district_type: data.districtType,
        naming_preset: namingPresetFor(data.districtType),
        state: data.state ?? null,
        city: data.city ?? null,
        is_active: data.isActive ?? true,
        share_slug: generateSlug(data.name),
        created_by: adminUserId,
      })
      .select()
      .single();

    if (error) throw error;

    return district;
  }

  async updateDistrict(data: UpdateCampusSchemaType) {
    const update: Database['public']['Tables']['districts']['Update'] = {};

    if (data.name !== undefined) update.name = data.name;
    if (data.districtType !== undefined) {
      update.district_type = data.districtType;
      update.naming_preset = namingPresetFor(data.districtType);
    }
    if (data.state !== undefined) update.state = data.state;
    if (data.city !== undefined) update.city = data.city;
    if (data.isActive !== undefined) update.is_active = data.isActive;

    const { error } = await this.adminClient
      .from('districts')
      .update(update)
      .eq('id', data.districtId);

    if (error) throw error;
  }

  async updateDistrictStatus(districtId: string, isActive: boolean) {
    const { error } = await this.adminClient
      .from('districts')
      .update({ is_active: isActive })
      .eq('id', districtId);

    if (error) throw error;
  }

  /**
   * Set the chapters (orgs) that belong to a district. Any org currently in the
   * district but not in the new list is unassigned (district_id -> null).
   */
  async assignChapters(data: AssignChaptersSchemaType) {
    const { error: clearError } = await this.adminClient
      .from('organization_profiles')
      .update({ district_id: null })
      .eq('district_id', data.districtId);

    if (clearError) throw clearError;

    if (data.orgAccountIds.length > 0) {
      const { error: setError } = await this.adminClient
        .from('organization_profiles')
        .update({ district_id: data.districtId })
        .in('account_id', data.orgAccountIds);

      if (setError) throw setError;
    }
  }

  async updateDistrictLogo(districtId: string, logoUrl: string) {
    const { error } = await this.adminClient
      .from('districts')
      .update({ logo_url: logoUrl })
      .eq('id', districtId);

    if (error) throw error;
  }

  async setStandardizeLogos(districtId: string, standardize: boolean) {
    const { error } = await this.adminClient
      .from('districts')
      .update({ standardize_logos: standardize })
      .eq('id', districtId);

    if (error) throw error;
  }

  async getDistrictChapterIds(districtId: string) {
    const { data, error } = await this.adminClient
      .from('organization_profiles')
      .select('account_id')
      .eq('district_id', districtId);

    if (error) throw error;

    return (data ?? []).map((r) => r.account_id);
  }
}
