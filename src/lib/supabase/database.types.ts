export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TenantScoped = {
  tenant_id: string;
};

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          about: string | null;
          website: string | null;
          phone: string | null;
          max_members: number;
          monthly_fee_cents: number;
          billing_status: "trial" | "active" | "past_due" | "canceled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          about?: string | null;
          website?: string | null;
          phone?: string | null;
          max_members?: number;
          monthly_fee_cents?: number;
          billing_status?: "trial" | "active" | "past_due" | "canceled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          about?: string | null;
          website?: string | null;
          phone?: string | null;
          max_members?: number;
          monthly_fee_cents?: number;
          billing_status?: "trial" | "active" | "past_due" | "canceled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_tenant_roles: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          role: "admin" | "supervisor" | "agent";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          role?: "admin" | "supervisor" | "agent";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          role?: "admin" | "supervisor" | "agent";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_tenant_roles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      channels: {
        Row: {
          id: string;
          tenant_id: string;
          provider_id: string;
          display_name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider_id: string;
          display_name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          provider_id?: string;
          display_name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          channel_id: string;
          phone_number_id: string;
          waba_id: string;
          access_token_encrypted: string;
          display_phone: string | null;
          verified_name: string | null;
          quality_rating: string | null;
          onboard_source: "manual" | "embedded_signup" | "business_app" | "baileys";
          meta_business_id: string | null;
          connection_status: "pending_qr" | "open" | "close";
          last_webhook_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          channel_id: string;
          phone_number_id: string;
          waba_id: string;
          access_token_encrypted: string;
          display_phone?: string | null;
          verified_name?: string | null;
          quality_rating?: string | null;
          onboard_source?: "manual" | "embedded_signup" | "business_app" | "baileys";
          meta_business_id?: string | null;
          connection_status?: "pending_qr" | "open" | "close";
          last_webhook_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          channel_id?: string;
          phone_number_id?: string;
          waba_id?: string;
          access_token_encrypted?: string;
          display_phone?: string | null;
          verified_name?: string | null;
          quality_rating?: string | null;
          onboard_source?: "manual" | "embedded_signup" | "business_app" | "baileys";
          meta_business_id?: string | null;
          connection_status?: "pending_qr" | "open" | "close";
          last_webhook_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          tenant_id: string;
          display_name: string | null;
          phone_e164: string | null;
          external_id: string | null;
          temperature: "hot" | "warm" | "cold";
          temperature_updated_at: string | null;
          email: string | null;
          company_name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          display_name?: string | null;
          phone_e164?: string | null;
          external_id?: string | null;
          temperature?: "hot" | "warm" | "cold";
          temperature_updated_at?: string | null;
          email?: string | null;
          company_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          display_name?: string | null;
          phone_e164?: string | null;
          external_id?: string | null;
          temperature?: "hot" | "warm" | "cold";
          temperature_updated_at?: string | null;
          email?: string | null;
          company_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_attributes: {
        Row: {
          id: string;
          tenant_id: string;
          key: string;
          label: string;
          type: "text" | "number" | "select" | "date" | "email" | "phone";
          options: Json;
          required: boolean;
          collect_via_ai: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          key: string;
          label: string;
          type?: "text" | "number" | "select" | "date" | "email" | "phone";
          options?: Json;
          required?: boolean;
          collect_via_ai?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          key?: string;
          label?: string;
          type?: "text" | "number" | "select" | "date" | "email" | "phone";
          options?: Json;
          required?: boolean;
          collect_via_ai?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_attribute_values: {
        Row: {
          id: string;
          tenant_id: string;
          contact_id: string;
          attribute_id: string;
          value: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          contact_id: string;
          attribute_id: string;
          value?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          contact_id?: string;
          attribute_id?: string;
          value?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      deal_stages: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          color: string;
          sort_order: number;
          is_closed_won: boolean;
          is_closed_lost: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          color?: string;
          sort_order?: number;
          is_closed_won?: boolean;
          is_closed_lost?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          color?: string;
          sort_order?: number;
          is_closed_won?: boolean;
          is_closed_lost?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          tenant_id: string;
          contact_id: string;
          conversation_id: string | null;
          stage_id: string;
          title: string;
          value: number | null;
          currency: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          contact_id: string;
          conversation_id?: string | null;
          stage_id: string;
          title: string;
          value?: number | null;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          contact_id?: string;
          conversation_id?: string | null;
          stage_id?: string;
          title?: string;
          value?: number | null;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          billing_type: "fixed" | "per_unit" | "tiered";
          unit_label: string;
          unit_attribute_key: string | null;
          base_price: number;
          min_price: number | null;
          currency: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          billing_type?: "fixed" | "per_unit" | "tiered";
          unit_label?: string;
          unit_attribute_key?: string | null;
          base_price?: number;
          min_price?: number | null;
          currency?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string | null;
          billing_type?: "fixed" | "per_unit" | "tiered";
          unit_label?: string;
          unit_attribute_key?: string | null;
          base_price?: number;
          min_price?: number | null;
          currency?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_pricing_tiers: {
        Row: {
          id: string;
          service_id: string;
          tenant_id: string;
          min_units: number;
          max_units: number | null;
          price: number;
          price_mode: "flat" | "per_unit";
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          tenant_id: string;
          min_units?: number;
          max_units?: number | null;
          price: number;
          price_mode?: "flat" | "per_unit";
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          tenant_id?: string;
          min_units?: number;
          max_units?: number | null;
          price?: number;
          price_mode?: "flat" | "per_unit";
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      playbooks: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          trigger: "new_contact" | "keyword" | "manual";
          trigger_keyword: string | null;
          is_active: boolean;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          trigger?: "new_contact" | "keyword" | "manual";
          trigger_keyword?: string | null;
          is_active?: boolean;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          trigger?: "new_contact" | "keyword" | "manual";
          trigger_keyword?: string | null;
          is_active?: boolean;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          tenant_id: string;
          channel_id: string;
          contact_id: string;
          status: "ai_active" | "waiting_human" | "human_active" | "resolved";
          assigned_to: string | null;
          last_message_at: string | null;
          waiting_human_at: string | null;
          handoff_busy_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          channel_id: string;
          contact_id: string;
          status?: "ai_active" | "waiting_human" | "human_active" | "resolved";
          assigned_to?: string | null;
          last_message_at?: string | null;
          waiting_human_at?: string | null;
          handoff_busy_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          channel_id?: string;
          contact_id?: string;
          status?: "ai_active" | "waiting_human" | "human_active" | "resolved";
          assigned_to?: string | null;
          last_message_at?: string | null;
          waiting_human_at?: string | null;
          handoff_busy_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_notifications: {
        Row: {
          id: string;
          tenant_id: string;
          type: string;
          title: string;
          body: string | null;
          conversation_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          type?: string;
          title: string;
          body?: string | null;
          conversation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          conversation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_usage_events: {
        Row: {
          id: string;
          tenant_id: string;
          provider: string;
          model: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          conversation_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider?: string;
          model?: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          conversation_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          provider?: string;
          model?: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          conversation_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          tenant_id: string;
          conversation_id: string;
          direction: "inbound" | "outbound";
          sender_type: "contact" | "ai" | "agent" | "system";
          sender_user_id: string | null;
          body: string | null;
          provider_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          conversation_id: string;
          direction: "inbound" | "outbound";
          sender_type: "contact" | "ai" | "agent" | "system";
          sender_user_id?: string | null;
          body?: string | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          conversation_id?: string;
          direction?: "inbound" | "outbound";
          sender_type?: "contact" | "ai" | "agent" | "system";
          sender_user_id?: string | null;
          body?: string | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_configs: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          instructions: string;
          is_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name?: string;
          instructions?: string;
          is_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          instructions?: string;
          is_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tenant_invites: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: "admin" | "supervisor" | "agent";
          invited_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          role?: "admin" | "supervisor" | "agent";
          invited_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          role?: "admin" | "supervisor" | "agent";
          invited_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_tenant: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
      };
      platform_add_tenant_member: {
        Args: {
          p_tenant_id: string;
          p_user_id: string;
          p_role?: "admin" | "supervisor" | "agent";
        };
        Returns: Database["public"]["Tables"]["user_tenant_roles"]["Row"];
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      seed_tenant_crm: {
        Args: { p_tenant_id: string };
        Returns: undefined;
      };
      assume_conversation: {
        Args: { p_conversation_id: string };
        Returns: Database["public"]["Tables"]["conversations"]["Row"];
      };
      release_conversation_to_ai: {
        Args: { p_conversation_id: string };
        Returns: Database["public"]["Tables"]["conversations"]["Row"];
      };
    };
    Enums: {
      app_role: "admin" | "supervisor" | "agent";
      conversation_status:
        | "ai_active"
        | "waiting_human"
        | "human_active"
        | "resolved";
      attribute_type: "text" | "number" | "select" | "date" | "email" | "phone";
      lead_temperature: "hot" | "warm" | "cold";
      billing_type: "fixed" | "per_unit" | "tiered";
      tier_price_mode: "flat" | "per_unit";
      playbook_trigger: "new_contact" | "keyword" | "manual";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type { TenantScoped };
