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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          uf: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          uf: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city_id: string | null
          clinic_name: string | null
          contractor_name: string | null
          created_at: string
          credit_limit: number | null
          dentist_name: string
          document: string | null
          email: string | null
          id: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          clinic_name?: string | null
          contractor_name?: string | null
          created_at?: string
          credit_limit?: number | null
          dentist_name: string
          document?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city_id?: string | null
          clinic_name?: string | null
          contractor_name?: string | null
          created_at?: string
          credit_limit?: number | null
          dentist_name?: string
          document?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      dentists: {
        Row: {
          active: boolean
          address: string | null
          bank: string | null
          city_id: string | null
          clinic_name: string | null
          commission_pct: number
          created_at: string
          cro: string | null
          document: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string
          payment_per_service: number
          phone: string | null
          pix_key: string | null
          specialty: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          bank?: string | null
          city_id?: string | null
          clinic_name?: string | null
          commission_pct?: number
          created_at?: string
          cro?: string | null
          document?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id: string
          payment_per_service?: number
          phone?: string | null
          pix_key?: string | null
          specialty?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          bank?: string | null
          city_id?: string | null
          clinic_name?: string | null
          commission_pct?: number
          created_at?: string
          cro?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string
          payment_per_service?: number
          phone?: string | null
          pix_key?: string | null
          specialty?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          city_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["fin_kind"]
          name: string
          owner_id: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["fin_kind"]
          name: string
          owner_id: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["fin_kind"]
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount: number
          attachment_path: string | null
          category_id: string | null
          city_id: string | null
          client_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          kind: Database["public"]["Enums"]["fin_kind"]
          os_id: string | null
          owner_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["fin_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          attachment_path?: string | null
          category_id?: string | null
          city_id?: string | null
          client_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          kind: Database["public"]["Enums"]["fin_kind"]
          os_id?: string | null
          owner_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["fin_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          category_id?: string | null
          city_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["fin_kind"]
          os_id?: string | null
          owner_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["fin_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          city_id: string | null
          created_at: string
          event_type: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      os_expenses: {
        Row: {
          amount: number
          city_id: string | null
          created_at: string
          description: string
          id: string
          os_id: string
          owner_id: string
        }
        Insert: {
          amount?: number
          city_id?: string | null
          created_at?: string
          description: string
          id?: string
          os_id: string
          owner_id: string
        }
        Update: {
          amount?: number
          city_id?: string | null
          created_at?: string
          description?: string
          id?: string
          os_id?: string
          owner_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          city_id: string | null
          created_at: string
          document: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          city_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          city_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          city_id: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          active?: boolean
          city_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          active?: boolean
          city_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      prosthesis_types: {
        Row: {
          avg_days: number | null
          city_id: string | null
          created_at: string
          default_commission_pct: number | null
          default_cost: number | null
          default_price: number | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          avg_days?: number | null
          city_id?: string | null
          created_at?: string
          default_commission_pct?: number | null
          default_cost?: number | null
          default_price?: number | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          avg_days?: number | null
          city_id?: string | null
          created_at?: string
          default_commission_pct?: number | null
          default_cost?: number | null
          default_price?: number | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      service_order_history: {
        Row: {
          action: string
          city_id: string | null
          created_at: string
          id: string
          note: string | null
          os_id: string
          owner_id: string
        }
        Insert: {
          action: string
          city_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          os_id: string
          owner_id: string
        }
        Update: {
          action?: string
          city_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          os_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_history_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_patients: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          os_id: string
          patient_id: string
          service_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          os_id: string
          patient_id: string
          service_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          os_id?: string
          patient_id?: string
          service_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_patients_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_photos: {
        Row: {
          city_id: string | null
          created_at: string
          id: string
          os_id: string
          owner_id: string
          path: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: string
          os_id: string
          owner_id: string
          path: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: string
          os_id?: string
          owner_id?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_photos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          acrylization_date: string | null
          city_id: string | null
          client_id: string | null
          code: string
          contractor_name: string | null
          cost: number
          created_at: string
          delivered_at: string | null
          dentist_name: string | null
          expected_at: string | null
          health_unit: string | null
          id: string
          molding_date: string | null
          notes: string | null
          owner_id: string
          patient_name: string
          price: number
          prosthesis_type_id: string | null
          sent_at: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["os_status"]
          technician_id: string | null
          teeth_setup_date: string | null
          updated_at: string
          wax_plan_date: string | null
        }
        Insert: {
          acrylization_date?: string | null
          city_id?: string | null
          client_id?: string | null
          code: string
          contractor_name?: string | null
          cost?: number
          created_at?: string
          delivered_at?: string | null
          dentist_name?: string | null
          expected_at?: string | null
          health_unit?: string | null
          id?: string
          molding_date?: string | null
          notes?: string | null
          owner_id: string
          patient_name: string
          price?: number
          prosthesis_type_id?: string | null
          sent_at?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          technician_id?: string | null
          teeth_setup_date?: string | null
          updated_at?: string
          wax_plan_date?: string | null
        }
        Update: {
          acrylization_date?: string | null
          city_id?: string | null
          client_id?: string | null
          code?: string
          contractor_name?: string | null
          cost?: number
          created_at?: string
          delivered_at?: string | null
          dentist_name?: string | null
          expected_at?: string | null
          health_unit?: string | null
          id?: string
          molding_date?: string | null
          notes?: string | null
          owner_id?: string
          patient_name?: string
          price?: number
          prosthesis_type_id?: string | null
          sent_at?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          technician_id?: string | null
          teeth_setup_date?: string | null
          updated_at?: string
          wax_plan_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_prosthesis_type_id_fkey"
            columns: ["prosthesis_type_id"]
            isOneToOne: false
            referencedRelation: "prosthesis_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          category: string | null
          city_id: string | null
          contact_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          products: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          category?: string | null
          city_id?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          products?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          category?: string | null
          city_id?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          products?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      technicians: {
        Row: {
          active: boolean
          bank: string | null
          city_id: string | null
          commission_pct: number | null
          created_at: string
          document: string | null
          full_name: string
          id: string
          owner_id: string
          phone: string | null
          pix_key: string | null
          services: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          bank?: string | null
          city_id?: string | null
          commission_pct?: number | null
          created_at?: string
          document?: string | null
          full_name: string
          id?: string
          owner_id: string
          phone?: string | null
          pix_key?: string | null
          services?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          bank?: string | null
          city_id?: string | null
          commission_pct?: number | null
          created_at?: string
          document?: string | null
          full_name?: string
          id?: string
          owner_id?: string
          phone?: string | null
          pix_key?: string | null
          services?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ubs_bulletin_patients: {
        Row: {
          address: string | null
          age: number | null
          birth_date: string | null
          bulletin_id: string
          cns: string | null
          created_at: string
          id: string
          owner_id: string
          patient_name: string
          position: number
          sex: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          birth_date?: string | null
          bulletin_id: string
          cns?: string | null
          created_at?: string
          id?: string
          owner_id: string
          patient_name: string
          position?: number
          sex?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          birth_date?: string | null
          bulletin_id?: string
          cns?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          patient_name?: string
          position?: number
          sex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ubs_bulletin_patients_bulletin_id_fkey"
            columns: ["bulletin_id"]
            isOneToOne: false
            referencedRelation: "ubs_bulletins"
            referencedColumns: ["id"]
          },
        ]
      }
      ubs_bulletins: {
        Row: {
          bulletin_date: string
          created_at: string
          health_unit: string
          id: string
          notes: string | null
          owner_id: string
          professional_name: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          bulletin_date?: string
          created_at?: string
          health_unit: string
          id?: string
          notes?: string | null
          owner_id: string
          professional_name: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          bulletin_date?: string
          created_at?: string
          health_unit?: string
          id?: string
          notes?: string | null
          owner_id?: string
          professional_name?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
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
      can_access_city: { Args: { _city_id: string }; Returns: boolean }
      get_user_city_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      fin_kind: "income" | "expense"
      fin_status: "pending" | "paid"
      os_status: "pending" | "in_progress" | "delivered" | "cancelled"
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
      app_role: ["admin", "user"],
      fin_kind: ["income", "expense"],
      fin_status: ["pending", "paid"],
      os_status: ["pending", "in_progress", "delivered", "cancelled"],
    },
  },
} as const
