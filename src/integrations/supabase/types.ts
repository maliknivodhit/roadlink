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
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          body: string | null
          category: Database["public"]["Enums"]["alert_category"]
          company_id: string
          context: Json | null
          created_at: string
          driver_id: string | null
          id: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          vehicle_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          category: Database["public"]["Enums"]["alert_category"]
          company_id: string
          context?: Json | null
          created_at?: string
          driver_id?: string | null
          id?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          vehicle_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          category?: Database["public"]["Enums"]["alert_category"]
          company_id?: string
          context?: Json | null
          created_at?: string
          driver_id?: string | null
          id?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: Json | null
          created_at: string
          default_hos_cycle: Database["public"]["Enums"]["hos_cycle"]
          dot_number: string | null
          id: string
          mc_number: string | null
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          default_hos_cycle?: Database["public"]["Enums"]["hos_cycle"]
          dot_number?: string | null
          id?: string
          mc_number?: string | null
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          default_hos_cycle?: Database["public"]["Enums"]["hos_cycle"]
          dot_number?: string | null
          id?: string
          mc_number?: string | null
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      dot_inspection_transfers: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string
          end_date: string
          id: string
          output_comment: string | null
          output_file_format: string
          output_file_url: string | null
          recipient: string | null
          start_date: string
          status: string
          transfer_method: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_id: string
          end_date: string
          id?: string
          output_comment?: string | null
          output_file_format?: string
          output_file_url?: string | null
          recipient?: string | null
          start_date: string
          status?: string
          transfer_method: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string
          end_date?: string
          id?: string
          output_comment?: string | null
          output_file_format?: string
          output_file_url?: string | null
          recipient?: string | null
          start_date?: string
          status?: string
          transfer_method?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dot_inspection_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dot_inspection_transfers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dot_inspection_transfers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          cdl_class: string | null
          cdl_expires: string | null
          cdl_number: string | null
          cdl_state: string | null
          company_id: string
          created_at: string
          current_duty_status: Database["public"]["Enums"]["duty_status"]
          current_vehicle_id: string | null
          employee_id: string | null
          exempt_driver: boolean
          home_terminal_timezone: string
          hos_cycle: Database["public"]["Enums"]["hos_cycle"]
          id: string
          medical_card_expires: string | null
          updated_at: string
        }
        Insert: {
          cdl_class?: string | null
          cdl_expires?: string | null
          cdl_number?: string | null
          cdl_state?: string | null
          company_id: string
          created_at?: string
          current_duty_status?: Database["public"]["Enums"]["duty_status"]
          current_vehicle_id?: string | null
          employee_id?: string | null
          exempt_driver?: boolean
          home_terminal_timezone?: string
          hos_cycle?: Database["public"]["Enums"]["hos_cycle"]
          id: string
          medical_card_expires?: string | null
          updated_at?: string
        }
        Update: {
          cdl_class?: string | null
          cdl_expires?: string | null
          cdl_number?: string | null
          cdl_state?: string | null
          company_id?: string
          created_at?: string
          current_duty_status?: Database["public"]["Enums"]["duty_status"]
          current_vehicle_id?: string | null
          employee_id?: string | null
          exempt_driver?: boolean
          home_terminal_timezone?: string
          hos_cycle?: Database["public"]["Enums"]["hos_cycle"]
          id?: string
          medical_card_expires?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_current_vehicle_id_fkey"
            columns: ["current_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dvir_defects: {
        Row: {
          company_id: string
          component: string
          created_at: string
          description: string
          id: string
          photo_urls: string[] | null
          repair_notes: string | null
          repaired_at: string | null
          repaired_by: string | null
          report_id: string
          severity: Database["public"]["Enums"]["dvir_severity"]
          status: Database["public"]["Enums"]["dvir_status"]
        }
        Insert: {
          company_id: string
          component: string
          created_at?: string
          description: string
          id?: string
          photo_urls?: string[] | null
          repair_notes?: string | null
          repaired_at?: string | null
          repaired_by?: string | null
          report_id: string
          severity?: Database["public"]["Enums"]["dvir_severity"]
          status?: Database["public"]["Enums"]["dvir_status"]
        }
        Update: {
          company_id?: string
          component?: string
          created_at?: string
          description?: string
          id?: string
          photo_urls?: string[] | null
          repair_notes?: string | null
          repaired_at?: string | null
          repaired_by?: string | null
          report_id?: string
          severity?: Database["public"]["Enums"]["dvir_severity"]
          status?: Database["public"]["Enums"]["dvir_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dvir_defects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dvir_defects_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "dvir_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      dvir_reports: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string
          id: string
          inspected_at: string
          inspection_type: Database["public"]["Enums"]["dvir_type"]
          mechanic_signature_url: string | null
          notes: string | null
          odometer_km: number | null
          safe_to_operate: boolean
          signature_url: string | null
          trailer_ids: string[] | null
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_id: string
          id?: string
          inspected_at?: string
          inspection_type: Database["public"]["Enums"]["dvir_type"]
          mechanic_signature_url?: string | null
          notes?: string | null
          odometer_km?: number | null
          safe_to_operate?: boolean
          signature_url?: string | null
          trailer_ids?: string[] | null
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          inspected_at?: string
          inspection_type?: Database["public"]["Enums"]["dvir_type"]
          mechanic_signature_url?: string | null
          notes?: string | null
          odometer_km?: number | null
          safe_to_operate?: boolean
          signature_url?: string | null
          trailer_ids?: string[] | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dvir_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dvir_reports_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dvir_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      eld_devices: {
        Row: {
          company_id: string
          created_at: string
          firmware_version: string | null
          id: string
          is_online: boolean
          last_seen_at: string | null
          model: string | null
          serial_number: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          firmware_version?: string | null
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          model?: string | null
          serial_number: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          firmware_version?: string | null
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          model?: string | null
          serial_number?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eld_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eld_devices_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofences: {
        Row: {
          alert_on_enter: boolean
          alert_on_exit: boolean
          center_lat: number | null
          center_lng: number | null
          company_id: string
          created_at: string
          id: string
          name: string
          polygon: Json | null
          radius_m: number | null
          shape_type: string
        }
        Insert: {
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          center_lat?: number | null
          center_lng?: number | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          polygon?: Json | null
          radius_m?: number | null
          shape_type?: string
        }
        Update: {
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          center_lat?: number | null
          center_lng?: number | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          polygon?: Json | null
          radius_m?: number | null
          shape_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_pings: {
        Row: {
          company_id: string
          driver_id: string | null
          engine_on: boolean | null
          heading_deg: number | null
          id: number
          ignition: boolean | null
          latitude: number
          longitude: number
          odometer_km: number | null
          recorded_at: string
          speed_kph: number | null
          vehicle_id: string
        }
        Insert: {
          company_id: string
          driver_id?: string | null
          engine_on?: boolean | null
          heading_deg?: number | null
          id?: number
          ignition?: boolean | null
          latitude: number
          longitude: number
          odometer_km?: number | null
          recorded_at: string
          speed_kph?: number | null
          vehicle_id: string
        }
        Update: {
          company_id?: string
          driver_id?: string | null
          engine_on?: boolean | null
          heading_deg?: number | null
          id?: number
          ignition?: boolean | null
          latitude?: number
          longitude?: number
          odometer_km?: number | null
          recorded_at?: string
          speed_kph?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_pings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_pings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_pings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hos_log_edits: {
        Row: {
          company_id: string
          created_at: string
          driver_response: string | null
          id: string
          original_log_id: string
          proposed_by: string
          proposed_changes: Json
          reason: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_response?: string | null
          id?: string
          original_log_id: string
          proposed_by: string
          proposed_changes: Json
          reason: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_response?: string | null
          id?: string
          original_log_id?: string
          proposed_by?: string
          proposed_changes?: Json
          reason?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hos_log_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hos_log_edits_original_log_id_fkey"
            columns: ["original_log_id"]
            isOneToOne: false
            referencedRelation: "hos_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      hos_logs: {
        Row: {
          co_driver_id: string | null
          company_id: string
          driver_id: string
          duty_status: Database["public"]["Enums"]["duty_status"]
          engine_hours: number | null
          event_time: string
          id: string
          latitude: number | null
          location_text: string | null
          longitude: number | null
          notes: string | null
          odometer_km: number | null
          origin: Database["public"]["Enums"]["eld_event_origin"]
          recorded_at: string
          sequence_id: number
          shipping_doc: string | null
          trailer_ids: string[] | null
          vehicle_id: string | null
        }
        Insert: {
          co_driver_id?: string | null
          company_id: string
          driver_id: string
          duty_status: Database["public"]["Enums"]["duty_status"]
          engine_hours?: number | null
          event_time: string
          id?: string
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          notes?: string | null
          odometer_km?: number | null
          origin?: Database["public"]["Enums"]["eld_event_origin"]
          recorded_at?: string
          sequence_id?: number
          shipping_doc?: string | null
          trailer_ids?: string[] | null
          vehicle_id?: string | null
        }
        Update: {
          co_driver_id?: string | null
          company_id?: string
          driver_id?: string
          duty_status?: Database["public"]["Enums"]["duty_status"]
          engine_hours?: number | null
          event_time?: string
          id?: string
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          notes?: string | null
          odometer_km?: number | null
          origin?: Database["public"]["Enums"]["eld_event_origin"]
          recorded_at?: string
          sequence_id?: number
          shipping_doc?: string | null
          trailer_ids?: string[] | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hos_logs_co_driver_id_fkey"
            columns: ["co_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hos_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hos_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hos_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ifta_fuel_purchases: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string | null
          gallons: number
          id: string
          jurisdiction: string
          price_per_gallon: number | null
          purchased_at: string
          receipt_url: string | null
          total_amount: number | null
          vehicle_id: string
          vendor: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_id?: string | null
          gallons: number
          id?: string
          jurisdiction: string
          price_per_gallon?: number | null
          purchased_at: string
          receipt_url?: string | null
          total_amount?: number | null
          vehicle_id: string
          vendor?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string | null
          gallons?: number
          id?: string
          jurisdiction?: string
          price_per_gallon?: number | null
          purchased_at?: string
          receipt_url?: string | null
          total_amount?: number | null
          vehicle_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ifta_fuel_purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifta_fuel_purchases_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifta_fuel_purchases_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ifta_trip_miles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          jurisdiction: string
          miles: number
          taxable_miles: number | null
          trip_date: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          jurisdiction: string
          miles: number
          taxable_miles?: number | null
          trip_date: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          jurisdiction?: string
          miles?: number
          taxable_miles?: number | null
          trip_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ifta_trip_miles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifta_trip_miles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          body: string
          company_id: string
          created_at: string
          from_user_id: string
          id: string
          read_at: string | null
          to_user_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          company_id: string
          created_at?: string
          from_user_id: string
          id?: string
          read_at?: string | null
          to_user_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          company_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          read_at?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_documents: {
        Row: {
          bol_number: string | null
          company_id: string
          created_at: string
          destination: string | null
          driver_id: string
          id: string
          load_description: string | null
          notes: string | null
          shipping_number: string | null
          start_location: string | null
          trailer_number: string | null
          trip_date: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          bol_number?: string | null
          company_id: string
          created_at?: string
          destination?: string | null
          driver_id: string
          id?: string
          load_description?: string | null
          notes?: string | null
          shipping_number?: string | null
          start_location?: string | null
          trailer_number?: string | null
          trip_date?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          bol_number?: string | null
          company_id?: string
          created_at?: string
          destination?: string | null
          driver_id?: string
          id?: string
          load_description?: string | null
          notes?: string | null
          shipping_number?: string | null
          start_location?: string | null
          trailer_number?: string | null
          trip_date?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      unidentified_driving_events: {
        Row: {
          annotated_by: string | null
          annotation: string | null
          claimed_at: string | null
          claimed_by_driver: string | null
          company_id: string
          created_at: string
          distance_km: number | null
          duration_seconds: number | null
          end_location: string | null
          end_time: string | null
          id: string
          start_location: string | null
          start_time: string
          vehicle_id: string
        }
        Insert: {
          annotated_by?: string | null
          annotation?: string | null
          claimed_at?: string | null
          claimed_by_driver?: string | null
          company_id: string
          created_at?: string
          distance_km?: number | null
          duration_seconds?: number | null
          end_location?: string | null
          end_time?: string | null
          id?: string
          start_location?: string | null
          start_time: string
          vehicle_id: string
        }
        Update: {
          annotated_by?: string | null
          annotation?: string | null
          claimed_at?: string | null
          claimed_by_driver?: string | null
          company_id?: string
          created_at?: string
          distance_km?: number | null
          duration_seconds?: number | null
          end_location?: string | null
          end_time?: string | null
          id?: string
          start_location?: string | null
          start_time?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidentified_driving_events_claimed_by_driver_fkey"
            columns: ["claimed_by_driver"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidentified_driving_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidentified_driving_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          company_id: string
          created_at: string
          engine_hours: number | null
          fuel_type: string | null
          id: string
          insurance_expires: string | null
          license_plate: string | null
          license_state: string | null
          make: string | null
          model: string | null
          notes: string | null
          odometer_km: number | null
          registration_expires: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          unit_number: string
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          engine_hours?: number | null
          fuel_type?: string | null
          id?: string
          insurance_expires?: string | null
          license_plate?: string | null
          license_state?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          registration_expires?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          unit_number: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          engine_hours?: number | null
          fuel_type?: string | null
          id?: string
          insurance_expires?: string | null
          license_plate?: string | null
          license_state?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          registration_expires?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          unit_number?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company_for_user: {
        Args: {
          _dot_number?: string
          _name: string
          _timezone?: string
          _user_id: string
        }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_manager: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      manager_edit_hos_log: {
        Args: {
          _log_id: string
          _new_duty_status: Database["public"]["Enums"]["duty_status"]
          _new_event_time: string
          _new_notes: string
          _reason: string
        }
        Returns: {
          co_driver_id: string | null
          company_id: string
          driver_id: string
          duty_status: Database["public"]["Enums"]["duty_status"]
          engine_hours: number | null
          event_time: string
          id: string
          latitude: number | null
          location_text: string | null
          longitude: number | null
          notes: string | null
          odometer_km: number | null
          origin: Database["public"]["Enums"]["eld_event_origin"]
          recorded_at: string
          sequence_id: number
          shipping_doc: string | null
          trailer_ids: string[] | null
          vehicle_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "hos_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      alert_category:
        | "hos_violation"
        | "speeding"
        | "geofence"
        | "dvir_defect"
        | "idle"
        | "unidentified_driving"
        | "device_offline"
        | "document_expiring"
        | "harsh_event"
        | "other"
      alert_severity: "info" | "warning" | "critical"
      app_role:
        | "super_admin"
        | "fleet_admin"
        | "dispatcher"
        | "compliance_officer"
        | "driver"
        | "mechanic"
      duty_status:
        | "off_duty"
        | "sleeper_berth"
        | "driving"
        | "on_duty_not_driving"
        | "yard_move"
        | "personal_conveyance"
      dvir_severity: "minor" | "major" | "out_of_service"
      dvir_status: "open" | "in_repair" | "resolved" | "deferred"
      dvir_type: "pre_trip" | "post_trip"
      eld_event_origin:
        | "auto"
        | "driver"
        | "co_driver"
        | "edit_request"
        | "unidentified"
      hos_cycle: "us_70_8" | "us_60_7" | "canada_70_7" | "canada_120_14"
      vehicle_status: "active" | "maintenance" | "out_of_service" | "retired"
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
      alert_category: [
        "hos_violation",
        "speeding",
        "geofence",
        "dvir_defect",
        "idle",
        "unidentified_driving",
        "device_offline",
        "document_expiring",
        "harsh_event",
        "other",
      ],
      alert_severity: ["info", "warning", "critical"],
      app_role: [
        "super_admin",
        "fleet_admin",
        "dispatcher",
        "compliance_officer",
        "driver",
        "mechanic",
      ],
      duty_status: [
        "off_duty",
        "sleeper_berth",
        "driving",
        "on_duty_not_driving",
        "yard_move",
        "personal_conveyance",
      ],
      dvir_severity: ["minor", "major", "out_of_service"],
      dvir_status: ["open", "in_repair", "resolved", "deferred"],
      dvir_type: ["pre_trip", "post_trip"],
      eld_event_origin: [
        "auto",
        "driver",
        "co_driver",
        "edit_request",
        "unidentified",
      ],
      hos_cycle: ["us_70_8", "us_60_7", "canada_70_7", "canada_120_14"],
      vehicle_status: ["active", "maintenance", "out_of_service", "retired"],
    },
  },
} as const
