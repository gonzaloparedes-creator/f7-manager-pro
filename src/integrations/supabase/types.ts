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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cedula: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          technician_id: string
          updated_at: string
        }
        Insert: {
          cedula?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          technician_id: string
          updated_at?: string
        }
        Update: {
          cedula?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          plan_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          plan_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          branch_id: string | null
          category: Database["public"]["Enums"]["inventory_category"]
          company_id: string
          cost_price: number
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          min_stock_alert: number
          name: string
          selling_price: number
          stock: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category?: Database["public"]["Enums"]["inventory_category"]
          company_id: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          min_stock_alert?: number
          name: string
          selling_price?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category?: Database["public"]["Enums"]["inventory_category"]
          company_id?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          min_stock_alert?: number
          name?: string
          selling_price?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      order_parts: {
        Row: {
          created_at: string
          created_by: string | null
          historical_cost: number
          historical_selling_price: number
          id: string
          inventory_item_id: string | null
          order_id: string
          part_details: string | null
          quantity: number
          supplier_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          historical_cost?: number
          historical_selling_price?: number
          id?: string
          inventory_item_id?: string | null
          order_id: string
          part_details?: string | null
          quantity?: number
          supplier_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          historical_cost?: number
          historical_selling_price?: number
          id?: string
          inventory_item_id?: string | null
          order_id?: string
          part_details?: string | null
          quantity?: number
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_parts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_parts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          id: string
          image_urls: string[]
          is_internal: boolean
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_urls?: string[]
          is_internal?: boolean
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          image_urls?: string[]
          is_internal?: boolean
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_technical_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          order_id: string
          technician_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          order_id: string
          technician_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          order_id?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_technical_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          alternative_phone: string | null
          assigned_technician_id: string | null
          cargos_adicionales: Json
          client_id: string | null
          client_signature: string | null
          company_id: string
          created_at: string
          current_branch_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          deposit_amount: number
          deposit_date: string | null
          device_pattern: number[] | null
          device_pin: string | null
          device_type: string
          estimated_delivery_date: string | null
          final_payment_date: string | null
          has_case: boolean
          has_esim: boolean
          has_sd: boolean
          has_sim: boolean
          id: string
          imei: string | null
          order_number: string
          photos: string[]
          problem_description: string | null
          problem_other: string | null
          problems: string[]
          quote_amount: number
          received_branch_id: string | null
          received_by_id: string | null
          secondary_contact_name: string | null
          secondary_phone: string | null
          senia_amount: number
          status: string
          technician_id: string
          technician_notes: string | null
          terms_accepted: boolean
          tracking_token: string
          updated_at: string
          warranty_days: number
        }
        Insert: {
          alternative_phone?: string | null
          assigned_technician_id?: string | null
          cargos_adicionales?: Json
          client_id?: string | null
          client_signature?: string | null
          company_id: string
          created_at?: string
          current_branch_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          deposit_amount?: number
          deposit_date?: string | null
          device_pattern?: number[] | null
          device_pin?: string | null
          device_type: string
          estimated_delivery_date?: string | null
          final_payment_date?: string | null
          has_case?: boolean
          has_esim?: boolean
          has_sd?: boolean
          has_sim?: boolean
          id?: string
          imei?: string | null
          order_number: string
          photos?: string[]
          problem_description?: string | null
          problem_other?: string | null
          problems?: string[]
          quote_amount?: number
          received_branch_id?: string | null
          received_by_id?: string | null
          secondary_contact_name?: string | null
          secondary_phone?: string | null
          senia_amount?: number
          status?: string
          technician_id: string
          technician_notes?: string | null
          terms_accepted?: boolean
          tracking_token?: string
          updated_at?: string
          warranty_days?: number
        }
        Update: {
          alternative_phone?: string | null
          assigned_technician_id?: string | null
          cargos_adicionales?: Json
          client_id?: string | null
          client_signature?: string | null
          company_id?: string
          created_at?: string
          current_branch_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          deposit_amount?: number
          deposit_date?: string | null
          device_pattern?: number[] | null
          device_pin?: string | null
          device_type?: string
          estimated_delivery_date?: string | null
          final_payment_date?: string | null
          has_case?: boolean
          has_esim?: boolean
          has_sd?: boolean
          has_sim?: boolean
          id?: string
          imei?: string | null
          order_number?: string
          photos?: string[]
          problem_description?: string | null
          problem_other?: string | null
          problems?: string[]
          quote_amount?: number
          received_branch_id?: string | null
          received_by_id?: string | null
          secondary_contact_name?: string | null
          secondary_phone?: string | null
          senia_amount?: number
          status?: string
          technician_id?: string
          technician_notes?: string | null
          terms_accepted?: boolean
          tracking_token?: string
          updated_at?: string
          warranty_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_current_branch_id_fkey"
            columns: ["current_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_received_branch_id_fkey"
            columns: ["received_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_received_by_id_fkey"
            columns: ["received_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          business_name: string | null
          company_id: string
          created_at: string
          evolution_instance_name: string | null
          full_name: string | null
          id: string
          is_super_admin: boolean
          notification_preferences: Json
          phone: string | null
          whatsapp_connected: boolean
          whatsapp_phone: string | null
        }
        Insert: {
          branch_id?: string | null
          business_name?: string | null
          company_id: string
          created_at?: string
          evolution_instance_name?: string | null
          full_name?: string | null
          id: string
          is_super_admin?: boolean
          notification_preferences?: Json
          phone?: string | null
          whatsapp_connected?: boolean
          whatsapp_phone?: string | null
        }
        Update: {
          branch_id?: string | null
          business_name?: string | null
          company_id?: string
          created_at?: string
          evolution_instance_name?: string | null
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          notification_preferences?: Json
          phone?: string | null
          whatsapp_connected?: boolean
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warranty_presets: {
        Row: {
          company_id: string
          created_at: string
          days: number
          id: string
          label: string
        }
        Insert: {
          company_id: string
          created_at?: string
          days: number
          id?: string
          label: string
        }
        Update: {
          company_id?: string
          created_at?: string
          days?: number
          id?: string
          label?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      get_history_by_code: {
        Args: { _code: string }
        Returns: {
          created_at: string
          id: string
          image_urls: string[]
          note: string
          status: string
        }[]
      }
      get_order_by_code: {
        Args: { _code: string }
        Returns: {
          cargos_adicionales: Json
          created_at: string
          deposit_amount: number
          device_type: string
          estimated_delivery_date: string
          id: string
          order_number: string
          quote_amount: number
          status: string
          technician_notes: string
          updated_at: string
        }[]
      }
      get_order_by_tracking: {
        Args: { _token: string }
        Returns: {
          created_at: string
          device_type: string
          estimated_delivery_date: string
          id: string
          order_number: string
          status: string
          technician_notes: string
          updated_at: string
        }[]
      }
      get_order_history_by_tracking: {
        Args: { _token: string }
        Returns: {
          created_at: string
          id: string
          image_urls: string[]
          note: string
          status: string
        }[]
      }
      get_technical_notes_by_code: {
        Args: { _code: string }
        Returns: {
          created_at: string
          id: string
          note: string
        }[]
      }
      get_user_branch: { Args: { _user_id: string }; Returns: string }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_active: { Args: { _company_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
      inventory_category: "Repuesto" | "Accesorio" | "Herramienta"
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
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      inventory_category: ["Repuesto", "Accesorio", "Herramienta"],
    },
  },
} as const
