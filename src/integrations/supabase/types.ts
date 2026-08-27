export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: {
    Tables: {
      account_requests: {
        Row: {
          address: string | null;
          auth_user_id: string | null;
          created_at: string;
          customer_id: string | null;
          email: string;
          full_name: string;
          id: string;
          id_number: string | null;
          notes: string | null;
          phone: string;
          rejection_reason: string | null;
          request_type: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email: string;
          full_name: string;
          id?: string;
          id_number?: string | null;
          notes?: string | null;
          phone: string;
          rejection_reason?: string | null;
          request_type?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          id_number?: string | null;
          notes?: string | null;
          phone?: string;
          rejection_reason?: string | null;
          request_type?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_requests_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
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
      audit_log: {
        Row: {
          action: string;
          action_date: string;
          created_at: string;
          id: string;
          new_data: Json | null;
          new_values: Json | null;
          old_data: Json | null;
          old_values: Json | null;
          record_id: string | null;
          table_name: string;
          user_id: string | null;
          user_name: string | null;
        };
        Insert: {
          action: string;
          action_date?: string;
          created_at?: string;
          id?: string;
          new_data?: Json | null;
          new_values?: Json | null;
          old_data?: Json | null;
          old_values?: Json | null;
          record_id?: string | null;
          table_name: string;
          user_id?: string | null;
          user_name?: string | null;
        };
        Update: {
          action?: string;
          action_date?: string;
          created_at?: string;
          id?: string;
          new_data?: Json | null;
          new_values?: Json | null;
          old_data?: Json | null;
          old_values?: Json | null;
          record_id?: string | null;
          table_name?: string;
          user_id?: string | null;
          user_name?: string | null;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          account_name: string;
          account_number: string | null;
          bank_name: string;
          branch: string | null;
          created_at: string;
          display_order: number;
          iban: string | null;
          id: string;
          is_active: boolean;
          updated_at: string;
          wallet_phone: string | null;
        };
        Insert: {
          account_name: string;
          account_number?: string | null;
          bank_name: string;
          branch?: string | null;
          created_at?: string;
          display_order?: number;
          iban?: string | null;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          wallet_phone?: string | null;
        };
        Update: {
          account_name?: string;
          account_number?: string | null;
          bank_name?: string;
          branch?: string | null;
          created_at?: string;
          display_order?: number;
          iban?: string | null;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          wallet_phone?: string | null;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          contract_file_url: string | null;
          contract_no: string;
          created_at: string;
          customer_id: string;
          due_day: number | null;
          end_date: string;
          holiday_increase: number;
          id: string;
          insurance_amount: number;
          monthly_rent: number;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          renewed_from_id: string | null;
          shop_id: string;
          start_date: string;
          status: Database["public"]["Enums"]["contract_status"];
          updated_at: string;
        };
        Insert: {
          contract_file_url?: string | null;
          contract_no: string;
          created_at?: string;
          customer_id: string;
          due_day?: number | null;
          end_date: string;
          holiday_increase?: number;
          id?: string;
          insurance_amount?: number;
          monthly_rent: number;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          renewed_from_id?: string | null;
          shop_id: string;
          start_date: string;
          status?: Database["public"]["Enums"]["contract_status"];
          updated_at?: string;
        };
        Update: {
          contract_file_url?: string | null;
          contract_no?: string;
          created_at?: string;
          customer_id?: string;
          due_day?: number | null;
          end_date?: string;
          holiday_increase?: number;
          id?: string;
          insurance_amount?: number;
          monthly_rent?: number;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          renewed_from_id?: string | null;
          shop_id?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["contract_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey";
            columns: ["renewed_from_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          activity: string | null;
          address: string | null;
          created_at: string;
          documents: Json | null;
          email: string | null;
          full_name: string;
          id: string;
          id_number: string | null;
          is_active: boolean;
          phone: string;
          updated_at: string;
        };
        Insert: {
          activity?: string | null;
          address?: string | null;
          created_at?: string;
          documents?: Json | null;
          email?: string | null;
          full_name: string;
          id?: string;
          id_number?: string | null;
          is_active?: boolean;
          phone: string;
          updated_at?: string;
        };
        Update: {
          activity?: string | null;
          address?: string | null;
          created_at?: string;
          documents?: Json | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          id_number?: string | null;
          is_active?: boolean;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          additional_charges: number;
          additional_charges_desc: string | null;
          contract_id: string | null;
          created_at: string;
          customer_id: string;
          discount_amount: number;
          due_date: string | null;
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
          status: Database["public"]["Enums"]["invoice_status"];
          tax_amount: number;
          total_amount: number;
          updated_at: string;
          water_amount: number;
          water_consumption: number;
          water_curr_reading: number;
          water_prev_reading: number;
          water_unit_price: number;
        };
        Insert: {
          additional_charges?: number;
          additional_charges_desc?: string | null;
          contract_id?: string | null;
          created_at?: string;
          customer_id: string;
          discount_amount?: number;
          due_date?: string | null;
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
          status?: Database["public"]["Enums"]["invoice_status"];
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string;
          water_amount?: number;
          water_consumption?: number;
          water_curr_reading?: number;
          water_prev_reading?: number;
          water_unit_price?: number;
        };
        Update: {
          additional_charges?: number;
          additional_charges_desc?: string | null;
          contract_id?: string | null;
          created_at?: string;
          customer_id?: string;
          discount_amount?: number;
          due_date?: string | null;
          elec_amount?: number;
          elec_consumption?: number;
          elec_curr_reading?: number;
          elec_prev_reading?: number;
          elec_unit_price?: number;
          holiday_increase?: number;
          id?: string;
          invoice_date?: string;
          invoice_month?: number;
          invoice_no?: string;
          invoice_year?: number;
          notes?: string | null;
          paid_amount?: number;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          previous_balance?: number;
          remaining_amount?: number;
          rent_amount?: number;
          shop_id?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string;
          water_amount?: number;
          water_consumption?: number;
          water_curr_reading?: number;
          water_prev_reading?: number;
          water_unit_price?: number;
        };
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
        Update: {
          created_at?: string;
          elec_consumption?: number | null;
          elec_current_reading?: number;
          elec_previous_reading?: number;
          id?: string;
          notes?: string | null;
          reading_date?: string;
          reading_month?: number;
          reading_year?: number;
          shop_id?: string;
          water_consumption?: number | null;
          water_current_reading?: number;
          water_previous_reading?: number;
        };
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
        Update: {
          category?: Database["public"]["Enums"]["meter_category"];
          fixed_fee_amount?: number;
          id?: number;
          is_active?: boolean;
          is_fixed_fee?: boolean;
          price_per_unit?: number;
          type_name?: string;
        };
        Relationships: [];
      };
      payment_request_invoices: {
        Row: {
          amount_applied: number;
          created_at: string;
          id: string;
          invoice_id: string;
          payment_request_id: string;
        };
        Insert: {
          amount_applied?: number;
          created_at?: string;
          id?: string;
          invoice_id: string;
          payment_request_id: string;
        };
        Update: {
          amount_applied?: number;
          created_at?: string;
          id?: string;
          invoice_id?: string;
          payment_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_request_invoices_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_request_invoices_payment_request_id_fkey";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_requests: {
        Row: {
          amount: number;
          attachment_path: string | null;
          bank_name: string | null;
          created_at: string;
          id: string;
          invoice_id: string | null;
          method: string;
          notes: string | null;
          receipt_id: string | null;
          reference_no: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: Database["public"]["Enums"]["payment_request_status"];
          tenant_account_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          attachment_path?: string | null;
          bank_name?: string | null;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          method?: string;
          notes?: string | null;
          receipt_id?: string | null;
          reference_no?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["payment_request_status"];
          tenant_account_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          attachment_path?: string | null;
          bank_name?: string | null;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          method?: string;
          notes?: string | null;
          receipt_id?: string | null;
          reference_no?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["payment_request_status"];
          tenant_account_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_requests_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_type: string;
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          last_login_at: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          account_type?: string;
          avatar_url?: string | null;
          created_at?: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          last_login_at?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          account_type?: string;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          last_login_at?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      receipt_details: {
        Row: {
          amount_paid: number;
          id: string;
          invoice_id: string;
          receipt_id: string;
        };
        Insert: {
          amount_paid: number;
          id?: string;
          invoice_id: string;
          receipt_id: string;
        };
        Update: {
          amount_paid?: number;
          id?: string;
          invoice_id?: string;
          receipt_id?: string;
        };
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
          cheque_date: string | null;
          cheque_no: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          id: string;
          is_active: boolean;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          receipt_date: string;
          receipt_file_url: string | null;
          receipt_no: string;
          received_by: string | null;
          reference_no: string | null;
          reversal_of: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          bank_name?: string | null;
          check_date?: string | null;
          check_number?: string | null;
          cheque_date?: string | null;
          cheque_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          receipt_date?: string;
          receipt_file_url?: string | null;
          receipt_no: string;
          received_by?: string | null;
          reference_no?: string | null;
          reversal_of?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          bank_name?: string | null;
          check_date?: string | null;
          check_number?: string | null;
          cheque_date?: string | null;
          cheque_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          receipt_date?: string;
          receipt_file_url?: string | null;
          receipt_no?: string;
          received_by?: string | null;
          reference_no?: string | null;
          reversal_of?: string | null;
          status?: string;
        };
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
        Update: {
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
          features: Json | null;
          fixed_elec_amount: number;
          fixed_water_amount: number;
          floor: number | null;
          id: string;
          insurance_amount: number;
          is_active: boolean;
          is_public: boolean;
          location_details: string | null;
          market_description: string | null;
          monthly_rent: number;
          property_id: string | null;
          shop_code: string;
          shop_name: string;
          status: Database["public"]["Enums"]["unit_status"];
          suitable_for: string | null;
          unit_type: Database["public"]["Enums"]["unit_type"];
          updated_at: string;
          water_meter_no: string | null;
          water_meter_type: number;
        };
        Insert: {
          area?: number | null;
          area_sqm?: number | null;
          created_at?: string;
          description?: string | null;
          elec_meter_no?: string | null;
          elec_meter_type?: number;
          features?: Json | null;
          fixed_elec_amount?: number;
          fixed_water_amount?: number;
          floor?: number | null;
          id?: string;
          insurance_amount?: number;
          is_active?: boolean;
          is_public?: boolean;
          location_details?: string | null;
          market_description?: string | null;
          monthly_rent?: number;
          property_id?: string | null;
          shop_code: string;
          shop_name: string;
          status?: Database["public"]["Enums"]["unit_status"];
          suitable_for?: string | null;
          unit_type?: Database["public"]["Enums"]["unit_type"];
          updated_at?: string;
          water_meter_no?: string | null;
          water_meter_type?: number;
        };
        Update: {
          area?: number | null;
          area_sqm?: number | null;
          created_at?: string;
          description?: string | null;
          elec_meter_no?: string | null;
          elec_meter_type?: number;
          features?: Json | null;
          fixed_elec_amount?: number;
          fixed_water_amount?: number;
          floor?: number | null;
          id?: string;
          insurance_amount?: number;
          is_active?: boolean;
          is_public?: boolean;
          location_details?: string | null;
          market_description?: string | null;
          monthly_rent?: number;
          property_id?: string | null;
          shop_code?: string;
          shop_name?: string;
          status?: Database["public"]["Enums"]["unit_status"];
          suitable_for?: string | null;
          unit_type?: Database["public"]["Enums"]["unit_type"];
          updated_at?: string;
          water_meter_no?: string | null;
          water_meter_type?: number;
        };
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
          created_at: string;
          customer_id: string | null;
          id: string;
          is_active: boolean;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          is_active?: boolean;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          is_active?: boolean;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_accounts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      unit_images: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          is_cover: boolean;
          shop_id: string;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_cover?: boolean;
          shop_id: string;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_cover?: boolean;
          shop_id?: string;
          storage_path?: string;
        };
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
      user_permissions: {
        Row: {
          allowed: boolean;
          created_at: string;
          granted_by: string | null;
          permission_key: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allowed?: boolean;
          created_at?: string;
          granted_by?: string | null;
          permission_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allowed?: boolean;
          created_at?: string;
          granted_by?: string | null;
          permission_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
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
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      viewing_requests: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          preferred_date: string | null;
          shop_id: string;
          status: string;
          visitor_email: string | null;
          visitor_name: string;
          visitor_phone: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          preferred_date?: string | null;
          shop_id: string;
          status?: string;
          visitor_email?: string | null;
          visitor_name: string;
          visitor_phone: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          preferred_date?: string | null;
          shop_id?: string;
          status?: string;
          visitor_email?: string | null;
          visitor_name?: string;
          visitor_phone?: string;
        };
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
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_remove_user_access: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      admin_set_user_active: {
        Args: { p_is_active: boolean; p_user_id: string };
        Returns: undefined;
      };
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
      archive_contract: { Args: { p_contract_id: string }; Returns: undefined };
      archive_customer: { Args: { p_customer_id: string }; Returns: undefined };
      archive_shop: { Args: { p_shop_id: string }; Returns: undefined };
      can_delete: { Args: { _user_id: string }; Returns: boolean };
      can_manage: { Args: { _user_id: string }; Returns: boolean };
      generate_monthly_invoices: {
        Args: { p_month: number; p_year: number };
        Returns: Json;
      };
      get_dashboard_stats: {
        Args: { p_month: number; p_year: number };
        Returns: Json;
      };
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
      record_last_login: { Args: never; Returns: undefined };
      reject_account_request: {
        Args: { p_rejection_reason?: string; p_request_id: string };
        Returns: undefined;
      };
      reject_payment_request: {
        Args: { p_payment_request_id: string; p_rejection_reason?: string };
        Returns: undefined;
      };
      reject_tenant_account_request: {
        Args: { p_rejection_reason?: string; p_request_id: string };
        Returns: undefined;
      };
      renew_contract: {
        Args: {
          p_contract_id: string;
          p_contract_no: string;
          p_due_day?: number;
          p_end_date: string;
          p_holiday_increase?: number;
          p_insurance_amount?: number;
          p_monthly_rent: number;
          p_notes?: string;
          p_payment_method?: Database["public"]["Enums"]["payment_method"];
          p_start_date: string;
        };
        Returns: string;
      };
      reverse_receipt: {
        Args: { p_reason?: string; p_receipt_id: string };
        Returns: string;
      };
      submit_staff_account_request: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_notes?: string;
          p_phone: string;
        };
        Returns: string;
      };
      submit_tenant_account_request: {
        Args: {
          p_address?: string;
          p_email: string;
          p_full_name: string;
          p_id_number?: string;
          p_notes?: string;
          p_phone: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "manager" | "accountant" | "data_entry" | "viewer";
      contract_status: "active" | "expired" | "cancelled" | "draft" | "renewed";
      invoice_status: "draft" | "issued" | "partial" | "paid" | "overdue" | "cancelled";
      meter_category: "electricity" | "water";
      payment_method: "cash" | "check" | "transfer" | "deposit" | "wallet" | "cheque";
      payment_request_status: "pending_review" | "approved" | "rejected" | "cancelled";
      payment_status: "unpaid" | "paid" | "partial";
      unit_status: "available" | "rented" | "reserved" | "maintenance" | "inactive";
      unit_type: "shop" | "apartment" | "office" | "warehouse" | "land" | "clinic" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "accountant", "data_entry", "viewer"],
      contract_status: ["active", "expired", "cancelled", "draft", "renewed"],
      invoice_status: ["draft", "issued", "partial", "paid", "overdue", "cancelled"],
      meter_category: ["electricity", "water"],
      payment_method: ["cash", "check", "transfer", "deposit", "wallet", "cheque"],
      payment_request_status: ["pending_review", "approved", "rejected", "cancelled"],
      payment_status: ["unpaid", "paid", "partial"],
      unit_status: ["available", "rented", "reserved", "maintenance", "inactive"],
      unit_type: ["shop", "apartment", "office", "warehouse", "land", "clinic", "other"],
    },
  },
} as const;
