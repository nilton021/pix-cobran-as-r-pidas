export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          document: string
          document_type: string
          email: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          document: string
          document_type?: string
          email: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          document?: string
          document_type?: string
          email?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      api_audit_events: {
        Row: {
          account_id: string | null
          api_key_id: string | null
          created_at: string
          duration_ms: number
          event_type: string
          id: string
          metadata: Json
          method: string
          request_id: string
          route: string
          status_code: number
        }
        Insert: {
          account_id?: string | null
          api_key_id?: string | null
          created_at?: string
          duration_ms: number
          event_type?: string
          id?: string
          metadata?: Json
          method: string
          request_id: string
          route: string
          status_code: number
        }
        Update: {
          account_id?: string | null
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number
          event_type?: string
          id?: string
          metadata?: Json
          method?: string
          request_id?: string
          route?: string
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_audit_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_audit_events_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_idempotency_keys: {
        Row: {
          api_key_id: string
          charge_id: string | null
          completed_at: string | null
          created_at: string
          idempotency_key: string
          request_hash: string
          response_status: number | null
        }
        Insert: {
          api_key_id: string
          charge_id?: string | null
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          request_hash: string
          response_status?: number | null
        }
        Update: {
          api_key_id?: string
          charge_id?: string | null
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          request_hash?: string
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_idempotency_keys_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          account_id: string
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limit_buckets: {
        Row: {
          api_key_id: string
          request_count: number
          route: string
          window_start: string
        }
        Insert: {
          api_key_id: string
          request_count?: number
          route: string
          window_start: string
        }
        Update: {
          api_key_id?: string
          request_count?: number
          route?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limit_buckets_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      charges: {
        Row: {
          account_id: string
          amount_cents: number
          created_at: string
          description: string | null
          end_to_end_id: string | null
          expires_at: string | null
          id: string
          last_error: string | null
          paid_at: string | null
          payer: Json | null
          payment_integration_id: string | null
          picpay_charge_id: string | null
          provider_charge_id: string | null
          qr_code: string | null
          qr_code_base64: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          created_at?: string
          description?: string | null
          end_to_end_id?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          paid_at?: string | null
          payer?: Json | null
          payment_integration_id?: string | null
          picpay_charge_id?: string | null
          provider_charge_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          created_at?: string
          description?: string | null
          end_to_end_id?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          paid_at?: string | null
          payer?: Json | null
          payment_integration_id?: string | null
          picpay_charge_id?: string | null
          provider_charge_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_payment_integration_id_fkey"
            columns: ["payment_integration_id"]
            isOneToOne: false
            referencedRelation: "payment_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_webhook_endpoints: {
        Row: {
          account_id: string
          active: boolean
          created_at: string
          events: Json
          id: string
          secret_name: string
          updated_at: string
          url: string
        }
        Insert: {
          account_id: string
          active?: boolean
          created_at?: string
          events?: Json
          id?: string
          secret_name: string
          updated_at?: string
          url: string
        }
        Update: {
          account_id?: string
          active?: boolean
          created_at?: string
          events?: Json
          id?: string
          secret_name?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_webhook_endpoints_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_integrations: {
        Row: {
          account_id: string
          created_at: string
          display_name: string
          environment: string
          id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_name: string
          environment?: string
          id?: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_name?: string
          environment?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_integrations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string | null
          id: string
          merchant_charge_id: string | null
          payload_hash: string | null
          received_at: string
          status: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          merchant_charge_id?: string | null
          payload_hash?: string | null
          received_at?: string
          status?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          merchant_charge_id?: string | null
          payload_hash?: string | null
          received_at?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_api_rate_limit: {
        Args: {
          p_api_key_id: string
          p_limit: number
          p_route: string
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      get_asaas_integration_credentials: {
        Args: { p_integration_id: string }
        Returns: {
          api_key: string
          environment: string
          integration_id: string
          webhook_secret: string
        }[]
      }
      get_customer_webhook_secret: {
        Args: { p_endpoint_id: string }
        Returns: string
      }
      get_picpay_integration_credentials: {
        Args: { p_integration_id: string }
        Returns: {
          client_id: string
          client_secret: string
          environment: string
          integration_id: string
          webhook_secret: string
        }[]
      }
      get_picpay_webhook_secret: {
        Args: { p_integration_id: string }
        Returns: string
      }
      get_inter_integration_credentials: {
        Args: { p_integration_id: string }
        Returns: {
          account_number: string | null
          cert_pem: string
          client_id: string
          client_secret: string
          environment: string
          integration_id: string
          key_pem: string
          pix_key: string
        }[]
      }
      get_efi_integration_credentials: {
        Args: { p_integration_id: string }
        Returns: {
          certificate_base64: string
          certificate_password: string | null
          client_id: string
          client_secret: string
          environment: string
          integration_id: string
          pix_key: string
          webhook_hmac: string
        }[]
      }
      save_inter_integration: {
        Args: {
          p_account_id: string
          p_account_number?: string | null
          p_cert_pem?: string | null
          p_client_id?: string | null
          p_client_secret?: string | null
          p_display_name?: string
          p_environment?: string
          p_integration_id?: string | null
          p_key_pem?: string | null
          p_pix_key?: string | null
        }
        Returns: string
      }
      save_efi_integration: {
        Args: {
          p_account_id: string
          p_certificate_base64?: string | null
          p_certificate_password?: string | null
          p_client_id?: string | null
          p_client_secret?: string | null
          p_display_name?: string
          p_environment?: string
          p_integration_id?: string | null
          p_pix_key?: string | null
        }
        Returns: {
          integration_id: string
          webhook_hmac: string
        }[]
      }
      purge_old_webhook_events: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      save_asaas_integration: {
        Args: {
          p_account_id: string
          p_api_key?: string
          p_display_name?: string
          p_environment?: string
          p_integration_id?: string
          p_webhook_token?: string
        }
        Returns: string
      }
      set_customer_webhook_secret: {
        Args: { p_endpoint_id: string; p_secret: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
