export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          card_prefix: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          is_personal_account: boolean
          name: string
          organization_id: string | null
          phone: string | null
          picture_url: string | null
          primary_owner_user_id: string
          public_data: Json
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          card_prefix?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_personal_account?: boolean
          name: string
          organization_id?: string | null
          phone?: string | null
          picture_url?: string | null
          primary_owner_user_id?: string
          public_data?: Json
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          card_prefix?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_personal_account?: boolean
          name?: string
          organization_id?: string | null
          phone?: string | null
          picture_url?: string | null
          primary_owner_user_id?: string
          public_data?: Json
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_memberships: {
        Row: {
          account_id: string
          account_role: string
          created_at: string
          created_by: string | null
          share_slug: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          account_role: string
          created_at?: string
          created_by?: string | null
          share_slug?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          account_role?: string
          created_at?: string
          created_by?: string | null
          share_slug?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_role_fkey"
            columns: ["account_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      activities: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          metadata: Json | null
          organization_id: string | null
          seq: number | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          metadata?: Json | null
          organization_id?: string | null
          seq?: number | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          organization_id?: string | null
          seq?: number | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          organization_id: string
          prefix: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          prefix: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          prefix?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          account_id: string
          customer_id: string
          email: string | null
          id: number
          provider: Database["public"]["Enums"]["billing_provider"]
        }
        Insert: {
          account_id: string
          customer_id: string
          email?: string | null
          id?: number
          provider: Database["public"]["Enums"]["billing_provider"]
        }
        Update: {
          account_id?: string
          customer_id?: string
          email?: string | null
          id?: number
          provider?: Database["public"]["Enums"]["billing_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cardholder_profiles: {
        Row: {
          account_id: string
          apple_wallet_added_at: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          first_name: string | null
          google_wallet_added_at: string | null
          id: string
          last_name: string | null
          marketing_opt_in: boolean
          phone: string | null
          postal_code: string | null
          region: string | null
          stripe_customer_id: string | null
          terms_accepted: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_id: string
          apple_wallet_added_at?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          first_name?: string | null
          google_wallet_added_at?: string | null
          id?: string
          last_name?: string | null
          marketing_opt_in?: boolean
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          stripe_customer_id?: string | null
          terms_accepted?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          apple_wallet_added_at?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          first_name?: string | null
          google_wallet_added_at?: string | null
          id?: string
          last_name?: string | null
          marketing_opt_in?: boolean
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          stripe_customer_id?: string | null
          terms_accepted?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cardholder_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardholder_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardholder_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardholder_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          activated_at: string | null
          assigned_at: string | null
          batch_id: string | null
          buyer_email: string | null
          card_number: number | null
          card_type: Database["public"]["Enums"]["card_type"]
          cardholder_id: string | null
          claim_token: string | null
          created_at: string | null
          created_by: string | null
          digital_card_number: number | null
          distributor_id: string | null
          expires_at: string | null
          id: string
          invite_sent_at: string | null
          organization_id: string
          paid_at: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          price_cents: number
          purchased_at: string | null
          status: Database["public"]["Enums"]["card_status"]
          stripe_customer_email: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          activated_at?: string | null
          assigned_at?: string | null
          batch_id?: string | null
          buyer_email?: string | null
          card_number?: number | null
          card_type?: Database["public"]["Enums"]["card_type"]
          cardholder_id?: string | null
          claim_token?: string | null
          created_at?: string | null
          created_by?: string | null
          digital_card_number?: number | null
          distributor_id?: string | null
          expires_at?: string | null
          id?: string
          invite_sent_at?: string | null
          organization_id: string
          paid_at?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price_cents?: number
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          stripe_customer_email?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          activated_at?: string | null
          assigned_at?: string | null
          batch_id?: string | null
          buyer_email?: string | null
          card_number?: number | null
          card_type?: Database["public"]["Enums"]["card_type"]
          cardholder_id?: string | null
          claim_token?: string | null
          created_at?: string | null
          created_by?: string | null
          digital_card_number?: number | null
          distributor_id?: string | null
          expires_at?: string | null
          id?: string
          invite_sent_at?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price_cents?: number
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          stripe_customer_email?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing: boolean
          enable_team_account_billing: boolean
          enable_team_accounts: boolean
        }
        Insert: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing?: boolean
          enable_team_account_billing?: boolean
          enable_team_accounts?: boolean
        }
        Update: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing?: boolean
          enable_team_account_billing?: boolean
          enable_team_accounts?: boolean
        }
        Relationships: []
      }
      discounts: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          merchant_id: string
          organization_id: string | null
          tags: string[] | null
          terms: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          merchant_id: string
          organization_id?: string | null
          tags?: string[] | null
          terms?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          merchant_id?: string
          organization_id?: string | null
          tags?: string[] | null
          terms?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: number
          invite_token: string
          invited_by: string
          role: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: number
          invite_token: string
          invited_by: string
          role: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: number
          invite_token?: string
          invited_by?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      merchant_profiles: {
        Row: {
          account_id: string
          address: string | null
          business_name: string | null
          business_type: string | null
          city: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          dashboard_passcode_hash: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          passcode: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          state: string | null
          stripe_account_id: string | null
          updated_at: string | null
          updated_by: string | null
          website: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          dashboard_passcode_hash?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          passcode?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          state?: string | null
          stripe_account_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          dashboard_passcode_hash?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          passcode?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          state?: string | null
          stripe_account_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      nonces: {
        Row: {
          client_token: string
          created_at: string
          expires_at: string
          id: string
          last_verification_at: string | null
          last_verification_ip: unknown
          last_verification_user_agent: string | null
          metadata: Json | null
          nonce: string
          purpose: string
          revoked: boolean
          revoked_reason: string | null
          scopes: string[] | null
          used_at: string | null
          user_id: string | null
          verification_attempts: number
        }
        Insert: {
          client_token: string
          created_at?: string
          expires_at: string
          id?: string
          last_verification_at?: string | null
          last_verification_ip?: unknown
          last_verification_user_agent?: string | null
          metadata?: Json | null
          nonce: string
          purpose: string
          revoked?: boolean
          revoked_reason?: string | null
          scopes?: string[] | null
          used_at?: string | null
          user_id?: string | null
          verification_attempts?: number
        }
        Update: {
          client_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_verification_at?: string | null
          last_verification_ip?: unknown
          last_verification_user_agent?: string | null
          metadata?: Json | null
          nonce?: string
          purpose?: string
          revoked?: boolean
          revoked_reason?: string | null
          scopes?: string[] | null
          used_at?: string | null
          user_id?: string | null
          verification_attempts?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          account_id: string
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          dismissed: boolean
          expires_at: string | null
          id: number
          link: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          account_id: string
          body: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: never
          link?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          account_id?: string
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: never
          link?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price_amount: number | null
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          order_id: string
          price_amount?: number | null
          product_id: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price_amount?: number | null
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at?: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          billing_customer_id?: number
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_billing_customer_id_fkey"
            columns: ["billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_digital_card_counters: {
        Row: {
          next_number: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          next_number?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          next_number?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_digital_card_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_digital_card_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_digital_card_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_digital_card_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_merchant_partnerships: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          merchant_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          merchant_id: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          merchant_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_merchant_partnerships_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_merchant_partnerships_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_merchant_partnerships_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_merchant_partnerships_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_merchant_partnerships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_merchant_partnerships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_merchant_partnerships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_merchant_partnerships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          account_id: string
          address: string | null
          card_price_cents: number
          cash_payments_enabled: boolean
          city: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          organization_name: string | null
          organization_type: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          share_per_card_cents: number
          state: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          card_price_cents?: number
          cash_payments_enabled?: boolean
          city?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_name?: string | null
          organization_type?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          share_per_card_cents?: number
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          card_price_cents?: number
          cash_payments_enabled?: boolean
          city?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_name?: string | null
          organization_type?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          share_per_card_cents?: number
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          card_id: string
          created_at: string | null
          created_by: string | null
          discount_id: string
          id: string
          merchant_id: string
          redeemed_at: string
          refund_reason: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["redemption_status"]
          updated_at: string | null
          updated_by: string | null
          validated_by: string | null
        }
        Insert: {
          card_id: string
          created_at?: string | null
          created_by?: string | null
          discount_id: string
          id?: string
          merchant_id: string
          redeemed_at?: string
          refund_reason?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string | null
          updated_by?: string | null
          validated_by?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string | null
          created_by?: string | null
          discount_id?: string
          id?: string
          merchant_id?: string
          redeemed_at?: string
          refund_reason?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string | null
          updated_by?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cardholders_view"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "redemptions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: number
          permission: Database["public"]["Enums"]["app_permissions"]
          role: string
        }
        Insert: {
          id?: number
          permission: Database["public"]["Enums"]["app_permissions"]
          role: string
        }
        Update: {
          id?: number
          permission?: Database["public"]["Enums"]["app_permissions"]
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          hierarchy_level: number
          name: string
        }
        Insert: {
          hierarchy_level: number
          name: string
        }
        Update: {
          hierarchy_level?: number
          name?: string
        }
        Relationships: []
      }
      subscription_items: {
        Row: {
          created_at: string
          id: string
          interval: string
          interval_count: number
          price_amount: number | null
          product_id: string
          quantity: number
          subscription_id: string
          type: Database["public"]["Enums"]["subscription_item_type"]
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          interval: string
          interval_count: number
          price_amount?: number | null
          product_id: string
          quantity?: number
          subscription_id: string
          type: Database["public"]["Enums"]["subscription_item_type"]
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval?: string
          interval_count?: number
          price_amount?: number | null
          product_id?: string
          quantity?: number
          subscription_id?: string
          type?: Database["public"]["Enums"]["subscription_item_type"]
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at?: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          billing_customer_id?: number
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          id?: string
          period_ends_at?: string
          period_starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_billing_customer_id_fkey"
            columns: ["billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_pass_registrations: {
        Row: {
          created_at: string | null
          device_library_identifier: string
          pass_type_identifier: string
          push_token: string
          serial_number: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_library_identifier: string
          pass_type_identifier: string
          push_token: string
          serial_number: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_library_identifier?: string
          pass_type_identifier?: string
          push_token?: string
          serial_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_pass_registrations_serial_number_fkey"
            columns: ["serial_number"]
            isOneToOne: false
            referencedRelation: "wallet_passes"
            referencedColumns: ["serial_number"]
          },
        ]
      }
      wallet_passes: {
        Row: {
          apple_pass_issued_at: string | null
          card_id: string
          content_tag: string
          created_at: string | null
          google_save_requested_at: string | null
          organization_id: string
          serial_number: string
          updated_at: string | null
        }
        Insert: {
          apple_pass_issued_at?: string | null
          card_id: string
          content_tag?: string
          created_at?: string | null
          google_save_requested_at?: string | null
          organization_id: string
          serial_number: string
          updated_at?: string | null
        }
        Update: {
          apple_pass_issued_at?: string | null
          card_id?: string
          content_tag?: string
          created_at?: string | null
          google_save_requested_at?: string | null
          organization_id?: string
          serial_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_passes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cardholders_view"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "wallet_passes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_sync_queue: {
        Row: {
          attempts: number
          card_id: string | null
          created_at: string
          id: string
          last_error: string | null
          not_before: string
          organization_id: string | null
          processed_at: string | null
          reason: string
          scope: string
          status: string
        }
        Insert: {
          attempts?: number
          card_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          not_before?: string
          organization_id?: string | null
          processed_at?: string | null
          reason: string
          scope: string
          status?: string
        }
        Update: {
          attempts?: number
          card_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          not_before?: string
          organization_id?: string | null
          processed_at?: string | null
          reason?: string
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_sync_queue_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cardholders_view"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "wallet_sync_queue_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cardholders_view: {
        Row: {
          activated_at: string | null
          card_id: string | null
          card_number: number | null
          card_status: Database["public"]["Enums"]["card_status"] | null
          cardholder_email: string | null
          cardholder_id: string | null
          cardholder_name: string | null
          display_code: string | null
          expires_at: string | null
          organization_id: string | null
          organization_prefix: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors_view: {
        Row: {
          account_role: string | null
          created_at: string | null
          email: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          organization_id: string | null
          phone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "distributors_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_memberships_account_role_fkey"
            columns: ["account_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      user_account_workspace: {
        Row: {
          id: string | null
          name: string | null
          picture_url: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          id: string | null
          name: string | null
          picture_url: string | null
          role: string | null
          slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_memberships_account_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { token: string; user_id: string }
        Returns: string
      }
      activate_card: {
        Args: { p_card_code: string; p_validity_days?: number }
        Returns: {
          activated_at: string | null
          assigned_at: string | null
          batch_id: string | null
          buyer_email: string | null
          card_number: number | null
          card_type: Database["public"]["Enums"]["card_type"]
          cardholder_id: string | null
          claim_token: string | null
          created_at: string | null
          created_by: string | null
          digital_card_number: number | null
          distributor_id: string | null
          expires_at: string | null
          id: string
          invite_sent_at: string | null
          organization_id: string
          paid_at: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          price_cents: number
          purchased_at: string | null
          status: Database["public"]["Enums"]["card_status"]
          stripe_customer_email: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      activate_digital_card: {
        Args: { p_claim_token: string; p_validity_days?: number }
        Returns: {
          activated_at: string | null
          assigned_at: string | null
          batch_id: string | null
          buyer_email: string | null
          card_number: number | null
          card_type: Database["public"]["Enums"]["card_type"]
          cardholder_id: string | null
          claim_token: string | null
          created_at: string | null
          created_by: string | null
          digital_card_number: number | null
          distributor_id: string | null
          expires_at: string | null
          id: string
          invite_sent_at: string | null
          organization_id: string
          paid_at: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          price_cents: number
          purchased_at: string | null
          status: Database["public"]["Enums"]["card_status"]
          stripe_customer_email: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_invitations_to_account: {
        Args: {
          account_slug: string
          invitations: Database["public"]["CompositeTypes"]["invitation"][]
        }
        Returns: Database["public"]["Tables"]["invitations"]["Row"][]
      }
      admin_set_merchant_dashboard_passcode: {
        Args: { passcode: string; target_account_id: string }
        Returns: undefined
      }
      admin_set_merchant_passcode: {
        Args: { new_passcode: string; target_account_id: string }
        Returns: undefined
      }
      assign_cards_to_distributor: {
        Args: { dist_id: string; org_id: string; quantity: number }
        Returns: number
      }
      assign_cards_to_distributor_by_count: {
        Args: {
          p_count: number
          p_distributor_id: string
          p_organization_id: string
        }
        Returns: number
      }
      backfill_wallet_passes: { Args: never; Returns: number }
      can_action_account_member: {
        Args: { target_team_account_id: string; target_user_id: string }
        Returns: boolean
      }
      cardholder_can_see_merchant: {
        Args: { target_merchant_id: string }
        Returns: boolean
      }
      claim_wallet_sync_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          card_id: string | null
          created_at: string
          id: string
          last_error: string | null
          not_before: string
          organization_id: string | null
          processed_at: string | null
          reason: string
          scope: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "wallet_sync_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_digital_card: {
        Args: {
          p_buyer_email: string
          p_distributor_id?: string
          p_organization_id: string
          p_payment_intent_id: string
          p_price_cents: number
        }
        Returns: {
          card_id: string
          claim_token: string
        }[]
      }
      create_invitation: {
        Args: { account_id: string; email: string; role: string }
        Returns: {
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: number
          invite_token: string
          invited_by: string
          role: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_nonce: {
        Args: {
          p_expires_in_seconds?: number
          p_metadata?: Json
          p_purpose?: string
          p_revoke_previous?: boolean
          p_scopes?: string[]
          p_user_id?: string
        }
        Returns: Json
      }
      create_team_account: {
        Args: { account_name: string }
        Returns: {
          card_prefix: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          is_personal_account: boolean
          name: string
          organization_id: string | null
          phone: string | null
          picture_url: string | null
          primary_owner_user_id: string
          public_data: Json
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_wallet_sync_card: {
        Args: { p_card_id: string; p_reason: string }
        Returns: undefined
      }
      enqueue_wallet_sync_org: {
        Args: { p_org_id: string; p_reason: string }
        Returns: undefined
      }
      generate_distributor_share_slug: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_account_invitations: {
        Args: { account_slug: string }
        Returns: {
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: number
          invited_by: string
          inviter_email: string
          inviter_name: string
          role: string
          updated_at: string
        }[]
      }
      get_account_members: {
        Args: { account_slug: string }
        Returns: {
          account_id: string
          created_at: string
          email: string
          id: string
          name: string
          picture_url: string
          primary_owner_user_id: string
          role: string
          role_hierarchy_level: number
          updated_at: string
          user_id: string
        }[]
      }
      get_admin_activities: {
        Args: {
          p_limit?: number
          p_page?: number
          p_types?: Database["public"]["Enums"]["activity_type"][]
        }
        Returns: Json
      }
      get_admin_card_stats: { Args: never; Returns: Json }
      get_admin_card_stats_filtered: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_organization_id?: string
        }
        Returns: Json
      }
      get_admin_card_type_split: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_organization_id?: string
        }
        Returns: Json
      }
      get_admin_card_usage_distribution: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_organization_id?: string
        }
        Returns: Json
      }
      get_admin_cards_activated_by_org: {
        Args: { p_date_from?: string; p_date_to?: string }
        Returns: {
          activated_count: number
          inactive_count: number
          organization_id: string
          organization_name: string
        }[]
      }
      get_admin_organizations_list: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      get_admin_platform_stats: {
        Args: { p_organization_id?: string }
        Returns: Json
      }
      get_admin_recent_activations: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_organization_id?: string
          p_page?: number
        }
        Returns: Json
      }
      get_admin_revenue_over_time: {
        Args: {
          months_back?: number
          p_date_from?: string
          p_date_to?: string
          p_organization_id?: string
        }
        Returns: {
          month: string
          revenue: number
        }[]
      }
      get_admin_top_organizations: {
        Args: { limit_count?: number; p_date_from?: string; p_date_to?: string }
        Returns: {
          name: string
          total_revenue: number
        }[]
      }
      get_admin_transaction_stats: { Args: never; Returns: Json }
      get_admin_transaction_stats_filtered: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_organization_id?: string
        }
        Returns: Json
      }
      get_cardholder_last_used: {
        Args: { cardholder_account_id: string }
        Returns: string
      }
      get_cardholder_total_redemptions: {
        Args: { cardholder_account_id: string }
        Returns: number
      }
      get_config: { Args: never; Returns: Json }
      get_digital_card_for_activation: {
        Args: { p_claim_token: string }
        Returns: {
          buyer_email: string
          cardholder_id: string
          digital_card_number: number
          id: string
          organization_id: string
          organization_name: string
          organization_picture_url: string
          price_cents: number
          status: Database["public"]["Enums"]["card_status"]
        }[]
      }
      get_discount_redemption_count: {
        Args: { discount_uuid: string }
        Returns: number
      }
      get_distributor_batch_count: {
        Args: { distributor_account_id: string }
        Returns: number
      }
      get_distributor_buy_page: {
        Args: { p_slug: string }
        Returns: {
          distributor_id: string
          distributor_name: string
          organization_id: string
          organization_name: string
          organization_picture_url: string
          price_cents: number
        }[]
      }
      get_distributor_card_stats: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_distributor_id: string
        }
        Returns: {
          activated: number
          activation_rate: number
          remaining: number
          total_assigned: number
          total_sales: number
        }[]
      }
      get_distributor_organization_name: {
        Args: { distributor_account_id: string }
        Returns: string
      }
      get_distributor_recent_activities: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_distributor_id: string
          p_limit?: number
        }
        Returns: {
          activity_type: string
          created_at: string
          id: string
          message: string
        }[]
      }
      get_distributor_revenue_stats: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_distributor_id: string
        }
        Returns: {
          total_earnings_cents: number
        }[]
      }
      get_distributor_sales_over_time: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_distributor_id: string
          p_months_back?: number
        }
        Returns: {
          month: string
          month_start: string
          revenue_cents: number
          sales_count: number
        }[]
      }
      get_distributor_total_revenue: {
        Args: { distributor_account_id: string }
        Returns: number
      }
      get_distributor_total_sales: {
        Args: { distributor_account_id: string }
        Returns: number
      }
      get_merchant_active_discounts: {
        Args: { merchant_account_id: string }
        Returns: number
      }
      get_merchant_organization_partners: {
        Args: { merch_id: string }
        Returns: {
          organization_id: string
        }[]
      }
      get_merchant_recent_scans: {
        Args: {
          limit_count?: number
          merchant_account_id: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          card_code: string
          discount_id: string
          discount_title: string
          id: string
          redeemed_at: string
        }[]
      }
      get_merchant_redemptions_over_time: {
        Args: {
          merchant_account_id: string
          months_back?: number
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          month: string
          redemption_count: number
        }[]
      }
      get_merchant_total_redemptions: {
        Args: { merchant_account_id: string }
        Returns: number
      }
      get_merchant_visit_analytics: {
        Args: {
          merchant_account_id: string
          p_date_from?: string
          p_date_to?: string
          time_period_months?: number
        }
        Returns: Json
      }
      get_merchant_visitor_kpi_stats: {
        Args: {
          merchant_account_id: string
          p_date_from?: string
          p_date_to?: string
          time_period_months?: number
        }
        Returns: Json
      }
      get_nonce_status: { Args: { p_id: string }; Returns: Json }
      get_org_admin_card_stats: {
        Args: {
          org_account_id: string
          p_date_from?: string
          p_date_to?: string
          p_distributor_id?: string
        }
        Returns: Json
      }
      get_org_admin_card_type_split: {
        Args: {
          org_account_id: string
          p_date_from?: string
          p_date_to?: string
          p_distributor_id?: string
        }
        Returns: Json
      }
      get_org_admin_cards_distribution: {
        Args: {
          org_account_id: string
          p_date_from?: string
          p_date_to?: string
          p_distributor_id?: string
        }
        Returns: Json
      }
      get_org_admin_distributor_stats: {
        Args: {
          org_account_id: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: Json
      }
      get_org_admin_recent_activations: {
        Args: {
          limit_count?: number
          org_account_id: string
          p_date_from?: string
          p_date_to?: string
          p_distributor_id?: string
        }
        Returns: {
          activated_at: string
          activation_id: string
          cardholder_name: string
          display_code: string
          distributor_name: string
          price_cents: number
        }[]
      }
      get_org_admin_revenue_stats: {
        Args: {
          org_account_id: string
          p_date_from?: string
          p_date_to?: string
          p_distributor_id?: string
        }
        Returns: Json
      }
      get_org_admin_sales_over_time: {
        Args: {
          months_back?: number
          org_account_id: string
          p_distributor_id?: string
        }
        Returns: {
          month: string
          revenue_cents: number
          sales_count: number
        }[]
      }
      get_org_admin_top_distributors: {
        Args: {
          limit_count?: number
          org_account_id: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          cards_activated: number
          distributor_id: string
          distributor_name: string
          revenue_cents: number
          total_cards: number
        }[]
      }
      get_org_unassigned_cards_count: {
        Args: { org_account_id: string }
        Returns: number
      }
      get_organization_buy_page: {
        Args: { p_slug: string }
        Returns: {
          organization_id: string
          organization_name: string
          organization_picture_url: string
          price_cents: number
        }[]
      }
      get_organization_merchant_partners: {
        Args: { org_id: string }
        Returns: {
          merchant_id: string
        }[]
      }
      get_organization_total_revenue: {
        Args: { org_account_id: string }
        Returns: number
      }
      get_platform_role: {
        Args: never
        Returns: Database["public"]["Enums"]["platform_role"]
      }
      get_upper_system_role: { Args: never; Returns: string }
      get_user_district_id: { Args: never; Returns: string }
      get_user_personal_account_id: { Args: never; Returns: string }
      get_user_platform_role: {
        Args: { target_user_id?: string }
        Returns: string
      }
      has_active_subscription: {
        Args: { target_account_id: string }
        Returns: boolean
      }
      has_more_elevated_role: {
        Args: {
          role_name: string
          target_account_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          account_id: string
          permission_name: Database["public"]["Enums"]["app_permissions"]
          user_id: string
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: { target_role: Database["public"]["Enums"]["platform_role"] }
        Returns: boolean
      }
      has_role_on_account: {
        Args: { account_id: string; account_role?: string }
        Returns: boolean
      }
      has_same_role_hierarchy_level: {
        Args: {
          role_name: string
          target_account_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      install_extensions: { Args: never; Returns: undefined }
      is_aal2: { Args: never; Returns: boolean }
      is_account_owner: { Args: { account_id: string }; Returns: boolean }
      is_account_team_member: {
        Args: { target_account_id: string }
        Returns: boolean
      }
      is_card_organization: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      is_cardholder_in_my_orgs: {
        Args: { target_id: string }
        Returns: boolean
      }
      is_current_user_merchant: { Args: never; Returns: boolean }
      is_merchant: { Args: { target_account_id: string }; Returns: boolean }
      is_merchant_account: { Args: { target_id: string }; Returns: boolean }
      is_mfa_compliant: { Args: never; Returns: boolean }
      is_organization: { Args: { target_account_id: string }; Returns: boolean }
      is_set: { Args: { field_name: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_team_member: {
        Args: { account_id: string; user_id: string }
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_actor_id?: string
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_metadata?: Json
          p_organization_id?: string
          p_type: Database["public"]["Enums"]["activity_type"]
        }
        Returns: string
      }
      next_digital_card_number: {
        Args: { p_organization_id: string }
        Returns: number
      }
      org_admin_can_see_merchant: {
        Args: { target_merchant_id: string }
        Returns: boolean
      }
      org_profile_readable_by_cardholder: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      revoke_nonce: {
        Args: { p_id: string; p_reason?: string }
        Returns: boolean
      }
      set_merchant_dashboard_passcode: {
        Args: { passcode: string; target_account_id: string }
        Returns: undefined
      }
      team_account_workspace: {
        Args: { account_slug: string }
        Returns: {
          id: string
          name: string
          permissions: Database["public"]["Enums"]["app_permissions"][]
          picture_url: string
          primary_owner_user_id: string
          role: string
          role_hierarchy_level: number
          slug: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
        }[]
      }
      transfer_team_account_ownership: {
        Args: { new_owner_id: string; target_account_id: string }
        Returns: undefined
      }
      upsert_order: {
        Args: {
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          currency: string
          line_items: Json
          status: Database["public"]["Enums"]["payment_status"]
          target_account_id: string
          target_customer_id: string
          target_order_id: string
          total_amount: number
        }
        Returns: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_subscription: {
        Args: {
          active: boolean
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          currency: string
          line_items: Json
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          target_account_id: string
          target_customer_id: string
          target_subscription_id: string
          trial_ends_at?: string
          trial_starts_at?: string
        }
        Returns: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_merchant_dashboard_passcode: {
        Args: { passcode: string; target_account_id: string }
        Returns: boolean
      }
      verify_merchant_passcode: {
        Args: { input_passcode: string; target_account_id: string }
        Returns: boolean
      }
      verify_nonce: {
        Args: {
          p_ip?: unknown
          p_max_verification_attempts?: number
          p_purpose: string
          p_required_scopes?: string[]
          p_token: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: Json
      }
    }
    Enums: {
      activity_type:
        | "organization_onboarded"
        | "organization_deactivated"
        | "merchant_added"
        | "discount_created"
        | "discount_updated"
        | "payment_failed"
        | "card_sold"
        | "card_activated"
        | "distributor_added"
        | "distributor_deactivated"
        | "batch_assigned"
        | "sale_completed"
        | "redemption_completed"
      app_permissions:
        | "roles.manage"
        | "billing.manage"
        | "settings.manage"
        | "members.manage"
        | "invites.manage"
        | "org.manage"
        | "distributors.manage"
        | "cards.assign"
        | "sales.view"
        | "merchant.manage"
        | "discounts.validate"
        | "analytics.view"
        | "cards.activate"
        | "discounts.redeem"
      billing_provider: "stripe" | "lemon-squeezy" | "paddle"
      card_status: "pending" | "paid" | "activated" | "expired" | "cancelled"
      card_type: "physical" | "digital"
      discount_type:
        | "percentage"
        | "fixed_amount"
        | "free_item"
        | "bogo"
        | "other"
      notification_channel: "in_app" | "email"
      notification_type: "info" | "warning" | "error"
      payment_status: "pending" | "succeeded" | "failed"
      payment_type: "stripe" | "cash"
      platform_role:
        | "cardholder"
        | "org_admin"
        | "distributor"
        | "merchant"
        | "district_admin"
      redemption_status: "completed" | "refunded"
      subscription_item_type: "flat" | "per_seat" | "metered"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused"
    }
    CompositeTypes: {
      invitation: {
        email: string | null
        role: string | null
      }
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: [
        "organization_onboarded",
        "organization_deactivated",
        "merchant_added",
        "discount_created",
        "discount_updated",
        "payment_failed",
        "card_sold",
        "card_activated",
        "distributor_added",
        "distributor_deactivated",
        "batch_assigned",
        "sale_completed",
        "redemption_completed",
      ],
      app_permissions: [
        "roles.manage",
        "billing.manage",
        "settings.manage",
        "members.manage",
        "invites.manage",
        "org.manage",
        "distributors.manage",
        "cards.assign",
        "sales.view",
        "merchant.manage",
        "discounts.validate",
        "analytics.view",
        "cards.activate",
        "discounts.redeem",
      ],
      billing_provider: ["stripe", "lemon-squeezy", "paddle"],
      card_status: ["pending", "paid", "activated", "expired", "cancelled"],
      card_type: ["physical", "digital"],
      discount_type: [
        "percentage",
        "fixed_amount",
        "free_item",
        "bogo",
        "other",
      ],
      notification_channel: ["in_app", "email"],
      notification_type: ["info", "warning", "error"],
      payment_status: ["pending", "succeeded", "failed"],
      payment_type: ["stripe", "cash"],
      platform_role: [
        "cardholder",
        "org_admin",
        "distributor",
        "merchant",
        "district_admin",
      ],
      redemption_status: ["completed", "refunded"],
      subscription_item_type: ["flat", "per_seat", "metered"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

