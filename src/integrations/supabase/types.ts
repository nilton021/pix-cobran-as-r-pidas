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
        ]
      }
      api_keys: {
        Row: {
          id: string
          account_id: string
          name: string
          key_prefix: string
          key_hash: string
          expires_at: string | null
          revoked_at: string | null
          last_used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          key_prefix: string
          key_hash: string
          expires_at?: string | null
          revoked_at?: string | null
          last_used_at?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          expires_at?: string | null
          revoked_at?: string | null
          last_used_at?: string | null
        }
        Relationships: []
      }
      payment_integrations: {
        Row: {
          id: string
          account_id: string
          provider: string
          environment: string
          display_name: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          provider: string
          environment: string
          display_name: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_webhook_endpoints: {
        Row: {
          id: string
          account_id: string
          url: string
          secret_name: string
          events: Json
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          url: string
          secret_name: string
          events?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          url?: string
          events?: Json
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      api_idempotency_keys: {
        Row: {
          api_key_id: string
          idempotency_key: string
          request_hash: string
          charge_id: string | null
          response_status: number | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          api_key_id: string
          idempotency_key: string
          request_hash: string
          charge_id?: string | null
          response_status?: number | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          charge_id?: string | null
          response_status?: number | null
          completed_at?: string | null
        }
        Relationships: []
      }
      api_rate_limit_buckets: {
        Row: {
          api_key_id: string
          route: string
          window_start: string
          request_count: number
        }
        Insert: {
          api_key_id: string
          route: string
          window_start: string
          request_count?: number
        }
        Update: {
          request_count?: number
        }
        Relationships: []
      }
      api_audit_events: {
        Row: {
          id: string
          account_id: string | null
          api_key_id: string | null
          request_id: string
          route: string
          method: string
          status_code: number
          duration_ms: number
          event_type: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          account_id?: string | null
          api_key_id?: string | null
          request_id: string
          route: string
          method: string
          status_code: number
          duration_ms: number
          event_type?: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          status_code?: number
          duration_ms?: number
          event_type?: string
          metadata?: Json
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
          p_api_key_id: string;
          p_route: string;
          p_limit: number;
          p_window_seconds?: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }[];
      };
      save_picpay_integration: {
        Args: {
          p_account_id: string;
          p_integration_id?: string | null;
          p_display_name?: string | null;
          p_environment?: string | null;
          p_client_id?: string | null;
          p_client_secret?: string | null;
          p_webhook_secret?: string | null;
        };
        Returns: string;
      };
      get_picpay_integration_credentials: {
        Args: { p_integration_id: string };
        Returns: {
          integration_id: string;
          environment: string;
          client_id: string;
          client_secret: string;
          webhook_secret: string;
        }[];
      };
      get_picpay_webhook_secret: {
        Args: { p_integration_id: string };
        Returns: string;
      };
      set_customer_webhook_secret: {
        Args: { p_endpoint_id: string; p_secret: string };
        Returns: undefined;
      };
      get_customer_webhook_secret: {
        Args: { p_endpoint_id: string };
        Returns: string;
      };
      purge_old_webhook_events: {
        Args: { p_retention_days?: number };
        Returns: number;
      };
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
