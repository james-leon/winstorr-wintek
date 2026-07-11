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
      categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          compare_at_price: number | null
          created_at: string
          delivery_instructions: string | null
          delivery_mode: Database["public"]["Enums"]["training_mode"] | null
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          description: string | null
          estimated_duration: string | null
          featured: boolean
          id: string
          images: Json
          name: string
          price: number | null
          price_type: Database["public"]["Enums"]["price_type"]
          requires_diagnostic: boolean | null
          requires_shipping: boolean | null
          service_area: Database["public"]["Enums"]["service_area"] | null
          short_description: string | null
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number | null
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          delivery_instructions?: string | null
          delivery_mode?: Database["public"]["Enums"]["training_mode"] | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          description?: string | null
          estimated_duration?: string | null
          featured?: boolean
          id?: string
          images?: Json
          name: string
          price?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          requires_diagnostic?: boolean | null
          requires_shipping?: boolean | null
          service_area?: Database["public"]["Enums"]["service_area"] | null
          short_description?: string | null
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number | null
          type: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          delivery_instructions?: string | null
          delivery_mode?: Database["public"]["Enums"]["training_mode"] | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          description?: string | null
          estimated_duration?: string | null
          featured?: boolean
          id?: string
          images?: Json
          name?: string
          price?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          requires_diagnostic?: boolean | null
          requires_shipping?: boolean | null
          service_area?: Database["public"]["Enums"]["service_area"] | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number | null
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          description: string
          id: string
          internal_notes: string | null
          photo_urls: Json
          preferred_date: string | null
          product_id: string
          quoted_price: number | null
          status: Database["public"]["Enums"]["service_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          description: string
          id?: string
          internal_notes?: string | null
          photo_urls?: Json
          preferred_date?: string | null
          product_id: string
          quoted_price?: number | null
          status?: Database["public"]["Enums"]["service_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          description?: string
          id?: string
          internal_notes?: string | null
          photo_urls?: Json
          preferred_date?: string | null
          product_id?: string
          quoted_price?: number | null
          status?: Database["public"]["Enums"]["service_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      training_enrollments: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          session_id: string
          status: Database["public"]["Enums"]["training_enrollment_status"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
          session_id: string
          status?: Database["public"]["Enums"]["training_enrollment_status"]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          session_id?: string
          status?: Database["public"]["Enums"]["training_enrollment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "training_enrollments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          capacity: number
          created_at: string
          end_date: string
          id: string
          location: string | null
          price_override: number | null
          product_id: string
          seats_taken: number
          start_date: string
          status: Database["public"]["Enums"]["training_session_status"]
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          end_date: string
          id?: string
          location?: string | null
          price_override?: number | null
          product_id: string
          seats_taken?: number
          start_date: string
          status?: Database["public"]["Enums"]["training_session_status"]
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          end_date?: string
          id?: string
          location?: string | null
          price_override?: number | null
          product_id?: string
          seats_taken?: number
          start_date?: string
          status?: Database["public"]["Enums"]["training_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "customer" | "staff" | "admin"
      delivery_type: "file_download" | "license_key" | "access_link"
      price_type: "fixed" | "starting_at" | "quote_only"
      product_status: "draft" | "active" | "archived"
      product_type: "physical" | "digital" | "service" | "training"
      service_area: "on_site" | "in_shop" | "remote" | "both"
      service_request_status:
        | "received"
        | "diagnosing"
        | "quoted"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      training_enrollment_status: "pending" | "confirmed" | "cancelled"
      training_mode: "in_person" | "online" | "hybrid"
      training_session_status: "scheduled" | "full" | "cancelled" | "completed"
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
      app_role: ["customer", "staff", "admin"],
      delivery_type: ["file_download", "license_key", "access_link"],
      price_type: ["fixed", "starting_at", "quote_only"],
      product_status: ["draft", "active", "archived"],
      product_type: ["physical", "digital", "service", "training"],
      service_area: ["on_site", "in_shop", "remote", "both"],
      service_request_status: [
        "received",
        "diagnosing",
        "quoted",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      training_enrollment_status: ["pending", "confirmed", "cancelled"],
      training_mode: ["in_person", "online", "hybrid"],
      training_session_status: ["scheduled", "full", "cancelled", "completed"],
    },
  },
} as const
