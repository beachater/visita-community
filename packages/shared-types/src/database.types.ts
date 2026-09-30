export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      amenity_change_requests: {
        Row: {
          amenity_key: string
          created_at: string
          entry: Json | null
          id: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          venue_id: string
        }
        Insert: {
          amenity_key: string
          created_at?: string
          entry?: Json | null
          id?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          venue_id: string
        }
        Update: {
          amenity_key?: string
          created_at?: string
          entry?: Json | null
          id?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_change_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      amenity_definitions: {
        Row: {
          created_at: string
          icon: string | null
          is_active: boolean
          is_filterable: boolean
          key: string
          label: string
          requires_verification: boolean
          sort_order: number
          summary_rank: number | null
          unit: string | null
          updated_at: string
          value_type: Database["public"]["Enums"]["amenity_value_type"]
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Insert: {
          created_at?: string
          icon?: string | null
          is_active?: boolean
          is_filterable?: boolean
          key: string
          label: string
          requires_verification?: boolean
          sort_order?: number
          summary_rank?: number | null
          unit?: string | null
          updated_at?: string
          value_type: Database["public"]["Enums"]["amenity_value_type"]
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Update: {
          created_at?: string
          icon?: string | null
          is_active?: boolean
          is_filterable?: boolean
          key?: string
          label?: string
          requires_verification?: boolean
          sort_order?: number
          summary_rank?: number | null
          unit?: string | null
          updated_at?: string
          value_type?: Database["public"]["Enums"]["amenity_value_type"]
          venue_type?: Database["public"]["Enums"]["venue_type"]
        }
        Relationships: []
      }
      analytics_daily: {
        Row: {
          count: number
          day: string
          type: Database["public"]["Enums"]["analytics_event_type"]
          venue_id: string
        }
        Insert: {
          count: number
          day: string
          type: Database["public"]["Enums"]["analytics_event_type"]
          venue_id: string
        }
        Update: {
          count?: number
          day?: string
          type?: Database["public"]["Enums"]["analytics_event_type"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          id: number
          occurred_at: string
          props: Json
          session_id: string
          type: Database["public"]["Enums"]["analytics_event_type"]
          venue_id: string
        }
        Insert: {
          id?: never
          occurred_at?: string
          props?: Json
          session_id: string
          type: Database["public"]["Enums"]["analytics_event_type"]
          venue_id: string
        }
        Update: {
          id?: never
          occurred_at?: string
          props?: Json
          session_id?: string
          type?: Database["public"]["Enums"]["analytics_event_type"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          threshold: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id: string
          name: string
          threshold?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          threshold?: number | null
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          accuracy_m: number | null
          end_distance_m: number | null
          id: string
          rejection_reason: string | null
          start_distance_m: number | null
          started_at: string
          status: Database["public"]["Enums"]["check_in_status"]
          user_id: string
          venue_id: string
          verified_at: string | null
        }
        Insert: {
          accuracy_m?: number | null
          end_distance_m?: number | null
          id?: string
          rejection_reason?: string | null
          start_distance_m?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["check_in_status"]
          user_id: string
          venue_id: string
          verified_at?: string | null
        }
        Update: {
          accuracy_m?: number | null
          end_distance_m?: number | null
          id?: string
          rejection_reason?: string | null
          start_distance_m?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["check_in_status"]
          user_id?: string
          venue_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_requests: {
        Row: {
          created_at: string
          device_id: string
          google_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string | null
          profile_id: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          profile_id?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          profile_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          amount: number
          created_at: string
          id: number
          reason: Database["public"]["Enums"]["point_reason"]
          source_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          reason: Database["public"]["Enums"]["point_reason"]
          source_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          reason?: Database["public"]["Enums"]["point_reason"]
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          qualified_at: string | null
          referred_id: string
          referrer_id: string
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_id: string
          referrer_id: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_id?: string
          referrer_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_awards: {
        Row: {
          created_at: string
          giver_id: string
          id: string
          points: number
          review_id: string
        }
        Insert: {
          created_at?: string
          giver_id: string
          id?: string
          points: number
          review_id: string
        }
        Update: {
          created_at?: string
          giver_id?: string
          id?: string
          points?: number
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_awards_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_awards_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          review_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          review_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          photo_url: string | null
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_venues: {
        Row: {
          created_at: string
          profile_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          profile_id?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_venues_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          photo_url: string | null
          starts_at: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          photo_url?: string | null
          starts_at: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          photo_url?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_occupancy: {
        Row: {
          expires_at: string
          level: Database["public"]["Enums"]["occupancy_level"]
          set_at: string
          set_by: string | null
          venue_id: string
        }
        Insert: {
          expires_at: string
          level: Database["public"]["Enums"]["occupancy_level"]
          set_at?: string
          set_by?: string | null
          venue_id: string
        }
        Update: {
          expires_at?: string
          level?: Database["public"]["Enums"]["occupancy_level"]
          set_at?: string
          set_by?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_occupancy_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_occupancy_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_owners: {
        Row: {
          contact_phone: string
          created_at: string
          id: string
          profile_id: string
          proof_key: string | null
          proposed_venue: Json | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_title: string
          status: Database["public"]["Enums"]["owner_claim_status"]
          venue_id: string | null
        }
        Insert: {
          contact_phone: string
          created_at?: string
          id?: string
          profile_id?: string
          proof_key?: string | null
          proposed_venue?: Json | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title: string
          status?: Database["public"]["Enums"]["owner_claim_status"]
          venue_id?: string | null
        }
        Update: {
          contact_phone?: string
          created_at?: string
          id?: string
          profile_id?: string
          proof_key?: string | null
          proposed_venue?: Json | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title?: string
          status?: Database["public"]["Enums"]["owner_claim_status"]
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_owners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_owners_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_owners_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          amenities: Json
          city: string
          created_at: string
          google_place_id: string | null
          hours: Json | null
          id: string
          is_published: boolean
          is_top_pick: boolean
          lat: number | null
          lng: number | null
          menu: Json
          name: string
          scanned_at: string | null
          search_terms: string[]
          slug: string
          splat_preview_url: string | null
          splat_url: string | null
          updated_at: string
          venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Insert: {
          address?: string | null
          amenities?: Json
          city?: string
          created_at?: string
          google_place_id?: string | null
          hours?: Json | null
          id?: string
          is_published?: boolean
          is_top_pick?: boolean
          lat?: number | null
          lng?: number | null
          menu?: Json
          name: string
          scanned_at?: string | null
          search_terms?: string[]
          slug: string
          splat_preview_url?: string | null
          splat_url?: string | null
          updated_at?: string
          venue_type?: Database["public"]["Enums"]["venue_type"]
        }
        Update: {
          address?: string | null
          amenities?: Json
          city?: string
          created_at?: string
          google_place_id?: string | null
          hours?: Json | null
          id?: string
          is_published?: boolean
          is_top_pick?: boolean
          lat?: number | null
          lng?: number | null
          menu?: Json
          name?: string
          scanned_at?: string | null
          search_terms?: string[]
          slug?: string
          splat_preview_url?: string | null
          splat_url?: string | null
          updated_at?: string
          venue_type?: Database["public"]["Enums"]["venue_type"]
        }
        Relationships: []
      }
    }
    Views: {
      point_balances: {
        Row: {
          balance: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_venue_owner: { Args: { p_venue_id: string }; Returns: boolean }
      owner_update_listing: {
        Args: { p_patch: Json; p_venue_id: string }
        Returns: undefined
      }
      purge_old_analytics: { Args: never; Returns: undefined }
      review_amenity_change: {
        Args: {
          p_decision: Database["public"]["Enums"]["change_request_status"]
          p_note: string
          p_request_id: string
        }
        Returns: {
          amenity_key: string
          created_at: string
          entry: Json | null
          id: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "amenity_change_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_owner_claim: {
        Args: {
          p_claim_id: string
          p_decision: Database["public"]["Enums"]["owner_claim_status"]
          p_note: string
        }
        Returns: {
          contact_phone: string
          created_at: string
          id: string
          profile_id: string
          proof_key: string | null
          proposed_venue: Json | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_title: string
          status: Database["public"]["Enums"]["owner_claim_status"]
          venue_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "venue_owners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_venue_id: { Args: { p_review_id: string }; Returns: string }
      set_occupancy: {
        Args: {
          p_level: Database["public"]["Enums"]["occupancy_level"]
          p_venue_id: string
        }
        Returns: {
          expires_at: string
          level: Database["public"]["Enums"]["occupancy_level"]
          set_at: string
          set_by: string | null
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "venue_occupancy"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unique_venue_slug: { Args: { p_name: string }; Returns: string }
      validate_venue_amenities: {
        Args: {
          p_amenities: Json
          p_venue_type: Database["public"]["Enums"]["venue_type"]
        }
        Returns: undefined
      }
      validate_venue_hours: { Args: { p_hours: Json }; Returns: undefined }
      validate_venue_menu: { Args: { p_menu: Json }; Returns: undefined }
      venue_stats: {
        Args: { p_from: string; p_to: string; p_venue_id: string }
        Returns: Json
      }
    }
    Enums: {
      amenity_value_type: "boolean" | "number" | "text" | "list"
      analytics_event_type:
        | "profile_view"
        | "walkthrough_open"
        | "directions_tap"
        | "search_appearance"
        | "filter_click"
        | "demand_tap"
      app_role: "admin"
      change_request_status: "pending" | "approved" | "rejected"
      check_in_status: "pending" | "verified" | "rejected"
      occupancy_level: "quiet" | "moderate" | "full"
      owner_claim_status: "pending" | "approved" | "rejected"
      point_reason:
        | "review"
        | "review_photo"
        | "first_review"
        | "amenity_confirm"
        | "outdated_report"
        | "check_in"
        | "streak"
        | "referral"
        | "referral_milestone"
        | "award_given"
        | "award_received"
        | "admin_adjustment"
      referral_status: "pending" | "qualified" | "rejected"
      review_status: "visible" | "hidden"
      venue_type: "cafe" | "pickleball_court" | "function_room" | "airbnb"
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
      amenity_value_type: ["boolean", "number", "text", "list"],
      analytics_event_type: [
        "profile_view",
        "walkthrough_open",
        "directions_tap",
        "search_appearance",
        "filter_click",
        "demand_tap",
      ],
      app_role: ["admin"],
      change_request_status: ["pending", "approved", "rejected"],
      check_in_status: ["pending", "verified", "rejected"],
      occupancy_level: ["quiet", "moderate", "full"],
      owner_claim_status: ["pending", "approved", "rejected"],
      point_reason: [
        "review",
        "review_photo",
        "first_review",
        "amenity_confirm",
        "outdated_report",
        "check_in",
        "streak",
        "referral",
        "referral_milestone",
        "award_given",
        "award_received",
        "admin_adjustment",
      ],
      referral_status: ["pending", "qualified", "rejected"],
      review_status: ["visible", "hidden"],
      venue_type: ["cafe", "pickleball_court", "function_room", "airbnb"],
    },
  },
} as const

