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
      account_deletion_log: {
        Row: {
          deleted_at: string | null
          email_hash: string
          id: string
          request_metadata: Json | null
          user_id_hash: string
        }
        Insert: {
          deleted_at?: string | null
          email_hash: string
          id?: string
          request_metadata?: Json | null
          user_id_hash: string
        }
        Update: {
          deleted_at?: string | null
          email_hash?: string
          id?: string
          request_metadata?: Json | null
          user_id_hash?: string
        }
        Relationships: []
      }
      account_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          manager_notes: string | null
          member_email: string
          member_id: string | null
          owner_id: string
          pending_self_subscribe: boolean | null
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          manager_notes?: string | null
          member_email: string
          member_id?: string | null
          owner_id: string
          pending_self_subscribe?: boolean | null
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          manager_notes?: string | null
          member_email?: string
          member_id?: string | null
          owner_id?: string
          pending_self_subscribe?: boolean | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rate_limit: {
        Row: {
          call_count: number
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          call_count?: number
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          call_count?: number
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_rate_limit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      billing_events: {
        Row: {
          event_id: string
          gateway: string
          id: string
          payload: Json | null
          processed_at: string | null
          type: string
        }
        Insert: {
          event_id: string
          gateway: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          type: string
        }
        Update: {
          event_id?: string
          gateway?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          type?: string
        }
        Relationships: []
      }
      bio_links: {
        Row: {
          clicks: number | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          link_type: string | null
          position: number | null
          thumbnail_url: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          clicks?: number | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          link_type?: string | null
          position?: number | null
          thumbnail_url?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          clicks?: number | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          link_type?: string | null
          position?: number | null
          thumbnail_url?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bio_links_user_id_fkey"
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      external_media_refs: {
        Row: {
          bunny_video_id: string | null
          created_at: string | null
          download_url: string | null
          expires_at: string | null
          external_file_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          post_id: string | null
          provider: string
          thumbnail_url: string | null
          user_id: string
          view_url: string | null
        }
        Insert: {
          bunny_video_id?: string | null
          created_at?: string | null
          download_url?: string | null
          expires_at?: string | null
          external_file_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          post_id?: string | null
          provider?: string
          thumbnail_url?: string | null
          user_id: string
          view_url?: string | null
        }
        Update: {
          bunny_video_id?: string | null
          created_at?: string | null
          download_url?: string | null
          expires_at?: string | null
          external_file_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          post_id?: string | null
          provider?: string
          thumbnail_url?: string | null
          user_id?: string
          view_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_media_refs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_media_refs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bunny_video_id: string | null
          category: string | null
          created_at: string | null
          expires_at: string | null
          file_type: string | null
          id: string
          name: string
          post_id: string | null
          size_bytes: number | null
          source: string | null
          storage_path: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          bunny_video_id?: string | null
          category?: string | null
          created_at?: string | null
          expires_at?: string | null
          file_type?: string | null
          id?: string
          name: string
          post_id?: string | null
          size_bytes?: number | null
          source?: string | null
          storage_path: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          bunny_video_id?: string | null
          category?: string | null
          created_at?: string | null
          expires_at?: string | null
          file_type?: string | null
          id?: string
          name?: string
          post_id?: string | null
          size_bytes?: number | null
          source?: string | null
          storage_path?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_connections: {
        Row: {
          connected_at: string | null
          google_account_id: string
          google_email: string
          google_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          google_account_id: string
          google_email: string
          google_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          google_account_id?: string
          google_email?: string
          google_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          idea_status: string | null
          notes: string | null
          objective: string | null
          origin: string | null
          pillar_id: string | null
          platform: string | null
          promoted_to_post_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          idea_status?: string | null
          notes?: string | null
          objective?: string | null
          origin?: string | null
          pillar_id?: string | null
          platform?: string | null
          promoted_to_post_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          idea_status?: string | null
          notes?: string | null
          objective?: string | null
          origin?: string | null
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
      milestones: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          goal_id: string
          id: string
          name: string
          position: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          goal_id: string
          id?: string
          name: string
          position?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          goal_id?: string
          id?: string
          name?: string
          position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "structured_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_user_id_fkey"
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
          due_date: string | null
          focus: string | null
          goals: string[] | null
          id: string
          month: string
          reflection: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          due_date?: string | null
          focus?: string | null
          goals?: string[] | null
          id?: string
          month: string
          reflection?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          due_date?: string | null
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
      monthly_reflections: {
        Row: {
          biz_blocked: string | null
          biz_clarity: string | null
          biz_procrastination: string | null
          biz_revenue: string | null
          biz_worked: string | null
          content_best: string | null
          content_connection: string | null
          content_rhythm: string | null
          created_at: string | null
          focus_distractions: string | null
          focus_execution: string | null
          focus_lessons: string | null
          id: string
          month: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          biz_blocked?: string | null
          biz_clarity?: string | null
          biz_procrastination?: string | null
          biz_revenue?: string | null
          biz_worked?: string | null
          content_best?: string | null
          content_connection?: string | null
          content_rhythm?: string | null
          created_at?: string | null
          focus_distractions?: string | null
          focus_execution?: string | null
          focus_lessons?: string | null
          id?: string
          month: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          biz_blocked?: string | null
          biz_clarity?: string | null
          biz_procrastination?: string | null
          biz_revenue?: string | null
          biz_worked?: string | null
          content_best?: string | null
          content_connection?: string | null
          content_rhythm?: string | null
          created_at?: string | null
          focus_distractions?: string | null
          focus_execution?: string | null
          focus_lessons?: string | null
          id?: string
          month?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moodboard_entries: {
        Row: {
          answer: string | null
          created_at: string | null
          id: string
          question_key: string
          section: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string | null
          id?: string
          question_key: string
          section: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string | null
          id?: string
          question_key?: string
          section?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moodboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          link: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_program_config: {
        Row: {
          deduction_pct: number
          grace_invoices: number
          id: boolean
          updated_at: string
        }
        Insert: {
          deduction_pct?: number
          grace_invoices?: number
          id?: boolean
          updated_at?: string
        }
        Update: {
          deduction_pct?: number
          grace_invoices?: number
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      partner_referrals: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          created_at: string
          currency: string | null
          deduction_pct: number | null
          first_invoice_id: string | null
          gross_amount_cents: number | null
          id: string
          net_amount_cents: number | null
          paid_at: string | null
          paid_invoices_count: number
          partner_id: string
          referred_user_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          currency?: string | null
          deduction_pct?: number | null
          first_invoice_id?: string | null
          gross_amount_cents?: number | null
          id?: string
          net_amount_cents?: number | null
          paid_at?: string | null
          paid_invoices_count?: number
          partner_id: string
          referred_user_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          currency?: string | null
          deduction_pct?: number | null
          first_invoice_id?: string | null
          gross_amount_cents?: number | null
          id?: string
          net_amount_cents?: number | null
          paid_at?: string | null
          paid_invoices_count?: number
          partner_id?: string
          referred_user_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commission_deduction_pct: number | null
          coupon_code: string | null
          coupon_discount_pct: number | null
          coupon_duration_months: number | null
          coupon_type: string | null
          cpf: string | null
          created_at: string
          current_clients: string | null
          full_name: string | null
          id: string
          instagram_handle: string | null
          notes: string | null
          phone: string | null
          pix_key: string | null
          status: string
          stripe_coupon_id: string | null
          stripe_promotion_code_id: string | null
          time_active: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commission_deduction_pct?: number | null
          coupon_code?: string | null
          coupon_discount_pct?: number | null
          coupon_duration_months?: number | null
          coupon_type?: string | null
          cpf?: string | null
          created_at?: string
          current_clients?: string | null
          full_name?: string | null
          id?: string
          instagram_handle?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          status?: string
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          time_active?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commission_deduction_pct?: number | null
          coupon_code?: string | null
          coupon_discount_pct?: number | null
          coupon_duration_months?: number | null
          coupon_type?: string | null
          cpf?: string | null
          created_at?: string
          current_clients?: string | null
          full_name?: string | null
          id?: string
          instagram_handle?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          status?: string
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          time_active?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          age_range: string | null
          created_at: string | null
          desires: string[] | null
          gender: string | null
          how_you_help: string | null
          icon: string | null
          id: string
          interests: string[] | null
          location: string | null
          name: string
          notes: string | null
          pain_points: string[] | null
          platforms: string[] | null
          user_id: string
        }
        Insert: {
          age_range?: string | null
          created_at?: string | null
          desires?: string[] | null
          gender?: string | null
          how_you_help?: string | null
          icon?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          name?: string
          notes?: string | null
          pain_points?: string[] | null
          platforms?: string[] | null
          user_id: string
        }
        Update: {
          age_range?: string | null
          created_at?: string | null
          desires?: string[] | null
          gender?: string | null
          how_you_help?: string | null
          icon?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          name?: string
          notes?: string | null
          pain_points?: string[] | null
          platforms?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_user_id_fkey"
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
          calendar_synced_at: string | null
          caption: string | null
          content_blocks: Json | null
          created_at: string | null
          cta: string | null
          format: string
          google_event_id: string | null
          hook: string | null
          id: string
          idea_id: string | null
          learnings: string | null
          notes: string | null
          pillar_id: string | null
          platform: string
          published_at: string | null
          reference_link: string | null
          result_comments: number | null
          result_reach: number | null
          result_saves: number | null
          result_shares: number | null
          result_views: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          script: string | null
          sections: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
          week_number: number | null
        }
        Insert: {
          archive_summary?: string | null
          calendar_synced_at?: string | null
          caption?: string | null
          content_blocks?: Json | null
          created_at?: string | null
          cta?: string | null
          format: string
          google_event_id?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          learnings?: string | null
          notes?: string | null
          pillar_id?: string | null
          platform: string
          published_at?: string | null
          reference_link?: string | null
          result_comments?: number | null
          result_reach?: number | null
          result_saves?: number | null
          result_shares?: number | null
          result_views?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          script?: string | null
          sections?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          week_number?: number | null
        }
        Update: {
          archive_summary?: string | null
          calendar_synced_at?: string | null
          caption?: string | null
          content_blocks?: Json | null
          created_at?: string | null
          cta?: string | null
          format?: string
          google_event_id?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          learnings?: string | null
          notes?: string | null
          pillar_id?: string | null
          platform?: string
          published_at?: string | null
          reference_link?: string | null
          result_comments?: number | null
          result_reach?: number | null
          result_saves?: number | null
          result_shares?: number | null
          result_views?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          script?: string | null
          sections?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          week_number?: number | null
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
          access_expires_at: string | null
          account_type: string
          ai_ideas_reset_at: string | null
          ai_ideas_used_month: number | null
          avatar_url: string | null
          bio: string | null
          bio_settings: Json | null
          bio_slug: string | null
          created_at: string | null
          editorial_line: Json | null
          id: string
          instagram_handle: string | null
          last_seen_at: string | null
          must_change_password: boolean
          name: string
          niche: string | null
          onboarding_completed: boolean | null
          phone: string | null
          plan: string | null
          platforms: string[] | null
          role: string | null
          storage_quota_bytes: number | null
          storage_retention_days: number | null
          storage_used_bytes: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          theme_accent: string | null
          theme_color: string | null
          theme_font: string | null
          theme_mode: string | null
          theme_preset: string | null
          theme_sidebar: string | null
          tiktok_handle: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          weekly_goal: number | null
          youtube_handle: string | null
        }
        Insert: {
          access_expires_at?: string | null
          account_type?: string
          ai_ideas_reset_at?: string | null
          ai_ideas_used_month?: number | null
          avatar_url?: string | null
          bio?: string | null
          bio_settings?: Json | null
          bio_slug?: string | null
          created_at?: string | null
          editorial_line?: Json | null
          id: string
          instagram_handle?: string | null
          last_seen_at?: string | null
          must_change_password?: boolean
          name: string
          niche?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          plan?: string | null
          platforms?: string[] | null
          role?: string | null
          storage_quota_bytes?: number | null
          storage_retention_days?: number | null
          storage_used_bytes?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          theme_accent?: string | null
          theme_color?: string | null
          theme_font?: string | null
          theme_mode?: string | null
          theme_preset?: string | null
          theme_sidebar?: string | null
          tiktok_handle?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          weekly_goal?: number | null
          youtube_handle?: string | null
        }
        Update: {
          access_expires_at?: string | null
          account_type?: string
          ai_ideas_reset_at?: string | null
          ai_ideas_used_month?: number | null
          avatar_url?: string | null
          bio?: string | null
          bio_settings?: Json | null
          bio_slug?: string | null
          created_at?: string | null
          editorial_line?: Json | null
          id?: string
          instagram_handle?: string | null
          last_seen_at?: string | null
          must_change_password?: boolean
          name?: string
          niche?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          plan?: string | null
          platforms?: string[] | null
          role?: string | null
          storage_quota_bytes?: number | null
          storage_retention_days?: number | null
          storage_used_bytes?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          theme_accent?: string | null
          theme_color?: string | null
          theme_font?: string | null
          theme_mode?: string | null
          theme_preset?: string | null
          theme_sidebar?: string | null
          tiktok_handle?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
      structured_goals: {
        Row: {
          category: string
          created_at: string | null
          current_value: number | null
          end_date: string | null
          id: string
          observation: string | null
          period: string | null
          start_date: string | null
          status: string
          target_value: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          current_value?: number | null
          end_date?: string | null
          id?: string
          observation?: string | null
          period?: string | null
          start_date?: string | null
          status?: string
          target_value?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          current_value?: number | null
          end_date?: string | null
          id?: string
          observation?: string | null
          period?: string | null
          start_date?: string | null
          status?: string
          target_value?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "structured_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_cents: number | null
          canceled_at: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          gateway: string
          gateway_customer_id: string | null
          gateway_payment_id: string | null
          gateway_subscription_id: string | null
          id: string
          plan: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          canceled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: string
          gateway_customer_id?: string | null
          gateway_payment_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          canceled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: string
          gateway_customer_id?: string | null
          gateway_payment_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          post_id: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          post_id?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          post_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_formats: {
        Row: {
          created_at: string | null
          id: string
          name: string
          platform: string
          structure: string
          tips: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          platform: string
          structure: string
          tips?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          platform?: string
          structure?: string
          tips?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_formats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hooks: {
        Row: {
          category: string
          created_at: string | null
          hook_text: string
          id: string
          is_favorite: boolean | null
          platforms: string[] | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          hook_text: string
          id?: string
          is_favorite?: boolean | null
          platforms?: string[] | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          hook_text?: string
          id?: string
          is_favorite?: boolean | null
          platforms?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_library_usage: {
        Row: {
          id: string
          is_user_item: boolean | null
          item_id: string
          item_type: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_user_item?: boolean | null
          item_id: string
          item_type: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_user_item?: boolean | null
          item_id?: string
          item_type?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_library_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prompts: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_favorite: boolean | null
          prompt_text: string
          tip: string | null
          title: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          prompt_text: string
          tip?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          prompt_text?: string
          tip?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_monthly_quota: { Args: never; Returns: number }
      ai_usage_this_month: {
        Args: never
        Returns: {
          quota: number
          used: number
        }[]
      }
      bump_ai_quota: {
        Args: { _user: string }
        Returns: {
          quota: number
          used: number
        }[]
      }
      bump_ai_rate_limit: {
        Args: { _max: number; _user: string; _window: string }
        Returns: number
      }
      claim_account_invites: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_stats: {
        Args: never
        Returns: {
          active_users_7d: number
          admins: number
          onboarded: number
          plan_free: number
          plan_pro: number
          plan_studio: number
          total_users: number
        }[]
      }
      get_manager_notes: { Args: { _owner_id: string }; Returns: string }
      get_public_bio_links_by_slug: {
        Args: { _slug: string }
        Returns: {
          icon: string
          id: string
          link_type: string
          position: number
          thumbnail_url: string
          title: string
          url: string
        }[]
      }
      get_public_profile_by_slug: {
        Args: { _slug: string }
        Returns: {
          avatar_url: string
          bio: string
          bio_settings: Json
          bio_slug: string
          id: string
          instagram_handle: string
          name: string
          niche: string
        }[]
      }
      get_user_details: { Args: { _user_id: string }; Returns: Json }
      has_access: { Args: never; Returns: boolean }
      increment_bio_link_click: {
        Args: { link_id: string }
        Returns: undefined
      }
      is_account_manager: { Args: { _owner: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_managed_accounts: {
        Args: never
        Returns: {
          avatar_url: string
          instagram_handle: string
          name: string
          niche: string
          owner_id: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      set_manager_notes: {
        Args: { _notes: string; _owner_id: string }
        Returns: undefined
      }
      touch_last_seen: { Args: never; Returns: undefined }
      user_tier: { Args: never; Returns: string }
      validate_partner_code: {
        Args: { _code: string }
        Returns: {
          coupon_type: string
          discount_pct: number
          partner_name: string
        }[]
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
