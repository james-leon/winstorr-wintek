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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_order_id: string | null
          related_return_id: string | null
          type: Database["public"]["Enums"]["admin_notification_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_order_id?: string | null
          related_return_id?: string | null
          type: Database["public"]["Enums"]["admin_notification_type"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_order_id?: string | null
          related_return_id?: string | null
          type?: Database["public"]["Enums"]["admin_notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
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
          status: Database["public"]["Enums"]["category_status"]
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
          status?: Database["public"]["Enums"]["category_status"]
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
          status?: Database["public"]["Enums"]["category_status"]
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
      commission_rules: {
        Row: {
          commission_type: Database["public"]["Enums"]["commission_kind"]
          commission_value: number
          created_at: string
          id: string
          is_active: boolean
          priority: number
          scope: Database["public"]["Enums"]["commission_scope"]
          scope_id: string | null
          updated_at: string
        }
        Insert: {
          commission_type: Database["public"]["Enums"]["commission_kind"]
          commission_value: number
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          scope: Database["public"]["Enums"]["commission_scope"]
          scope_id?: string | null
          updated_at?: string
        }
        Update: {
          commission_type?: Database["public"]["Enums"]["commission_kind"]
          commission_value?: number
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          scope?: Database["public"]["Enums"]["commission_scope"]
          scope_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_email: string | null
          customer_id: string | null
          discount_applied: number
          id: string
          order_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          discount_applied: number
          id?: string
          order_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          discount_applied?: number
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applies_to: Database["public"]["Enums"]["coupon_applies_to"]
          applies_to_ids: string[] | null
          code: string
          created_at: string
          created_by: string | null
          current_usage_count: number
          description: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          excludes_sale_items: boolean
          id: string
          max_discount_amount: number | null
          min_order_amount: number | null
          status: Database["public"]["Enums"]["coupon_status"]
          updated_at: string
          usage_limit_per_customer: number | null
          usage_limit_total: number | null
          valid_from: string
          valid_until: string | null
          vendor_id: string | null
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["coupon_applies_to"]
          applies_to_ids?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          current_usage_count?: number
          description?: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          excludes_sale_items?: boolean
          id?: string
          max_discount_amount?: number | null
          min_order_amount?: number | null
          status?: Database["public"]["Enums"]["coupon_status"]
          updated_at?: string
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
          valid_from?: string
          valid_until?: string | null
          vendor_id?: string | null
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["coupon_applies_to"]
          applies_to_ids?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          current_usage_count?: number
          description?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          excludes_sale_items?: boolean
          id?: string
          max_discount_amount?: number | null
          min_order_amount?: number | null
          status?: Database["public"]["Enums"]["coupon_status"]
          updated_at?: string
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
          valid_from?: string
          valid_until?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          created_at: string
          customer_id: string
          full_name: string
          id: string
          is_default: boolean
          label: string
          landmark_description: string | null
          phone: string
          quartier: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          customer_id: string
          full_name: string
          id?: string
          is_default?: boolean
          label: string
          landmark_description?: string | null
          phone: string
          quartier: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          customer_id?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark_description?: string | null
          phone?: string
          quartier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financing_partner_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          financing_partner_id: string | null
          id: string
          invited_by: string | null
          proposed_partner_name: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["financing_invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          financing_partner_id?: string | null
          id?: string
          invited_by?: string | null
          proposed_partner_name?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["financing_invitation_status"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          financing_partner_id?: string | null
          id?: string
          invited_by?: string | null
          proposed_partner_name?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["financing_invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "financing_partner_invitations_financing_partner_id_fkey"
            columns: ["financing_partner_id"]
            isOneToOne: false
            referencedRelation: "financing_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      financing_partner_members: {
        Row: {
          created_at: string
          financing_partner_id: string
          id: string
          role: Database["public"]["Enums"]["financing_partner_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          financing_partner_id: string
          id?: string
          role?: Database["public"]["Enums"]["financing_partner_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          financing_partner_id?: string
          id?: string
          role?: Database["public"]["Enums"]["financing_partner_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financing_partner_members_financing_partner_id_fkey"
            columns: ["financing_partner_id"]
            isOneToOne: false
            referencedRelation: "financing_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      financing_partners: {
        Row: {
          contact_email: string | null
          contact_phone: string
          created_at: string
          default_terms_description: string | null
          description: string
          id: string
          is_active: boolean
          logo_url: string | null
          min_product_price: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          default_terms_description?: string | null
          description?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          min_product_price?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          default_terms_description?: string | null
          description?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          min_product_price?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      financing_requests: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_message: string | null
          customer_name: string
          customer_phone: string
          financing_partner_id: string
          id: string
          partner_notes: string | null
          product_id: string | null
          product_name: string
          product_price: number
          status: Database["public"]["Enums"]["financing_request_status"]
          updated_at: string
          variant_id: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_message?: string | null
          customer_name: string
          customer_phone: string
          financing_partner_id: string
          id?: string
          partner_notes?: string | null
          product_id?: string | null
          product_name?: string
          product_price?: number
          status?: Database["public"]["Enums"]["financing_request_status"]
          updated_at?: string
          variant_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_message?: string | null
          customer_name?: string
          customer_phone?: string
          financing_partner_id?: string
          id?: string
          partner_notes?: string | null
          product_id?: string | null
          product_name?: string
          product_price?: number
          status?: Database["public"]["Enums"]["financing_request_status"]
          updated_at?: string
          variant_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financing_requests_financing_partner_id_fkey"
            columns: ["financing_partner_id"]
            isOneToOne: false
            referencedRelation: "financing_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financing_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financing_requests_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financing_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_banners: {
        Row: {
          background_color: string | null
          category_id: string | null
          created_at: string
          cta_label: string | null
          display_order: number
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          starts_at: string | null
          subtitle: string | null
          title: string
          type: Database["public"]["Enums"]["homepage_banner_type"]
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          category_id?: string | null
          created_at?: string
          cta_label?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title: string
          type: Database["public"]["Enums"]["homepage_banner_type"]
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          category_id?: string | null
          created_at?: string
          cta_label?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          type?: Database["public"]["Enums"]["homepage_banner_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homepage_banners_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          commission_amount: number
          commission_rate_applied: number | null
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          product_slug: string | null
          product_type: string
          quantity: number
          shipment_id: string | null
          subtotal: number
          unit_price: number
          variant_attributes: Json | null
          variant_id: string | null
          vendor_id: string | null
        }
        Insert: {
          commission_amount?: number
          commission_rate_applied?: number | null
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          product_slug?: string | null
          product_type: string
          quantity: number
          shipment_id?: string | null
          subtotal: number
          unit_price: number
          variant_attributes?: Json | null
          variant_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          commission_amount?: number
          commission_rate_applied?: number | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          product_slug?: string | null
          product_type?: string
          quantity?: number
          shipment_id?: string | null
          subtotal?: number
          unit_price?: number
          variant_attributes?: Json | null
          variant_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "order_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipments: {
        Row: {
          acceptance_deadline: string | null
          acceptance_status: Database["public"]["Enums"]["shipment_acceptance_status"]
          accepted_at: string | null
          auto_confirmed: boolean
          confirmation_deadline: string | null
          created_at: string
          currency: string
          customer_confirmed_at: string | null
          delivered_at: string | null
          delivery_mode: string | null
          id: string
          notes: string | null
          order_id: string
          pickup_point_id: string | null
          refusal_notes: string | null
          refusal_reason:
            | Database["public"]["Enums"]["shipment_refusal_reason"]
            | null
          refused_at: string | null
          reminder_sent_at: string | null
          shipment_number: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          subtotal: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          acceptance_deadline?: string | null
          acceptance_status?: Database["public"]["Enums"]["shipment_acceptance_status"]
          accepted_at?: string | null
          auto_confirmed?: boolean
          confirmation_deadline?: string | null
          created_at?: string
          currency?: string
          customer_confirmed_at?: string | null
          delivered_at?: string | null
          delivery_mode?: string | null
          id?: string
          notes?: string | null
          order_id: string
          pickup_point_id?: string | null
          refusal_notes?: string | null
          refusal_reason?:
            | Database["public"]["Enums"]["shipment_refusal_reason"]
            | null
          refused_at?: string | null
          reminder_sent_at?: string | null
          shipment_number?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          subtotal?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          acceptance_deadline?: string | null
          acceptance_status?: Database["public"]["Enums"]["shipment_acceptance_status"]
          accepted_at?: string | null
          auto_confirmed?: boolean
          confirmation_deadline?: string | null
          created_at?: string
          currency?: string
          customer_confirmed_at?: string | null
          delivered_at?: string | null
          delivery_mode?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          pickup_point_id?: string | null
          refusal_notes?: string | null
          refusal_reason?:
            | Database["public"]["Enums"]["shipment_refusal_reason"]
            | null
          refused_at?: string | null
          reminder_sent_at?: string | null
          shipment_number?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          subtotal?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cinetpay_transaction_id: string | null
          coupon_code: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_mode: string
          discount_amount: number
          has_physical_items: boolean
          id: string
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_point_id: string | null
          shipping_address: Json | null
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cinetpay_transaction_id?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_mode?: string
          discount_amount?: number
          has_physical_items?: boolean
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_point_id?: string | null
          shipping_address?: Json | null
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cinetpay_transaction_id?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_mode?: string
          discount_amount?: number
          has_physical_items?: boolean
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_point_id?: string | null
          shipping_address?: Json | null
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_confirmations: {
        Row: {
          amount: number
          confirmed_by: string | null
          created_at: string
          id: string
          method: string
          notes: string | null
          order_id: string
        }
        Insert: {
          amount: number
          confirmed_by?: string | null
          created_at?: string
          id?: string
          method: string
          notes?: string | null
          order_id: string
        }
        Update: {
          amount?: number
          confirmed_by?: string | null
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_confirmations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_points: {
        Row: {
          address: string
          city: string
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_hours: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          opening_hours?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          opening_hours?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_price_tiers: {
        Row: {
          created_at: string
          id: string
          min_quantity: number
          product_id: string
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          min_quantity: number
          product_id: string
          unit_price: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          min_quantity?: number
          product_id?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          created_at: string
          customer_id: string | null
          guest_contact: string | null
          guest_name: string | null
          id: string
          product_id: string
          question: string
          status: Database["public"]["Enums"]["question_status"]
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          customer_id?: string | null
          guest_contact?: string | null
          guest_name?: string | null
          id?: string
          product_id: string
          question: string
          status?: Database["public"]["Enums"]["question_status"]
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          customer_id?: string | null
          guest_contact?: string | null
          guest_name?: string | null
          id?: string
          product_id?: string
          question?: string
          status?: Database["public"]["Enums"]["question_status"]
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          verified_purchase: boolean
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          compare_at_price: number | null
          created_at: string
          id: string
          image_url: string | null
          is_default: boolean
          min_order_quantity: number | null
          price: number | null
          product_id: string
          sku: string | null
          status: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          attributes?: Json
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_default?: boolean
          min_order_quantity?: number | null
          price?: number | null
          product_id: string
          sku?: string | null
          status?: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          attributes?: Json
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_default?: boolean
          min_order_quantity?: number | null
          price?: number | null
          product_id?: string
          sku?: string | null
          status?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          description_en: string | null
          estimated_duration: string | null
          featured: boolean
          has_variants: boolean
          id: string
          images: Json
          min_order_quantity: number
          name: string
          name_en: string | null
          price: number | null
          price_type: Database["public"]["Enums"]["price_type"]
          quality_verified: boolean
          rating_average: number
          rating_count: number
          rejection_reason: string | null
          requires_diagnostic: boolean | null
          requires_shipping: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_area: Database["public"]["Enums"]["service_area"] | null
          short_description: string | null
          short_description_en: string | null
          sku: string | null
          slug: string
          source_type: Database["public"]["Enums"]["source_type"] | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number | null
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
          vendor_id: string
          warranty_duration: string | null
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
          description_en?: string | null
          estimated_duration?: string | null
          featured?: boolean
          has_variants?: boolean
          id?: string
          images?: Json
          min_order_quantity?: number
          name: string
          name_en?: string | null
          price?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          quality_verified?: boolean
          rating_average?: number
          rating_count?: number
          rejection_reason?: string | null
          requires_diagnostic?: boolean | null
          requires_shipping?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area?: Database["public"]["Enums"]["service_area"] | null
          short_description?: string | null
          short_description_en?: string | null
          sku?: string | null
          slug: string
          source_type?: Database["public"]["Enums"]["source_type"] | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number | null
          type: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          vendor_id: string
          warranty_duration?: string | null
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
          description_en?: string | null
          estimated_duration?: string | null
          featured?: boolean
          has_variants?: boolean
          id?: string
          images?: Json
          min_order_quantity?: number
          name?: string
          name_en?: string | null
          price?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          quality_verified?: boolean
          rating_average?: number
          rating_count?: number
          rejection_reason?: string | null
          requires_diagnostic?: boolean | null
          requires_shipping?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area?: Database["public"]["Enums"]["service_area"] | null
          short_description?: string | null
          short_description_en?: string | null
          sku?: string | null
          slug?: string
          source_type?: Database["public"]["Enums"]["source_type"] | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number | null
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          vendor_id?: string
          warranty_duration?: string | null
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
          {
            foreignKeyName: "products_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string
          id: string
          order_id: string
          order_item_id: string | null
          photo_urls: Json | null
          reason: Database["public"]["Enums"]["return_reason"]
          refund_amount: number | null
          resolution_notes: string | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description: string
          id?: string
          order_id: string
          order_item_id?: string | null
          photo_urls?: Json | null
          reason: Database["public"]["Enums"]["return_reason"]
          refund_amount?: number | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string
          id?: string
          order_id?: string
          order_item_id?: string | null
          photo_urls?: Json | null
          reason?: Database["public"]["Enums"]["return_reason"]
          refund_amount?: number | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
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
          vendor_id: string | null
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
          vendor_id?: string | null
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
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      store_follows: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_follows_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_follows_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
      vendor_announcements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          title: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          title: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          title?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_announcements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_applications: {
        Row: {
          admin_notes: string | null
          business_name: string
          city: string
          contact_name: string
          created_at: string
          description: string
          email: string | null
          id: string
          invitation_id: string | null
          phone: string
          product_types: Json
          reviewed_by: string | null
          social_link: string | null
          status: Database["public"]["Enums"]["vendor_application_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          business_name: string
          city: string
          contact_name: string
          created_at?: string
          description: string
          email?: string | null
          id?: string
          invitation_id?: string | null
          phone: string
          product_types?: Json
          reviewed_by?: string | null
          social_link?: string | null
          status?: Database["public"]["Enums"]["vendor_application_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          business_name?: string
          city?: string
          contact_name?: string
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          invitation_id?: string | null
          phone?: string
          product_types?: Json
          reviewed_by?: string | null
          social_link?: string | null
          status?: Database["public"]["Enums"]["vendor_application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_applications_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "vendor_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          last_email_error: string | null
          last_email_sent_at: string | null
          last_email_status: string | null
          proposed_vendor_name: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["vendor_invitation_status"]
          token: string
          vendor_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_email_error?: string | null
          last_email_sent_at?: string | null
          last_email_status?: string | null
          proposed_vendor_name?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["vendor_invitation_status"]
          token: string
          vendor_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_email_error?: string | null
          last_email_sent_at?: string | null
          last_email_status?: string | null
          proposed_vendor_name?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["vendor_invitation_status"]
          token?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invitations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["vendor_member_role"]
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["vendor_member_role"]
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["vendor_member_role"]
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_members_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_storefronts: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          policies: string | null
          social_links: Json
          updated_at: string
          vendor_id: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          policies?: string | null
          social_links?: Json
          updated_at?: string
          vendor_id: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          policies?: string | null
          social_links?: Json
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_storefronts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_withdrawal_requests: {
        Row: {
          amount_requested: number
          available_balance_at_request: number
          created_at: string
          id: string
          payout_details: string
          payout_method: string
          processed_at: string | null
          processed_by: string | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          vendor_id: string
        }
        Insert: {
          amount_requested: number
          available_balance_at_request: number
          created_at?: string
          id?: string
          payout_details: string
          payout_method: string
          processed_at?: string | null
          processed_by?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          vendor_id: string
        }
        Update: {
          amount_requested?: number
          available_balance_at_request?: number
          created_at?: string
          id?: string
          payout_details?: string
          payout_method?: string
          processed_at?: string | null
          processed_by?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_withdrawal_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          allow_financing: boolean
          boost_score: number
          city: string | null
          commission_rate: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          pinned_until: string | null
          sales_count: number
          slug: string
          status: Database["public"]["Enums"]["vendor_status"]
          type: Database["public"]["Enums"]["vendor_type"]
          updated_at: string
          verification_note: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          allow_financing?: boolean
          boost_score?: number
          city?: string | null
          commission_rate?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          pinned_until?: string | null
          sales_count?: number
          slug: string
          status?: Database["public"]["Enums"]["vendor_status"]
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
          verification_note?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          allow_financing?: boolean
          boost_score?: number
          city?: string | null
          commission_rate?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          pinned_until?: string | null
          sales_count?: number
          slug?: string
          status?: Database["public"]["Enums"]["vendor_status"]
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
          verification_note?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_financing_partner_invitation: {
        Args: { _token: string }
        Returns: Json
      }
      accept_vendor_invitation: { Args: { _token: string }; Returns: Json }
      admin_analytics: {
        Args: {
          _from: string
          _low_stock_threshold?: number
          _to: string
          _vendor_id?: string
        }
        Returns: Json
      }
      auto_confirm_delivered_shipments: { Args: never; Returns: number }
      auto_refuse_expired_shipments: { Args: never; Returns: number }
      can_manage_product_image: { Args: { _name: string }; Returns: boolean }
      confirm_cash_payment: {
        Args: { _notes?: string; _order_id: string }
        Returns: Json
      }
      confirm_order_payment: {
        Args: {
          _method: Database["public"]["Enums"]["payment_method"]
          _order_id: string
          _txn_id: string
        }
        Returns: Json
      }
      customer_confirm_shipment: {
        Args: { _shipment_id: string }
        Returns: Json
      }
      delete_vendor_cascade: { Args: { _vendor_id: string }; Returns: Json }
      generate_order_number: { Args: never; Returns: string }
      generate_shipment_number: { Args: never; Returns: string }
      generate_shipments_for_order: {
        Args: { _order_id: string }
        Returns: undefined
      }
      get_financing_partner_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          partner_name: string
          proposed_partner_name: string
          status: Database["public"]["Enums"]["financing_invitation_status"]
        }[]
      }
      get_follower_count: { Args: { _vendor_id: string }; Returns: number }
      get_follower_counts: {
        Args: never
        Returns: {
          count: number
          vendor_id: string
        }[]
      }
      get_order_by_number: {
        Args: { _order_number: string }
        Returns: {
          coupon_code: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          delivery_mode: string
          discount_amount: number
          has_physical_items: boolean
          id: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_point_address: string
          pickup_point_city: string
          pickup_point_hours: string
          pickup_point_id: string
          pickup_point_name: string
          pickup_point_phone: string
          shipping_address: Json
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
        }[]
      }
      get_order_items_by_number: {
        Args: { _order_number: string }
        Returns: {
          id: string
          product_id: string
          product_image: string
          product_name: string
          product_slug: string
          product_type: string
          quantity: number
          subtotal: number
          unit_price: number
        }[]
      }
      get_order_returns: {
        Args: { _order_number: string }
        Returns: {
          created_at: string
          customer_id: string | null
          description: string
          id: string
          order_id: string
          order_item_id: string | null
          photo_urls: Json | null
          reason: Database["public"]["Enums"]["return_reason"]
          refund_amount: number | null
          resolution_notes: string | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "return_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_tier_unit_price:
        | { Args: { _product_id: string; _quantity: number }; Returns: number }
        | {
            Args: {
              _product_id: string
              _quantity: number
              _variant_id?: string
            }
            Returns: number
          }
      get_vendor_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          proposed_vendor_name: string
          status: Database["public"]["Enums"]["vendor_invitation_status"]
          vendor_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      identifier_has_account: {
        Args: { _identifier: string }
        Returns: boolean
      }
      is_order_vendor: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      is_partner_member: {
        Args: { _partner_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_vendor_member: {
        Args: { _user_id: string; _vendor_id: string }
        Returns: boolean
      }
      order_counts_as_sale: {
        Args: {
          _payment_status: Database["public"]["Enums"]["payment_status"]
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      recompute_vendor_boost_scores: { Args: never; Returns: undefined }
      redeem_coupon: {
        Args: {
          _coupon_id: string
          _customer_email: string
          _customer_id: string
          _discount: number
          _order_id: string
        }
        Returns: undefined
      }
      refuse_shipment: {
        Args: {
          _notes: string
          _reason: Database["public"]["Enums"]["shipment_refusal_reason"]
          _shipment_id: string
          _system?: boolean
        }
        Returns: Json
      }
      request_withdrawal: {
        Args: {
          _amount: number
          _payout_details: string
          _payout_method: string
          _vendor_id: string
        }
        Returns: Json
      }
      resolve_commission: {
        Args: { _line_amount: number; _product_id: string }
        Returns: Json
      }
      send_delivery_reminders: { Args: never; Returns: number }
      set_vendor_allow_financing: {
        Args: { _allow: boolean; _vendor_id: string }
        Returns: Json
      }
      snapshot_order_commissions: {
        Args: { _order_id: string }
        Returns: undefined
      }
      validate_coupon: {
        Args: {
          _code: string
          _customer_email: string
          _customer_id: string
          _product_ids: string[]
          _subtotal: number
        }
        Returns: Json
      }
      vendor_accept_shipment: { Args: { _shipment_id: string }; Returns: Json }
      vendor_available_balance: {
        Args: { _vendor_id: string }
        Returns: number
      }
      vendor_deletion_impact: { Args: { _vendor_id: string }; Returns: Json }
      vendor_pending_confirmation_amount: {
        Args: { _vendor_id: string }
        Returns: number
      }
      vendor_refuse_shipment: {
        Args: {
          _notes?: string
          _reason: Database["public"]["Enums"]["shipment_refusal_reason"]
          _shipment_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      admin_notification_type:
        | "new_order"
        | "payment_failed"
        | "return_requested"
        | "other"
      app_role: "customer" | "staff" | "admin"
      category_status: "active" | "archived"
      commission_kind: "percentage" | "fixed_amount"
      commission_scope: "global" | "vendor" | "category" | "product"
      coupon_applies_to:
        | "all_products"
        | "specific_products"
        | "specific_category"
        | "specific_vendor"
      coupon_discount_type: "percentage" | "fixed_amount"
      coupon_status: "active" | "paused" | "expired"
      delivery_type: "file_download" | "license_key" | "access_link"
      financing_invitation_status:
        | "pending"
        | "accepted"
        | "expired"
        | "revoked"
      financing_partner_member_role: "owner" | "staff"
      financing_request_status:
        | "new"
        | "contacted"
        | "approved"
        | "rejected"
        | "completed"
      homepage_banner_type:
        | "hero_slide"
        | "promo_tile"
        | "category_tile"
        | "hero_side"
      order_status:
        | "pending_payment"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "completed"
        | "cancelled"
        | "payment_failed"
      payment_method: "mtn_momo" | "orange_money" | "card" | "cash_on_pickup"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      price_type: "fixed" | "starting_at" | "quote_only"
      product_status:
        | "draft"
        | "active"
        | "archived"
        | "pending_review"
        | "rejected"
      product_type: "physical" | "digital" | "service" | "training"
      question_status: "pending" | "answered" | "hidden"
      return_reason:
        | "defective"
        | "wrong_item"
        | "not_as_described"
        | "changed_mind"
        | "other"
      return_status:
        | "requested"
        | "under_review"
        | "approved"
        | "rejected"
        | "refunded"
        | "exchanged"
      review_status: "published" | "pending" | "hidden"
      service_area: "on_site" | "in_shop" | "remote" | "both"
      service_request_status:
        | "received"
        | "diagnosing"
        | "quoted"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      shipment_acceptance_status: "pending_acceptance" | "accepted" | "refused"
      shipment_refusal_reason:
        | "rupture_stock"
        | "produit_endommage"
        | "prix_incorrect"
        | "autre"
        | "delai_depasse"
      shipment_status:
        | "pending_acceptance"
        | "accepted"
        | "refused"
        | "pending_pickup"
        | "ready_for_pickup"
        | "shipped"
        | "delivered"
        | "completed"
        | "cancelled"
      source_type: "direct_import" | "authorized_wholesaler" | "other"
      training_enrollment_status: "pending" | "confirmed" | "cancelled"
      training_mode: "in_person" | "online" | "hybrid"
      training_session_status: "scheduled" | "full" | "cancelled" | "completed"
      vendor_application_status: "new" | "contacted" | "approved" | "rejected"
      vendor_invitation_status: "pending" | "accepted" | "expired" | "revoked"
      vendor_member_role: "owner" | "staff"
      vendor_status: "active" | "suspended" | "pending_approval"
      vendor_type: "internal" | "external"
      withdrawal_status: "pending" | "approved" | "paid" | "rejected"
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
      admin_notification_type: [
        "new_order",
        "payment_failed",
        "return_requested",
        "other",
      ],
      app_role: ["customer", "staff", "admin"],
      category_status: ["active", "archived"],
      commission_kind: ["percentage", "fixed_amount"],
      commission_scope: ["global", "vendor", "category", "product"],
      coupon_applies_to: [
        "all_products",
        "specific_products",
        "specific_category",
        "specific_vendor",
      ],
      coupon_discount_type: ["percentage", "fixed_amount"],
      coupon_status: ["active", "paused", "expired"],
      delivery_type: ["file_download", "license_key", "access_link"],
      financing_invitation_status: [
        "pending",
        "accepted",
        "expired",
        "revoked",
      ],
      financing_partner_member_role: ["owner", "staff"],
      financing_request_status: [
        "new",
        "contacted",
        "approved",
        "rejected",
        "completed",
      ],
      homepage_banner_type: [
        "hero_slide",
        "promo_tile",
        "category_tile",
        "hero_side",
      ],
      order_status: [
        "pending_payment",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "payment_failed",
      ],
      payment_method: ["mtn_momo", "orange_money", "card", "cash_on_pickup"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      price_type: ["fixed", "starting_at", "quote_only"],
      product_status: [
        "draft",
        "active",
        "archived",
        "pending_review",
        "rejected",
      ],
      product_type: ["physical", "digital", "service", "training"],
      question_status: ["pending", "answered", "hidden"],
      return_reason: [
        "defective",
        "wrong_item",
        "not_as_described",
        "changed_mind",
        "other",
      ],
      return_status: [
        "requested",
        "under_review",
        "approved",
        "rejected",
        "refunded",
        "exchanged",
      ],
      review_status: ["published", "pending", "hidden"],
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
      shipment_acceptance_status: ["pending_acceptance", "accepted", "refused"],
      shipment_refusal_reason: [
        "rupture_stock",
        "produit_endommage",
        "prix_incorrect",
        "autre",
        "delai_depasse",
      ],
      shipment_status: [
        "pending_acceptance",
        "accepted",
        "refused",
        "pending_pickup",
        "ready_for_pickup",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
      ],
      source_type: ["direct_import", "authorized_wholesaler", "other"],
      training_enrollment_status: ["pending", "confirmed", "cancelled"],
      training_mode: ["in_person", "online", "hybrid"],
      training_session_status: ["scheduled", "full", "cancelled", "completed"],
      vendor_application_status: ["new", "contacted", "approved", "rejected"],
      vendor_invitation_status: ["pending", "accepted", "expired", "revoked"],
      vendor_member_role: ["owner", "staff"],
      vendor_status: ["active", "suspended", "pending_approval"],
      vendor_type: ["internal", "external"],
      withdrawal_status: ["pending", "approved", "paid", "rejected"],
    },
  },
} as const
