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
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_items: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number | null
          type: string
          user_id: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number | null
          type: string
          user_id: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number | null
          type?: string
          user_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_purchases: {
        Row: {
          course_id: string
          id: string
          purchased_at: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          id?: string
          purchased_at?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          id?: string
          purchased_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_purchases_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          content_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_included_pro: boolean | null
          position: number | null
          price_cents: number | null
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_included_pro?: boolean | null
          position?: number | null
          price_cents?: number | null
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_included_pro?: boolean | null
          position?: number | null
          price_cents?: number | null
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          date: string
          done: boolean | null
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          date: string
          done?: boolean | null
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          date?: string
          done?: boolean | null
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          pillar_id: string | null
          platform: string | null
          promoted_to_post_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          pillar_id?: string | null
          platform?: string | null
          promoted_to_post_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          pillar_id?: string | null
          platform?: string | null
          promoted_to_post_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_promoted_to_post_fk"
            columns: ["promoted_to_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          category: string | null
          created_at: string | null
          file_name: string
          file_type: string | null
          id: string
          storage_path: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          file_name: string
          file_type?: string | null
          id?: string
          storage_path: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          file_name?: string
          file_type?: string | null
          id?: string
          storage_path?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          created_at: string | null
          focus: string | null
          goals: string[] | null
          id: string
          month: string
          reflection: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          focus?: string | null
          goals?: string[] | null
          id?: string
          month: string
          reflection?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          focus?: string | null
          goals?: string[] | null
          id?: string
          month?: string
          reflection?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pillars: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          position: number | null
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          name: string
          position?: number | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pillars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          archive_summary: string | null
          caption: string | null
          created_at: string | null
          cta: string | null
          format: string
          hook: string | null
          id: string
          idea_id: string | null
          notes: string | null
          pillar_id: string | null
          platform: string
          published_at: string | null
          result_comments: number | null
          result_reach: number | null
          result_saves: number | null
          result_shares: number | null
          result_views: number | null
          scheduled_date: string | null
          script: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archive_summary?: string | null
          caption?: string | null
          created_at?: string | null
          cta?: string | null
          format: string
          hook?: string | null
          id?: string
          idea_id?: string | null
          notes?: string | null
          pillar_id?: string | null
          platform: string
          published_at?: string | null
          result_comments?: number | null
          result_reach?: number | null
          result_saves?: number | null
          result_shares?: number | null
          result_views?: number | null
          scheduled_date?: string | null
          script?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archive_summary?: string | null
          caption?: string | null
          created_at?: string | null
          cta?: string | null
          format?: string
          hook?: string | null
          id?: string
          idea_id?: string | null
          notes?: string | null
          pillar_id?: string | null
          platform?: string
          published_at?: string | null
          result_comments?: number | null
          result_reach?: number | null
          result_saves?: number | null
          result_shares?: number | null
          result_views?: number | null
          scheduled_date?: string | null
          script?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
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
          bio: string | null
          created_at: string | null
          id: string
          instagram_handle: string | null
          name: string
          niche: string | null
          onboarding_completed: boolean | null
          plan: string | null
          platforms: string[] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tiktok_handle: string | null
          updated_at: string | null
          weekly_goal: number | null
          youtube_handle: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id: string
          instagram_handle?: string | null
          name: string
          niche?: string | null
          onboarding_completed?: boolean | null
          plan?: string | null
          platforms?: string[] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tiktok_handle?: string | null
          updated_at?: string | null
          weekly_goal?: number | null
          youtube_handle?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          name?: string
          niche?: string | null
          onboarding_completed?: boolean | null
          plan?: string | null
          platforms?: string[] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tiktok_handle?: string | null
          updated_at?: string | null
          weekly_goal?: number | null
          youtube_handle?: string | null
        }
        Relationships: []
      }
      reference_formats: {
        Row: {
          format_type: string
          id: string
          is_active: boolean | null
          name: string
          platform: string
          structure: string
          tips: string | null
        }
        Insert: {
          format_type: string
          id?: string
          is_active?: boolean | null
          name: string
          platform: string
          structure: string
          tips?: string | null
        }
        Update: {
          format_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          platform?: string
          structure?: string
          tips?: string | null
        }
        Relationships: []
      }
      reference_hooks: {
        Row: {
          category: string
          example: string | null
          formats: string[] | null
          hook_text: string
          id: string
          is_active: boolean | null
          platforms: string[] | null
        }
        Insert: {
          category: string
          example?: string | null
          formats?: string[] | null
          hook_text: string
          id?: string
          is_active?: boolean | null
          platforms?: string[] | null
        }
        Update: {
          category?: string
          example?: string | null
          formats?: string[] | null
          hook_text?: string
          id?: string
          is_active?: boolean | null
          platforms?: string[] | null
        }
        Relationships: []
      }
      reference_prompts: {
        Row: {
          category: string
          id: string
          is_active: boolean | null
          platforms: string[] | null
          position: number | null
          prompt_text: string
          tip: string | null
          title: string
        }
        Insert: {
          category: string
          id?: string
          is_active?: boolean | null
          platforms?: string[] | null
          position?: number | null
          prompt_text: string
          tip?: string | null
          title: string
        }
        Update: {
          category?: string
          id?: string
          is_active?: boolean | null
          platforms?: string[] | null
          position?: number | null
          prompt_text?: string
          tip?: string | null
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
