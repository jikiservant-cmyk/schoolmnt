export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  school: {
    Tables: {
      schools: {
        Row: {
          id: string
          name: string
          attendance_mode: 'device' | 'manual' | 'both'
          timezone: string
          settings: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          attendance_mode?: 'device' | 'manual' | 'both'
          timezone?: string
          settings?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          attendance_mode?: 'device' | 'manual' | 'both'
          timezone?: string
          settings?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      academic_years: {
        Row: {
          id: string
          school_id: string
          name: string
          starts_at: string | null
          ends_at: string | null
          is_current: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          starts_at?: string | null
          ends_at?: string | null
          is_current?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          starts_at?: string | null
          ends_at?: string | null
          is_current?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          }
        ]
      }
      classes: {
        Row: {
          id: string
          school_id: string
          academic_year_id: string
          name: string
          teacher_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          academic_year_id: string
          name: string
          teacher_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          academic_year_id?: string
          name?: string
          teacher_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_classes_teacher"
            columns: ["teacher_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      devices: {
        Row: {
          id: string
          school_id: string
          serial_number: string
          label: string | null
          is_active: boolean | null
          firmware_version: string | null
          ip_address: string | null
          last_seen_at: string | null
          last_error: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          serial_number: string
          label?: string | null
          is_active?: boolean | null
          firmware_version?: string | null
          ip_address?: string | null
          last_seen_at?: string | null
          last_error?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          serial_number?: string
          label?: string | null
          is_active?: boolean | null
          firmware_version?: string | null
          ip_address?: string | null
          last_seen_at?: string | null
          last_error?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          }
        ]
      }
      people: {
        Row: {
          id: string
          school_id: string
          device_user_id: string | null
          full_name: string
          role: 'student' | 'teacher' | 'admin'
          class_id: string | null
          phone: string | null
          is_active: boolean | null
          created_by: string | null
          updated_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          device_user_id?: string | null
          full_name: string
          role: 'student' | 'teacher' | 'admin'
          class_id?: string | null
          phone?: string | null
          is_active?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          device_user_id?: string | null
          full_name?: string
          role?: 'student' | 'teacher' | 'admin'
          class_id?: string | null
          phone?: string | null
          is_active?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_people_created_by"
            columns: ["created_by"]
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_people_updated_by"
            columns: ["updated_by"]
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          }
        ]
      }
      staff_users: {
        Row: {
          id: string
          person_id: string
          auth_user_id: string | null
          staff_role: 'school_admin' | 'teacher'
          manual_link_token: string | null
          manual_link_token_expires_at: string | null
          pin_hash: string | null
          pin_failed_attempts: number | null
          pin_locked_until: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          person_id: string
          auth_user_id?: string | null
          staff_role: 'school_admin' | 'teacher'
          manual_link_token?: string | null
          manual_link_token_expires_at?: string | null
          pin_hash?: string | null
          pin_failed_attempts?: number | null
          pin_locked_until?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          person_id?: string
          auth_user_id?: string | null
          staff_role?: 'school_admin' | 'teacher'
          manual_link_token?: string | null
          manual_link_token_expires_at?: string | null
          pin_hash?: string | null
          pin_failed_attempts?: number | null
          pin_locked_until?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      teacher_classes: {
        Row: {
          staff_user_id: string
          class_id: string
        }
        Insert: {
          staff_user_id: string
          class_id: string
        }
        Update: {
          staff_user_id?: string
          class_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_staff_user_id_fkey"
            columns: ["staff_user_id"]
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          }
        ]
      }
      parents: {
        Row: {
          id: string
          school_id: string
          full_name: string | null
          phone: string
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          full_name?: string | null
          phone: string
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          full_name?: string | null
          phone?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          }
        ]
      }
      student_parents: {
        Row: {
          student_id: string
          parent_id: string
          relationship: string | null
          is_primary_contact: boolean | null
        }
        Insert: {
          student_id: string
          parent_id: string
          relationship?: string | null
          is_primary_contact?: boolean | null
        }
        Update: {
          student_id?: string
          parent_id?: string
          relationship?: string | null
          is_primary_contact?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      device_logs: {
        Row: {
          id: string
          device_id: string | null
          raw_serial_number: string
          device_user_id: string | null
          event_timestamp: string | null
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          received_at: string | null
        }
        Insert: {
          id?: string
          device_id?: string | null
          raw_serial_number: string
          device_user_id?: string | null
          event_timestamp?: string | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string | null
          raw_serial_number?: string
          device_user_id?: string | null
          event_timestamp?: string | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_logs_device_id_fkey"
            columns: ["device_id"]
            referencedRelation: "devices"
            referencedColumns: ["id"]
          }
        ]
      }
      attendance_logs: {
        Row: {
          id: string
          school_id: string
          person_id: string
          source: 'device' | 'manual'
          device_id: string | null
          device_log_id: string | null
          marked_by: string | null
          status: 'present' | 'late' | 'absent' | 'excused' | 'sick' | 'holiday'
          attendance_type: 'check_in' | 'check_out'
          class_id_at_time: string | null
          class_name_at_time: string | null
          occurred_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          person_id: string
          source: 'device' | 'manual'
          device_id?: string | null
          device_log_id?: string | null
          marked_by?: string | null
          status?: 'present' | 'late' | 'absent' | 'excused' | 'sick' | 'holiday'
          attendance_type?: 'check_in' | 'check_out'
          class_id_at_time?: string | null
          class_name_at_time?: string | null
          occurred_at?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          person_id?: string
          source?: 'device' | 'manual'
          device_id?: string | null
          device_log_id?: string | null
          marked_by?: string | null
          status?: 'present' | 'late' | 'absent' | 'excused' | 'sick' | 'holiday'
          attendance_type?: 'check_in' | 'check_out'
          class_id_at_time?: string | null
          class_name_at_time?: string | null
          occurred_at?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_class_id_at_time_fkey"
            columns: ["class_id_at_time"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_device_id_fkey"
            columns: ["device_id"]
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_device_log_id_fkey"
            columns: ["device_log_id"]
            referencedRelation: "device_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_marked_by_fkey"
            columns: ["marked_by"]
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          school_id: string
          recipient_type: 'parent' | 'teacher' | 'staff'
          recipient_id: string
          recipient_phone_snapshot: string | null
          channel: 'sms' | 'whatsapp' | 'email'
          notification_type: string
          related_table: string | null
          related_id: string | null
          message: string
          status: 'pending' | 'sent' | 'failed'
          provider_response: string | null
          error: string | null
          retry_count: number
          next_retry_at: string | null
          created_at: string | null
          sent_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          recipient_type: 'parent' | 'teacher' | 'staff'
          recipient_id: string
          recipient_phone_snapshot?: string | null
          channel?: 'sms' | 'whatsapp' | 'email'
          notification_type?: string
          related_table?: string | null
          related_id?: string | null
          message: string
          status?: 'pending' | 'sent' | 'failed'
          provider_response?: string | null
          error?: string | null
          retry_count?: number
          next_retry_at?: string | null
          created_at?: string | null
          sent_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          recipient_type?: 'parent' | 'teacher' | 'staff'
          recipient_id?: string
          recipient_phone_snapshot?: string | null
          channel?: 'sms' | 'whatsapp' | 'email'
          notification_type?: string
          related_table?: string | null
          related_id?: string | null
          message?: string
          status?: 'pending' | 'sent' | 'failed'
          provider_response?: string | null
          error?: string | null
          retry_count?: number
          next_retry_at?: string | null
          created_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      today_attendance_summary: {
        Row: {
          school_id: string | null
          role: 'student' | 'teacher' | 'admin' | null
          present_count: number | null
          total_marked: number | null
        }
        Relationships: [
          {
            foreignKeyName: "today_attendance_summary_school_id_fkey"
            columns: ["school_id"]
            referencedRelation: "schools"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      auth_school_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_school_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      fn_check_pin_attempt: {
        Args: {
          p_staff_user_id: string
        }
        Returns: undefined
      }
      fn_register_pin_failure: {
        Args: {
          p_staff_user_id: string
        }
        Returns: undefined
      }
      fn_register_pin_success: {
        Args: {
          p_staff_user_id: string
        }
        Returns: undefined
      }
      fn_validate_manual_link_token: {
        Args: {
          p_token: string
        }
        Returns: Database["school"]["Tables"]["staff_users"]["Row"][]
      }
      fn_issue_manual_link_token: {
        Args: {
          p_staff_user_id: string
        }
        Returns: string
      }
      fn_device_belongs_to_school: {
        Args: {
          p_device_id: string
          p_school_id: string
        }
        Returns: boolean
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
