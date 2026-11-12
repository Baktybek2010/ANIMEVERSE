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
      admin_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anime: {
        Row: {
          anilist_id: number | null
          anilist_synced_at: string | null
          banner_url: string | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          episode_duration: number | null
          episodes_total: number | null
          format: Database["public"]["Enums"]["anime_format"]
          genre_slugs: string[]
          id: string
          is_adult: boolean
          is_featured: boolean
          is_published: boolean
          locked_fields: string[]
          mal_id: number | null
          popularity: number
          poster_color: string | null
          poster_url: string | null
          score: number | null
          search_text: string
          season: Database["public"]["Enums"]["anime_season_name"] | null
          season_year: number | null
          slug: string
          source: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["anime_status"]
          studio: string | null
          synonyms: string[]
          title_english: string | null
          title_native: string | null
          title_romaji: string
          trailer_youtube_id: string | null
          trending: number
          updated_at: string
          views_count: number
        }
        Insert: {
          anilist_id?: number | null
          anilist_synced_at?: string | null
          banner_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          episode_duration?: number | null
          episodes_total?: number | null
          format?: Database["public"]["Enums"]["anime_format"]
          genre_slugs?: string[]
          id?: string
          is_adult?: boolean
          is_featured?: boolean
          is_published?: boolean
          locked_fields?: string[]
          mal_id?: number | null
          popularity?: number
          poster_color?: string | null
          poster_url?: string | null
          score?: number | null
          search_text?: string
          season?: Database["public"]["Enums"]["anime_season_name"] | null
          season_year?: number | null
          slug: string
          source?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["anime_status"]
          studio?: string | null
          synonyms?: string[]
          title_english?: string | null
          title_native?: string | null
          title_romaji: string
          trailer_youtube_id?: string | null
          trending?: number
          updated_at?: string
          views_count?: number
        }
        Update: {
          anilist_id?: number | null
          anilist_synced_at?: string | null
          banner_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          episode_duration?: number | null
          episodes_total?: number | null
          format?: Database["public"]["Enums"]["anime_format"]
          genre_slugs?: string[]
          id?: string
          is_adult?: boolean
          is_featured?: boolean
          is_published?: boolean
          locked_fields?: string[]
          mal_id?: number | null
          popularity?: number
          poster_color?: string | null
          poster_url?: string | null
          score?: number | null
          search_text?: string
          season?: Database["public"]["Enums"]["anime_season_name"] | null
          season_year?: number | null
          slug?: string
          source?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["anime_status"]
          studio?: string | null
          synonyms?: string[]
          title_english?: string | null
          title_native?: string | null
          title_romaji?: string
          trailer_youtube_id?: string | null
          trending?: number
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "anime_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_genres: {
        Row: {
          anime_id: string
          genre_id: number
        }
        Insert: {
          anime_id: string
          genre_id: number
        }
        Update: {
          anime_id?: string
          genre_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "anime_genres_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_translations: {
        Row: {
          anime_id: string
          description: string | null
          is_manual: boolean
          locale: string
          title: string | null
          updated_at: string
        }
        Insert: {
          anime_id: string
          description?: string | null
          is_manual?: boolean
          locale: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          anime_id?: string
          description?: string | null
          is_manual?: boolean
          locale?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anime_translations_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          body_en: string | null
          body_ja: string | null
          body_ru: string
          cover_url: string | null
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          title_en: string | null
          title_ja: string | null
          title_ru: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_en?: string | null
          body_ja?: string | null
          body_ru: string
          cover_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          title_en?: string | null
          title_ja?: string | null
          title_ru: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_en?: string | null
          body_ja?: string | null
          body_ru?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          title_en?: string | null
          title_ja?: string | null
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          anime_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          starts_at: string | null
          subtitle_en: string | null
          subtitle_ja: string | null
          subtitle_ru: string | null
          title_en: string | null
          title_ja: string | null
          title_ru: string | null
          updated_at: string
        }
        Insert: {
          anime_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle_en?: string | null
          subtitle_ja?: string | null
          subtitle_ru?: string | null
          title_en?: string | null
          title_ja?: string | null
          title_ru?: string | null
          updated_at?: string
        }
        Update: {
          anime_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle_en?: string | null
          subtitle_ja?: string | null
          subtitle_ru?: string | null
          title_en?: string | null
          title_ja?: string | null
          title_ru?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_sources: {
        Row: {
          audio_label: string | null
          audio_lang: string
          created_at: string
          episode_id: string
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["video_kind"]
          quality: string
          sort_order: number
          url: string
        }
        Insert: {
          audio_label?: string | null
          audio_lang?: string
          created_at?: string
          episode_id: string
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["video_kind"]
          quality?: string
          sort_order?: number
          url: string
        }
        Update: {
          audio_label?: string | null
          audio_lang?: string
          created_at?: string
          episode_id?: string
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["video_kind"]
          quality?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_sources_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_subtitles: {
        Row: {
          created_at: string
          episode_id: string
          id: string
          is_default: boolean
          label: string
          lang: string
          url: string
        }
        Insert: {
          created_at?: string
          episode_id: string
          id?: string
          is_default?: boolean
          label: string
          lang: string
          url: string
        }
        Update: {
          created_at?: string
          episode_id?: string
          id?: string
          is_default?: boolean
          label?: string
          lang?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_subtitles_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          air_date: string | null
          anime_id: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_premium: boolean
          is_published: boolean
          number: number
          season_id: string
          thumbnail_url: string | null
          title_en: string | null
          title_ja: string | null
          title_ru: string | null
          updated_at: string
          views_count: number
        }
        Insert: {
          air_date?: string | null
          anime_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          number: number
          season_id: string
          thumbnail_url?: string | null
          title_en?: string | null
          title_ja?: string | null
          title_ru?: string | null
          updated_at?: string
          views_count?: number
        }
        Update: {
          air_date?: string | null
          anime_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          number?: number
          season_id?: string
          thumbnail_url?: string | null
          title_en?: string | null
          title_ja?: string | null
          title_ru?: string | null
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "episodes_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          anime_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          anime_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          anime_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string
          id: number
          name_en: string
          name_ja: string
          name_ru: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          name_en: string
          name_ja: string
          name_ru: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: never
          name_en?: string
          name_ja?: string
          name_ru?: string
          slug?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          link: string | null
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string | null
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
      payment_events: {
        Row: {
          id: string
          payload: Json
          processed_at: string
          provider: string
          type: string
        }
        Insert: {
          id: string
          payload: Json
          processed_at?: string
          provider: string
          type: string
        }
        Update: {
          id?: string
          payload?: Json
          processed_at?: string
          provider?: string
          type?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          id: string
          paid_at: string | null
          provider: string
          provider_payment_id: string
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          paid_at?: string | null
          provider: string
          provider_payment_id: string
          receipt_url?: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: Database["public"]["Enums"]["billing_interval"]
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name_en: string
          name_ja: string
          name_ru: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_period: Database["public"]["Enums"]["billing_interval"]
          created_at?: string
          currency?: string
          id: string
          is_active?: boolean
          name_en: string
          name_ja: string
          name_ru: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["billing_interval"]
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name_en?: string
          name_ja?: string
          name_ru?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_banned: boolean
          locale: string
          preferences: Json
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_banned?: boolean
          locale?: string
          preferences?: Json
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_banned?: boolean
          locale?: string
          preferences?: Json
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start?: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          description: string
          level: number
          name: string
        }
        Insert: {
          description?: string
          level: number
          name: string
        }
        Update: {
          description?: string
          level?: number
          name?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          anime_id: string
          created_at: string
          id: string
          number: number
          title_en: string | null
          title_ja: string | null
          title_ru: string | null
        }
        Insert: {
          anime_id: string
          created_at?: string
          id?: string
          number: number
          title_en?: string | null
          title_ja?: string | null
          title_ru?: string | null
        }
        Update: {
          anime_id?: string
          created_at?: string
          id?: string
          number?: number
          title_en?: string | null
          title_ja?: string | null
          title_ru?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          granted_by: string | null
          id: string
          plan_id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start?: string
          granted_by?: string | null
          id?: string
          plan_id: string
          provider: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          granted_by?: string | null
          id?: string
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      view_events: {
        Row: {
          anime_id: string
          created_at: string
          episode_id: string
          id: number
          user_id: string | null
        }
        Insert: {
          anime_id: string
          created_at?: string
          episode_id: string
          id?: never
          user_id?: string | null
        }
        Update: {
          anime_id?: string
          created_at?: string
          episode_id?: string
          id?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_events_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_events_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          anime_id: string
          completed: boolean
          created_at: string
          duration_seconds: number
          episode_id: string
          position_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          anime_id: string
          completed?: boolean
          created_at?: string
          duration_seconds?: number
          episode_id: string
          position_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          anime_id?: string
          completed?: boolean
          created_at?: string
          duration_seconds?: number
          episode_id?: string
          position_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          anime_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          anime_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          anime_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
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
      admin_daily_stats: {
        Args: {
          p_days?: number
        }
        Returns: {
          day: string
          views: number
          signups: number
          active_users: number
        }[]
      }
      admin_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_grant_subscription: {
        Args: {
          p_user: string
          p_plan: string
          p_days: number
        }
        Returns: string
      }
      admin_revoke_subscription: {
        Args: {
          p_subscription: string
        }
        Returns: undefined
      }
      admin_set_user_ban: {
        Args: {
          p_user: string
          p_banned: boolean
          p_reason?: string
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          p_user: string
          p_role: string
        }
        Returns: undefined
      }
      can_watch_episode: {
        Args: {
          p_episode: string
        }
        Returns: boolean
      }
      current_role_level: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      expire_subscriptions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_continue_watching: {
        Args: {
          p_limit?: number
        }
        Returns: {
          anime_id: string
          episode_id: string
          position_seconds: number
          duration_seconds: number
          updated_at: string
        }[]
      }
      get_recommendations: {
        Args: {
          p_limit?: number
        }
        Returns: {
          anime_id: string
          relevance: number
        }[]
      }
      has_active_subscription: {
        Args: {
          p_user: string
        }
        Returns: boolean
      }
      is_active_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_premium: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_username_available: {
        Args: {
          p_username: string
        }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_entity_type?: string
          p_entity_id?: string
          p_details?: Json
        }
        Returns: undefined
      }
      rate_limit_hit: {
        Args: {
          p_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      record_view: {
        Args: {
          p_episode: string
        }
        Returns: boolean
      }
    }
    Enums: {
      anime_format:
        | "tv"
        | "tv_short"
        | "movie"
        | "ova"
        | "ona"
        | "special"
        | "music"
      anime_season_name: "winter" | "spring" | "summer" | "fall"
      anime_status:
        | "announced"
        | "ongoing"
        | "finished"
        | "hiatus"
        | "cancelled"
      billing_interval: "month" | "year"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      subscription_status:
        | "incomplete"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      video_kind: "hls" | "mp4" | "webm"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
