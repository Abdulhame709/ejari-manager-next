export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      additional_charges: {
        Row: {
          amount: number;
          charge_date: string;
          contract_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_applied: boolean;
          shop_id: string | null;
        };
        Insert: {
          amount: number;
          charge_date?: string;
          contract_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_applied?: boolean;
          shop_id?: string | null;
        };
        Update: {
          amount?: number;
          charge_date?: string;
          contract_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_applied?: boolean;
          shop_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "additional_charges_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "additional_charges_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      account_requests: {
        Row: {
          id: string;
          request_type: "tenant" | "staff";
          auth_user_id: string | null;
          email: string;
          full_name: string;
          phone: string;
          id_number: string | null;
          address: string | null;
          notes: string | null;
          status: "pending" | "approved" | "rejected";
          rejection_reason: string | null;
          customer_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_type?: "tenant" | "staff";
          auth_user_id?: string | null;
          email: string;
          full_name: string;
          phone: string;
          id_number?: string | null;
          address?: string | null;
          notes?: string | null;
          status?: "pending" | "approved" | "rejected";
          rejection_reason?: string | null;
          customer_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_requests"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string | null;
          record_id: string | null;
          old_values: Json | null;
          old_data: Json | null;
          new_values: Json | null;
          new_data: Json | null;
          user_name: string | null;
          action_date: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          table_name?: string | null;
          record_id?: string | null;
          old_values?: Json | null;
          old_data?: Json | null;
          new_values?: Json | null;
          new_data?: Json | null;
          user_name?: string | null;
          action_date?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          id: string;
          bank_name: string;
          account_name: string;
          account_number: string | null;
          iban: string | null;
          wallet_phone: string | null;
          branch: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bank_name: string;
          account_name: string;
          account_number?: string | null;
          iban?: string | null;
          wallet_phone?: string | null;
          branch?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bank_accounts"]["Insert"]>;
        Relationships: [];
      };
      contracts: {
        Row: {
          contract_no: string;
          created_at: string;
          customer_id: string;
          end_date: string;
          holiday_increase: number;
          id: string;
          monthly_rent: number;
          notes: string | null;
          shop_id: string;
          start_date: string;
          status: Database["public"]["Enums"]["contract_status"];
          updated_at: string;
          due_day: number | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          insurance_amount: number | null;
          contract_file_url: string | null;
          renewed_from_id: string | null;
        };
        Insert: {
          contract_no: string;
          created_at?: string;
          customer_id: string;
          end_date: string;
          holiday_increase?: number;
          id?: string;
          monthly_rent: number;
          notes?: string | null;
          shop_id: string;
          start_date: string;
          status?: Database["public"]["Enums"]["contract_status"];
          updated_at?: string;
          due_day?: number | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          insurance_amount?: number | null;
          contract_file_url?: string | null;
          renewed_from_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["contracts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey";
            columns: ["renewed_from_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          id_number: string | null;
          is_active: boolean;
          phone: string;
          updated_at: string;
          activity: string | null;
          documents: Json | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          id_number?: string | null;
          is_active?: boolean;
          phone: string;
          updated_at?: string;
          activity?: string | null;
          documents?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          additional_charges: number;
          additional_charges_desc: string | null;
          contract_id: string;
          created_at: string;
          customer_id: string;
          elec_amount: number;
          elec_consumption: number;
          elec_curr_reading: number;
          elec_prev_reading: number;
          elec_unit_price: number;
          holiday_increase: number;
          id: string;
          invoice_date: string;
          invoice_month: number;
          invoice_no: string;
          invoice_year: number;
          notes: string | null;
          paid_amount: number;
          payment_status: Database["public"]["Enums"]["payment_status"];
          previous_balance: number;
          remaining_amount: number;
          rent_amount: number;
          shop_id: string;
          total_amount: number;
          updated_at: string;
          water_amount: number;
          water_consumption: number;
          water_curr_reading: number;
          water_prev_reading: number;
          water_unit_price: number;
          status: Database["public"]["Enums"]["invoice_status"] | null;
          due_date: string | null;
          tax_amount: number | null;
          discount_amount: number | null;
          invoice_number_serial: number | null;
        };
        Insert: {
          additional_charges?: number;
          additional_charges_desc?: string | null;
          contract_id: string;
          created_at?: string;
          customer_id: string;
          elec_amount?: number;
          elec_consumption?: number;
          elec_curr_reading?: number;
          elec_prev_reading?: number;
          elec_unit_price?: number;
          holiday_increase?: number;
          id?: string;
          invoice_date?: string;
          invoice_month: number;
          invoice_no: string;
          invoice_year: number;
          notes?: string | null;
          paid_amount?: number;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          previous_balance?: number;
          remaining_amount?: number;
          rent_amount?: number;
          shop_id: string;
          total_amount?: number;
          updated_at?: string;
          water_amount?: number;
          water_consumption?: number;
          water_curr_reading?: number;
          water_prev_reading?: number;
          water_unit_price?: number;
          status?: Database["public"]["Enums"]["invoice_status"] | null;
          due_date?: string | null;
          tax_amount?: number | null;
          discount_amount?: number | null;
          invoice_number_serial?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      meter_readings: {
        Row: {
          created_at: string;
          elec_consumption: number | null;
          elec_current_reading: number;
          elec_previous_reading: number;
          id: string;
          notes: string | null;
          reading_date: string;
          reading_month: number;
          reading_year: number;
          shop_id: string;
          water_consumption: number | null;
          water_current_reading: number;
          water_previous_reading: number;
        };
        Insert: {
          created_at?: string;
          elec_consumption?: number | null;
          elec_current_reading?: number;
          elec_previous_reading?: number;
          id?: string;
          notes?: string | null;
          reading_date?: string;
          reading_month: number;
          reading_year: number;
          shop_id: string;
          water_consumption?: number | null;
          water_current_reading?: number;
          water_previous_reading?: number;
        };
        Update: Partial<Database["public"]["Tables"]["meter_readings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "meter_readings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      meter_types: {
        Row: {
          category: Database["public"]["Enums"]["meter_category"];
          fixed_fee_amount: number;
          id: number;
          is_active: boolean;
          is_fixed_fee: boolean;
          price_per_unit: number;
          type_name: string;
        };
        Insert: {
          category: Database["public"]["Enums"]["meter_category"];
          fixed_fee_amount?: number;
          id: number;
          is_active?: boolean;
          is_fixed_fee?: boolean;
          price_per_unit?: number;
          type_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["meter_types"]["Insert"]>;
        Relationships: [];
      };
      payment_requests: {
        Row: {
          id: string;
          tenant_account_id: string | null;
          invoice_id: string | null;
          amount: number;
          method: string | null;
          reference_no: string | null;
          bank_name: string | null;
          receipt_path: string | null;
          attachment_path: string | null;
          status: string | null;
          reviewer_id: string | null;
          notes: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          receipt_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_account_id?: string | null;
          invoice_id?: string | null;
          amount?: number;
          method?: string | null;
          reference_no?: string | null;
          bank_name?: string | null;
          receipt_path?: string | null;
          attachment_path?: string | null;
          status?: string | null;
          reviewer_id?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          receipt_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_requests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_requests_tenant_account_id_fkey";
            columns: ["tenant_account_id"];
            isOneToOne: false;
            referencedRelation: "tenant_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_requests_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_requests_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_requests_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_request_invoices: {
        Row: {
          id: string;
          payment_request_id: string;
          invoice_id: string;
          amount_applied: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_request_id: string;
          invoice_id: string;
          amount_applied?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_request_invoices"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_request_invoices_payment_request_id_fkey";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_request_invoices_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_type: "staff" | "tenant" | "visitor";
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          updated_at: string;
          role_type: string | null;
        };
        Insert: {
          account_type?: "staff" | "tenant" | "visitor";
          avatar_url?: string | null;
          created_at?: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
          role_type?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          city: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          address?: string | null;
          city?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
        Relationships: [];
      };
      receipt_details: {
        Row: { amount_paid: number; id: string; invoice_id: string; receipt_id: string };
        Insert: { amount_paid: number; id?: string; invoice_id: string; receipt_id: string };
        Update: Partial<Database["public"]["Tables"]["receipt_details"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "receipt_details_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_details_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
        ];
      };
      receipts: {
        Row: {
          amount: number;
          bank_name: string | null;
          check_date: string | null;
          check_number: string | null;
          cheque_no: string | null;
          cheque_date: string | null;
          receipt_file_url: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          id: string;
          is_active: boolean;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          receipt_date: string;
          receipt_no: string;
          received_by: string | null;
          transfer_ref: string | null;
          reference_no: string | null;
          status: string | null;
          reversal_of: string | null;
        };
        Insert: {
          amount: number;
          bank_name?: string | null;
          check_date?: string | null;
          check_number?: string | null;
          cheque_no?: string | null;
          cheque_date?: string | null;
          receipt_file_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          receipt_date?: string;
          receipt_no: string;
          received_by?: string | null;
          transfer_ref?: string | null;
          reference_no?: string | null;
          status?: string | null;
          reversal_of?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["receipts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "receipts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_reversal_of_fkey";
            columns: ["reversal_of"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          company_address: string | null;
          company_logo: string | null;
          company_name: string;
          company_phone: string | null;
          currency: string;
          currency_symbol: string;
          elec_price_3phase: number;
          elec_price_normal: number;
          fixed_elec_fee: number;
          fixed_water_fee: number;
          id: number;
          invoice_footer: string | null;
          invoice_subtitle: string | null;
          invoice_title: string;
          updated_at: string;
          water_price_per_unit: number;
        };
        Insert: {
          company_address?: string | null;
          company_logo?: string | null;
          company_name?: string;
          company_phone?: string | null;
          currency?: string;
          currency_symbol?: string;
          elec_price_3phase?: number;
          elec_price_normal?: number;
          fixed_elec_fee?: number;
          fixed_water_fee?: number;
          id?: number;
          invoice_footer?: string | null;
          invoice_subtitle?: string | null;
          invoice_title?: string;
          updated_at?: string;
          water_price_per_unit?: number;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
      shops: {
        Row: {
          area: number | null;
          area_sqm: number | null;
          created_at: string;
          description: string | null;
          elec_meter_no: string | null;
          elec_meter_type: number;
          fixed_elec_amount: number;
          fixed_water_amount: number;
          id: string;
          is_active: boolean;
          shop_code: string;
          shop_name: string;
          updated_at: string;
          water_meter_no: string | null;
          water_meter_type: number;
          property_id: string | null;
          unit_type: Database["public"]["Enums"]["unit_type"] | null;
          status: Database["public"]["Enums"]["unit_status"] | null;
          floor: number | null;
          location_details: string | null;
          monthly_rent: number | null;
          insurance_amount: number | null;
          is_public: boolean | null;
          market_description: string | null;
          suitable_for: string | null;
          features: Json | null;
        };
        Insert: {
          area?: number | null;
          area_sqm?: number | null;
          created_at?: string;
          description?: string | null;
          elec_meter_no?: string | null;
          elec_meter_type?: number;
          fixed_elec_amount?: number;
          fixed_water_amount?: number;
          id?: string;
          is_active?: boolean;
          shop_code: string;
          shop_name: string;
          updated_at?: string;
          water_meter_no?: string | null;
          water_meter_type?: number;
          property_id?: string | null;
          unit_type?: Database["public"]["Enums"]["unit_type"] | null;
          status?: Database["public"]["Enums"]["unit_status"] | null;
          floor?: number | null;
          location_details?: string | null;
          monthly_rent?: number | null;
          insurance_amount?: number | null;
          is_public?: boolean | null;
          market_description?: string | null;
          suitable_for?: string | null;
          features?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["shops"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shops_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_accounts: {
        Row: {
          id: string;
          user_id: string | null;
          customer_id: string | null;
          created_at: string;
          is_active: boolean | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          customer_id?: string | null;
          created_at?: string;
          is_active?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["tenant_accounts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tenant_accounts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_accounts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: true;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      unit_images: {
        Row: {
          id: string;
          shop_id: string;
          storage_path: string;
          display_order: number;
          is_cover: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          storage_path: string;
          display_order?: number;
          is_cover?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["unit_images"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "unit_images_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      viewing_requests: {
        Row: {
          id: string;
          shop_id: string;
          visitor_name: string;
          visitor_phone: string;
          visitor_email: string | null;
          preferred_date: string | null;
          notes: string | null;
          status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          visitor_name: string;
          visitor_phone: string;
          visitor_email?: string | null;
          preferred_date?: string | null;
          notes?: string | null;
          status?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["viewing_requests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "viewing_requests_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      approve_payment_request: {
        Args: { p_payment_request_id: string };
        Returns: string;
      };
      approve_staff_account_request: {
        Args: { p_request_id: string };
        Returns: Json;
      };
      approve_tenant_account_request: {
        Args: { p_request_id: string };
        Returns: Json;
      };
      reject_account_request: {
        Args: { p_rejection_reason?: string | null; p_request_id: string };
        Returns: undefined;
      };
      reject_tenant_account_request: {
        Args: { p_rejection_reason?: string | null; p_request_id: string };
        Returns: undefined;
      };
      submit_staff_account_request: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_notes?: string | null;
          p_phone: string;
        };
        Returns: string;
      };
      submit_tenant_account_request: {
        Args: {
          p_address?: string | null;
          p_email: string;
          p_full_name: string;
          p_id_number?: string | null;
          p_notes?: string | null;
          p_phone: string;
        };
        Returns: string;
      };
      record_last_login: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      reject_payment_request: {
        Args: { p_payment_request_id: string; p_rejection_reason?: string | null };
        Returns: undefined;
      };
      can_delete: { Args: { _user_id: string }; Returns: boolean };
      can_manage: { Args: { _user_id: string }; Returns: boolean };
      get_user_role: {
        Args: { _user_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string };
        Returns: boolean;
      };
      current_tenant_customer_id: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: {
      app_role: "admin" | "manager" | "accountant" | "data_entry" | "viewer";
      contract_status: "active" | "expired" | "cancelled" | "draft" | "renewed";
      meter_category: "electricity" | "water";
      payment_method: "cash" | "check" | "transfer" | "deposit" | "wallet";
      payment_status: "unpaid" | "paid" | "partial";
      invoice_status: "draft" | "issued" | "partial" | "paid" | "overdue" | "cancelled";
      unit_type: "shop" | "apartment" | "office" | "warehouse" | "land" | "clinic" | "other";
      unit_status: "available" | "rented" | "reserved" | "maintenance" | "inactive";
      payment_request_status: "pending_review" | "approved" | "rejected" | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "accountant", "data_entry", "viewer"],
      contract_status: ["active", "expired", "cancelled", "draft", "renewed"],
      meter_category: ["electricity", "water"],
      payment_method: ["cash", "check", "transfer", "deposit", "wallet"],
      payment_status: ["unpaid", "paid", "partial"],
      invoice_status: ["draft", "issued", "partial", "paid", "overdue", "cancelled"],
      unit_type: ["shop", "apartment", "office", "warehouse", "land", "clinic", "other"],
      unit_status: ["available", "rented", "reserved", "maintenance", "inactive"],
      payment_request_status: ["pending_review", "approved", "rejected", "cancelled"],
    },
  },
} as const;
