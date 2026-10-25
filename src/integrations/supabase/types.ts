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
      appointments: {
        Row: {
          appointment_code: string
          athlete_id: string
          created_at: string
          created_by: string | null
          id: string
          injury_id: string | null
          location: string | null
          purpose: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_code?: string
          athlete_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id?: string | null
          location?: string | null
          purpose?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_code?: string
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id?: string | null
          location?: string | null
          purpose?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_code: string
          assessment_date: string | null
          assessment_type: string | null
          athlete_id: string
          balance: string | null
          clinical_impression: string | null
          created_at: string
          created_by: string | null
          follow_up_date: string | null
          functional_tests: string | null
          history: string | null
          id: string
          injury_id: string
          mechanism: string | null
          observation: string | null
          pain: string | null
          plan: string | null
          presenting_complaint: string | null
          range_of_motion: string | null
          red_flags: string | null
          referral_recommendation: string | null
          sport_specific_findings: string | null
          strength: string | null
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          assessment_code?: string
          assessment_date?: string | null
          assessment_type?: string | null
          athlete_id: string
          balance?: string | null
          clinical_impression?: string | null
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          functional_tests?: string | null
          history?: string | null
          id?: string
          injury_id: string
          mechanism?: string | null
          observation?: string | null
          pain?: string | null
          plan?: string | null
          presenting_complaint?: string | null
          range_of_motion?: string | null
          red_flags?: string | null
          referral_recommendation?: string | null
          sport_specific_findings?: string | null
          strength?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          assessment_code?: string
          assessment_date?: string | null
          assessment_type?: string | null
          athlete_id?: string
          balance?: string | null
          clinical_impression?: string | null
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          functional_tests?: string | null
          history?: string | null
          id?: string
          injury_id?: string
          mechanism?: string | null
          observation?: string | null
          pain?: string | null
          plan?: string | null
          presenting_complaint?: string | null
          range_of_motion?: string | null
          red_flags?: string | null
          referral_recommendation?: string | null
          sport_specific_findings?: string | null
          strength?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_achievements: {
        Row: {
          achieved_on: string | null
          category: string
          created_at: string
          detail: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          achieved_on?: string | null
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          achieved_on?: string | null
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_guardians: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_guardians_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          athlete_code: string
          athlete_number: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          first_name: string
          gender: string | null
          id: string
          phone: string | null
          photo_path: string | null
          school_id: string | null
          self_registered: boolean
          sport: string | null
          surname: string
          updated_at: string
        }
        Insert: {
          athlete_code?: string
          athlete_number?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          first_name: string
          gender?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          school_id?: string | null
          self_registered?: boolean
          sport?: string | null
          surname: string
          updated_at?: string
        }
        Update: {
          athlete_code?: string
          athlete_number?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          school_id?: string | null
          self_registered?: boolean
          sport?: string | null
          surname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_articles: {
        Row: {
          author_id: string
          author_name: string
          category: string
          content_markdown: string
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name?: string
          category?: string
          content_markdown?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          category?: string
          content_markdown?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      care_requests: {
        Row: {
          appointment_id: string | null
          athlete_id: string
          created_at: string
          handled_by: string | null
          id: string
          kind: string
          message: string
          preferred_date: string | null
          requester_id: string
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          athlete_id: string
          created_at?: string
          handled_by?: string | null
          id?: string
          kind?: string
          message: string
          preferred_date?: string | null
          requester_id: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          athlete_id?: string
          created_at?: string
          handled_by?: string | null
          id?: string
          kind?: string
          message?: string
          preferred_date?: string | null
          requester_id?: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          id: string
          injury_id: string
          note: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id: string
          note: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          athlete_id: string | null
          audience: string | null
          body: string
          created_at: string
          id: string
          recipient_id: string | null
          school_id: string | null
          sender_id: string
          subject: string | null
        }
        Insert: {
          athlete_id?: string | null
          audience?: string | null
          body: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          school_id?: string | null
          sender_id: string
          subject?: string | null
        }
        Update: {
          athlete_id?: string | null
          audience?: string | null
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          school_id?: string | null
          sender_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      community_activity: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          kind?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_activity_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profiles: {
        Row: {
          bio: string | null
          country: string | null
          cover_path: string | null
          created_at: string
          discoverable: boolean
          district: string | null
          gallery_paths: string[]
          headline: string | null
          interests: string[]
          position: string | null
          school_id: string | null
          school_name: string | null
          skills: string[]
          sport: string | null
          team: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          bio?: string | null
          country?: string | null
          cover_path?: string | null
          created_at?: string
          discoverable?: boolean
          district?: string | null
          gallery_paths?: string[]
          headline?: string | null
          interests?: string[]
          position?: string | null
          school_id?: string | null
          school_name?: string | null
          skills?: string[]
          sport?: string | null
          team?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          bio?: string | null
          country?: string | null
          cover_path?: string | null
          created_at?: string
          discoverable?: boolean
          district?: string | null
          gallery_paths?: string[]
          headline?: string | null
          interests?: string[]
          position?: string | null
          school_id?: string | null
          school_name?: string | null
          skills?: string[]
          sport?: string | null
          team?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_requests: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          requester_email: string
          requester_name: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          requester_email: string
          requester_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          requester_email?: string
          requester_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_requests: {
        Row: {
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string
          organisation_type: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message: string
          organisation_type?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          organisation_type?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          kind: string
          last_message_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string
        }
        Relationships: []
      }
      delivery_logs: {
        Row: {
          channel: string
          consultation_request_id: string | null
          created_at: string
          error_message: string | null
          id: string
          provider_message_id: string | null
          recipient_user_id: string | null
          source: string
          status: string
          subject: string | null
        }
        Insert: {
          channel: string
          consultation_request_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_user_id?: string | null
          source?: string
          status: string
          subject?: string | null
        }
        Update: {
          channel?: string
          consultation_request_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_user_id?: string | null
          source?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_logs_consultation_request_id_fkey"
            columns: ["consultation_request_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          file_size: number | null
          id: string
          injury_id: string | null
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          id?: string
          injury_id?: string | null
          storage_path: string
          title: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          id?: string
          injury_id?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          frequency: string | null
          id: string
          injury_id: string
          instructions: string | null
          name: string
          plan_id: string | null
          reps: string | null
          sets: number | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          frequency?: string | null
          id?: string
          injury_id: string
          instructions?: string | null
          name: string
          plan_id?: string | null
          reps?: string | null
          sets?: number | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          frequency?: string | null
          id?: string
          injury_id?: string
          instructions?: string | null
          name?: string
          plan_id?: string | null
          reps?: string | null
          sets?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "rehabilitation_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          findings: string | null
          id: string
          injury_id: string
          next_steps: string | null
          pain_score: number | null
          progress: string | null
          review_date: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          findings?: string | null
          id?: string
          injury_id: string
          next_steps?: string | null
          pain_score?: number | null
          progress?: string | null
          review_date: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          findings?: string | null
          id?: string
          injury_id?: string
          next_steps?: string | null
          pain_score?: number | null
          progress?: string | null
          review_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          athlete_id: string
          body_region: string
          created_at: string
          created_by: string | null
          id: string
          injury_code: string
          injury_date: string | null
          mechanism: string | null
          notes: string | null
          pain_score: number | null
          sport_context: string | null
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          body_region: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_code?: string
          injury_date?: string | null
          mechanism?: string | null
          notes?: string | null
          pain_score?: number | null
          sport_context?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          body_region?: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_code?: string
          injury_date?: string | null
          mechanism?: string | null
          notes?: string | null
          pain_score?: number | null
          sport_context?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "injuries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_hidden: {
        Row: {
          created_at: string
          hidden_at: string
          message_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_at?: string
          message_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_at?: string
          message_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_hidden_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          consultation_request_id: string | null
          created_at: string
          data: Json
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          consultation_request_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          consultation_request_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_consultation_request_id_fkey"
            columns: ["consultation_request_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          contact: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          kind: string
          location: string | null
          organisation_id: string | null
          organiser: string | null
          published: boolean
          sport: string | null
          starts_on: string | null
          title: string
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          kind: string
          location?: string | null
          organisation_id?: string | null
          organiser?: string | null
          published?: boolean
          sport?: string | null
          starts_on?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          kind?: string
          location?: string | null
          organisation_id?: string | null
          organiser?: string | null
          published?: boolean
          sport?: string | null
          starts_on?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      org_join_requests: {
        Row: {
          created_at: string
          handled_by: string | null
          id: string
          role: string
          school_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handled_by?: string | null
          id?: string
          role?: string
          school_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handled_by?: string | null
          id?: string
          role?: string
          school_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_join_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_code: string
          avatar_path: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          requested_role: string | null
          updated_at: string
        }
        Insert: {
          account_code?: string
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          requested_role?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          requested_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recovery_updates: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          id: string
          injury_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id: string
          notes?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_updates_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_updates_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          id: string
          injury_id: string | null
          reason: string | null
          referral_code: string
          referred_to: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id?: string | null
          reason?: string | null
          referral_code?: string
          referred_to: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          injury_id?: string | null
          reason?: string | null
          referral_code?: string
          referred_to?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      rehabilitation_plans: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          goals: string | null
          id: string
          injury_id: string
          notes: string | null
          phase: string | null
          plan_code: string
          start_date: string | null
          target_return_date: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          goals?: string | null
          id?: string
          injury_id: string
          notes?: string | null
          phase?: string | null
          plan_code?: string
          start_date?: string | null
          target_return_date?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          goals?: string | null
          id?: string
          injury_id?: string
          notes?: string | null
          phase?: string | null
          plan_code?: string
          start_date?: string | null
          target_return_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehabilitation_plans_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehabilitation_plans_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
        ]
      }
      school_users: {
        Row: {
          created_at: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_users_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          intake_notes: string | null
          location: string | null
          logo_path: string | null
          name: string
          school_code: string
          school_type: string
          self_registered: boolean
          updated_at: string
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intake_notes?: string | null
          location?: string | null
          logo_path?: string | null
          name: string
          school_code?: string
          school_type?: string
          self_registered?: boolean
          updated_at?: string
        }
        Update: {
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intake_notes?: string | null
          location?: string | null
          logo_path?: string | null
          name?: string
          school_code?: string
          school_type?: string
          self_registered?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      social_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          media_path: string | null
          parent_post_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          parent_post_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          parent_post_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_parent_post_id_fkey"
            columns: ["parent_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_shares: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      add_social_comment: {
        Args: { _body: string; _post_id: string }
        Returns: string
      }
      can_access_message: {
        Args: { _message_id: string; _user_id?: string }
        Returns: boolean
      }
      can_read_communication: {
        Args: {
          _c: Database["public"]["Tables"]["communications"]["Row"]
          _user: string
        }
        Returns: boolean
      }
      can_view_athlete: {
        Args: { _athlete: string; _user: string }
        Returns: boolean
      }
      can_view_member: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      can_write_blog: { Args: never; Returns: boolean }
      create_direct_conversation: {
        Args: { _other_user: string }
        Returns: string
      }
      create_social_post: {
        Args: { _body?: string; _media_path?: string; _parent_post_id?: string }
        Returns: string
      }
      delete_message_for_everyone: {
        Args: { _message_id: string }
        Returns: undefined
      }
      discover_members: {
        Args: { _q?: string; _role?: string; _school?: string; _sport?: string }
        Returns: string[]
      }
      discover_schools: {
        Args: { _q?: string }
        Returns: {
          id: string
          location: string
          logo_path: string
          member_count: number
          name: string
          school_type: string
          sports: string[]
        }[]
      }
      get_member_cards: {
        Args: { _ids: string[] }
        Returns: {
          avatar_path: string
          cover_path: string
          full_name: string
          headline: string
          id: string
          position: string
          role: string
          school: string
          school_id: string
          school_verified: boolean
          sport: string
          team: string
          visibility: string
        }[]
      }
      get_messaging_member_profile: {
        Args: { _user_id: string }
        Returns: {
          avatar_path: string
          cover_path: string
          full_name: string
          headline: string
          id: string
          position: string
          role: string
          school: string
          school_id: string
          school_verified: boolean
          sport: string
          team: string
          visibility: string
        }[]
      }
      get_sender_names: {
        Args: { _ids: string[] }
        Returns: {
          full_name: string
          id: string
          is_admin: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blog_admin: { Args: never; Returns: boolean }
      is_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id?: string }
        Returns: boolean
      }
      is_discoverable_member: { Args: { _u: string }; Returns: boolean }
      is_valid_photo_path: { Args: { _p: string }; Returns: boolean }
      is_vito_staff: { Args: { _user_id: string }; Returns: boolean }
      list_messaging_users: {
        Args: { _query?: string }
        Returns: {
          avatar_path: string
          full_name: string
          id: string
          role: string
        }[]
      }
      list_public_organisations: {
        Args: never
        Returns: {
          id: string
          name: string
          school_type: string
        }[]
      }
      list_social_comments: {
        Args: { _post_id: string }
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
        }[]
      }
      list_social_posts: {
        Args: {
          _limit?: number
          _offset?: number
          _profile_id?: string
          _tab?: string
        }
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          author_role: string
          body: string
          comments_count: number
          created_at: string
          id: string
          liked: boolean
          likes_count: number
          media_path: string
          parent_post_id: string
          shared: boolean
          shares_count: number
        }[]
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      save_athlete_profile: {
        Args: {
          p_bio: string
          p_country: string
          p_date_of_birth: string
          p_discoverable: boolean
          p_district: string
          p_first_name: string
          p_full_name: string
          p_headline: string
          p_interests: string[]
          p_phone: string
          p_position: string
          p_school_name: string
          p_skills: string[]
          p_sport: string
          p_surname: string
          p_team: string
          p_user_id: string
          p_visibility: string
        }
        Returns: undefined
      }
      share_social_post: { Args: { _post_id: string }; Returns: number }
      social_can_view_profile: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      social_profile_summary: {
        Args: { _user_id: string }
        Returns: {
          avatar_path: string
          bio: string
          country: string
          cover_path: string
          district: string
          followers_count: number
          following_count: number
          full_name: string
          headline: string
          interests: string[]
          is_following: boolean
          player_position: string
          posts_count: number
          role: string
          school_name: string
          skills: string[]
          sport: string
          team: string
          user_id: string
        }[]
      }
      toggle_social_follow: { Args: { _following: string }; Returns: boolean }
      toggle_social_like: { Args: { _post_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "vito_admin"
        | "clinical_professional"
        | "clinical_supervisor"
        | "school_admin"
        | "coach"
        | "athlete"
        | "parent"
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
    Enums: {
      app_role: [
        "super_admin",
        "vito_admin",
        "clinical_professional",
        "clinical_supervisor",
        "school_admin",
        "coach",
        "athlete",
        "parent",
      ],
    },
  },
} as const
